# Referenzblätter Miro & Lotte — Erzeugung und Figurenkonsistenz-Prüfung

Erzeugt lokal mit Fooocus (SDXL Base 1.0, kommerziell nutzbar, siehe `README.md`), gesteuert per
Playwright-Automatisierung der sichtbaren Weboberfläche (`scripts/fooocus-generate.mjs`) —
**nicht** über die interne Gradio-API, wie angeordnet. CPU-only (keine GPU vorhanden, siehe
`gpu-check.md`): eine einzelne Generierung dauerte **~94 Minuten**.

## Miro — vollständige Einstellungen (für Reproduzierbarkeit)

| Feld | Wert |
|---|---|
| Modell | sd_xl_base_1.0.safetensors (Base Model, kein Refiner) |
| LoRA | sd_xl_offset_example-lora_1.0.safetensors, Gewicht 0,1 (Fooocus-Standard) |
| Performance | Speed (Fooocus-Standard) |
| Aspect Ratio | 1152×896 (Fooocus-Standard, nicht geändert) |
| Seed | **424242** (fest, „Random" deaktiviert) |
| Bildanzahl | 1 |
| Styles | Fooocus V2, Fooocus Enhance, Fooocus Sharp (Fooocus-Standardauswahl, nicht geändert) |
| Positiv-Prompt | `warm children's book illustration, thick slightly irregular ink outlines, flat colors without gradients, rounded child-friendly proportions, no photorealism, simple flat ground shadow only, no text in image, young rounded chibi fox character named Miro, warm reddish-brown fur, light cream belly, bright turquoise tail tip, wearing only a small braided fir-twig bracelet with one wooden bead, big friendly eyes, no other clothing, character reference sheet, turnaround sheet, full body front view on the left, full body side view in the middle, three small head close-ups on the right showing happy smiling expression, curious expression with head tilted, and thoughtful expression scratching ear with paw, clean white background, consistent character design, orthographic reference sheet layout` |
| Negativ-Prompt | `text, watermark, logo, signature, extra limbs, extra fingers, extra tail, deformed paws, blurry, photorealistic, adult human proportions, scary, dark horror shadows, brand logo, clothed fox in full outfit, realistic fur texture, franchise character, Disney style, anime style` |
| Ergebnisdatei | `referenzblatt-miro.png` (lokal, .gitignore) |
| Generiert am | 2026-08-25, gestartet 17:47 Uhr, fertig 19:21 Uhr |

**Hinweis:** PNG-Metadaten wurden von Fooocus nicht eingebettet (Option „Save Metadata to Images"
war nicht aktiviert) — die Tabelle oben ist die verbindliche Aufzeichnung aller Einstellungen.

## Figurenkonsistenz-Prüfung Miro gegen `character-bibles/miro.md`

| Merkmal aus Character Bible | Im generierten Bild? | Bewertung |
|---|---|---|
| Rundliche, chibihafte Proportionen | Ja | Trifft zu |
| Warmes Rotbraun, heller Bauch | Ja | Trifft zu |
| Türkise **Schwanzspitze** | **Nein** — Schwanzspitze ist weiß, Türkis erscheint stattdessen als Schal/Schärpe über der Brust | **Abweichung** |
| Tannenzweig-Armband mit einer Holzperle | **Nein** — nicht erkennbar, stattdessen die türkise Schärpe | **Abweichung** |
| Keine durchgehende Kleidung außer Armband | **Nein** — trägt eine Art Schärpe/Gürtel-Kombination | **Abweichung** |
| 3 unterscheidbare Gesichtsausdrücke (fröhlich/neugierig/nachdenklich mit Ohr-Kratz-Geste) | Teilweise — alle 4 Posen wirken ähnlich fröhlich, keine erkennbare Ohr-Kratz-Geste | **Abweichung** |
| Keine Markenähnlichkeit (Originalitätsprüfung) | Ja, kein erkennbarer Bezug zu bekannten Fuchsfiguren | Trifft zu |

**Ergebnis: NICHT vollständig figurenkonsistent zur Character Bible.** Das Modell hat die
türkise Kennfarbe an die falsche Stelle gesetzt (Schärpe statt Schwanzspitze) und das
Accessoire falsch interpretiert (Schärpe statt Tannenzweig-Armband). Gesamtstil (Proportionen,
Fellfarbe, Wärme der Illustration) trifft den Charakterbogen gut.

## Lotte — Einstellungen

| Feld | Wert |
|---|---|
| Seed | **434343** (fest) |
| Übrige Einstellungen | identisch zu Miro (Modell, Performance, Aspect Ratio, Styles) |
| Positiv-Prompt | `..., young rounded owl character named Lotte, blue-grey feathers, round glasses made of two small twigs, perched pose, character reference sheet, turnaround sheet, ...` (vollständig siehe `scripts/fooocus-generate.mjs`) |
| Ergebnisdatei | `referenzblatt-lotte.png` (lokal, .gitignore) |
| Generiert am | 2026-08-25, gestartet ca. 19:30 Uhr, fertig 20:57 Uhr (~87 Min.) |

## Figurenkonsistenz-Prüfung Lotte gegen `character-bibles/lotte.md`

| Merkmal aus Character Bible | Im generierten Bild? | Bewertung |
|---|---|---|
| Blaugraues Gefieder | Teilweise — mehrere Panels zeigen dunkelblaues/weißes Gefieder statt blaugrau, andere Panels zeigen graue oder braune/beige Varianten | **Abweichung** |
| Runde Brille aus zwei Ästchen | **Nein** — keine erkennbare Brille als Accessoire, die großen Augen mit dunklem Rand wirken nur brillenartig (typischer niedlicher Eulen-Cartoon-Stil, kein Ästchen-Accessoire) | **Abweichung** |
| Sitzende Pose (Ast) | Ja, die meisten Panels zeigen Lotte auf einem Ast sitzend | Trifft zu |
| Rundliche, kindgerechte Proportionen | Ja | Trifft zu |
| **Ein** konsistentes Design über das ganze Blatt | **Nein** — das Blatt zeigt mehrere sichtbar unterschiedliche Eulen-Varianten (blau/weiß, grau/braun, komplett beige), keine elf Ansichten derselben Figur | **Abweichung** |
| Keine Markenähnlichkeit | Ja, kein erkennbarer Bezug zu bekannten Eulenfiguren | Trifft zu |

**Ergebnis: NICHT figurenkonsistent.** Stärkere Abweichung als bei Miro — das Modell hat mehrere
unterschiedliche Farbvarianten statt einer einzelnen konsistenten Figur erzeugt, das Ästchen-
Brillen-Accessoire fehlt vollständig.

**Bekannte kleine Prompt-Ungenauigkeit:** Der Ausdruckstext übernimmt „scratching ear with paw"
unverändert aus der gemeinsamen Vorlage — für eine Eule wäre „with wing" passender. Nicht vor dem
Lauf korrigiert (Zeitkosten einer erneuten ~90-Minuten-Generierung gegen geringen Nutzen abgewogen);
bei einer eventuellen Neu-Generierung zu beheben.

## Gesamtergebnis dieser Stufe

Beide Referenzblätter liegen vor (Miro: `referenzblatt-miro.png`, Lotte: `referenzblatt-lotte.png`),
sind aber **nicht freigabefähig** — beide weichen von ihrer Character Bible ab (Miro: Kennfarbe/
Accessoire falsch platziert; Lotte: kein einzelnes konsistentes Design, Brillen-Accessoire fehlt).
Wie angeordnet: keine der 24 Szenenillustrationen erzeugt, bevor die Figurenkonsistenz bestanden ist.
Diese ist für **beide Figuren nicht bestanden**.

**Optionen für den Nutzer:**
1. Character Bible an die generierten Designs anpassen (pragmatisch, kein weiterer Rechenaufwand).
2. Prompt schärfen (Accessoires expliziter/isolierter beschreiben, „single consistent character,
   not multiple variants") und neu generieren — ca. 90 Minuten Rechenzeit je Versuch auf dieser
   CPU-only-Hardware, siehe `gpu-check.md`.
3. Diese Bilder als Stil-/Grobreferenz akzeptieren und die Detailkorrektur (Schwanzspitze, Armband,
   Brille) im nächsten Illustrationsschritt manuell/gezielt nachschärfen.

Lauf stoppt hier für die visuelle Freigabe durch den Nutzer, wie angeordnet.
