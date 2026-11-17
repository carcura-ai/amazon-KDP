# Website-Tracking (Stand 17.11.2026)

Ein Skript (`<script id="cx-track">`) im Footer-Teil `kubio//footer` (WP-ID 27) sendet Ereignisse an GA4 (`gtag`, Property 548650753). Es gilt auf jeder Seite, auch auf der Startseite. Es hält die Cookie-Einwilligung ein (Consent Mode: ohne Zustimmung nur anonyme Pings). Es werden keine Namen, E-Mails oder Freitexte gesendet.

| Ereignis | Parameter | Sagt aus |
|---|---|---|
| cx_scroll | percent (25/50/75/90) | Wie weit liest man |
| cx_section_view | section | Welche Abschnitte werden gesehen (letzter gesehener = Stelle, wo man abspringt) |
| cx_time | seconds (15/30/60/120) | Verweildauer (nur sichtbarer Tab) |
| cx_exit | max_scroll, last_section, seconds | Wo und nach wie langer Zeit verlässt man die Seite |
| cx_click_whatsapp / tel / mail / route / social | place, service | Welche Kontaktwege, an welcher Stelle der Seite |
| cx_click_anfragen | place, label | Klicks auf „Anfragen“ |
| cx_click_link | target, place | Interne Klicks (Navigation) |
| cx_details_open | label, place | Welche Preiszeilen/Fragen werden aufgeklappt |
| cx_anfrage_bereich | section | Welche Leistungsgruppe wird auf /anfragen/ geöffnet |
| cx_form_start / cx_form_leistung / cx_form_submit / cx_form_abandon | service, checked | Formular: begonnen, was gewählt, abgesendet, abgebrochen |
| cx_form_success / cx_form_error | form | Contact-Form-7-Formulare |
| cx_gallery_bild / cx_gallery_video | – | Galerie-Nutzung |
| cx_rage_click | target | 3 schnelle Klicks auf Nicht-Klickbares (Nutzer glaubt, es sei ein Knopf) |
| cx_res_error | tag, file | Sichtbares Bild/Video lädt nicht |
| cx_js_error | message, file | Skriptfehler |

Gemeinsamer Parameter: `page_path`. Damit Parameter in GA4-Berichten erscheinen, müssen sie als benutzerdefinierte Dimensionen (Bereich: Ereignis) angelegt werden: place, label, section, percent, service, target, seconds, max_scroll, last_section, page_path, tag, file, message, form.

Hinweis: Complianz blockiert Skripte, die Wörter wie „instagram“ oder „google maps“ enthalten. Solche Begriffe im Skript deshalb nur zusammengesetzt schreiben ('insta'+'gram').
