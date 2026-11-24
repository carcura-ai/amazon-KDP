# Carcura Erinnerungen – Abo-Kalender für Apple Kalender

**Abo-Adresse (fest, nie ändern):** https://carcura.info/kalender-1d9dad6f1b082a1f.ics
→ Rank-Math-Weiterleitung **ID 4** (302) auf die aktuelle Datei in der Mediathek.
Aktuelle Datei: Medien-ID **1815**, https://carcura.info/wp-content/uploads/2026/11/cal-1d9dad6f1b082a1f.ics

Der Nutzer hat die Adresse in Apple Kalender (iPhone) abonniert. Neue Termine erscheinen ohne sein Zutun.

## Neue Erinnerung eintragen (ohne Rückfrage, siehe CLAUDE.md)
1. Termin in `termine.json` ergänzen (uid eindeutig, start `JJJJ-MM-TTTHH:MM`, `minuten` = Dauer, titel beginnt mit „Carcura:“, optional `erinnern_min` = Hinweis so viele Minuten vorher). Vergangene Termine dürfen drinbleiben.
   **Kundenaufträge:** Titel nur „Carcura: Auftrag – <Fahrzeug>, <Leistung> (Abholung)“, **keine** Namen, Telefonnummern oder Kennzeichen (die Datei ist öffentlich erreichbar). `erinnern_min` 60. Details ins Auftragsbuch `../auftraege/AUFTRAEGE.md`.
2. `python3 build_ics.py` → `carcura-erinnerungen.ics`
3. Hochladen: `wp_upload_media` (filename `cal-1d9dad6f1b082a1f.ics`, content_base64, size, sha256) → neue Medien-ID und URL.
4. `wp_rm_update_redirect` id 4, target = neue URL. Danach alte Medien-ID mit `wp_delete_media` löschen und die IDs oben aktualisieren.
5. Prüfen: `curl -sL https://carcura.info/kalender-1d9dad6f1b082a1f.ics` enthält den neuen Termin.
6. Muss Claude selbst etwas tun, zusätzlich `send_later` in der Sitzung.

Hinweis: Das iPhone lädt Abo-Kalender in Abständen neu (Einstellung unter Kalender → Accounts → Abrufen). Für Erinnerungen am selben Tag deshalb zusätzlich PushNotification nutzen.
