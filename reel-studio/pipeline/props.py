#!/usr/bin/env python3
"""Fuehrt auto_edit.json (Clips, Woerter) und edit.json (Grafiken, Look) zu Remotion-Props zusammen
und schreibt zusaetzlich eine SRT-Datei (Import in DaVinci Resolve, CapCut, Premiere).

Aufruf: python3 -I pipeline/props.py projekte/<name>
"""
import json, sys
from pathlib import Path

proj = Path(sys.argv[1]).resolve()
auto = json.loads((proj / "analysis" / "auto_edit.json").read_text(encoding="utf-8"))
edit = json.loads((proj / "edit.json").read_text(encoding="utf-8"))
props = {**auto, **edit}  # edit.json darf Clips/Woerter gezielt ueberschreiben
(proj / "export").mkdir(exist_ok=True)
(proj / "export" / "props.json").write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")


def ts(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


# SRT: Zeilen mit max. 32 Zeichen, Umbruch an Satzzeichen
cues, cur = [], []
for w in props["words"]:
    cur.append(w)
    text = " ".join(x["w"] for x in cur)
    if len(text) > 32 or w["w"][-1] in ".!?,":
        cues.append(cur); cur = []
if cur:
    cues.append(cur)
srt = "\n".join(f"{i}\n{ts(c[0]['s'])} --> {ts(c[-1]['e'])}\n{' '.join(x['w'] for x in c)}\n"
                for i, c in enumerate(cues, 1))
(proj / "export" / f"{proj.name}.srt").write_text(srt, encoding="utf-8")
