# Umbauplan Carcura Manager

Stand: 12.10.2026 · Grundlage: `docs/AUDIT.md` · **Status: wartet auf Freigabe**

Ziel: Carcura soll optimal laufen, und der Manager soll als „Service mit Software“ an andere Aufbereiter verkaufsfertig
werden. Sicherheit richtet sich nach BSI IT-Grundschutz, TR-02102 und OWASP ASVS L2; Datenschutz nach DSGVO.

---

## 1. Arbeitsweise (gilt für alle Phasen)

- **Branch:** `claude/kind-curie-4rhi0y`. Ein Commit bzw. ein Pull Request pro Phase. Größere Phasen werden in benannte Teil-Commits gegliedert, die Phase schließt mit einem Abnahme-Commit ab. Vor jedem Commit laufen Tests und Typprüfung, ab Phase 1 auch Linter, `npm audit` und Secret-Scan; alles muss grün sein.
- **Migrationen:**
  - Drizzle kennt keine Rückwärts-Migrationen. Ab Phase 1 gehört deshalb zu jeder neuen Migration `NNNN_name.sql` eine Datei `NNNN_name.down.sql` und der Befehl `npm run db:down`.
  - Ein Test wendet jede Migration auf einer Kopie mit Beispieldaten an, nimmt sie zurück und wendet sie erneut an. Danach müssen die Daten gleich sein.
  - Vor jeder Migration läuft weiterhin automatisch eine Sicherung (`S/index.ts:25`).
  - Die 15 vorhandenen Migrationen gelten als Basisstand; ihr Rückweg ist die Sicherung.
- **Keine Daten verlieren:** Was „raus“ soll, wird per Modul bzw. Feature-Flag abgeschaltet, nicht gelöscht. Carcura-Altdaten bleiben lesbar, z. B. Bar-Zahlungen und eigene Rechnungen schreibgeschützt. Löschen nur mit deiner ausdrücklichen Freigabe (siehe Entscheidung E8).
- **Kein Deployment ohne Freigabe.** E-Mail, SMS und Zahlungen laufen in Tests nur gegen Mocks bzw. Testmodus. Echte Kunden werden nie angeschrieben.
- **Rechtstexte** sind Entwürfe mit dem Vermerk „ENTWURF – Prüfung durch Fachanwalt erforderlich“. Keine Aussagen wie „zertifiziert“ oder „rechtssicher“.
- **Entscheidungen** stehen kurz und datiert in `docs/DECISIONS.md`.

---

## 2. Phasen im Überblick

Aufwand in Personentagen (PT) für eine erfahrene Entwicklerin bzw. einen erfahrenen Entwickler. Darin enthalten sind Tests,
Doku und Smartphone-Prüfung. Nicht enthalten sind deine Abnahmen sowie die Termine bei Anwalt und Steuerberater.

| Phase | Inhalt | Aufwand | Ergebnis für dich |
|---|---|---|---|
| **1** | Sicherheit (Fundament) | 17–20 PT | Die drei hohen Lücken sind geschlossen, Sicherungen verschlüsselt und außer Haus, CI-Pipeline, Grundlage für fremde Mandanten |
| **2** | Datenschutz, Rechtspflichten, Modulsystem, Lexware-Übergabe | 21–25 PT | Barzahlung raus, Module schaltbar, Einwilligungen, Löschkonzept, Rechnung per Klick in Lexware, Entwürfe für den Anwalt |
| **3** | Kernfunktionen gegen echte Probleme | 26–30 PT | Protokoll 2.0, Online-Terminanfrage, Statusmeldungen, Preisfindung, Auftragszeit, Boxen, Pflegeabos, B2B |
| **4** | Verkaufsfähigkeit | 13–16 PT | Onboarding unter 30 Minuten, Demo-Mandant, Hilfe, Betreiber-Oberfläche, Monitoring |
| **5** | Abschluss und Übergabe | 5–6 PT | Gesamttest, Scans, Wiederherstellungstest, GO-LIVE-Checkliste, Abschlussbericht |
| | **Summe** | **82–97 PT** | |

**Empfehlung zur Reihenfolge:** Die Reihenfolge des Auftrags passt. Eine Änderung schlage ich vor:

- **Das Modulsystem (2.1) kommt an den Anfang von Phase 2.** „Deaktivieren statt löschen“ setzt es voraus.
- **Carcura kann nach Phase 2 produktiv gehen**, mit deiner Freigabe und auf dem neuen Server. Ab dann arbeitet der eigene Betrieb mit der Lexware-Übergabe und ohne Barzahlungs-Risiko.
- Die Funktionen aus Phase 3 kommen danach schrittweise dazu.
- Fremde Mandanten erst nach Phase 4.

**Abhängigkeiten:**

- Für die Abnahme von TLS und SSL Labs (Phase 1) brauche ich den Zielserver (E4).
- Für die externe Sicherung brauche ich den zweiten Speicherort (E4).
- Für die Lexware-Übergabe brauche ich einen API-Schlüssel eines **Test-Kontos** (siehe Abschnitt 5).

---

## 3. Phasen im Detail

### Phase 1 – Sicherheit (17–20 PT)

| Nr. | Arbeitspaket | Behebt (AUDIT.md) | PT |
|---|---|---|---|
| 1.1 | **Sofortmaßnahmen:** Mandantensperre wirkt bei Anmeldung und Sitzung, laufende Sitzungen enden. Rechteänderungen nur durch Admins, keine Rechte über den eigenen Stand hinaus. 2FA-Pflicht für Admins und Betreiber serverseitig in allen Modi. | H1, H2, H3 | 1 |
| 1.2 | **CI-Pipeline** (GitHub Actions): Tests, Typprüfung, ESLint, `npm audit --audit-level=high`, Semgrep, gitleaks, Build. Dependabot für npm und Actions. ZAP-Baseline als eigener Job gegen eine Testinstanz. | M13 | 2 |
| 1.3 | **Abhängigkeiten:** sharp ≥ 0.35.5; `extract-zip` ersetzen durch eigenes Entpacken mit Pfad-, Symlink- und Größenprüfung; Desktop-Abhängigkeiten aktualisieren | 5.1, M9 | 0,5 |
| 1.4 | **Anmeldung:** Argon2id (mind. m = 19 MiB, t = 2, p = 1), bestehende scrypt-Hashes werden bei der nächsten Anmeldung umgestellt. Mindestlänge 12, keine Zeichenklassen-Pflicht, Höchstlänge 256. Lokale Liste kompromittierter Passwörter (Lizenz prüfen). Sperrmeldung ohne Kontoverrat, Rate-Limit je Konto. Gleiches Zeitverhalten bei „Passwort vergessen“ (Versand in die Warteschlange). | N1, M3, M4, M12 | 2 |
| 1.5 | **2FA:** Schutz gegen Wiederverwendung von TOTP-Codes (letzter Zeitschritt), Challenge nur einmal nutzbar, 2FA-Änderung beendet andere Sitzungen. WebAuthn bzw. Passkeys als optionales Folgepaket (+1,5 PT, nicht eingeplant). | M5 | 1 |
| 1.6 | **Sitzungen:** IDs nur als Hash speichern (Migration mit Rückweg; alle werden einmal abgemeldet). Cookie `__Host-`. Sitzungsliste und „Überall abmelden“. Absolute Höchstdauer nach ASVS 3.3 festlegen. Leerlauf 8 h bleibt. | M2, M6 | 1,5 |
| 1.7 | **Zugriff:** Alle `UPDATE`/`DELETE` mit `company_id`. Rechte-Matrix-Test für jede Route und jede Rolle. Isolationstests zusätzlich im Modus `saas` und für die Hintergrundjobs. Löschlauf nur für den eigenen Mandanten. | 2.4, N7, N8 | 2,5 |
| 1.8 | **Header:** CSP ohne `unsafe-inline` (nach Messung: React-Style-Props sind CSSOM und nicht betroffen; Bibliotheken mit `<style>` bekommen einen Hash), `frame-ancestors 'none'`. `/api/health` öffentlich ohne Version. | N2, N4 | 1 |
| 1.9 | **SSRF und Uploads:** netguard für SMTP und alle frei konfigurierbaren Ziele (keine privaten Netze, nur erlaubte Ports). Logo-Prüfung nach Inhalt. Anschluss für einen optionalen Virenscan (ClamAV im Container, standardmäßig aus). PDF-Chromium ohne Netzwerk und ohne JavaScript. | H4, N3, N5, M12 | 1 |
| 1.10 | **Schlüssel:** Schlüsselhierarchie per HKDF (getrennt für Cookies, Daten und 2FA), Schlüsselversion an jedem Chiffrat, Befehl zur Rotation, Ablage außerhalb der Datenbank. Lead-Token nur gehasht und nur im Header. Zeitprüfung gegen Bots. | M7, M11 | 1,5 |
| 1.11 | **Sicherung (CON.3):** AES-256-GCM-verschlüsselte Sicherungen. Täglicher Versand an einen zweiten Ort in der EU (S3-kompatibel oder SFTP). Monatlicher automatischer Wiederherstellungstest in eine leere Instanz mit Protokoll. RPO 24 h, RTO 4 h als Vorschlag. | M1 | 2,5 |
| 1.12 | **Protokollierung (OPS.1.1.5):** Audit-Kette mit HMAC-Schlüssel, Schutz gegen Änderung in der Datenbank (Trigger). Anonymisierung ohne Änderung alter Einträge (personenbezogene Inhalte getrennt ablegen). Fehlende Ereignisse ergänzen. Aufbewahrungsfristen festlegen. | M8, N6 | 1,5 |
| 1.13 | **TLS und Doku:** Caddy mit `protocols tls1.2 tls1.3` und Suiten nach TR-02102-2 (2026-01), HSTS. `docs/SECURITY.md` (Zuordnung zu den BSI-Bausteinen und ASVS L2), `docs/INCIDENT.md` (DER.2.1, Art. 33 DSGVO), ZAP-Ergebnis. | N10 | 1,5 |

**Abnahme:**

- Alle Kriterien aus Abschnitt 4 des Auftrags sind erfüllt oder in `SECURITY.md` begründet.
- ZAP-Baseline ohne hohe Befunde.
- `npm audit` ohne hohe Befunde.
- SSL Labs mindestens A, sobald der Zielserver steht.

### Phase 2 – Datenschutz, Rechtspflichten, Module (21–25 PT)

| Nr. | Arbeitspaket | PT |
|---|---|---|
| 2.1 | **Modulsystem nach Abschnitt 2 des Auftrags.** Module: Kern, B2B, Wachstum, Lager, Labor, Eigene Rechnungsstellung, Online-Buchung. Sie werden auf die vorhandenen Feature-Schlüssel abgebildet, kein Neubau. Die Sperre gilt in **allen** Modi, auch selbst gehostet. Die Oberfläche blendet gesperrte Module aus. Carcura bekommt alle Module, neue Mandanten den Kern. Tarifbeschreibungen nennen nur vorhandene Funktionen. | 2,5 |
| 2.2 | **Barzahlung raus:** Neue Einträge mit „bar“ sind nicht mehr möglich (Server und Oberfläche). Bestehende Carcura-Einträge bleiben schreibgeschützt sichtbar. Hinweis „Barzahlungen erfassen Sie in Ihrer Kasse bzw. Buchhaltung.“ Frage an den Steuerberater ist dokumentiert. | 0,5 |
| 2.3 | **Labor:** KI-Assistent, Belegerkennung per KI, Finanzen, Liquidität und USt-Schätzung kommen ins Modul „Labor“, Standard aus und nicht verkaufbar. Für Carcura gilt eine bewusste Einwilligung in den Einstellungen. Die falsche Aussage in `docs/06` wird korrigiert. | 1 |
| 2.4 | **Wettbewerber:** nur die Place-ID speichern, Daten live abrufen, kein Verlauf. Modul „Wachstum“, Standard aus. Altdaten siehe E8. | 1 |
| 2.5 | **Keine Carcura-Reste:** PWA-Name, Absender-Standard, Meta-Formularfelder, Hilfetexte, Desktop- und iOS-Konfiguration auf Einstellungen bzw. Build-Variablen umstellen. Exportkennung und Header neutral, alte Namen bleiben als Alias erhalten. | 1 |
| 2.6 | **Einwilligungen (5.4):** je Kunde und Kanal mit Zeitpunkt, Wortlaut, Quelle und Nachweis. Double-Opt-in für E-Mail-Werbung, Widerruf, Sperrliste. Versandsperre ohne Einwilligung. Service-Nachrichten nur zum konkreten Auftrag. Schalter „Bestandskundenausnahme“ standardmäßig aus. Klick-Kennungen nur mit Einwilligungssignal der Website; dafür wird auch die WordPress-Brücke angepasst. | 3 |
| 2.7 | **Löschkonzept und Datenschutz-Center:** `docs/LOESCHKONZEPT.md` (angelehnt an DIN 66398). Fristen je Mandant mit den Vorschlägen aus dem Auftrag, darunter **Buchungsbelege 8 Jahre**. Fehler beheben: Aktivitäten gelöschter Leads, Jobprotokoll, Lauf je Mandant. **Oberfläche** für Auskunft, Einschränkung, Widerspruch (wirkt als Sperrliste), Anfragenregister, Löschprotokoll, Exporte. Export auch für Leads. | 3 |
| 2.8 | **Fotos:** Werkzeug zum Verpixeln (manuell, Rechtecke über Kennzeichen und Gesichter) beim Export für Marketing. EXIF entfernt. Export nur mit dokumentierter Einwilligung des Kunden. | 2 |
| 2.9 | **Lexware-Office-Übergabe (5.3):** Verbindung per API-Schlüssel (verschlüsselt gespeichert). Aus einem abgeschlossenen Auftrag per Klick Kontakt und Rechnung anlegen, als Entwurf oder final. XRechnung bei entsprechend eingerichtetem Kontakt. Rechnungsnummer, Link und Zahlungsstatus werden gespeichert, der Zahlungsstatus wird regelmäßig abgeglichen. Rate-Limit 2/s, Wiederholversuche, verständliche Fehlermeldungen. Tests gegen einen nachgebauten Lexware-Server. | 4 |
| 2.10 | **Eigene Rechnungsstellung → Modul, Standard aus.** Carcura schaltet auf die Lexware-Übergabe um; alte Rechnungen bleiben lesbar und als PDF abrufbar. Das Modul ist erst wieder einschaltbar, wenn die Bedingungen aus 5.3 erfüllt sind; das sperrt der Code. | 0,5 |
| 2.11 | **Kleinunternehmer:** Warnung bei 80 % und 95 % der Grenzen (25.000 € Vorjahr, 100.000 € laufendes Jahr), Grundlage sind Lexware-Umsätze bzw. Aufträge. Hinweis, dass beim Überschreiten von 100.000 € die Befreiung sofort entfällt. | 0,5 |
| 2.12 | **Datenportabilität:** Formatbeschreibung `docs/EXPORTFORMAT.md`, Export in der Oberfläche, kein Entgelt | 0,5 |
| 2.13 | **Entwürfe in `docs/legal/`:** AV-Vertrag, TOM (aus SECURITY.md), VVT nach Art. 30 Abs. 2, Muster-Datenschutzhinweise für Endkunden (Annahme, Anfrage, Buchung, Erinnerungen, WhatsApp-Link), DSFA-Bewertung. Dazu `docs/SUBPROCESSORS.md` und eine Ansicht in der App mit Ankündigung von Änderungen. `OFFENE-FRAGEN.md` wird fortgeschrieben. | 2,5 |
| 2.14 | **E-Mail:** Prüfung von SPF, DKIM und DMARC je Mandanten-Domain mit Anleitung. Alternativ Versand über die Betreiber-Domain mit Antwortadresse des Mandanten. | 1 |
| — | sevDesk als zweite Buchhaltung: später, ca. 2–3 PT, erst wenn ein Interessent sevDesk nutzt | — |

**Abnahme:**

- Kein Weg, „bar“ neu zu erfassen.
- Ein Mandant „neu“ sieht nur den Kern.
- Testrechnung im Lexware-**Testkonto** mit Rückmeldung des Zahlungsstatus.
- Löschjob mit Protokoll.
- Alle Entwürfe als ENTWURF gekennzeichnet.

### Phase 3 – Kernfunktionen (26–30 PT)

| Nr. | Arbeitspaket | PT |
|---|---|---|
| 3.1 | **Protokoll 2.0:** Rückgabe mit Bezug zur Annahme und Vorher-Nachher je Schadenposition. Zustandsstufe 1–4, Lackschichtdicke je Bauteil (manuell). SHA-256 über PDF und Fotos mit Zeitstempel, auf dem PDF angezeigt. Kopie per E-Mail nach der Unterschrift. Haftungsklausel als Textbaustein (ENTWURF). Signatur-Metadaten (Name, Zeitpunkt, Gerät, Prüfpfad), ohne Aussage über eine höhere Beweiskraft. | 4 |
| 3.2 | **Online-Terminanfrage (Variante A):** öffentliche Seite und einbettbares Widget je Mandant. Auswahl von Leistung, Fahrzeugklasse und Zeitfenster aus freien Slots; unverbindlich bis zur Bestätigung. WCAG 2.1 AA. Kein Cookie. Honeypot, Zeitprüfung und Rate-Limit. Datenschutzhinweis. | 4 |
| 3.3 | **Statusmeldungen:** bestätigt, angenommen, in Arbeit, fertig mit Abholzeiten. Vorlagen je Mandant bearbeitbar. Erinnerung in Stunden (24–48 h). SMS nur vorbereitet, Anbieter siehe E5. | 2,5 |
| 3.4 | **Preisfindung:** Fahrzeugklassen (Kleinwagen, Mittelklasse, SUV/Van, Transporter), Preise je Klasse, Zustandszuschlag je Stufe, Pakete. Branchenvorlage **nur mit Struktur, ohne Preise**. | 3 |
| 3.5 | **Auftragszeit und Nachkalkulation:** Start/Stopp je Auftrag und Mitarbeiter, Soll/Ist, Material aus dem Lager (falls aktiv), Stundenertrag je Auftrag und Leistung. Klar benannt als „Auftragszeit zur Kalkulation – keine Arbeitszeiterfassung“. | 2,5 |
| 3.6 | **Checklisten je Leistung**, im Auftrag abhakbar | 1,5 |
| 3.7 | **Boxen bzw. Stellplätze** als Ressource; Konfliktprüfung für Mitarbeiter und Box, mit Blockieren statt nur Warnen | 2 |
| 3.8 | **Pflegeabos:** Leistungen, Intervall, Laufzeit, Verlängerung, Kündigungsfrist nach § 309 Nr. 9 BGB, nächste fällige Leistung. Wiedervorlage als Aufgabe. Automatische Kundennachricht nur nach den Regeln aus 2.6. Die Wiederkehr-Erinnerung aus „Revenue Recovery“ wird übernommen, das Plugin danach nur noch als Lead-Eingang genutzt. **Voraussetzung:** Ich brauche den Plugin-Code bzw. Lesezugriff, er liegt nicht im Repository. | 3,5 |
| 3.9 | **B2B (Modul):** Autohaus- und Flottenkunden mit eigenen Preislisten, Sammelaufträge, Nachkalkulation je Fahrzeug, Sammelrechnung über Lexware, Zahlungsziel je Kunde, Mahnstufen-Hinweise. Mehrere Standorte: separates Paket (+2–3 PT), erst bei Bedarf. | 4 |

**Abnahme:** jede Funktion mit automatisierten Tests und bei 360 px nutzbar. Ende-zu-Ende-Test „Anfrage → Termin → Annahme →
Auftrag → Statusmeldung → Übergabe → Rechnung in Lexware“.

### Phase 4 – Verkaufsfähigkeit (13–16 PT)

| Nr. | Arbeitspaket | PT |
|---|---|---|
| 4.1 | **Onboarding-Assistent:** Firma, Kleinunternehmer, Logo und Farben, Leistungskatalog aus der Vorlage, Boxen und Mitarbeiter, Buchhaltung, CSV-Import (auch Fahrzeuge mit Kennzeichen-Duplikatprüfung), Widget-Code. Zeit bis zum ersten unterschriebenen Protokoll messen, Ziel unter 30 min. | 3 |
| 4.2 | **Demo-Mandant** mit gekennzeichneten Beispieldaten, getrennt von echten Mandanten, zurücksetzbar | 1 |
| 4.3 | Hilfetexte je Bildschirm, Support-Kontakt mit Antwortzeit laut Vertrag, „Was ist neu“, Systemstatus | 1,5 |
| 4.4 | **White-Label vollständig:** Rechtstexte, Fußzeilen und Mail-Vorlagen je Mandant; Prüfung, dass bei einem fremden Mandanten kein „Carcura“ erscheint | 1,5 |
| 4.5 | **Betreiber-Oberfläche:** Module schalten, sperren, Kennzahlen, Supportfreigaben, Export und Löschung nach Vertragsende | 2,5 |
| 4.6 | **Monitoring:** Verfügbarkeit, Fehlerrate, Job-Laufzeit, Sicherungsstatus, Zertifikatsablauf; Alarm per E-Mail an den Betreiber | 1,5 |
| 4.7 | **Leistung:** Vorschaubilder in reduzierter Größe, Messung mit gedrosseltem 4G, Ziel unter 2 s | 1,5 |
| 4.8 | **Barrierefreiheit** (öffentliche Seiten WCAG 2.1 AA, App möglichst) und automatisierte Tests bei 360 px, Tablet und Desktop in der CI | 2 |

### Phase 5 – Abschluss (5–6 PT)

- **Vollständiger Testlauf:** Einheitentests, Integrationstests, Mandantentrennung und Ende-zu-Ende auf Smartphone- und Desktop-Breite.
- **Scans:** ZAP, `npm audit` und gitleaks ohne kritische oder hohe Befunde.
- **Wiederherstellung:** protokollierter Test aus einer externen Sicherung.
- **`docs/GO-LIVE.md`:** Übernahme der Carcura-Daten mit Probelauf, Rollback-Plan, offene Punkte für Anwalt und Steuerberater.
- **`docs/REPORT.md`:** umgesetzt bzw. bewusst nicht umgesetzt, bekannte Grenzen, nächste Schritte.

---

## 4. Risiken

| Risiko | Wirkung | Gegenmaßnahme |
|---|---|---|
| Der jetzige Server (Plesk, abgelaufenes Zertifikat) ist für den Manager ungeeignet | TLS- und Sicherungs-Abnahme nicht möglich | Eigener EU-Server (E4) |
| Kundendaten **doppelt** in WordPress-Plugins (CRM Suite, Suite v2, Revenue Recovery, Newsletter, Firmenkunden) und im Manager | Löschpflichten und Auskunft nicht vollständig erfüllbar; eine Angriffsfläche mehr | Nach Phase 3 die Plugins auf den Lead-Eingang reduzieren (E9) |
| Kassenpflicht-Gesetz (Entwurf) erfasst evtl. auch Kartenzahlungen | Zahlungsart „Karte“ könnte für Mandanten > 100.000 € Folgen haben | Frage an den Steuerberater, Gesetzgebung beobachten |
| Lexware-API-Änderungen bzw. Rate-Limit (2/s) | Übergabe stockt | Warteschlange mit Wiederholung, Fehleranzeige, Versionsprüfung |
| Primärquellen hier nicht direkt abrufbar | Rechtsangaben nur über amtliche Suchauszüge geprüft | Volltext vor der jeweiligen Phase lesen; Anwalt bzw. Steuerberater |
| Umfang (82–97 PT) | lange Laufzeit bis zum Verkauf | Carcura-Produktivstart nach Phase 2; Verkauf nach Phase 4; B2B-Standorte und sevDesk erst bei Bedarf |
| Wettbewerb mit kostenlosem Basis-Tarif (DETAILING \| ONE) | Preisdruck | Verkauf über Einrichtung und Support, nicht über Funktionsliste |

---

## 5. Entscheidungen für dich (mit Empfehlung)

| Nr. | Frage | Meine Empfehlung | Begründung |
|---|---|---|---|
| **E1** | Rechnungen: Lexware-Übergabe oder eigene Rechnungsstellung? | **Lexware-Übergabe** (wie vorgegeben), eigene Rechnungsstellung als gesperrtes Modul | GoBD, E-Rechnung und Archiv liegen dann beim Buchhaltungsanbieter. Die eigene Lösung bräuchte zusätzlich XRechnung/ZUGFeRD, KoSIT, Z3/DATEV, eine Verfahrensdokumentation und eine Prüfung durch den Steuerberater, grob 12–18 PT plus Haftungsrisiko. |
| **E2** | Online-Buchung: nur Anfrage oder verbindlich mit Anzahlung? | **Variante A jetzt.** Variante B erst nach 3 Monaten Daten zur No-Show-Quote. | B bringt Fernabsatzpflichten, Widerrufsbutton und AGB-Prüfung mit sich, also Anwaltskosten. Ob No-Shows bei Carcura das Problem sind, zeigen erst die Zahlen. |
| **E3** | Zahlungsdienst für B | **Mollie** (Sitz in den Niederlanden), Stripe als Alternative | EU-Anbieter, einfache Abrechnung, Karten- und Zahldaten bleiben beim Anbieter. AV-Vertrag und Preise vor der Umsetzung prüfen. |
| **E4** | Hosting | **Wechsel:** eigener EU-Cloud-Server für den Manager (z. B. Hetzner, Rechenzentrum in Deutschland; AV-Vertrag beim Anbieter abschließen). Zweiter Sicherungsort bei einem **anderen** Anbieter bzw. Standort in der EU. carcura.info (WordPress) kann auf Plesk bleiben. | Das Setup ist auf Docker und Caddy ausgelegt. Plesk liefert derzeit ein abgelaufenes Zertifikat und teilt sich den Server mit WordPress. Kosten: Server laut `docs/deployment` ab ca. 7 €/Monat; Speicher für Sicherungen im einstelligen Euro-Bereich, aktuelle Preise beim Anbieter prüfen. |
| **E5** | E-Mail- und SMS-Anbieter | **E-Mail:** zum Start das SMTP des Mandanten; für Systemmails ein EU-Anbieter mit AV-Vertrag. **SMS:** zunächst keine. | Statusmeldungen per E-Mail decken das Problem ab; SMS kostet pro Nachricht. Konkrete Anbieter schlage ich in Phase 2 mit geprüftem AV-Vertrag vor. |
| **E6** | KI im Labor-Modul | **Für den Verkauf ohne KI.** Für Carcura weiter Anthropic per bewusster Einwilligung, wie heute standardmäßig aus. | Kein nachgewiesener Kaufgrund. Die Drittlandübermittlung (USA) muss für jeden Mandanten begründet werden. |
| **E7** | Produktname | **Konfigurierbar lassen**, Markenrecherche (DPMA bzw. EUIPO) vor der Festlegung | Ohne Recherche keine Festlegung. Kosten der Recherche gering, Risiko einer Abmahnung hoch. |
| **E8** | **Neu:** Gespeicherter Wettbewerber-Verlauf (Bewertung und Anzahl aus Google Places) | **Löschen** und nur die Place-ID behalten | Laut Google-Bedingungen darf nur die Place-ID dauerhaft gespeichert werden. Löschen ist ein Datenverlust; deshalb nur mit deiner ausdrücklichen Freigabe. Alternative: Modul aus, Daten bis zur Klärung gesperrt. |
| **E9** | **Neu:** Die fünf eigenen WordPress-Plugins mit Kundendaten | Nach Phase 3 **auf den Lead-Eingang reduzieren**, Daten in den Manager übernehmen, Plugins abschalten | Eine Datenquelle statt zwei: einfachere Auskunft und Löschung, weniger Angriffsfläche. Funktionen wie WhatsApp-Anfragen und Bewertungsanfragen in „Suite v2“ müssten sonst ebenfalls nach den neuen Regeln umgebaut werden. |
| **E10** | **Neu:** Barzahlung auch bei **Ausgaben** entfernen? | **Ja**, ebenfalls schreibgeschützt für Altdaten | Vorsichtige Auslegung von „bare Zahlungsvorgänge erfassen“. Ausgaben wandern ohnehin ins Labor-Modul. Endgültig klärt das der Steuerberater. |

**Für den Start von Phase 1 brauche ich nur deine Freigabe dieses Plans.** E4 (Server) brauche ich spätestens für die Pakete 1.11
und 1.13. E1, E8 und E10 brauche ich vor Phase 2. Die übrigen haben Zeit bis zur jeweiligen Phase.

## 6. Was ich von dir brauche

1. **Freigabe** dieses Plans, ggf. mit Änderungen an Reihenfolge oder Umfang.
2. Antworten zu **E1, E4, E8, E10** (die übrigen später).
3. Für Phase 2: einen **Lexware-Office-API-Schlüssel eines Test- bzw. Zweitkontos**. Dein Produktivkonto soll in Tests keine Rechnungen bekommen.
4. Für Phase 3.8: Zugriff auf den Code des Plugins **Carcura Revenue Recovery** (ZIP oder Repository).
5. Termin bzw. Budget für **Steuerberater und Fachanwalt IT-Recht**. Die Fragen sind in `docs/legal/OFFENE-FRAGEN.md` gesammelt.
