#!/usr/bin/env python3
"""Rechtlich saubere Bild-Assets holen; jede Quelle wird in projekte/<name>/assets/LIZENZEN.md protokolliert.

  asset.py emoji <Name> <projekt>                 Microsoft Fluent Emoji 3D (MIT), z. B. Sponge, "Racing car", Sparkles
  asset.py suche "<Begriff>"                      Openverse: nur CC0, gemeinfrei (PDM) oder CC BY
  asset.py hole <openverse-id> <projekt>          laden + Quellenangabe (CC BY: Nennung in die Beschreibung!)
  asset.py freistellen <bild|video> <projekt> [--t 3.2] [--name x]   Hintergrund entfernen (eigenes Material)
Aufruf jeweils mit: python3 -I pipeline/asset.py ...
"""
import argparse, json, re, subprocess, sys, tempfile, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = {"User-Agent": "carcura-reel-studio/1.0"}
FLUENT = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets"
OPENVERSE = "https://api.openverse.org/v1/images/"


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def assets_dir(projekt):
    d = Path(projekt).resolve() / "assets"
    d.mkdir(parents=True, exist_ok=True)
    return d


def log(d, datei, quelle, lizenz, urheber, link, nennung):
    f = d / "LIZENZEN.md"
    if not f.exists():
        f.write_text("| Datei | Quelle | Lizenz | Urheber | Link | Nennung noetig |\n|---|---|---|---|---|---|\n", encoding="utf-8")
    with f.open("a", encoding="utf-8") as fh:
        fh.write(f"| {datei} | {quelle} | {lizenz} | {urheber} | {link} | {nennung} |\n")


def emoji(name, projekt):
    d = assets_dir(projekt)
    snake = name.lower().replace(" ", "_").replace("-", "_")
    folder = urllib.parse.quote(name)
    for path in (f"{folder}/3D/{snake}_3d.png", f"{folder}/Default/3D/{snake}_3d_default.png"):
        try:
            data = get(f"{FLUENT}/{path}")
            break
        except Exception:
            data = None
    if not data:
        sys.exit(f"Emoji '{name}' nicht gefunden – exakten englischen Namen verwenden (github.com/microsoft/fluentui-emoji/tree/main/assets)")
    out = d / f"emoji_{snake}.png"
    out.write_bytes(data)
    log(d, out.name, "Microsoft Fluent Emoji", "MIT", "Microsoft", "github.com/microsoft/fluentui-emoji", "nein")
    print(f"assets/{out.name}")


def suche(begriff):
    q = urllib.parse.urlencode({"q": begriff, "license": "cc0,pdm,by", "mature": "false", "page_size": 10})
    for r in json.loads(get(f"{OPENVERSE}?{q}"))["results"]:
        print(f"{r['id']}  {r['license'].upper()} {r.get('license_version') or ''}  {r.get('width')}x{r.get('height')}  "
              f"{(r.get('title') or '')[:50]}  – {r.get('creator') or '?'} ({r.get('source')})")


def hole(oid, projekt):
    d = assets_dir(projekt)
    r = json.loads(get(f"{OPENVERSE}{oid}/"))
    if r["license"] not in ("cc0", "pdm", "by"):
        sys.exit(f"Lizenz {r['license']} nicht zulaessig (nur CC0, PDM, CC BY)")
    ext = Path(urllib.parse.urlparse(r["url"]).path).suffix.lower() or ".jpg"
    out = d / f"ov_{re.sub(r'[^a-z0-9]+', '_', (r.get('title') or oid).lower())[:40]}{ext}"
    out.write_bytes(get(r["url"]))
    nennung = "nein" if r["license"] in ("cc0", "pdm") else f"JA: {r.get('attribution') or r.get('creator')}"
    log(d, out.name, r.get("source"), f"{r['license'].upper()} {r.get('license_version') or ''}", r.get("creator"),
        r.get("foreign_landing_url"), nennung)
    print(f"assets/{out.name}  ({r['license'].upper()}; {nennung})")


def freistellen(src, projekt, t, name):
    from PIL import Image
    from rembg import new_session, remove
    d = assets_dir(projekt)
    src = Path(src)
    with tempfile.TemporaryDirectory() as tmp:
        img_path = src
        if src.suffix.lower() in (".mp4", ".mov", ".m4v", ".mkv", ".webm"):
            img_path = Path(tmp) / "frame.png"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", str(img_path)], check=True)
        cut = remove(Image.open(img_path).convert("RGBA"), session=new_session("isnet-general-use"))
    cut = cut.crop(cut.getbbox())
    cut.thumbnail((1400, 1400))
    out = d / f"{name or src.stem}_frei.png"
    cut.save(out)
    log(d, out.name, f"eigenes Material ({src.name} @ {t}s)", "eigene Rechte", "Carcura", "-", "nein")
    print(f"assets/{out.name}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("befehl", choices=["emoji", "suche", "hole", "freistellen"])
    ap.add_argument("arg")
    ap.add_argument("projekt", nargs="?")
    ap.add_argument("--t", type=float, default=0.0)
    ap.add_argument("--name")
    a = ap.parse_args()
    {"emoji": lambda: emoji(a.arg, a.projekt), "suche": lambda: suche(a.arg), "hole": lambda: hole(a.arg, a.projekt),
     "freistellen": lambda: freistellen(a.arg, a.projekt, a.t, a.name)}[a.befehl]()
