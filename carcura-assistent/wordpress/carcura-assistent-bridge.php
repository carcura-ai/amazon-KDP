<?php
/**
 * Plugin Name: Carcura Assistent – Anfragen an WhatsApp
 * Description: Leitet jede erfolgreich gesendete Website-Anfrage (/wp-json/ccrr/v1/lead) zusätzlich an den Carcura-Assistenten weiter. Die bisherige E-Mail bleibt unverändert als Absicherung.
 * Version: 1.0.0
 *
 * Installation: Datei nach wp-content/mu-plugins/ hochladen (Ordner ggf. anlegen).
 * Danach unten die beiden Werte eintragen.
 */

if (!defined('ABSPATH')) {
    exit;
}

// Adresse des Assistenten und das gleiche LEAD_SECRET wie in der .env des Assistenten.
define('CARCURA_ASSISTENT_URL', 'https://bot.carcura.info/lead');
define('CARCURA_ASSISTENT_SECRET', 'HIER_LEAD_SECRET_EINTRAGEN');

add_filter('rest_request_after_callbacks', function ($response, $handler, $request) {
    if (!($request instanceof WP_REST_Request) || $request->get_route() !== '/ccrr/v1/lead') {
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
        return $response; // abgelehnte Anfrage (z. B. Spam-Schutz) nicht weiterleiten
    }

    $params = $request->get_json_params();
    if (!is_array($params)) {
        $params = $request->get_params();
    }
    $fields = array('name', 'email', 'phone', 'vehicle', 'service', 'message', 'customer_type', 'source', 'channel', 'website');
    $payload = array();
    foreach ($fields as $field) {
        $payload[$field] = isset($params[$field]) ? (string) $params[$field] : '';
    }
    $payload['gclid'] = !empty($params['gclid']) ? 'ja' : '';

    // Nicht blockierend: Der Kunde wartet nicht auf WhatsApp.
    wp_remote_post(CARCURA_ASSISTENT_URL, array(
        'timeout'  => 5,
        'blocking' => false,
        'headers'  => array(
            'Content-Type'      => 'application/json',
            'X-Carcura-Secret'  => CARCURA_ASSISTENT_SECRET,
        ),
        'body'     => wp_json_encode($payload),
    ));

    return $response;
}, 10, 3);
