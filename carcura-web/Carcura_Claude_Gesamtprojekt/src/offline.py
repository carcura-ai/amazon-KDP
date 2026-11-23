#!/usr/bin/env python3
"""Erzeugt dist-offline/: dieselbe Website mit relativen Pfaden, damit sie per Doppelklick
auf index.html ohne Server läuft (z. B. unter Windows ohne Python). Nur zur Ansicht, nicht für den Livebetrieb."""
import os, re, shutil

P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(P, "dist"), os.path.join(P, "dist-offline")
shutil.rmtree(OUT, ignore_errors=True)
shutil.copytree(SRC, OUT)


def rel(target, depth):
    """'/leistungen/#preise' -> '../leistungen/index.html#preise' aus einer Seite in Tiefe depth."""
    path, frag = (target.split("#", 1) + [""])[:2]
    path, query = (path.split("?", 1) + [""])[:2]
    up = "../" * depth
    if path == "/" or path == "":
        p = up + "index.html"
    elif path.endswith("/"):
        p = up + path.strip("/") + "/index.html"
    else:
        p = up + path.lstrip("/")
    return p + ("?" + query if query else "") + ("#" + frag if frag else "")


for root, _, files in os.walk(OUT):
    for f in files:
        if not f.endswith(".html"):
            continue
        fp = os.path.join(root, f)
        depth = len(os.path.relpath(fp, OUT).split(os.sep)) - 1
        h = open(fp, encoding="utf8").read()
        h = re.sub(r'((?:href|src|data-full|content="0;url)=?"?)(/[^"\s]*)', lambda m: m.group(1) + rel(m.group(2), depth) if not m.group(2).startswith("//") else m.group(0), h)
        h = re.sub(r'("src":\s*")(/assets/[^"]+)', lambda m: m.group(1) + rel(m.group(2), depth), h)
        h = re.sub(r'<script>location\.replace\([^<]*</script>', "", h)  # Weiterleitungs-Platzhalter: Meta-Refresh genügt
        h = re.sub(r'<link rel="preload"[^>]*>', "", h)  # Preload mit crossorigin stört unter file://
        open(fp, "w", encoding="utf8").write(h)
print("dist-offline erstellt")
