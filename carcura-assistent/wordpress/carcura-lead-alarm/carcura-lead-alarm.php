<?php
/**
 * Plugin Name: Carcura Lead-Alarm
 * Description: Schickt jede neue Website-Anfrage sofort in eure Telegram-Gruppe (Alex + Richy), mit allen Kundendaten, gewählten Leistungen, Richtwert und WhatsApp-Knopf. Optional zusätzlich per E-Mail. Unabhängig davon, was das Revenue-Plugin speichert.
 * Version: 1.0.0
 * Author: Carcura GbR
 * Requires PHP: 7.4
 *
 * Einrichtung: Werkzeuge → Carcura Lead-Alarm.
 */

if (!defined('ABSPATH')) {
    exit;
}

const CCLA_OPTION = 'ccla_settings';
const CCLA_LOG    = 'ccla_log';
const CCLA_ROUTES = array('/ccrr/v1/lead', '/ccrr/v1/fleet-lead', '/ccrr/v1/meta-lead');

function ccla_settings() {
    $s = get_option(CCLA_OPTION, array());
    return wp_parse_args(is_array($s) ? $s : array(), array(
        'token'   => '',
        'chat_id' => '',
        'emails'  => '',
    ));
}

/* ---------------------------------------------------------------------
 * 1. Anfragen abgreifen – nach erfolgreicher Verarbeitung durch das Plugin
 * ------------------------------------------------------------------- */

add_filter('rest_request_after_callbacks', function ($response, $handler, $request) {
    if (!($request instanceof WP_REST_Request) || !in_array($request->get_route(), CCLA_ROUTES, true)) {
        return $response;
    }
    if (is_wp_error($response)) {
        return $response;
    }
    $status = ($response instanceof WP_REST_Response) ? $response->get_status() : 200;
    if ($status < 200 || $status >= 300) {
        return $response;
    }
    $data = ($response instanceof WP_REST_Response) ? $response->get_data() : $response;
    if (is_array($data) && array_key_exists('ok', $data) && $data['ok'] === false) {
        return $response; // vom Spam-Schutz abgelehnt
    }

    $params = $request->get_json_params();
    if (!is_array($params) || !$params) {
        $params = $request->get_params();
    }
    if (!empty($params['website'])) {
        return $response; // Honeypot ausgefüllt → Bot
    }

    $lead = ccla_normalize($params, $request->get_route());
    if ($lead['email'] === '' && $lead['phone'] === '') {
        return $response;
    }

    // Doppelte Meldungen (gleiche Person, gleiche Leistung) innerhalb von 2 Minuten unterdrücken.
    $key = 'ccla_' . md5(strtolower($lead['email']) . '|' . preg_replace('/\D/', '', $lead['phone']) . '|' . $lead['service']);
    if (get_transient($key)) {
        return $response;
    }
    set_transient($key, 1, 2 * MINUTE_IN_SECONDS);

    // Erst nach der Antwort an den Kunden senden – das Formular wartet nicht auf Telegram.
    add_action('shutdown', function () use ($lead) {
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        }
        ccla_dispatch($lead);
    });

    return $response;
}, 20, 3);

function ccla_normalize(array $p, $route) {
    $str = function ($k) use ($p) {
        return isset($p[$k]) && is_scalar($p[$k]) ? trim((string) $p[$k]) : '';
    };
    $lead = array(
        'name'          => $str('name'),
        'email'         => $str('email'),
        'phone'         => $str('phone'),
        'vehicle'       => $str('vehicle'),
        'service'       => $str('service'),
        'message'       => $str('message'),
        'customer_type' => $str('customer_type'),
        'source'        => $str('source'),
        'ads'           => $str('gclid') !== '',
        'route'         => $route,
        'extra'         => array(),
    );
    // Weitere Felder (z. B. Firmenkunden-Formular) unverändert mitnehmen.
    $skip = array('name', 'email', 'phone', 'vehicle', 'service', 'message', 'customer_type', 'source', 'gclid', 'website', 'channel', '_wpnonce', 'rest_route');
    foreach ($p as $k => $v) {
        if (in_array($k, $skip, true) || !is_scalar($v) || trim((string) $v) === '') {
            continue;
        }
        $lead['extra'][$k] = trim((string) $v);
    }
    if ($lead['phone'] === '' && isset($lead['extra']['telefon'])) {
        $lead['phone'] = $lead['extra']['telefon'];
    }
    return $lead;
}

/* ---------------------------------------------------------------------
 * 2. Versand
 * ------------------------------------------------------------------- */

function ccla_dispatch(array $lead) {
    $s = ccla_settings();
    if ($s['token'] !== '' && $s['chat_id'] !== '') {
        $r = ccla_telegram_send($s['token'], $s['chat_id'], ccla_format_telegram($lead), ccla_buttons($lead));
        ccla_log('Telegram', $r === true ? 'ok' : $r, $lead);
    }
    $emails = ccla_email_list($s['emails']);
    if ($emails) {
        $headers = array('Content-Type: text/plain; charset=UTF-8');
        if (is_email($lead['email'])) {
            $headers[] = 'Reply-To: ' . ($lead['name'] !== '' ? str_replace(array("\r", "\n", '<', '>'), '', $lead['name']) . ' ' : '') . '<' . $lead['email'] . '>';
        }
        $ok = wp_mail($emails, ccla_subject($lead), ccla_format_text($lead), $headers);
        ccla_log('E-Mail', $ok ? 'ok' : 'wp_mail fehlgeschlagen', $lead);
    }
}

function ccla_email_list($raw) {
    $out = array();
    foreach (preg_split('/[\s,;]+/', (string) $raw) as $e) {
        if (is_email($e)) {
            $out[] = $e;
        }
    }
    return $out;
}

function ccla_wa_number($phone) {
    $d = preg_replace('/\D/', '', (string) $phone);
    if ($d === '') {
        return '';
    }
    if (strpos($d, '00') === 0) {
        $d = substr($d, 2);
    } elseif (strpos($d, '0') === 0) {
        $d = '49' . substr($d, 1);
    }
    if (strpos($d, '490') === 0) {
        $d = '49' . substr($d, 3); // „+49 (0)170 …“
    }
    return strlen($d) >= 9 ? $d : '';
}

function ccla_first_name($name) {
    $parts = preg_split('/\s+/', trim((string) $name));
    return $parts && $parts[0] !== '' ? $parts[0] : '';
}

function ccla_short_service($service) {
    $first = trim(explode(',', (string) $service)[0]);
    return $first !== '' ? $first : 'Anfrage';
}

function ccla_subject(array $lead) {
    return 'Neue Anfrage: ' . ccla_short_service($lead['service']) . ($lead['name'] !== '' ? ' – ' . $lead['name'] : '');
}

function ccla_label($route, $source) {
    if ($route === '/ccrr/v1/fleet-lead') {
        return 'Firmenkunden-Portal';
    }
    if ($route === '/ccrr/v1/meta-lead') {
        return 'Meta-Lead';
    }
    return $source === 'anfrage_formular' ? 'Anfrageformular' : ($source !== '' ? $source : 'Website');
}

function ccla_h($s) {
    return htmlspecialchars((string) $s, ENT_NOQUOTES, 'UTF-8');
}

function ccla_format_telegram(array $lead) {
    $t   = array();
    $t[] = '🚗 <b>Neue Anfrage</b> – ' . ccla_h(ccla_short_service($lead['service']));
    $t[] = '';
    if ($lead['name'] !== '') {
        $t[] = '👤 <b>' . ccla_h($lead['name']) . '</b>' . ($lead['customer_type'] === 'firma' ? ' (Firma)' : '');
    }
    if ($lead['phone'] !== '') {
        $t[] = '📞 ' . ccla_h($lead['phone']);
    }
    if ($lead['email'] !== '') {
        $t[] = '✉️ ' . ccla_h($lead['email']);
    }
    if ($lead['vehicle'] !== '') {
        $t[] = '🚘 ' . ccla_h($lead['vehicle']);
    }
    $t[] = '';
    if ($lead['message'] !== '') {
        $t[] = ccla_h($lead['message']);
    } elseif ($lead['service'] !== '') {
        $t[] = 'Leistungen: ' . ccla_h($lead['service']);
    }
    foreach ($lead['extra'] as $k => $v) {
        $t[] = ccla_h(ucfirst(str_replace('_', ' ', $k))) . ': ' . ccla_h($v);
    }
    $t[] = '';
    $meta = 'Quelle: ' . ccla_label($lead['route'], $lead['source']);
    if ($lead['ads']) {
        $meta .= ' · über Google Ads';
    }
    $t[] = '<i>' . ccla_h($meta . ' · ' . wp_date('d.m. H:i')) . '</i>';
    $t[] = '<i>Wer übernimmt? Kurz 👍 drauf, dann weiß der andere Bescheid.</i>';

    $msg = trim(implode("\n", $t));
    if (mb_strlen($msg) > 3900) {
        $msg = mb_substr($msg, 0, 3900) . '…';
    }
    return $msg;
}

function ccla_buttons(array $lead) {
    $row = array();
    $wa  = ccla_wa_number($lead['phone']);
    if ($wa !== '') {
        $vor  = ccla_first_name($lead['name']);
        $text = 'Hi' . ($vor !== '' ? ' ' . $vor : '') . ', hier ist Carcura – danke für deine Anfrage (' . ccla_short_service($lead['service']) . ')! Wann würde es dir passen?';
        $row[] = array('text' => '💬 WhatsApp an Kunden', 'url' => 'https://wa.me/' . $wa . '?text=' . rawurlencode($text));
    }
    $row[] = array('text' => '📋 Im WordPress', 'url' => admin_url());
    return array('inline_keyboard' => array($row));
}

function ccla_format_text(array $lead) {
    $plain = wp_strip_all_tags(str_replace(array('<b>', '</b>', '<i>', '</i>'), '', ccla_format_telegram($lead)));
    $plain = html_entity_decode($plain, ENT_QUOTES, 'UTF-8');
    $wa    = ccla_wa_number($lead['phone']);
    if ($wa !== '') {
        $plain .= "\n\nWhatsApp: https://wa.me/" . $wa;
    }
    return $plain;
}

function ccla_telegram_send($token, $chat_id, $text, $markup = null) {
    $body = array(
        'chat_id'                  => $chat_id,
        'text'                     => $text,
        'parse_mode'               => 'HTML',
        'disable_web_page_preview' => true,
    );
    if ($markup) {
        $body['reply_markup'] = wp_json_encode($markup);
    }
    $res = wp_remote_post('https://api.telegram.org/bot' . rawurlencode($token) . '/sendMessage', array(
        'timeout' => 8,
        'body'    => $body,
    ));
    if (is_wp_error($res)) {
        return $res->get_error_message();
    }
    $json = json_decode(wp_remote_retrieve_body($res), true);
    if (is_array($json) && !empty($json['ok'])) {
        return true;
    }
    // Fallback ohne Formatierung, falls Telegram das HTML ablehnt.
    if (isset($json['description']) && stripos($json['description'], 'parse') !== false) {
        unset($body['parse_mode']);
        $body['text'] = html_entity_decode(wp_strip_all_tags($text), ENT_QUOTES, 'UTF-8');
        $res2 = wp_remote_post('https://api.telegram.org/bot' . rawurlencode($token) . '/sendMessage', array('timeout' => 8, 'body' => $body));
        $json2 = is_wp_error($res2) ? null : json_decode(wp_remote_retrieve_body($res2), true);
        if (is_array($json2) && !empty($json2['ok'])) {
            return true;
        }
    }
    return isset($json['description']) ? (string) $json['description'] : 'HTTP ' . wp_remote_retrieve_response_code($res);
}

function ccla_log($channel, $result, array $lead) {
    $log = get_option(CCLA_LOG, array());
    if (!is_array($log)) {
        $log = array();
    }
    array_unshift($log, array(
        'time'    => wp_date('d.m.Y H:i:s'),
        'channel' => $channel,
        'result'  => $result,
        'who'     => $lead['name'] !== '' ? $lead['name'] : ($lead['email'] !== '' ? $lead['email'] : $lead['phone']),
    ));
    update_option(CCLA_LOG, array_slice($log, 0, 20), false);
}

/* ---------------------------------------------------------------------
 * 3. Einstellungsseite: Werkzeuge → Carcura Lead-Alarm
 * ------------------------------------------------------------------- */

add_action('admin_menu', function () {
    add_management_page('Carcura Lead-Alarm', 'Carcura Lead-Alarm', 'manage_options', 'carcura-lead-alarm', 'ccla_admin_page');
});

add_filter('plugin_action_links_' . plugin_basename(__FILE__), function ($links) {
    array_unshift($links, '<a href="' . esc_url(admin_url('tools.php?page=carcura-lead-alarm')) . '">Einrichten</a>');
    return $links;
});

function ccla_admin_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $s      = ccla_settings();
    $notice = '';
    $chats  = array();

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && check_admin_referer('ccla_admin')) {
        $action = isset($_POST['ccla_action']) ? sanitize_key(wp_unslash($_POST['ccla_action'])) : '';
        $s['token']   = isset($_POST['token']) ? trim(sanitize_text_field(wp_unslash($_POST['token']))) : $s['token'];
        $s['chat_id'] = isset($_POST['chat_id']) ? trim(sanitize_text_field(wp_unslash($_POST['chat_id']))) : $s['chat_id'];
        $s['emails']  = isset($_POST['emails']) ? implode(', ', ccla_email_list(wp_unslash($_POST['emails']))) : $s['emails'];
        update_option(CCLA_OPTION, $s, false);
        $notice = 'Gespeichert.';

        if ($action === 'find' && $s['token'] !== '') {
            $res  = wp_remote_get('https://api.telegram.org/bot' . rawurlencode($s['token']) . '/getUpdates', array('timeout' => 10));
            $json = is_wp_error($res) ? null : json_decode(wp_remote_retrieve_body($res), true);
            if (!is_array($json) || empty($json['ok'])) {
                $notice = 'Telegram meldet einen Fehler – stimmt der Bot-Token?';
            } else {
                foreach ($json['result'] as $u) {
                    foreach (array('message', 'my_chat_member', 'channel_post') as $k) {
                        if (isset($u[$k]['chat']['id'])) {
                            $c = $u[$k]['chat'];
                            $chats[(string) $c['id']] = isset($c['title']) ? $c['title'] : trim((isset($c['first_name']) ? $c['first_name'] : '') . ' ' . (isset($c['last_name']) ? $c['last_name'] : ''));
                        }
                    }
                }
                $notice = $chats ? 'Gefundene Chats unten – die Gruppe hat eine Nummer mit Minus davor.' : 'Noch keine Chats gefunden. Schreibt in der Gruppe einmal „/start“ und klickt dann erneut.';
            }
        } elseif ($action === 'test') {
            $lead = array(
                'name' => 'Max Mustermann (TEST)', 'email' => 'max@example.com', 'phone' => '0170 1234567',
                'vehicle' => 'VW Golf 7', 'service' => 'Basic Innen & Außen',
                'message' => "Gewählte Leistungen:\n• Basic Innen & Außen\nRichtwert: ab 145 €\n\nWunschtermin: Samstag vormittags",
                'customer_type' => 'privat', 'source' => 'anfrage_formular', 'ads' => true,
                'route' => '/ccrr/v1/lead', 'extra' => array(),
            );
            ccla_dispatch($lead);
            $log    = get_option(CCLA_LOG, array());
            $notice = 'Testnachricht verschickt. Ergebnis: ' . (isset($log[0]) ? $log[0]['channel'] . ' → ' . $log[0]['result'] : 'nichts eingerichtet');
        }
    }

    $log = get_option(CCLA_LOG, array());
    ?>
    <div class="wrap">
        <h1>Carcura Lead-Alarm</h1>
        <p>Jede Website-Anfrage landet sofort in eurer Telegram-Gruppe – mit Name, Telefon, Leistungen, Richtwert und einem Knopf, der direkt WhatsApp mit dem Kunden öffnet.</p>
        <?php if ($notice) : ?>
            <div class="notice notice-info"><p><?php echo esc_html($notice); ?></p></div>
        <?php endif; ?>

        <form method="post">
            <?php wp_nonce_field('ccla_admin'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="ccla_token">Telegram-Bot-Token</label></th>
                    <td><input name="token" id="ccla_token" type="password" class="regular-text" autocomplete="off" value="<?php echo esc_attr($s['token']); ?>">
                        <p class="description">Von @BotFather, sieht aus wie <code>123456789:ABC…</code></p></td>
                </tr>
                <tr>
                    <th scope="row"><label for="ccla_chat">Chat-ID der Gruppe</label></th>
                    <td><input name="chat_id" id="ccla_chat" type="text" class="regular-text" value="<?php echo esc_attr($s['chat_id']); ?>">
                        <p class="description">Mit „Chat-ID suchen“ automatisch finden.</p></td>
                </tr>
                <tr>
                    <th scope="row"><label for="ccla_emails">Zusätzlich per E-Mail an</label></th>
                    <td><input name="emails" id="ccla_emails" type="text" class="regular-text" value="<?php echo esc_attr($s['emails']); ?>">
                        <p class="description">Optional, mehrere mit Komma trennen. Läuft über euer FluentSMTP.</p></td>
                </tr>
            </table>
            <p>
                <button class="button button-primary" name="ccla_action" value="save">Speichern</button>
                <button class="button" name="ccla_action" value="find">Chat-ID suchen</button>
                <button class="button" name="ccla_action" value="test">Testnachricht senden</button>
            </p>
        </form>

        <?php if ($chats) : ?>
            <h2>Gefundene Chats</h2>
            <table class="widefat striped" style="max-width:600px">
                <thead><tr><th>Chat-ID</th><th>Name</th></tr></thead>
                <tbody>
                <?php foreach ($chats as $id => $title) : ?>
                    <tr><td><code><?php echo esc_html($id); ?></code></td><td><?php echo esc_html($title); ?></td></tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>

        <h2>Letzte Zustellungen</h2>
        <?php if (!$log) : ?>
            <p>Noch keine.</p>
        <?php else : ?>
            <table class="widefat striped" style="max-width:800px">
                <thead><tr><th>Zeit</th><th>Kanal</th><th>Kunde</th><th>Ergebnis</th></tr></thead>
                <tbody>
                <?php foreach ($log as $row) : ?>
                    <tr>
                        <td><?php echo esc_html($row['time']); ?></td>
                        <td><?php echo esc_html($row['channel']); ?></td>
                        <td><?php echo esc_html($row['who']); ?></td>
                        <td><?php echo esc_html($row['result']); ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </div>
    <?php
}
