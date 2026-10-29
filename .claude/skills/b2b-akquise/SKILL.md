---
name: b2b-akquise
description: Partner-Akquise für Carcura – recherchiert Werkstätten, Autohändler, Karosserie- und Lackbetriebe, Reifenhändler, Autovermieter und Fuhrparks im Umkreis von Walterschen, findet Ansprechpartner und ein belegbares Problem, erstellt eine Anrufliste mit persönlichem Gesprächsleitfaden und verschickt nach dokumentierter Zustimmung eine personalisierte HTML-Mail im Carcura-Design über das Mail-Relay. Nutzen bei „Akquise“, „Betriebe raussuchen“, „Werkstätten/Autohändler anschreiben“, „Partner-Mails“, „Zustimmung: …“.
---

# B2B-Akquise für Carcura

Ziel: Betriebe gewinnen, die regelmäßig Fahrzeuge aufbereiten lassen. Das Ziel ist nicht, möglichst viele Mails zu verschicken.

## Harte Regel – zuerst lesen

**Keine Werbe-Mail an einen Betrieb ohne vorherige Zustimmung.** § 7 Abs. 2 Nr. 2 UWG gilt auch zwischen Firmen. Eine einzige unerwünschte Werbe-Mail reicht für eine Abmahnung. Auch Kontaktformulare und LinkedIn-Nachrichten zählen als elektronische Werbung. Deshalb:

1. **Recherche:** erlaubt, nur öffentliche Firmendaten.
2. **Erstkontakt:** per **Telefon** (bei Firmen mit sachlichem Bezug in der Regel vertretbar), **persönlich vorbeigehen** oder per **Brief**.
3. **Mail erst nach einem „Ja, schicken Sie mir Infos“.** Dokumentiert werden: wer zugestimmt hat, wann und wie.

Das Mail-Relay erzwingt das technisch. Ohne das Feld `einwilligung` lehnt es Firmen-Mails ab. Niemals `art: "kunde"` oder `"intern"` verwenden, um das zu umgehen.

Weitere Regeln:
- Keine erfundenen Fakten: keine Zahlen, Bewertungen oder Probleme behaupten, die nicht belegt sind. Beobachtungen immer mit Quelle (URL) notieren und Vermutungen als Vermutung formulieren.
- Preise nur von carcura.info (Seiten /firmenkunde/, /partner/, /leistungen/).
- **Akquise-Daten nie ins Git-Repository.** Das Repo ist öffentlich. Sie gehören auf die private WordPress-Seite „Akquise-Liste (intern)“.

## Ablauf

### 1. Recherche („Akquise: 15 Betriebe …“)
- **Umkreis:** Standard 25 km um 57632 Walterschen. Orte: Altenkirchen, Hachenburg, Weyerbusch, Flammersfeld, Asbach, Hamm (Sieg), Wissen, Betzdorf, Eitorf, Windeck, Waldbröl, Neuwied (Rand), Montabaur (Rand), Wirges.
- **Zielgruppen und typisches Problem:** siehe Tabelle unten.
- **Werkzeuge:** WebSearch für die Suche, dann WebFetch auf Website, Impressum, Fahrzeugbestand (mobile.de/AutoScout24-Händlerseite) und Google-Bewertungen.
- **Pro Betrieb notieren:**
  - Firma, Typ, Ort, Entfernung
  - Website, Telefon, allgemeine E-Mail
  - Inhaber oder Geschäftsführer laut Impressum
  - Bestand bzw. Größe, falls sichtbar
  - **eine konkrete Beobachtung mit Quelle**, Problem-Hypothese, passende Carcura-Leistung
- **Aussortieren:** Betriebe mit eigener Aufbereitung, Ketten mit Zentraleinkauf und alles, was auf der Sperrliste steht.

| Typ | Belegbare Beobachtung (Beispiele) | Problem-Hypothese | Carcura-Lösung |
|---|---|---|---|
| Gebrauchtwagenhändler | Bestandsgröße, Fotos mit verschmutztem Innenraum oder Wasserflecken | Standzeit, schlechtere Inseratsfotos | Hol- und Bringservice, verkaufsfertige Aufbereitung, Festpreis pro Klasse |
| Freie Werkstatt | Kein Aufbereitungs-Angebot auf der Website | Kunden holen das Auto ungepflegt ab | Innen- und Außenreinigung als Zusatzleistung für Werkstattkunden |
| Karosserie/Lack | Unfallinstandsetzung | Polierbedarf nach dem Lackieren, Übergabequalität | Politur und Finish, Innenreinigung vor Übergabe |
| Reifenhändler | Einlagerung, Saisonwechsel | Zusatzumsatz pro Kunde | Felgenreinigung, Wäsche plus Wachs beim Radwechsel |
| Autovermietung/Fuhrpark | Flottengröße | Rückläufer, Leasingrückgabe | Leasingrückgabe-Paket, Rahmenvertrag |

### 2. Liste speichern
- Private WordPress-Seite **„Akquise-Liste (intern)“**: mit `wp_search_posts` suchen. Gibt es sie nicht, mit `wp_create_page` und Status `private` anlegen.
- Darauf eine HTML-Tabelle mit den Spalten: Nr, Firma, Typ, Ort, Ansprechpartner, Telefon, E-Mail, Beobachtung + Quelle, Hypothese, **Status**, Zustimmung, Letzter Kontakt.
- **Status-Werte:** `neu` → `angerufen` → `zustimmung` → `mail_gesendet` → `termin` → `partner` | `kein_interesse` | `sperre`
- Wer „kein Interesse“ sagt oder um Ruhe bittet: Status `sperre`, nie wieder kontaktieren.

### 3. Anrufliste für Alex und Richy
Pro Betrieb, sortiert nach Potenzial, mit einem persönlichen Leitfaden (Sie-Form, ghost-Stil):
1. **Einstieg:** „Guten Tag Herr/Frau X, hier ist Alex von Carcura aus Walterschen, wir bereiten Fahrzeuge auf …“
2. **Beobachtung als Frage**, nie als Vorwurf: „Ich habe gesehen, dass Sie gerade rund 40 Fahrzeuge im Bestand haben. Wer macht die bei Ihnen verkaufsfertig?“
3. **Angebot in einem Satz.**
4. **Zustimmungsfrage:** „Darf ich Ihnen unsere Konditionen kurz per Mail schicken? An welche Adresse?“
5. **Notieren:** Name, Datum, ja/nein, E-Mail-Adresse.

Alternative für Nicht-Erreichte: einen personalisierten **Brief** als PDF erzeugen (gleicher Inhalt, ohne Mail-Pflichttext).

### 4. Mail nach Zustimmung („Zustimmung: Autohaus X, Herr Y, Telefonat 28.10., Alex“)
1. In der Liste Status `zustimmung` setzen und die Zustimmung wörtlich eintragen.
2. **Standardablauf (vom Nutzer festgelegt, 29.10.2026) – immer so durchführen:**
   1. **Abgleich:** Empfänger gegen alle bisher gesendeten Mails prüfen (`wp_list_cpt_items` rest_base `carcura-mails`, status publish, `cc_to` lesen) und gegen die Liste auf Seite 1145. Schon angeschrieben → nicht senden, melden.
   2. **Branchenvorlage wählen** aus `carcura-assistent/email/`: `vorlage-haendler`, `vorlage-firma` (Fahrschule, Taxi, Pflegedienst, Fuhrpark), `vorlage-bestatter`, `vorlage-bus`, `vorlage-landmaschinen`. Für andere Branchen eine neue Vorlage nach demselben Muster aus `segmente-texte.md` bauen (HTML + Klartext) und committen.
   3. **Anrede mit Ansprechpartner** aus dem Impressum oder dem Telefonat: „Sehr geehrte Frau X,“ / „Sehr geehrter Herr Y,“. Bei zwei Inhabern beide nennen. Kein Name bekannt → „Guten Tag,“.
   4. **Inhalt:** Einstieg immer „wir sind Carcura, eine Fahrzeugaufbereitung aus Walterschen – Alexander Fuchs und Richy Schumacher. …“. **Kein Bezug auf ein Telefonat oder Gespräch**, kein Satz zur Zustimmung. Teamfoto `carcura-team-mail.jpg` und HD-Logo bleiben drin. Höchstens 150 Wörter, Sie-Form, nichts Erfundenes, keine Preise außer denen auf carcura.info.
   5. **Prüfen vor dem Anlegen:** kein `{{` übrig, kein „Telefonat“, „Gespräch“, „besprochen“; Teamfoto-URL enthalten; Empfänger-Adresse aus öffentlicher Quelle oder vom Nutzer genannt.
3. Nach dem Anlegen die Bytelänge live gegen lokal prüfen (`wp_replace_in_post` mit identischem Suchtext liefert `content_length_before`).
4. Eine **Klartext-Fassung** mit demselben Inhalt erstellen.
5. **Als Entwurf in den Mail-Ausgang legen** (Mail-Relay ab 1.2, kein Passwort nötig, läuft über die WordPress-Verbindung):
   - `wp_create_cpt_item` mit `rest_base: "carcura-mails"`, `title` = Betreff, `content` = fertiges HTML, `status: "draft"`.
   - Danach `wp_update_cpt_item` mit `meta`:
     - `cc_to`: Empfänger
     - `cc_art`: `b2b_einwilligung`
     - `cc_einwilligung`: wörtlich, wer wann wie zugestimmt hat
     - `cc_text`: die Klartext-Fassung
   - Alex bzw. Richy den Entwurf im Chat zeigen (Betreff, Empfänger, Text). Die Vorschau gibt es auch unter WordPress → Mail-Ausgang.
6. **Erst nach „ok“ senden.** Meldet der Nutzer Zustimmungen gesammelt mit Auftrag zum Senden („alle haben zugestimmt, nach und nach senden“), gilt das als ok für genau diese Betriebe. Vorher `cc_to` zurücklesen und mit der Liste abgleichen. Senden: `wp_update_cpt_item` mit `status: "publish"`. Alternativ klickt Alex im Mail-Ausgang auf „Senden“.
   - Das Plugin prüft Zustimmung, Sperrliste und Tageslimit (40). Es verhindert eine zweite Firmen-Mail an dieselbe Adresse innerhalb von 60 Tagen und sendet mit 20 s Abstand, mit Blindkopie an carcura@web.de.
   - Mehrere Mails: nacheinander freigeben. Die Warteschlange läuft über WP-Cron. Damit sie bei wenig Besuchern weiterläuft, alle ~25 s `curl -sS https://carcura.info/wp-cron.php` aufrufen, bis alles raus ist.
   - Ergebnis prüfen: `wp_get_post_meta` (post_type `carcura-mails`, key `cc_ergebnis`). Erwartet wird `✅ gesendet …`.
   - Bei `❌` ist die Mail zurück im Entwurf, mit Grund. Nicht umgehen, sondern melden.
7. Status `mail_gesendet` auf Seite 1145 setzen und melden: gesendet (Betrieb, Ansprechpartner, Adresse) und wo eine E-Mail-Adresse fehlt – die liefert der Nutzer aus dem Telefonat.

**Eigene HTML-Vorlage des Nutzers:** als Eintrag im Mail-Ausgang mit `cc_art: "vorlage"` ablegen (wird nie gesendet). Vor jedem Einsatz mit `wp_get_cpt_item` lesen und Platzhalter wie `{{anrede}}` füllen.

**Alternativer Weg (nur mit Anwendungspasswort in den Umgebungs-Secrets `CARCURA_WP_USER`/`CARCURA_WP_APP_PASSWORD`):** sofort senden per POST an `https://carcura.info/wp-json/carcura-mail/v1/send`:

```bash
python3 - <<'PY'
import json, os, subprocess
payload = {
  "to": "empfaenger@firma.de",
  "subject": "…",
  "text": open("mail.txt").read(),
  "html": open("mail.html").read(),
  "art": "b2b_einwilligung",
  "einwilligung": "Telefonat 28.10.2026, Herr Y stimmt Infos per Mail zu (Alex)",
  "reply_to": "carcura@web.de"
}
open("payload.json", "w").write(json.dumps(payload))
cmd = ["curl", "-sS", "-u", os.environ["CARCURA_WP_USER"] + ":" + os.environ["CARCURA_WP_APP_PASSWORD"],
       "-X", "POST", "https://carcura.info/wp-json/carcura-mail/v1/send",
       "-H", "Content-Type: application/json", "--data-binary", "@payload.json"]
print(subprocess.run(cmd, capture_output=True, text=True).stdout)
PY
```

Antwortcodes: 422 = Zustimmung fehlt, 403 = Sperrliste, 409 = schon angeschrieben, 429 = Limit/Abstand. Bei 422, 403 und 409 nicht senden. Bei 502 einmal neu versuchen.

**„Kein Interesse“** → zusätzlich zur Akquise-Liste die Adresse oder `@domain` unter Werkzeuge → Carcura Mail-Relay → Sperrliste eintragen lassen. Das muss Alex machen, ich habe dort keinen Schreibzugriff.

### 5. Nachfassen
- Nach 5–7 Werktagen ohne Antwort: **anrufen**, nicht erneut mailen.
- Eine zweite Mail nur, wenn der Betrieb darum gebeten hat.

## Was der Nutzer sagt → was du tust
- „Akquise: 15 Betriebe um Walterschen“ → Schritte 1–3, am Ende die Anrufliste plus Link zur privaten Seite.
- „Schreib alle Autohändler in X an“ / „schreib Firmen an“ → Schritte 1–3 für X. Dazu für jeden Betrieb schon den **personalisierten Mail-Entwurf** als `draft` in den Mail-Ausgang legen (ohne `cc_to`-Freigabe). Gesendet wird ein Entwurf erst, wenn Zustimmung und „ok“ vorliegen. So geht nach dem Telefonat jede Mail in Sekunden raus. Nie ohne Zustimmung senden, auch nicht auf Anweisung.
- „Zustimmung: …“ → Schritt 4.
- „Kein Interesse: …“ → Status `sperre`.
- „Stand Akquise?“ → Zahlen pro Status aus der privaten Seite.
