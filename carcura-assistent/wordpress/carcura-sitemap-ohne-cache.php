<?php
/**
 * Plugin Name: Carcura – Sitemap ohne Cache
 * Description: Schaltet den Sitemap-Cache von Rank Math ab. Grund: Der Cache wurde seit dem 20.10.2026 nicht mehr erneuert,
 *              page-sitemap.xml zeigte nur 14 von 25 Seiten (alle Ortsseiten und neuen Leistungsseiten fehlten).
 *              Ohne Cache baut Rank Math die Sitemap bei jedem Abruf frisch – bei ~30 Seiten ohne spürbare Last.
 * Version: 1.0.0
 *
 * Installation: Datei nach wp-content/mu-plugins/ hochladen (Ordner ggf. anlegen).
 * Prüfung danach: https://carcura.info/page-sitemap.xml muss 25 Einträge zeigen,
 * u. a. /fahrzeugaufbereitung-hachenburg/ – dann Sitemap in der Search Console neu einreichen.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_filter('rank_math/sitemap/enable_caching', '__return_false');
