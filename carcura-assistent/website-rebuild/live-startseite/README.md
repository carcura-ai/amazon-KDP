# Live-Startseite (16.11.2026)
- `htmlblock.html`: Inhalt des HTML-Blocks im Template-Part `kubio//front-header` (WP-ID 28). Generator: `gen.py` (liest die freigegebene Vorschau).
- Nach dem Erzeugen wurden live drei CSS-Korrekturen ergänzt (Linkfarben mit !important, Schrift, margin-block -30px); `htmlblock.html` ist der Stand davor.
- Galerie: WP-Seite 1655 (/galerie/), Quelle `galpage.html` (live ergänzt um Breiten-Override).
- Schriften: Systemschrift (woff2-Upload in WordPress nicht erlaubt). Sora/Inter erst, wenn woff2 erlaubt ist.
- Rollback: alter Inhalt von Part 28 steht im Sitzungsverlauf (Abschnitt `wp:kubio/navigation` + `cc-lp__trust`).

## Rollout auf alle Seiten (16.11.2026)
- Header (neu, Systemschrift, Sticky, mobiles Menü): Template-Teile `kubio//header` (29) und `kubio//header_ueber-uns` (26; das Template full-width nutzt diesen).
- Globale Design-Ebene: `<style id="cx-layer">` + `<script id="cx-layer-js">` im Footer-Teil `kubio//footer` (27) vor `<style id="cc-fix-css">`. Sie überschreibt die Systeme cc-lp, cc-sv, cc-rq, cc-fleet, cc-about, cc-partner (Schrift, Größen, Hintergrundmuster je Seite über body.page-id-N, Funkeln, Medien ausgeblendet außer Über uns).
- Medien sind per CSS ausgeblendet, nicht aus dem HTML gelöscht. Aufräumen der Seiteninhalte (tote Bild-Tags) ist ein späterer Schritt.
- Galerie: Seite 1655, Duplikate entfernt (Politur-/Abperl-Standbild, Grill-Paar).
