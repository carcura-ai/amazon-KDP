#!/usr/bin/env python3
"""Anti-Slop-Pruefung: misst ein Reel gegen das Zurueckhaltungs-Budget aus references/anti-slop.md.

Aufruf: python3 -I pipeline/qc.py projekte/<name>   (liest export/props.json, das props.py schreibt)
Richtung in edit.json: "richtung": "ruhig" | "ausgewogen" (Standard) | "energisch".
Ein Overlay darf das Budget nur mit Begruendung im Feld "note" ueberschreiten.
Gibt Verstoesse aus; Exit-Code 0 (nur Hinweis, blockiert render.sh nicht).
"""
import json
import sys
from pathlib import Path

# je Richtung: (min, max) – Werte aus dem Budget in references/anti-slop.md
BUDGET = {
    "ruhig":      {"grafik_10s": 2, "text_gleichzeitig": 1, "woerter_titel": 5, "zooms_min": 6,  "sfx_10s": 1, "glitch": 0, "stile": 2},
    "ausgewogen": {"grafik_10s": 3, "text_gleichzeitig": 2, "woerter_titel": 7, "zooms_min": 10, "sfx_10s": 2, "glitch": 1, "stile": 3},
    "energisch":  {"grafik_10s": 4, "text_gleichzeitig": 2, "woerter_titel": 7, "zooms_min": 16, "sfx_10s": 4, "glitch": 3, "stile": 3},
}
TEXT_KEYS = ("text", "line1", "line2", "title", "main", "kicker", "sub", "label")
NO_GRAPHIC = {"blur", "letterbox", "glint"}  # Bildkorrektur, kein Grafik-Ereignis

proj = Path(sys.argv[1])
props = json.loads((proj / "export" / "props.json").read_text(encoding="utf-8"))
edit = json.loads((proj / "edit.json").read_text(encoding="utf-8"))
richtung = edit.get("richtung", "ausgewogen")
B = BUDGET[richtung]
fps = props.get("fps", 30)
T = max([c["at"] + (c["to"] - c["from"]) / c.get("rate", 1) for c in props["clips"]] + [1])
ov = [o for o in props.get("overlays", []) if o.get("type") not in NO_GRAPHIC]
befunde = []


def flag(text, o=None):
    if o is not None and o.get("note"):
        return  # begruendete Ausnahme
    befunde.append(text)


def fenster(zeiten, limit, was):
    """Gleitendes 10-s-Fenster; meldet jede Stelle, an der mehr als limit Ereignisse liegen."""
    zeiten = sorted(zeiten)
    gemeldet = -99.0
    for i, t in enumerate(zeiten):
        n = sum(1 for u in zeiten[i:] if u < t + 10)
        if n > limit and t - gemeldet >= 10:
            befunde.append(f"{was}: {n} in 10 s ab {t:.1f} s (Budget {richtung}: {limit})")
            gemeldet = t


# 1. Grafik-Ereignisse und Sounds je 10 s
fenster([o["from"] for o in ov if not o.get("note")], B["grafik_10s"], "Grafiken")
fenster([s["at"] for s in props.get("sfx", [])], B["sfx_10s"], "Sounds")

# 2. Gleichzeitige Textbloecke (ohne Untertitel; Dauerelemente wie timer ueber > halbe Laenge zaehlen nicht)
kurz = [o for o in ov if o["to"] - o["from"] < T / 2]
for o in kurz:
    gleich = [p for p in kurz if p is not o and p["from"] < o["to"] and p["to"] > o["from"] and any(p.get(k) for k in TEXT_KEYS)]
    if any(o.get(k) for k in TEXT_KEYS) and len(gleich) + 1 > B["text_gleichzeitig"]:
        flag(f"{o['type']} bei {o['from']:.1f} s: {len(gleich) + 1} Textbloecke gleichzeitig (Budget {B['text_gleichzeitig']})", o)

# 3. Woerter je Titel und Lesezeit (0,5 s + 0,25 s je Wort)
for o in ov:
    for k in ("text", "line1", "line2", "title", "main"):
        if not isinstance(o.get(k), str):
            continue
        n = len(o[k].replace("\n", " ").split())
        if n > B["woerter_titel"]:
            flag(f"{o['type']}.{k} bei {o['from']:.1f} s: {n} Woerter (Budget {B['woerter_titel']})", o)
    woerter = sum(len(str(o.get(k, "")).split()) for k in TEXT_KEYS)
    if woerter and o["to"] - o["from"] < 0.5 + 0.25 * woerter:
        flag(f"{o['type']} bei {o['from']:.1f} s: {o['to'] - o['from']:.1f} s sichtbar, Lesezeit {0.5 + 0.25 * woerter:.1f} s noetig", o)

# 4. Zooms pro Minute und gleichfoermige Zooms (Zoom auf jedem Schnitt gleich gross)
zooms = [z for z in props.get("zooms", []) if z["scale"][0] != z["scale"][1] or z["scale"][0] != 1]
pro_min = len(zooms) / (T / 60)
if pro_min > B["zooms_min"]:
    befunde.append(f"Zooms: {pro_min:.0f} pro Minute (Budget {richtung}: {B['zooms_min']}) – auto.zoom aus oder Zooms gezielt setzen")
gleich = {tuple(z["scale"]) for z in zooms}
if len(zooms) >= 4 and len(gleich) <= 2:
    befunde.append(f"Zooms: {len(zooms)} Zooms mit nur {len(gleich)} Groessen – wirkt maschinell, Staerke nach Bedeutung variieren")

# 5. Glitch/Flash im ganzen Video
glitch = sum(1 for c in props["clips"] if c.get("tin") in ("glitch", "flash"))
if glitch > B["glitch"]:
    befunde.append(f"Glitch/Flash: {glitch} im Video (Budget {richtung}: {B['glitch']})")

# 6. Gleicher Sound auf jedem Element (Stock-Whoosh-Teppich)
namen = [s["name"] for s in props.get("sfx", [])]
for nm in set(namen):
    if namen.count(nm) >= 5 and nm in ("whoosh", "whip", "pop"):
        befunde.append(f"Sound '{nm}' {namen.count(nm)}x – nicht jedes Element braucht einen Sound (auto.sfx pruefen)")

# 7. Animationsstile (Anzahl verschiedener Overlay-Typen ist eine gute Naeherung)
stile = {o["type"] for o in ov if o["type"] not in ("sticker",)}
if len(stile) > B["stile"] + 2:
    befunde.append(f"{len(stile)} verschiedene Grafik-Typen ({', '.join(sorted(stile))}) – ein wiederkehrendes Element traegt die Identitaet besser")

print(f"Anti-Slop-Pruefung ({richtung}, {T:.1f} s, {len(ov)} Grafiken, {len(namen)} Sounds, {len(zooms)} Zooms):")
print("\n".join("  – " + b for b in befunde) if befunde else "  ok – Budget eingehalten")
