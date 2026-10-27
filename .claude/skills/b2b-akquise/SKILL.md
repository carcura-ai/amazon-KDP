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
2. Die Vorlage `carcura-assistent/email/partner-vorlage.html` füllen:
   - `{{betreff}}`: max. 50 Zeichen, konkret, ohne Ausrufezeichen
   - `{{vorschau}}`: ein Satz
   - `{{anrede}}`: „Hallo Herr Y,“
   - `{{einstieg}}`: auf das Telefonat beziehen
   - `{{problem}}`: die belegte Beobachtung bzw. das, was im Gespräch gesagt wurde
   - `{{loesung_titel}}` und `{{loesung_punkte}}`: 2–3 `<p style="margin:0 0 6px;">• …</p>`
   - `{{angebot}}`: Kennenlernangebot
   - `{{cta_url}}`: https://carcura.info/firmenkunde/
   - `{{cta_text}}`
   - `{{absender}}`: wer angerufen hat
   - `{{einwilligung_datum}}`
3. Den Fließtext auf höchstens 150 Wörter halten. Sie-Form, kein Werbesprech, nichts Erfundenes.
4. Eine **Klartext-Fassung** mit demselben Inhalt erstellen.
5. Zuerst **Alex bzw. Richy den Entwurf zeigen**, erst nach „ok“ senden.
6. Senden, **eine Mail nach der anderen**, mindestens 20 s Abstand, höchstens 40 pro Tag:

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
cmd = ["curl", "-sS", "-X", "POST", "https://carcura.info/wp-json/carcura-mail/v1/send",
       "-H", "Content-Type: application/json", "--data-binary", "@payload.json"]
u, p = os.environ.get("CARCURA_WP_USER"), os.environ.get("CARCURA_WP_APP_PASSWORD")
if u and p:
    cmd[1:1] = ["-u", f"{u}:{p}"]  # sonst setzt der Umgebungs-Proxy die Anmeldung für carcura.info
print(subprocess.run(cmd, capture_output=True, text=True).stdout)
PY
```

7. Status `mail_gesendet` setzen und das Ergebnis melden. Bei HTTP 502 einmal neu versuchen. Bei 422 fehlt die Zustimmung: nicht senden.

### 5. Nachfassen
- Nach 5–7 Werktagen ohne Antwort: **anrufen**, nicht erneut mailen.
- Eine zweite Mail nur, wenn der Betrieb darum gebeten hat.

## Was der Nutzer sagt → was du tust
- „Akquise: 15 Betriebe um Walterschen“ → Schritte 1–3, am Ende die Anrufliste plus Link zur privaten Seite.
- „Zustimmung: …“ → Schritt 4.
- „Kein Interesse: …“ → Status `sperre`.
- „Stand Akquise?“ → Zahlen pro Status aus der privaten Seite.
