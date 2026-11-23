"""Apply the Carcura visual overlay to an existing dist directory."""
import json
import re
import shutil
import sys
from pathlib import Path

patch = Path(__file__).resolve().parent
dist = Path(sys.argv[1]).resolve()
home = dist / "index.html"
services = dist / "leistungen/index.html"
html = home.read_text(encoding="utf-8")
if 'class="studio-opening"' in html:
    raise SystemExit("Das Design-Update wurde hier bereits eingespielt.")
hero = re.search(r'<section class="hero" aria-labelledby="h1">(.*?)</section>', html, re.S)
film = re.search(r'<section class="film" id="film".*?</section>', html, re.S)
if not hero or not film:
    raise SystemExit("Die Startseite entspricht nicht dem erwarteten Build.")
data = re.search(r'<script type="application/json" id="film-data">(.*?)</script>', film[0], re.S)
frames = json.loads(data[1])
if len(frames) != 15:
    raise SystemExit("Die 15 erwarteten Filmzustände fehlen.")
body = hero[1]
body = re.sub(r'<div class="hero-media">.*?</div>', '', body, count=1, flags=re.S)
body = body.replace('<div class="wrap">','<div class="studio-content">',1)
body = re.sub(r'</div>\s*<p class="hero-tag">.*?</p>\s*$', '''  <div class="studio-controls" role="group" aria-label="Filmkapitel">
   <button type="button" data-play>Film abspielen</button>
   <button type="button" data-shot="0" aria-pressed="true">Außenwäsche</button>
   <button type="button" data-shot="4" aria-pressed="false">Innenraum</button>
   <button type="button" data-shot="8" aria-pressed="false">Politur</button>
   <button type="button" data-shot="10" aria-pressed="false">Keramik</button>
  </div>
  <p class="studio-label">Außenwäsche · So kommt es oft an.</p>
  <p class="hero-tag">KI-Inszenierung auf Basis unserer Hallenfotos</p>
 </div>''', body, flags=re.S)
opening = f'''<section class="studio-opening" id="film" aria-labelledby="h1">
 <div class="studio-picture" aria-hidden="true">
  <img src="{frames[0]['src']}" width="762" height="506" alt="" fetchpriority="high">
  <img width="762" height="506" alt="" style="opacity:0">
 </div>
 <div class="studio-shade" aria-hidden="true"></div>{body}
</section>
<script type="application/json" id="studio-frames">{data[1]}</script>'''
html = html.replace(hero[0], opening, 1).replace(film[0], '', 1)
html = html.replace('<body>', '<body class="carcura-finish">', 1)
html = html.replace('</head>', '<link rel="stylesheet" href="assets/css/carcura-finish.css">\n</head>', 1)
html = html.replace('<script src="assets/js/film.js" defer></script>',
                    '<script src="assets/js/carcura-finish.js" defer></script>',1)
for frame in frames:
    if not (dist / frame['src']).is_file():
        raise SystemExit(f"Filmbild fehlt: {frame['src']}")
if not services.is_file():
    raise SystemExit("Die Leistungsübersicht fehlt. Bitte vollständiges dist verwenden.")
service_html = services.read_text(encoding="utf-8")
main = re.search(r'<main\b[^>]*>.*?</main>',service_html,re.S|re.I)
if not main:
    raise SystemExit("Hauptinhalt der Leistungsübersicht nicht gefunden.")
# Limit media removal to the overview's main content. Keep shared logo and nav.
content = re.sub(r'<picture\b[^>]*>.*?</picture>', '', main[0], flags=re.S|re.I)
content = re.sub(r'<img\b[^>]*>', '', content, flags=re.I)
content = re.sub(r'<div\b[^>]*class="[^"]*\bphoto\b[^"]*"[^>]*>\s*</div>', '',content,flags=re.I)
for path in ('assets/css/carcura-finish.css','assets/js/carcura-finish.js'):
    target = dist / path
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(patch / path,target)
home.write_text(html,encoding="utf-8")
services.write_text(service_html.replace(main[0],content,1),encoding="utf-8")
print("Startseite aktualisiert. Bilder im Hauptinhalt der Leistungsübersicht entfernt.")
