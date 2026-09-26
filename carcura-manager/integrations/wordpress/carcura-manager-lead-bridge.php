<?php
/**
 * Plugin Name: Carcura Manager – Lead-Weiterleitung
 * Description: Leitet Anfragen des Website-Formulars (REST-Endpunkt /wp-json/ccrr/v1/lead) zusätzlich serverseitig an Carcura Management weiter. Das bestehende Plugin bleibt unverändert und speichert weiterhin selbst (Rückfallebene).
 * Version: 1.0.0
 * Author: Carcura GbR
 *
 * Installation: Datei nach wp-content/mu-plugins/ kopieren (Ordner ggf. anlegen) und in wp-config.php eintragen:
 *   define( 'CARCURA_MANAGER_URL', 'https://app.carcura.info' );
 *   define( 'CARCURA_MANAGER_LEAD_TOKEN', '<Token aus Einstellungen → Integrationen → Website-Lead-Eingang>' );
 * Der Token bleibt auf dem Webserver und erscheint nie im Browser.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_filter( 'rest_post_dispatch', 'carcura_manager_forward_lead', 20, 3 );

/**
 * Nach erfolgreicher Verarbeitung durch das bestehende Plugin: Anfrage an Carcura Management senden.
 * Fehler bei der Weiterleitung beeinflussen die Antwort an den Besucher nicht (nur Protokolleintrag).
 */
function carcura_manager_forward_lead( $result, $server, $request ) {
	if ( ! defined( 'CARCURA_MANAGER_URL' ) || ! defined( 'CARCURA_MANAGER_LEAD_TOKEN' ) ) {
		return $result;
	}
	if ( 'POST' !== $request->get_method() || '/ccrr/v1/lead' !== untrailingslashit( $request->get_route() ) ) {
		return $result;
	}
	if ( is_wp_error( $result ) || ( $result instanceof WP_HTTP_Response && $result->get_status() >= 400 ) ) {
		return $result;
	}

	$params = $request->get_json_params();
	if ( empty( $params ) ) {
		$params = $request->get_body_params();
	}
	if ( ! is_array( $params ) ) {
		return $result;
	}

	// Nur die vereinbarten Felder weitergeben (Datensparsamkeit)
	$fields  = array( 'name', 'email', 'phone', 'vehicle', 'service', 'message', 'customer_type', 'source', 'channel', 'gclid', 'fbclid', 'campaign', 'website' );
	$payload = array();
	foreach ( $fields as $field ) {
		if ( isset( $params[ $field ] ) && is_scalar( $params[ $field ] ) ) {
			$payload[ $field ] = (string) $params[ $field ];
		}
	}

	$response = wp_remote_post(
		untrailingslashit( CARCURA_MANAGER_URL ) . '/api/public/leads/website',
		array(
			'timeout' => 5,
			'headers' => array(
				'Content-Type' => 'application/json',
				'X-Lead-Token' => CARCURA_MANAGER_LEAD_TOKEN,
			),
			'body'    => wp_json_encode( $payload ),
		)
	);

	if ( is_wp_error( $response ) ) {
		error_log( 'Carcura Manager: Lead-Weiterleitung fehlgeschlagen: ' . $response->get_error_message() );
	} elseif ( wp_remote_retrieve_response_code( $response ) >= 300 ) {
		error_log( 'Carcura Manager: Lead-Weiterleitung abgelehnt (HTTP ' . wp_remote_retrieve_response_code( $response ) . ')' );
	}

	return $result;
}
