# Website-Umbau carcura.info (November 2026)

Plan und Preise: `docs/WEBSITE-REBUILD-MASTERPLAN.md`.

- `neue-seiten/` – Inhalt der neuen bzw. komplett neu geschriebenen Seiten (cc-lp-Stil, CSS aus Block 1258 + `extra.css`):
  Startseite (mit AutomotiveBusiness-JSON-LD), Keramikversiegelung (Seite 777), Flecken im Autositz (neu), Tierhaare entfernen (neu).
- `alte-seiten/edits.py` – exakte Austauschregeln für die bestehenden Seiten (Leistungen, Anfragen, Innenreinigung, Geruch,
  Wohnmobil, Politur, Leasingrückgabe, Hol- & Bring) und den Block „Schnellanfrage“. Jede Regel nennt die erwartete Trefferzahl.
- `alte-seiten/build.py` – wendet die Regeln auf das gerenderte Live-HTML an, baut Vorschauen und prüft alle `?leistung=`-Links
  gegen das Anfrageformular. `check.js` – Handy-Prüfung (390 px), JavaScript-Fehler, Textauszug für die Tests.
- `tests/` – Berichte der Simulationsrunden (Personas, Abbrüche, Widersprüche).

Ergebnis Anfragen von 15 Personas: Ausgangsmessung 5 · Runde 1 6 · Runde 2 11 · Runde 3 13 (kein Abbruch im ersten Bildschirm). Kontrollpersonas Runde 3: 4/5 bekannte, 1/3 neue (danach Budget, Leder, Geruch ergänzt).
Live geht nichts ohne Freigabe; vor dem Go-live die Regeln gegen den Roh-Inhalt in WordPress prüfen (Trefferzahl), danach live nachlesen.
