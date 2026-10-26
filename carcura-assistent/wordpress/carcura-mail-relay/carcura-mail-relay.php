<?php
/**
 * Plugin Name: Carcura Mail-Relay
 * Description: Lässt den Carcura-Assistenten (Claude) E-Mails über euren normalen WordPress-Mailversand (FluentSMTP → carcura@web.de) verschicken. Nur für angemeldete Administratoren per Anwendungspasswort, mit Tageslimit und Protokoll.
 * Version: 1.0.0
 * Author: Carcura GbR
 * Requires PHP: 7.4
 *
 * Endpunkt: POST /wp-json/carcura-mail/v1/send
 *   { "to": "kunde@example.com", "subject": "…", "text": "…", "reply_to": "carcura@web.de", "bcc_self": true }
 * Protokoll: Werkzeuge → Carcura Mail-Relay
 */

if (!defined('ABSPATH')) {
    exit;
}

const CCMR_LOG       = 'ccmr_log';
const CCMR_DAY_LIMIT = 40;      // Schutz gegen Versehen: höchstens 40 Mails pro Tag
const CCMR_GAP       = 20;      // Sekunden Mindestabstand zwischen zwei Mails
const CCMR_SELF      = 'carcura@web.de';

add_action('rest_api_init', function () {
    register_rest_route('carcura-mail/v1', '/send', array(
        'methods'             => 'POST',
        'permission_callback' => function () {
            return current_user_can('manage_options');
        },
        'callback'            => 'ccmr_send',
        'args'                => array(
            'to'       => array('required' => true, 'type' => 'string'),
            'subject'  => array('required' => true, 'type' => 'string'),
            'text'     => array('required' => true, 'type' => 'string'),
            'reply_to' => array('type' => 'string'),
            'bcc_self' => array('type' => 'boolean', 'default' => true),
        ),
    ));
    register_rest_route('carcura-mail/v1', '/status', array(
        'methods'             => 'GET',
        'permission_callback' => function () {
            return current_user_can('manage_options');
        },
        'callback'            => function () {
            return array('ok' => true, 'heute_gesendet' => ccmr_count_today(), 'tageslimit' => CCMR_DAY_LIMIT, 'absender' => get_option('admin_email'));
        },
    ));
});

function ccmr_count_today() {
    $log   = get_option(CCMR_LOG, array());
    $today = wp_date('Y-m-d');
    $n     = 0;
    foreach ((array) $log as $row) {
        if (isset($row['ok'], $row['day']) && $row['ok'] && $row['day'] === $today) {
            $n++;
        }
    }
    return $n;
}

function ccmr_send(WP_REST_Request $req) {
    $to      = sanitize_email($req->get_param('to'));
    $subject = trim(wp_strip_all_tags((string) $req->get_param('subject')));
    $text    = trim((string) $req->get_param('text'));
    $reply   = sanitize_email((string) $req->get_param('reply_to'));

    if (!is_email($to)) {
        return new WP_Error('ccmr_to', 'Ungültige Empfängeradresse.', array('status' => 400));
    }
    if ($subject === '' || $text === '' || mb_strlen($subject) > 200 || mb_strlen($text) > 20000) {
        return new WP_Error('ccmr_content', 'Betreff oder Text fehlt bzw. ist zu lang.', array('status' => 400));
    }
    if (ccmr_count_today() >= CCMR_DAY_LIMIT) {
        return new WP_Error('ccmr_limit', 'Tageslimit erreicht (' . CCMR_DAY_LIMIT . ' Mails). Morgen weiter.', array('status' => 429));
    }
    $last = (int) get_option('ccmr_last', 0);
    if (time() - $last < CCMR_GAP) {
        return new WP_Error('ccmr_gap', 'Bitte ' . CCMR_GAP . ' Sekunden Abstand zwischen zwei Mails.', array('status' => 429, 'retry_after' => CCMR_GAP - (time() - $last)));
    }
    update_option('ccmr_last', time(), false);

    $headers = array('Content-Type: text/plain; charset=UTF-8');
    $headers[] = 'Reply-To: Carcura <' . (is_email($reply) ? $reply : CCMR_SELF) . '>';
    if ($req->get_param('bcc_self') !== false && strtolower($to) !== CCMR_SELF) {
        $headers[] = 'Bcc: ' . CCMR_SELF;
    }

    $error = '';
    $catch = function ($e) use (&$error) {
        $error = $e->get_error_message();
    };
    add_action('wp_mail_failed', $catch);
    $ok = wp_mail($to, $subject, $text, $headers);
    remove_action('wp_mail_failed', $catch);

    $log = get_option(CCMR_LOG, array());
    if (!is_array($log)) {
        $log = array();
    }
    array_unshift($log, array(
        'time'    => wp_date('d.m.Y H:i:s'),
        'day'     => wp_date('Y-m-d'),
        'to'      => $to,
        'subject' => $subject,
        'ok'      => (bool) $ok,
        'error'   => $error,
        'user'    => wp_get_current_user()->user_login,
    ));
    update_option(CCMR_LOG, array_slice($log, 0, 300), false);

    if (!$ok) {
        return new WP_Error('ccmr_failed', 'Versand fehlgeschlagen: ' . ($error ?: 'unbekannt'), array('status' => 502));
    }
    return array('ok' => true, 'to' => $to, 'heute_gesendet' => ccmr_count_today());
}

add_action('admin_menu', function () {
    add_management_page('Carcura Mail-Relay', 'Carcura Mail-Relay', 'manage_options', 'carcura-mail-relay', function () {
        $log = (array) get_option(CCMR_LOG, array());
        echo '<div class="wrap"><h1>Carcura Mail-Relay</h1>';
        echo '<p>Hier steht jede Mail, die der Assistent über euren Mailversand geschickt hat. Heute: <strong>' . esc_html(ccmr_count_today()) . ' / ' . esc_html(CCMR_DAY_LIMIT) . '</strong>. Jede Mail geht zusätzlich als Blindkopie an ' . esc_html(CCMR_SELF) . '.</p>';
        echo '<p>Zugriff entziehen: Benutzer → Profil → Anwendungspasswörter → „Carcura Assistent“ widerrufen.</p>';
        if (!$log) {
            echo '<p>Noch keine Mails.</p></div>';
            return;
        }
        echo '<table class="widefat striped" style="max-width:1000px"><thead><tr><th>Zeit</th><th>An</th><th>Betreff</th><th>Ergebnis</th><th>Von</th></tr></thead><tbody>';
        foreach ($log as $r) {
            echo '<tr><td>' . esc_html($r['time']) . '</td><td>' . esc_html($r['to']) . '</td><td>' . esc_html($r['subject']) . '</td><td>' . ($r['ok'] ? '✅' : '❌ ' . esc_html($r['error'])) . '</td><td>' . esc_html($r['user']) . '</td></tr>';
        }
        echo '</tbody></table></div>';
    });
});
