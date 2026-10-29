<?php
/**
 * Plugin Name: Carcura Mail-Relay
 * Description: Lässt den Carcura-Assistenten (Claude) E-Mails über euren normalen WordPress-Mailversand (FluentSMTP → carcura@web.de) verschicken – als HTML mit Klartext-Fassung, mit Mail-Ausgang zur Freigabe, Zustimmungspflicht für Firmen-Mails, Sperrliste, Tageslimit und Protokoll.
 * Version: 1.2.0
 * Author: Carcura GbR
 * Requires PHP: 7.4
 *
 * Weg 1 – Mail-Ausgang (Werkzeuge → Carcura Mail-Relay, Menü „Mail-Ausgang“):
 *   Eintrag vom Typ cc_mail (REST: /wp/v2/carcura-mails). Titel = Betreff, Inhalt = HTML,
 *   Meta: cc_to, cc_art (kunde|b2b_einwilligung|intern|vorlage), cc_einwilligung, cc_text (optional, sonst aus HTML erzeugt).
 *   Entwurf = wird nicht gesendet. „Senden“ (Status veröffentlicht) = kommt in die Warteschlange.
 *   Ergebnis steht in cc_ergebnis. Einträge mit cc_art = vorlage werden nie gesendet.
 * Weg 2 – Endpunkt POST /wp-json/carcura-mail/v1/send (Anwendungspasswort), wie in 1.1.
 *
 * Werbung an Firmen ohne vorherige Zustimmung (§ 7 Abs. 2 Nr. 2 UWG) wird auf beiden Wegen abgelehnt.
 */

if (!defined('ABSPATH')) {
    exit;
}

const CCMR_LOG       = 'ccmr_log';
const CCMR_DAY_LIMIT = 40;      // Schutz gegen Versehen: höchstens 40 Mails pro Tag
const CCMR_GAP       = 20;      // Sekunden Mindestabstand zwischen zwei Mails
const CCMR_SELF      = 'carcura@web.de';
const CCMR_REPEAT    = 60;      // Tage: keine zweite Firmen-Mail an dieselbe Adresse
const CCMR_ARTEN     = array('kunde', 'b2b_einwilligung', 'intern');

/* ------------------------------------------------------------------ */
/* Prüfungen und Versand (für beide Wege gleich)                       */
/* ------------------------------------------------------------------ */

function ccmr_count_today() {
    $today = wp_date('Y-m-d');
    $n     = 0;
    foreach ((array) get_option(CCMR_LOG, array()) as $row) {
        if (!empty($row['ok']) && isset($row['day']) && $row['day'] === $today) {
            $n++;
        }
    }
    return $n;
}

function ccmr_sperrliste() {
    $lines = preg_split('/\R/', (string) get_option('ccmr_sperrliste', ''));
    return array_values(array_filter(array_map(function ($l) {
        return strtolower(trim($l));
    }, $lines)));
}

function ccmr_gesperrt($to) {
    $to     = strtolower($to);
    $domain = substr(strrchr($to, '@'), 1);
    foreach (ccmr_sperrliste() as $s) {
        if ($s === $to || ltrim($s, '@') === $domain) {
            return true;
        }
    }
    return false;
}

function ccmr_schon_angeschrieben($to) {
    $grenze = time() - CCMR_REPEAT * DAY_IN_SECONDS;
    foreach ((array) get_option(CCMR_LOG, array()) as $row) {
        if (!empty($row['ok']) && ($row['art'] ?? '') === 'b2b_einwilligung' && strtolower($row['to']) === strtolower($to)
            && (int) ($row['ts'] ?? 0) >= $grenze) {
            return true;
        }
    }
    return false;
}

function ccmr_klartext($html) {
    $t = preg_replace('#<(br|/p|/div|/tr|/h[1-6]|/li)[^>]*>#i', "\n", $html);
    $t = preg_replace('#<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>#is', '$2 ($1)', $t);
    $t = html_entity_decode(wp_strip_all_tags($t), ENT_QUOTES, 'UTF-8');
    $t = preg_replace("/[ \t]+/", ' ', $t);
    return trim(preg_replace("/\n\s*\n+/", "\n\n", $t));
}

/**
 * Prüft alles, was vor dem Versand feststehen muss (ohne Zeitabstand).
 * Gibt true oder WP_Error zurück.
 */
function ccmr_pruefen($m) {
    if (!in_array($m['art'], CCMR_ARTEN, true)) {
        return new WP_Error('ccmr_art', 'Art muss kunde, b2b_einwilligung oder intern sein.', array('status' => 400));
    }
    if ($m['art'] === 'b2b_einwilligung' && mb_strlen($m['consent']) < 15) {
        return new WP_Error('ccmr_consent', 'Firmen-Mail ohne dokumentierte Zustimmung abgelehnt (§ 7 UWG). Feld "einwilligung": wer hat wann wie zugestimmt?', array('status' => 422));
    }
    if (!is_email($m['to'])) {
        return new WP_Error('ccmr_to', 'Ungültige Empfängeradresse.', array('status' => 400));
    }
    if ($m['art'] !== 'intern' && ccmr_gesperrt($m['to'])) {
        return new WP_Error('ccmr_sperre', 'Adresse oder Domain steht auf der Sperrliste.', array('status' => 403));
    }
    if ($m['art'] === 'b2b_einwilligung' && ccmr_schon_angeschrieben($m['to'])) {
        return new WP_Error('ccmr_repeat', 'An diese Adresse ging in den letzten ' . CCMR_REPEAT . ' Tagen schon eine Firmen-Mail. Nachfassen per Telefon.', array('status' => 409));
    }
    if ($m['subject'] === '' || $m['text'] === '' || mb_strlen($m['subject']) > 200 || mb_strlen($m['text']) > 20000) {
        return new WP_Error('ccmr_content', 'Betreff oder Text fehlt bzw. ist zu lang.', array('status' => 400));
    }
    if ($m['html'] !== '' && mb_strlen($m['html']) > 200000) {
        return new WP_Error('ccmr_html', 'HTML zu groß.', array('status' => 400));
    }
    if (ccmr_count_today() >= CCMR_DAY_LIMIT) {
        return new WP_Error('ccmr_limit', 'Tageslimit erreicht (' . CCMR_DAY_LIMIT . ' Mails). Morgen weiter.', array('status' => 429));
    }
    return true;
}

/** Verschickt eine geprüfte Mail und schreibt das Protokoll. */
function ccmr_mail($m) {
    update_option('ccmr_last', time(), false);

    $headers   = array('Content-Type: ' . ($m['html'] !== '' ? 'text/html' : 'text/plain') . '; charset=UTF-8');
    $headers[] = 'Reply-To: Carcura <' . (is_email($m['reply']) ? $m['reply'] : CCMR_SELF) . '>';
    if ($m['bcc_self'] && strtolower($m['to']) !== CCMR_SELF) {
        $headers[] = 'Bcc: ' . CCMR_SELF;
    }

    $error = '';
    $catch = function ($e) use (&$error) {
        $error = $e->get_error_message();
    };
    // Bei HTML den Klartext als Alternative mitschicken (bessere Zustellbarkeit, lesbar ohne HTML).
    $text = $m['text'];
    $alt  = function ($phpmailer) use ($text) {
        $phpmailer->AltBody = $text;
    };
    if ($m['html'] !== '') {
        add_action('phpmailer_init', $alt);
    }
    add_action('wp_mail_failed', $catch);
    $ok = wp_mail($m['to'], $m['subject'], $m['html'] !== '' ? $m['html'] : $m['text'], $headers);
    remove_action('wp_mail_failed', $catch);
    remove_action('phpmailer_init', $alt);

    $log = get_option(CCMR_LOG, array());
    if (!is_array($log)) {
        $log = array();
    }
    array_unshift($log, array(
        'time'    => wp_date('d.m.Y H:i:s'),
        'day'     => wp_date('Y-m-d'),
        'ts'      => time(),
        'to'      => $m['to'],
        'subject' => $m['subject'],
        'ok'      => (bool) $ok,
        'error'   => $error,
        'art'     => $m['art'],
        'consent' => $m['consent'],
        'html'    => $m['html'] !== '',
        'user'    => $m['user'],
        'post'    => $m['post'] ?? 0,
    ));
    update_option(CCMR_LOG, array_slice($log, 0, 300), false);

    return $ok ? true : new WP_Error('ccmr_failed', 'Versand fehlgeschlagen: ' . ($error ?: 'unbekannt'), array('status' => 502));
}

/* ------------------------------------------------------------------ */
/* Weg 2: REST-Endpunkt (wie 1.1)                                      */
/* ------------------------------------------------------------------ */

add_action('rest_api_init', function () {
    $admin = function () {
        return current_user_can('manage_options');
    };
    register_rest_route('carcura-mail/v1', '/send', array(
        'methods'             => 'POST',
        'permission_callback' => $admin,
        'callback'            => 'ccmr_send',
        'args'                => array(
            'to'           => array('required' => true, 'type' => 'string'),
            'subject'      => array('required' => true, 'type' => 'string'),
            'text'         => array('type' => 'string'),
            'html'         => array('type' => 'string'),
            'art'          => array('required' => true, 'type' => 'string', 'enum' => CCMR_ARTEN),
            'einwilligung' => array('type' => 'string'),
            'reply_to'     => array('type' => 'string'),
            'bcc_self'     => array('type' => 'boolean', 'default' => true),
        ),
    ));
    register_rest_route('carcura-mail/v1', '/status', array(
        'methods'             => 'GET',
        'permission_callback' => $admin,
        'callback'            => function () {
            return array('ok' => true, 'version' => '1.2.0', 'heute_gesendet' => ccmr_count_today(), 'tageslimit' => CCMR_DAY_LIMIT, 'warteschlange' => count(ccmr_queue_ids()), 'absender' => get_option('admin_email'));
        },
    ));
});

function ccmr_send(WP_REST_Request $req) {
    $html = trim((string) $req->get_param('html'));
    $text = trim((string) $req->get_param('text'));
    $m    = array(
        'to'       => sanitize_email($req->get_param('to')),
        'subject'  => trim(wp_strip_all_tags((string) $req->get_param('subject'))),
        'text'     => $text !== '' ? $text : ccmr_klartext($html),
        'html'     => $html,
        'art'      => (string) $req->get_param('art'),
        'consent'  => trim(wp_strip_all_tags((string) $req->get_param('einwilligung'))),
        'reply'    => sanitize_email((string) $req->get_param('reply_to')),
        'bcc_self' => $req->get_param('bcc_self') !== false,
        'user'     => wp_get_current_user()->user_login,
    );
    $check = ccmr_pruefen($m);
    if (is_wp_error($check)) {
        return $check;
    }
    $last = (int) get_option('ccmr_last', 0);
    if (time() - $last < CCMR_GAP) {
        return new WP_Error('ccmr_gap', 'Bitte ' . CCMR_GAP . ' Sekunden Abstand zwischen zwei Mails.', array('status' => 429, 'retry_after' => CCMR_GAP - (time() - $last)));
    }
    $ok = ccmr_mail($m);
    return is_wp_error($ok) ? $ok : array('ok' => true, 'to' => $m['to'], 'heute_gesendet' => ccmr_count_today());
}

/* ------------------------------------------------------------------ */
/* Weg 1: Mail-Ausgang (Beitragstyp cc_mail)                           */
/* ------------------------------------------------------------------ */

const CCMR_META = array('cc_to', 'cc_art', 'cc_einwilligung', 'cc_text', 'cc_ergebnis');

add_action('init', function () {
    register_post_type('cc_mail', array(
        'labels'          => array(
            'name'          => 'Mail-Ausgang',
            'singular_name' => 'Mail',
            'add_new_item'  => 'Neue Mail',
            'edit_item'     => 'Mail prüfen',
            'menu_name'     => 'Mail-Ausgang',
        ),
        'public'          => false,
        'show_ui'         => true,
        'show_in_menu'    => true,
        'menu_icon'       => 'dashicons-email-alt',
        'show_in_rest'    => true,
        'rest_base'       => 'carcura-mails',
        'supports'        => array('title', 'editor', 'custom-fields'),
        'capability_type' => 'page',
        'map_meta_cap'    => true,
        'capabilities'    => array('create_posts' => 'manage_options'),
    ));
    foreach (CCMR_META as $key) {
        register_post_meta('cc_mail', $key, array(
            'type'          => 'string',
            'single'        => true,
            'show_in_rest'  => true,
            'auth_callback' => function () {
                return current_user_can('manage_options');
            },
        ));
    }
});

// Nur Administratoren dürfen Mails anlegen, ändern oder senden.
add_filter('rest_pre_dispatch', function ($result, $server, $request) {
    if (strpos($request->get_route(), '/wp/v2/carcura-mails') === 0 && !current_user_can('manage_options')) {
        return new WP_Error('rest_forbidden', 'Nur für Administratoren.', array('status' => 403));
    }
    return $result;
}, 10, 3);

// HTML-Mails im einfachen Textfeld bearbeiten, nicht im Block-Editor.
add_filter('use_block_editor_for_post_type', function ($use, $type) {
    return $type === 'cc_mail' ? false : $use;
}, 10, 2);
add_filter('user_can_richedit', function ($can) {
    return get_post_type() === 'cc_mail' ? false : $can;
});

function ccmr_from_post($post) {
    $html = trim((string) $post->post_content);
    $text = trim((string) get_post_meta($post->ID, 'cc_text', true));
    return array(
        'to'       => sanitize_email((string) get_post_meta($post->ID, 'cc_to', true)),
        'subject'  => trim(wp_strip_all_tags($post->post_title)),
        'text'     => $text !== '' ? $text : ccmr_klartext($html),
        'html'     => $html,
        'art'      => (string) get_post_meta($post->ID, 'cc_art', true),
        'consent'  => trim(wp_strip_all_tags((string) get_post_meta($post->ID, 'cc_einwilligung', true))),
        'reply'    => CCMR_SELF,
        'bcc_self' => true,
        'user'     => (string) get_post_meta($post->ID, '_ccmr_freigabe', true),
        'post'     => $post->ID,
    );
}

function ccmr_zurueck_zum_entwurf($id, $msg) {
    update_post_meta($id, 'cc_ergebnis', '❌ ' . $msg . ' (' . wp_date('d.m.Y H:i') . ')');
    delete_post_meta($id, '_ccmr_queue');
    wp_update_post(array('ID' => $id, 'post_status' => 'draft'));
}

// „Senden“ = Veröffentlichen: prüfen und in die Warteschlange stellen.
// wp_after_insert_post läuft erst, nachdem auch die Felder (REST-Meta bzw. Formular) gespeichert sind.
add_action('wp_after_insert_post', function ($id, $post, $update, $before) {
    if ($post->post_type !== 'cc_mail' || $post->post_status !== 'publish' || ($before && $before->post_status === 'publish')) {
        return;
    }
    if (get_post_meta($id, '_ccmr_gesendet', true)) {
        return; // schon einmal verschickt, nie doppelt senden
    }
    if (get_post_meta($id, 'cc_art', true) === 'vorlage') {
        ccmr_zurueck_zum_entwurf($id, 'Vorlagen werden nie gesendet.');
        return;
    }
    update_post_meta($id, '_ccmr_freigabe', wp_get_current_user()->user_login ?: 'unbekannt');
    $check = ccmr_pruefen(ccmr_from_post($post));
    if (is_wp_error($check)) {
        ccmr_zurueck_zum_entwurf($id, $check->get_error_message());
        return;
    }
    update_post_meta($id, '_ccmr_queue', time());
    update_post_meta($id, 'cc_ergebnis', '⏳ in der Warteschlange (' . wp_date('d.m.Y H:i') . ')');
    ccmr_process_queue(); // erste Mail sofort, falls der Abstand passt; sonst plant sich die Warteschlange selbst ein
}, 10, 4);

function ccmr_queue_ids() {
    return get_posts(array(
        'post_type'   => 'cc_mail',
        'post_status' => 'publish',
        'meta_key'    => '_ccmr_queue',
        'orderby'     => 'meta_value_num',
        'order'       => 'ASC',
        'fields'      => 'ids',
        'numberposts' => 100,
    ));
}

// Eine Mail pro Durchlauf, danach frühestens nach CCMR_GAP Sekunden die nächste.
function ccmr_process_queue() {
    $ids = ccmr_queue_ids();
    if (!$ids) {
        return;
    }
    // Sperre gegen zwei gleichzeitige Durchläufe (Seitenaufruf + Cron), sonst droht doppelter Versand.
    if (!add_option('ccmr_lock', time(), '', false)) {
        if (time() - (int) get_option('ccmr_lock') < 120) {
            if (!wp_next_scheduled('ccmr_process_queue')) {
                wp_schedule_single_event(time() + CCMR_GAP, 'ccmr_process_queue');
            }
            return;
        }
        update_option('ccmr_lock', time(), false);
    }
    $wait = CCMR_GAP - (time() - (int) get_option('ccmr_last', 0));
    if ($wait <= 0) {
        $id   = array_shift($ids);
        $post = get_post($id);
        $m    = ccmr_from_post($post);
        $res  = ccmr_pruefen($m); // nochmals, z. B. Tageslimit oder Sperrliste inzwischen geändert
        if (!is_wp_error($res)) {
            $res = ccmr_mail($m);
        }
        if (is_wp_error($res)) {
            ccmr_zurueck_zum_entwurf($id, $res->get_error_message());
        } else {
            delete_post_meta($id, '_ccmr_queue');
            update_post_meta($id, '_ccmr_gesendet', time());
            update_post_meta($id, 'cc_ergebnis', '✅ gesendet ' . wp_date('d.m.Y H:i') . ' an ' . $m['to']);
        }
        $wait = CCMR_GAP;
    }
    delete_option('ccmr_lock');
    if ($ids && !wp_next_scheduled('ccmr_process_queue')) {
        wp_schedule_single_event(time() + max(1, $wait), 'ccmr_process_queue');
    }
}
add_action('ccmr_process_queue', 'ccmr_process_queue');

// Eine verschickte Mail bleibt unverändert als Nachweis.
add_filter('wp_insert_post_data', function ($data, $postarr) {
    if ($data['post_type'] === 'cc_mail' && !empty($postarr['ID']) && get_post_meta($postarr['ID'], '_ccmr_gesendet', true)) {
        $old                   = get_post($postarr['ID']);
        $data['post_title']    = $old->post_title;
        $data['post_content']  = $old->post_content;
        if ($data['post_status'] !== 'trash') {
            $data['post_status'] = 'publish';
        }
    }
    return $data;
}, 10, 2);

/* ---------- Bearbeitungsseite: Felder, Vorschau, Senden-Knopf ---------- */

add_action('add_meta_boxes_cc_mail', function () {
    add_meta_box('ccmr_felder', 'Empfänger & Zustimmung', 'ccmr_box_felder', 'cc_mail', 'normal', 'high');
    add_meta_box('ccmr_vorschau', 'Vorschau', 'ccmr_box_vorschau', 'cc_mail', 'normal', 'default');
    remove_meta_box('postcustom', 'cc_mail', 'normal');
});

function ccmr_box_felder($post) {
    wp_nonce_field('ccmr_save', 'ccmr_nonce');
    $v = function ($k) use ($post) {
        return esc_attr((string) get_post_meta($post->ID, $k, true));
    };
    $art = (string) get_post_meta($post->ID, 'cc_art', true);
    echo '<p><label><strong>An</strong><br><input type="email" name="cc_to" value="' . $v('cc_to') . '" class="widefat"></label></p>';
    echo '<p><label><strong>Art</strong><br><select name="cc_art">';
    foreach (array('' => '– bitte wählen –', 'b2b_einwilligung' => 'Firma mit Zustimmung', 'kunde' => 'Kunde (Antwort auf Anfrage)', 'intern' => 'Intern', 'vorlage' => 'Vorlage (wird nie gesendet)') as $k => $l) {
        echo '<option value="' . esc_attr($k) . '"' . selected($art, $k, false) . '>' . esc_html($l) . '</option>';
    }
    echo '</select></label></p>';
    echo '<p><label><strong>Zustimmung</strong> (bei Firmen Pflicht: wer, wann, wie)<br><input type="text" name="cc_einwilligung" value="' . $v('cc_einwilligung') . '" class="widefat" placeholder="Telefonat 28.10.2026, Herr Y stimmt Infos per Mail zu (Alex)"></label></p>';
    echo '<p><label><strong>Klartext-Fassung</strong> (leer = wird aus dem HTML erzeugt)<br><textarea name="cc_text" rows="5" class="widefat">' . esc_textarea((string) get_post_meta($post->ID, 'cc_text', true)) . '</textarea></label></p>';
    $erg = (string) get_post_meta($post->ID, 'cc_ergebnis', true);
    if ($erg !== '') {
        echo '<p><strong>Ergebnis:</strong> ' . esc_html($erg) . '</p>';
    }
    echo '<p class="description">„Senden“ (rechts) stellt die Mail in die Warteschlange. Abstand ' . CCMR_GAP . ' s, höchstens ' . CCMR_DAY_LIMIT . ' pro Tag, Blindkopie an ' . CCMR_SELF . '.</p>';
}

function ccmr_box_vorschau($post) {
    if (trim($post->post_content) === '') {
        echo '<p>Noch kein HTML.</p>';
        return;
    }
    echo '<iframe sandbox="" style="width:100%;height:700px;border:1px solid #ddd;background:#fff" srcdoc="' . esc_attr($post->post_content) . '"></iframe>';
}

add_action('save_post_cc_mail', function ($id) {
    if (!isset($_POST['ccmr_nonce']) || !wp_verify_nonce($_POST['ccmr_nonce'], 'ccmr_save') || !current_user_can('manage_options')) {
        return;
    }
    if (get_post_meta($id, '_ccmr_gesendet', true)) {
        return;
    }
    update_post_meta($id, 'cc_to', sanitize_email(wp_unslash($_POST['cc_to'] ?? '')));
    $art = sanitize_key(wp_unslash($_POST['cc_art'] ?? ''));
    update_post_meta($id, 'cc_art', in_array($art, array_merge(CCMR_ARTEN, array('vorlage')), true) ? $art : '');
    update_post_meta($id, 'cc_einwilligung', sanitize_text_field(wp_unslash($_POST['cc_einwilligung'] ?? '')));
    update_post_meta($id, 'cc_text', sanitize_textarea_field(wp_unslash($_POST['cc_text'] ?? '')));
}, 5);

// Der Knopf heißt „Senden“ statt „Veröffentlichen“.
add_filter('gettext', function ($t, $orig) {
    if (is_admin() && get_post_type() === 'cc_mail') {
        if ($orig === 'Publish') {
            return 'Senden';
        }
        if ($orig === 'Update' && get_post_meta(get_the_ID(), '_ccmr_gesendet', true)) {
            return 'Gesendet';
        }
    }
    return $t;
}, 10, 2);

// Spalten in der Übersicht.
add_filter('manage_cc_mail_posts_columns', function ($c) {
    return array('cb' => $c['cb'], 'title' => 'Betreff', 'cc_to' => 'An', 'cc_art' => 'Art', 'cc_ergebnis' => 'Ergebnis', 'date' => 'Datum');
});
add_action('manage_cc_mail_posts_custom_column', function ($col, $id) {
    echo esc_html((string) get_post_meta($id, $col, true));
}, 10, 2);

/* ------------------------------------------------------------------ */
/* Protokoll und Sperrliste (Werkzeuge → Carcura Mail-Relay)           */
/* ------------------------------------------------------------------ */

add_action('admin_menu', function () {
    add_management_page('Carcura Mail-Relay', 'Carcura Mail-Relay', 'manage_options', 'carcura-mail-relay', function () {
        if (isset($_POST['ccmr_sperre_nonce']) && wp_verify_nonce($_POST['ccmr_sperre_nonce'], 'ccmr_sperre')) {
            update_option('ccmr_sperrliste', sanitize_textarea_field(wp_unslash($_POST['ccmr_sperrliste'] ?? '')), false);
            echo '<div class="notice notice-success"><p>Sperrliste gespeichert.</p></div>';
        }
        $log = (array) get_option(CCMR_LOG, array());
        echo '<div class="wrap"><h1>Carcura Mail-Relay 1.2</h1>';
        echo '<p>Heute gesendet: <strong>' . esc_html(ccmr_count_today()) . ' / ' . esc_html(CCMR_DAY_LIMIT) . '</strong> · Warteschlange: <strong>' . esc_html(count(ccmr_queue_ids())) . '</strong> · Jede Mail geht zusätzlich als Blindkopie an ' . esc_html(CCMR_SELF) . '.</p>';
        echo '<p>Entwürfe prüfen und senden: <a href="' . esc_url(admin_url('edit.php?post_type=cc_mail&post_status=draft')) . '">Mail-Ausgang → Entwürfe</a></p>';

        echo '<h2>Sperrliste</h2><p>Eine Adresse oder Domain pro Zeile (z. B. <code>info@autohaus.de</code> oder <code>@autohaus.de</code>). Wer „kein Interesse“ sagt, kommt hierher und bekommt nie wieder eine Mail.</p>';
        echo '<form method="post">';
        wp_nonce_field('ccmr_sperre', 'ccmr_sperre_nonce');
        echo '<textarea name="ccmr_sperrliste" rows="6" class="large-text code">' . esc_textarea((string) get_option('ccmr_sperrliste', '')) . '</textarea>';
        submit_button('Sperrliste speichern');
        echo '</form>';

        echo '<h2>Protokoll</h2>';
        if (!$log) {
            echo '<p>Noch keine Mails.</p></div>';
            return;
        }
        echo '<table class="widefat striped" style="max-width:1100px"><thead><tr><th>Zeit</th><th>An</th><th>Betreff</th><th>Art</th><th>Zustimmung</th><th>Ergebnis</th><th>Freigabe</th></tr></thead><tbody>';
        foreach ($log as $r) {
            echo '<tr><td>' . esc_html($r['time']) . '</td><td>' . esc_html($r['to']) . '</td><td>' . esc_html($r['subject']) . '</td><td>' . esc_html($r['art'] ?? '') . '</td><td>' . esc_html($r['consent'] ?? '') . '</td><td>' . ($r['ok'] ? '✅' : '❌ ' . esc_html($r['error'])) . '</td><td>' . esc_html($r['user']) . '</td></tr>';
        }
        echo '</tbody></table></div>';
    });
});
