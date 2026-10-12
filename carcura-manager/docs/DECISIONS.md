# Entscheidungen

Kurz und datiert: was, warum, welche Alternative es gab. Neue Einträge kommen oben dazu.

## 12.10.2026 – Phase 0

**D-006 · Modulsystem baut auf den vorhandenen Entitlements auf**
- Entscheidung: Die Module aus dem Auftrag (Kern, B2B, Wachstum, Lager, Labor, Eigene Rechnungsstellung, Online-Buchung) werden auf die vorhandenen 33 Feature-Schlüssel in `server/src/core/entitlements.ts` abgebildet.
- Warum: Auflösung, Overrides und Add-ons sind bereits getestet.
- Neu hinzu kommt: Die Sperre gilt in allen Betriebsarten, und die Oberfläche blendet gesperrte Module aus.
- Alternative: ein eigenes neues Flag-System. Verworfen, weil es doppelte Logik und ein Migrationsrisiko bedeutet.

**D-005 · Umkehrbare Migrationen per Konvention**
- Entscheidung: Ab der nächsten Migration gehört zu jeder `NNNN_name.sql` eine `NNNN_name.down.sql`. Ein Test prüft Hin, Zurück und Hin auf einer Datenkopie.
- Die 15 vorhandenen Migrationen sind der Basisstand; ihr Rückweg ist die automatische Sicherung vor jeder Migration.
- Alternative: Wechsel des Migrationswerkzeugs. Verworfen, weil das bei SQLite plus Drizzle unverhältnismäßig wäre.

**D-004 · Referrer-Policy bleibt `same-origin`**
- Der Auftrag nennt `strict-origin-when-cross-origin`. `same-origin` ist strenger: Nach außen wird gar kein Referrer gesendet.
- Das Schutzziel des Auftrags ist damit erfüllt.
- Alternative: Umstellung auf den genannten Wert. Kein Vorteil, nur mehr Datenabfluss.

**D-003 · Google Places: kein Verlauf von Bewertungsdaten**
- Befund: Laut Places-API-Richtlinien und Maps Service Specific Terms darf nur die Place-ID dauerhaft gespeichert werden. Breiten- und Längengrad dürfen höchstens 30 Tage zwischengespeichert werden.
- Die Tabelle `competitor_snapshots` speichert heute Bewertung, Anzahl, Status und Preisniveau als Verlauf. Das ist nicht gedeckt.
- Entscheidung für die Umsetzung (Phase 2): nur die Place-ID speichern und live abrufen. Modul „Wachstum“, Standard aus.
- Offen: Was mit den gespeicherten Altdaten geschieht, entscheidet der Inhaber (PLAN.md, E8).
- Alternative: Modul ganz abschalten. Bleibt möglich, falls der Live-Abruf keinen Nutzen bringt.

**D-002 · Argon2id statt scrypt**
- Entscheidung: Neue Hashes mit Argon2id (mindestens m = 19 MiB, t = 2, p = 1 nach OWASP). Bestehende scrypt-Hashes werden bei der nächsten erfolgreichen Anmeldung umgestellt, ohne Zwangs-Reset.
- Quelle (Argon2 in `node:crypto` oder Paket `argon2`) wird in Phase 1 nach Verfügbarkeit in der Container-Node-Version entschieden.
- Alternative: scrypt mit N = 2^17. Zulässig nach OWASP, aber der Auftrag fordert Argon2id bzw. bcrypt.

**D-001 · Prüfung der Rechtsquellen über amtliche Suchauszüge**
- Die Netzwerkfreigabe dieser Umgebung blockiert gesetze-im-internet.de, EUR-Lex, BSI und BMF.
- Geprüft wurde deshalb über eine Websuche, beschränkt auf diese Domains. Ergebnis und Abweichungen stehen in `docs/AUDIT.md`, Abschnitt 8.
- Vor der Umsetzung einer Phase wird der Volltext gelesen, sobald der Zugriff möglich ist.
- Alternative: ungeprüfte Übernahme der Angaben aus dem Auftrag. Verworfen (Grundregel „Erfinde keine Rechtslage“).
