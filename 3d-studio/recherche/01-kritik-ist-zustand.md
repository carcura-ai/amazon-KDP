# Kritik Ist-Zustand: 3D-Animationen Carcura

Modus: L99 (Review) · Stand 10.11.2026 · Grundlage: alle Dateien in `lieferung/`, Einzelbilder aus allen Videos in
voller Größe, Rohbilder und entrauschte Bilder aus `out/` direkt verglichen, alle genannten Skripte. Die Sportwagen-Wäsche
gibt es nicht als Video. Sie ist nur über Kontaktbogen, Look-Standbilder und Code bewertet.

## 1. Gesamturteil

Hobby-Niveau. Die Lackschichten-Explosion kommt knapp an untere Semi-Pro heran. Technisch ist alles ordentlich gebaut:
reproduzierbar, über Fronten und Keyframes gesteuert, Text als HTML, Budgets und Kennzeichnung eingehalten. Visuell
erkennt man aber sofort Eigenbau. **Als Erstes sieht man Korn.** Lack, Boden und Stahl körnen auch nach dem
ffmpeg-Entrauschen. Als Zweites stimmen Maßstab und Material nicht: Tropfen sehen aus wie Glaslinsen, Schmutz wie
Konfetti, Schaum wie Filz und Lack wie Kunststoff. Dazu kommt eine Kamera, die nur zuschaut, und das Markengelb landet im
Bild als Orange oder Oliv.

## 2. Die 15 wichtigsten Fehler (nach Wirkung)

**1. Rauschen auf fast jeder Fläche**
- *Sichtbar:* Bei der Keramik-Haube sieht die obere Bildhälfte aus wie Schmirgelpapier. `f_0040` roh und entrauscht sind
  fast gleich körnig. Die Stahlplatte der Lackschichten körnt trotz 192 Samples, der Wäsche-Boden ebenfalls, und im Tunnel
  glitzert der ganze Lack.
- *Ursache:* Dem Ubuntu-Build fehlen Funktionen (geprüft: `_cycles.with_openimagedenoise = False`,
  `with_path_guiding = False`). In `lib/studio.py` Z. 192–194 steht `adaptive_threshold 0.02`, Blender-Standard ist 0,01.
  Viele Materialien liegen im mittleren Rauheitsbereich, den die eigene Skill-Regel verbietet:
  `keramik_schutz.py` Z. 53–54 (Metallic 0,45, Rauheit 0,3, im UV-Akt bis 0,45, Z. 62), `studio_auto.py` Z. 32–35
  (Schwarzlack-Basis 0,5, Gelb 0,25, Rot 0,3), der Boden in Z. 48–59 (Rauheit 0,15–0,6 per Noise), Schaum 0,45,
  Tunnelstahl 0,35 (`tunnel_fahrt.py` Z. 92) und Stahl 0,18 (`lackschichten.py` Z. 23).
- *Behebung:* Größter Hebel ist der offizielle Blender-Build von blender.org. Er kommt als portables Archiv ohne root,
  bringt OpenImageDenoise auf CPU mit und arbeitet im Compositor über den Denoise-Node mit Albedo- und Normal-Pass. Das
  widerspricht der Skill-Regel „keine vorkompilierten Fremd-Bibliotheken“, deshalb muss Alex entscheiden. Ohne OIDN:
  Rauheiten binär halten (Coat 0–0,03, Basis ohne Metallic ≥ 0,6), den Boden mit zwei Zuständen bauen (Pfütze 0,03,
  Beton 0,85) statt mit Verlauf, `adaptive_threshold 0.005` setzen, `adaptive_min_samples 32`, für Standbilder 256–512
  Samples. Nebenwirkung: Rauschen frisst Bitrate. Saubere Bilder sind bei gleichem CRF kleiner (Richtung sicher, Größe
  nicht gemessen).

**2. Falscher Maßstab bei Wasser und Schmutz, daher wirkt alles wie Spielzeug**
- *Sichtbar:* Die Keramik-Perlen haben 2,2–4,8 cm Durchmesser und sind kugelrund. Die Lachen links sehen aus wie
  schwarze Linsen. Der Schmutz liegt als olivgraue Scheiben von 1–4 cm auf dem Lack.
- *Ursache:* `keramik_schutz.py` Z. 125 setzt den Radius auf 0,011–0,024. Beim Schmutz steht der Radius in Z. 187 bei
  3–20 mm und die Dicke in Z. 194 bei r × 0,12. Die Kamera steht 1,5 m entfernt mit 38 mm (Z. 234), der Ausschnitt ist
  damit eine 2,3 m breite Fläche.
- *Physik:* Wassertropfen über der Kapillarlänge (ca. 2,7 mm) drückt die Schwerkraft flach. Kugelperlen von 4 cm gibt es
  nicht, und das Auge merkt das, auch ohne es benennen zu können.
- *Behebung:* Makro-Ausschnitt von 25–40 cm. Perlen 1,5–6 mm groß, große unten abgeflacht (Geometry Nodes: Z-Skalierung
  abhängig vom Radius). Auf der Seite „ohne“ keine Ellipsoide, sondern unregelmäßige flache Lachen: Grid mit
  Noise-Kontur, Solidify 0,5–1 mm. Schmutz als Shader-Schicht mit Staubfilm, Sprenkeln < 1 mm (Voronoi) und Bump. Den
  Baustein gibt es schon: `waesche.py` Z. 27–80 `dreckiger_lack`.

**3. Der Lack spiegelt nichts, deshalb sieht er aus wie Plastik**
- *Sichtbar:* Bei der Keramik ist oben ein rosa-weißer Schleier (Pixel #997E7F), unten stumpfes Rotbraun (#760A0A). Der
  Sportwagen zeigt nur eine weiche helle Fläche und keine durchgehende Lichtkante auf der Schulter.
- *Ursache:* Die Welt ist schwarz (`keramik_schutz.py` Z. 19), es gibt nur zwei Lichter (Z. 231–232). Beim Auto steht das
  HDRI auf 0,55 und die Belichtung auf −0,6 (`studio_auto.py` Z. 107–108). Die Unterbelichtung kaschiert die
  AgX-Entsättigung, statt das Licht richtig zu setzen.
- *Behebung:* Lack wird durch das definiert, was er spiegelt. Eine Lichtbühne aus Emission-Flächen statt Area-Lights
  bauen, weil sich Form und Verlauf nur so steuern lassen: Overhead-Softbox 6 × 3 m mit weichem Randabfall (Gradient
  Texture), 2–3 lange Streifen entlang der Designlinien, Bodenreflektor und schwarze Flags. Bei allen Karten
  `visible_camera = False`. Lack: Basis dunkel, Metallic 0 (Metallic-Lack nur mit Flakes per Voronoi-Normal), Coat 1,
  Coat-Rauheit 0–0,02. Belichtung auf 0 lassen und die Lichter dimmen.

**4. Die Markenfarbe kommt nicht an**
- *Sichtbar:* Die Keramik-Trennlinie hat einen cremeweißen Kern (#FAFAD6) und einen orangen Saum (#F0B57D, #E48440). Die
  Kante der Lackschichten ist oliv (#A7B937, #B8C455). Kein gemessenes Pixel liegt nahe #E8F320. Dazu kommen fünf
  Fremdfarben: Rot, Violett, Blau, Sportwagen-Gelb #F2C500 und Silber.
- *Ursache:* Emission 6–7 (`keramik_schutz.py` Z. 73, `lackschichten.py` Z. 31). AgX zieht helle, gesättigte Farben
  Richtung Weiß, die Spiegelung im Rotlack macht Orange daraus, und die dünne Geometrie mischt mit Schwarz.
- *Behebung:* Das Akzentgelb an einer Testkarte kalibrieren, bis das Ausgabepixel #E8F320 ±5 trifft. Wahrscheinlich
  liegt der Wert um Emission 1–2, das ist ungeprüft. Alternativ Markenelemente als 2D-Ebene im Schnitt bzw. im HTML.
  Farbregel: schwarzer Lack, neutrales Licht, genau ein Gelb als Linie.

**5. Die Kamera schaut nur zu**
- *Sichtbar:* Bei der Keramik fährt die Kamera in 8 s nur 14 cm (Z. 235), und das obere Viertel bleibt leeres Schwarz. Die
  Lackschichten zeigen einen 16°-Bogen, die Wäsche eine einzige Totale über 7 s. Im Tunnel bläht das 26-mm-Weitwinkel
  nah am Auto die Nase auf (Z. 112).
- *Behebung:* Jede Einstellung bekommt eine Bewegung mit Absicht. Makro mit 90–135 mm und Tiefenschärfe (Camera > DOF,
  Fokus-Empty auf der Perle, f/2,8–4), langsamer Slider parallel zur Fläche. Das Auto in der Totale mit 50–85 mm,
  24–35 mm nur für Fahrt-Rigs mit Abstand. Tiefenschärfe erhöht das Rauschen in den Unschärfezonen, ohne OIDN also
  sparsam einsetzen.

**6. Timing und Easing sind physikalisch falsch**
- *Sichtbar:* Tropfen bremsen vor dem Aufprall und landen weich. Perlen gleiten, statt schneller zu werden. Schmutz
  wächst aus dem Lack wie Pilze.
- *Ursache:* `studio.py` Z. 170–177: `weich()` setzt jeden Key auf Bezier `AUTO_CLAMPED`, also Geschwindigkeit 0 an jedem
  Key. Das gilt für alle Tropfen und den Schmutz (`keramik_schutz.py` Z. 145, 204, 216, 227). Der Schmutz skaliert in
  Z. 192–194 in 3 Bildern von 0 auf 1.
- *Behebung:* Fall mit `QUAD` und `EASE_IN`, Aufprall als harter Key plus 2–3 Bilder Squash. Rollen mit `EASE_IN` oder
  per Simulation Zone. Kameras mit eigenen F-Kurven und langem Ausklang statt symmetrischem S. Schmutz braucht eine
  Ursache: ein Spritzer, der mit Richtung ins Bild fliegt, oder ein Zeitraffer, in dem die Staubschicht im Shader wächst.

**7. Der Schaum sieht aus wie Filz**
- *Sichtbar:* Das Auto ist gleichmäßig grau-flauschig überzogen, ohne Glanz, ohne Gewicht, ohne Läufer.
- *Ursache:* `sportwagen_waesche.py` Z. 25: Basis 0,86, Rauheit 0,45. Dazu `waesche.py` Z. 157–191: Icosphären mit
  1–2,6 cm Radius, 5200 je m², und die Belichtung von −0,6 drückt das Weiß ins Grau.
- *Behebung:* Schaum als Masse bauen: Points to Volume (Voxel 4–6 mm), dann Volume to Mesh, Smooth und
  Noise-Displacement. Dicke 1–4 cm, unten dicker, mit Läufern an den Kanten. Material Weiß 0,9 mit nassem Glanz (Coat 0,3,
  Rauheit 0,1) und Voronoi-Bump für die Bläschen. Subsurface rauscht auf CPU, Translucent-Mix ist die günstigere
  Alternative. Beim Spülen rutscht der Schaum in Fetzen ab, statt zu verschwinden.

**8. Der Ablauf der Wäsche stimmt fachlich nicht, und das kostet Glaubwürdigkeit**
- *Sichtbar:* Schaum und Spülen laufen als senkrechte Wischblende von vorn nach hinten. Die Lanze ist ein schwebender
  Kegel, der Strahl ein grauer Fächer schräg nach oben, der das Auto nicht trifft.
- *Ursache:* `sportwagen_waesche.py` Z. 18–19 legt beide Fronten entlang X. `waesche.py` Z. 232–313 baut die Lanze ohne
  Halter und den Strahl aus 2600 Strichen mit Alpha 0,22.
- *Behebung:* Gängige Praxis ist, Schaum von unten nach oben aufzutragen und von oben nach unten zu spülen. Die Fronten
  gehören dann entlang Z (bitte von Alex fachlich bestätigen). Den Strahl als Flachstrahl-Fläche mit Glanz,
  Bewegungsunschärfe und Spritzern beim Aufprall bauen. Die Lanze entweder vollständig zeigen oder vom Bildrand
  anschneiden. Für einen Fachbetrieb wiegt ein falscher Ablauf schwerer als ein schwacher Shader.

**9. Nach dem Spülen wirken die Tropfen wie schwarze Punkte**
- *Sichtbar:* Im Kontaktbogen unten rechts ist die Haube voller schwarzer Sprenkel. Nach der Wäsche sieht das Auto
  dreckiger aus als vorher.
- *Ursache:* Die Tropfen (3–7,5 mm, `waesche.py` Z. 194–222) brechen den schwarzen Boden und die dunkle Wand. Caustics sind
  aus (`studio.py` Z. 197), deshalb werfen Glaskörper dunkle Schatten.
- *Behebung:* Eine helle Overhead-Karte setzen, die sich in jedem Tropfen als Glanzpunkt spiegelt. Im Tropfen-Material
  `Is Shadow Ray` auf Transparent schalten. Shadow Caustics (MNEE, CPU-fähig) an Tropfen, Lack und Licht testen, ob das in
  dieser Szene trägt, ist ungeprüft. In der Totale keine Tropfen zeigen, nur im Makro.

**10. Das Auto ist ein Platzhalter (Modellqualität)**
- *Sichtbar:* Treppenstufen am Seiteneinlass, eine ausgefranste Haubenkante, schwebende gelbe Rechtecke am Dach,
  Achtziger-Keilform, ein Innenraum aus Quadern.
- *Ursache:* `lib/sportwagen.py` baut das Auto aus 18 Querschnitten mit je 10 Punkten (Z. 25–44). Subsurf wird
  angewendet, danach setzen Exact-Booleans auf das dichte Netz (Z. 194–237).
- *Behebung:* Ein Lizenzmodell ist entschieden. Beim Kauf drei Punkte prüfen. Erstens die Lizenz: Viele Stock-Automodelle
  sind wegen Marken- und Designrechten nur redaktionell freigegeben („Editorial“), nötig ist die kommerzielle
  Werbenutzung. Zweitens die Topologie: Quads, Subdivision-fähig, getrennte Teile, Leuchten mit Innenleben. Drittens der
  Maßstab in Metern. Für Schaum und Tropfen eine „Waschhülle“ anlegen: Karosserieteile joinen, Voxel-Remesh 1–2 cm und
  das Ergebnis als unsichtbaren Emitter nutzen, denn die Geometry-Nodes-Logik erwartet einen geschlossenen Körper.

**11. Studio mit Horizontlinie und schwarzem Loch**
- *Sichtbar:* Beim Auto läuft eine harte Linie zwischen Boden und Wand auf halber Bildhöhe. Bei der Keramik ist das obere
  Viertel leer.
- *Ursache:* `studio_auto.py` Z. 109 legt eine 60-m-Ebene an, dazu eine schräge Wand (Z. 122–126).
- *Behebung:* Eine Hohlkehle bauen, also den Boden mit 2–3 m Radius in die Wand ziehen. Die Bodenspiegelung über Fresnel
  abfallen lassen. Bei der Keramik die Kamera tiefer setzen und den Rand mit Fläche oder Bokeh-Lichtern füllen.

**12. In 3 Sekunden wird keine Geschichte klar**
- Keramik: Die ersten 0,5 s sind leer (Bild 1–12). Danach passiert auf beiden Seiten gleichzeitig etwas, das nur mit den
  HTML-Etiketten lesbar ist. Violette Stäbchen mit gelben Funken versteht niemand als UV. Drei Akte zu je etwa 2,2 s sind
  zu kurz.
- Wäsche: In 3 s sieht man ein Spielzeugauto, das einen grauen Pelz bekommt.
- Tunnel: hat nichts mit Aufbereitung zu tun und folgt dem Tutorial-Look (Vorlage laut Skriptkopf: BENY).
- Lackschichten: In 3 s versteht man „Schichten“. Das ist das Einzige, was funktioniert.
- *Behebung:* Hook im ersten Bild, eine Aussage je Einstellung. Der A/B-Unterschied muss ohne Text erkennbar sein, zum
  Beispiel als scharfe gegen verschwommene Spiegelung derselben Lichtleiste.

**13. Lackschichten: Proportion und Material**
- *Sichtbar:* Fünf gleich große Glastabletts. Die Keramik ist eine leuchtende Platte, halb so dick wie der Klarlack. Die
  Perlen wirken wie Murmeln und zeigen einen quadratischen Fensterreflex, der typisch für CG ist.
- *Ursache:* `lackschichten.py` Z. 22–30 setzt die Dicken auf 0,14 / 0,06 / 0,06 / 0,07 / 0,035 und arbeitet mit Alpha
  statt Transmission. Z. 31–32 erzeugt die Emissionskanten, Z. 75 ein quadratisches Hauptlicht von 3,5 × 3,5 m.
- *Behebung:* Ein Stufenschnitt aus einem gewölbten Karosserieblech statt eines Stapels. Keramik als hauchdünner
  Glanzfilm. In der Realität ist sie um Größenordnungen dünner als der Klarlack (Hersteller nennen meist wenige µm,
  Klarlack liegt bei einigen zehn µm). Das sind Richtwerte, vor einer Beschriftung am Datenblatt prüfen. Lichter als
  Streifen statt Quadrat. Widerspruch beim Einsatzort: Der Skriptkopf nennt /keramikversiegelung/, `LIESMICH.md` nennt
  /autopolitur/. Für die Politur fehlt die Kernaussage, nämlich dass die Politur Kratzer im Klarlack einebnet.

**14. Nachbearbeitung und Ausgabe**
- *Sichtbar:* Die Bilder sind weich und verschmiert, `einmal.mp4` hat nur 720 px, im Schwarz liegt ein Grauschleier.
- *Ursache:* `export.sh` Z. 24 filtert mit nlmeans s=3 plus zeitlichem hqdn3d 4, was bei Bewegung Geisterbilder erzeugt,
  und das auf 8-Bit-PNG (`studio.py` Z. 200–201). Z. 19–23 hebt das Schwarz linear pro Kanal an, also alle Schatten.
  Z. 44 nutzt die Standardbreite 720.
- *Behebung:* Sauberer rendern statt stärker filtern. 16 Bit ausgeben. Im Compositor Glare „Fog Glow“ dezent auf
  Lichtkanten (in 4.0 auf CPU vorhanden), eine leichte Vignette, am Schluss feines gleichmäßiges Korn
  (`noise=alls=3:allf=t`), das Restflecken kaschiert. Die Welt direkt so rendern, dass nach AgX 9/9/10 herauskommt.
  Für 1:1 im Web 1080 px ausgeben, denn ein 390-px-Handy mit 3× Pixeldichte braucht etwa 1170 px. Unter 2 MB kommt man
  dabei nur mit sauberen Bildern.

**15. Es gibt keine kanalgerechten Fassungen**
- Alles liegt in 1:1 oder 16:9 vor, ohne Ton und ohne Endkarte. Ein Reel braucht 9:16 in 1080 × 1920, eingebrannte Titel
  in Poppins innerhalb der Sicherheitszonen, eine Logo-Endkarte und Sounddesign. „Kein Text im Bild“ gilt nur für die
  Website.

## 3. Pro Animation

| Animation | Urteil | Begründung |
|---|---|---|
| Lackschichten | **Behalten und verbessern** | Einzige Animation mit klarer 3-s-Aussage, auf CPU gut machbar. Nötig sind Stufenschnitt aus gewölbtem Blech, Streifenlicht, Proportionen, ein rauscharmer Stahl und ein geklärter Einsatzort. Für /autopolitur/ eine eigene Szene „Kratzer im Klarlack → Politur ebnet“. |
| Keramik-Schutz | **Neu konzipieren** | Die A/B-Idee mit Ehrlichkeitslogik (rechts altert auch, nur weniger) ist richtig. Maßstab, Material, UV-Bild und Rauschen tragen sie nicht. Neu als Makro auf schwarzem Lack mit Abklebelinie. |
| Sportwagen-Wäsche | **Neu konzipieren**, Steuerlogik behalten | Fronten und Geometry Nodes sind solide. Shot-Struktur, Ablauf, Schaum, Studio und Auto müssen neu. |
| Tunnel-Fahrt | **Verwerfen** | Kein Bezug zur Leistung, generischer Tutorial-Look. Nassboden, Bewegungsunschärfe und viele Emitter sind auf dieser Hardware am teuersten. Das Motiv „Lichtband über makellosem Lack“ wandert in die Wäsche-Schlusseinstellung. |

## 4. Was ein Profi anders machen würde

**Grundsatz:** 3D zeigt, was eine Kamera nicht kann: Mikroebene, Jahre im Zeitraffer, Schnittbilder. Echtes Video zeigt,
was jeder kennt: Wasser perlt, Schaum läuft. Auf CPU ohne Denoiser schlägt ein Makro-Handyvideo echter Perlen jeden
Wasser-Render. Laut Kommentar in `web/sportwagen-waesche.html` steht auf der Keramikseite „keine Symbolbilder“. Die
beste Lösung dort ist echtes Video plus 3D-Erklärbild.

**Rahmen:** schwarzer Lack, neutrale Lichtbühne, Gelb nur als eine Lichtlinie oder als Grafik. Website in 1:1 oder 4:5,
6–8 s, höchstens 2 MB, Text als HTML. Reel in 9:16, 12–15 s, mit Ton und eingebrannten Poppins-Titeln. Jede Einstellung
ist eine eigene Datei, geschnitten wird in ffmpeg, gerendert wird nur, was im Bild ist.

### A) Keramikversiegelung: Wasser, UV, Schmutz (Reel 14 s, Website-Schnitt aus K2–K5, ca. 8 s)

| Nr | Dauer | Kamera | Bild | Aussage |
|---|---|---|---|---|
| K1 | 0–1,5 s | 120 mm Makro, 10° über der Fläche, f/2,8, Fokus auf der Perle | Ein Tropfen fällt beschleunigt auf schwarzen Lack und zieht sich zur Perle zusammen, eine Lichtleiste spiegelt sich als scharfer Bogen | Hook: So sieht Schutz aus |
| K2 | 1,5–4 s | 85 mm, 35° von oben, Slider quer über die Abklebelinie | Sprühnebel auf beiden Hälften: links flache, unregelmäßige Lachen, rechts runde Perlen | ohne / mit |
| K3 | 4–6 s | 85 mm, die Fläche kippt um 15° | Rechts rollen die Perlen ab und nehmen Staubkörner mit, links bleibt der Film stehen | Wasser läuft leichter ab |
| K4 | 6–8,5 s | 50 mm, 60° Aufsicht | Schlammspritzer kommen von unten ins Bild, dann eine Spülwelle von oben: rechts klar, links Schleier und Reste | Schmutz haftet weniger (kein „perlt komplett ab“) |
| K5 | 8,5–11 s | 85 mm statisch, eine Lichtleiste wandert über die Fläche | Zeitraffer „Monate“ als Overlay: links wird die Spiegelung der Leiste matt und unscharf, die Farbe blasser, rechts bleibt sie deutlich schärfer | UV und Glanz, als vereinfachte Darstellung gekennzeichnet |
| K6 | 11–13 s | 50 mm, Fahrt entlang der Flanke des schwarzen Lizenzautos | Eine gelbe Lichtlinie läuft über die Schulter, Perlen liegen auf der Haube | Ergebnis und Marke |
| K7 | 13–14 s | statisch | Logo, CTA, Hinweis „3D-Animation“ | Handlung |

Für die Website gibt es eine CPU-freundliche Alternative zu K5: ein 3D-Mikroschnitt. Die Klarlack-Oberfläche hat Berge
und Täler, der Keramikfilm ebnet sie ein, die Perle sitzt hoch, das Schmutzkorn findet keinen Halt. Die Materialien sind
undurchsichtig und das Licht kontrolliert, deshalb bleibt das Bild rauscharm.

### B) Autowäsche außen: Schaum, Spülen, Glanz (Reel 15 s)

| Nr | Dauer | Kamera | Bild | Aussage |
|---|---|---|---|---|
| W1 | 0–1,5 s | 50 mm, tief an der Flanke, Streiflicht | Staubfilm und Laufspuren werden im Streiflicht sichtbar | Hook: so kommt er an |
| W2 | 1,5–4 s | 35 mm, 3/4 vorn, leichte Fahrt | Der Strahl der Schaumkanone trifft, der Schaum baut sich von unten nach oben auf | Vorwäsche |
| W3 | 4–6 s | 100 mm Makro an der Tür | Der Schaum sackt ab, Läufer ziehen grau verfärbt nach unten | Schaum löst Schmutz (Einwirkzeit) |
| W4 | 6–9 s | 50 mm, die Kamera begleitet den Flachstrahl | Der Strahl schneidet von oben nach unten eine saubere Bahn, der Schaum rutscht in Fetzen ab | Spülen |
| W5 | 9–11 s | 100 mm auf der Haube | Wasser läuft als Film und Perlen ab, die Lichtleiste spiegelt sich scharf | sauber |
| W6 | 11–14 s | 85 mm, langsamer Orbit über 15°, Hohlkehle | Das saubere Auto, ein Lichtband fährt über Haube und Dach (Light Linking nur aufs Auto) | Glanz |
| W7 | 14–15 s | statisch | Logo, CTA, Hinweis „3D-Animation“ | Handlung |

## 5. Grenzen der Umgebung

**Geprüft:** Blender 4.0.2 (Ubuntu) hat kein OIDN, kein Path Guiding und kein OSL. OpenVDB, Remesh und Fluid (Mantaflow)
sind vorhanden. EEVEE rendert headless über Mesa (Testwürfel 480 px, 32 Samples, 6,5 s). Die Maschine hat 4 Kerne und
15 GB RAM. Cycles braucht laut Keramik-Log etwa 42 s je Bild bei 960 px und 96 Samples.

**Realistisch:**
- Makro- und Schnittbilder mit undurchsichtigen und glänzenden Materialien, Streifenlicht und wenig Glas
- Lackschichten, Mikroschnitt, Lichtband über Lack
- Schaum als Volumen-Mesh, Fronten, Light Linking, Glare im Compositor
- Reels aus 6–7 Einstellungen von 1,5–3 s Länge

**Rechenzeit (linear aus dem Log hochgerechnet, ungeprüft):** 15 s × 24 fps sind 360 Bilder. 1080 × 1920 entspricht
etwa 2,25-mal der Pixel von 960². Bei 96 Samples sind das rund 95 s je Bild, also etwa 9,5 h. Bei 256 Samples sind es
etwa 25 h. Adaptive Sampling kann das senken, Glas und Volumen erhöhen es.

**Nicht realistisch ohne Denoiser:**
- Wasserfilm, Strahl mit Nebel, Gischt: Transmission, Volumen und Bewegungsunschärfe erzeugen Rauschen, das ffmpeg nicht
  entfernt.
- Mantaflow-FLIP für Spülwasser: vorhanden, aber nach meiner Einschätzung auf 4 Kernen in Werbequalität zeitlich nicht
  tragbar.
- Tiefenschärfe, Nassbodenspiegelung und Bewegungsunschärfe gleichzeitig (Tunnel).
- Großflächiger Subsurface-Schaum.
- EEVEE (Legacy in 4.0) rendert ohne Rauschen, aber ohne Raytracing. Lackspiegelungen laufen dann nur über Screen-Space
  und Probes, Glas und Wasser bleiben schwach. Für diese Szenen ist das ungeprüft. Für Lackschichten oder Mikroschnitt
  ist ein Versuch sinnvoll.

**Hebel nach Wirkung:**
1. Offizieller Blender-Build (OIDN und Path Guiding auf CPU), Freigabe durch Alex nötig.
2. Wasser real im Makro filmen, 3D nur für Mikroebene, Schnitt und Zeitraffer.
3. Für die finale Wäsche Renderzeit auf einer gemieteten GPU. Die Kosten habe ich nicht recherchiert.
