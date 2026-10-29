#!/usr/bin/env python3
"""Handerkennung (MediaPipe Hand Landmarker): Handflaeche je Frame + Ereignisse (Hand hebt sich, Hand oeffnet sich).

Aufruf:
  python3 -I pipeline/hand.py projekte/<name> [--nur A1,B3] [--fps 15]   alle (oder genannte) Videobausteine
  python3 -I pipeline/hand.py <video.mp4> [--fps 15]                       einzelne Datei (Test), JSON neben der Datei
Ausgang: projekte/<name>/analysis/hand/<datei>.json
  {"w", "h", "fps", "samples": [[t, x, y, offen, groesse, seite], ...], "events": [{"t", "typ": "hebt"|"offen"|"senkt", ...}]}
  t in Sekunden der Quelldatei, x/y/groesse relativ zur Bildbreite/-hoehe (Handflaechenmitte), offen 0..1.
props.py rechnet das fuer das Overlay "handcard" auf die Zeitleiste und den Bildausschnitt um.
"""
import argparse, json, subprocess
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MODEL = HERE / "daten" / "hand_landmarker.task"
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
PALM = [0, 5, 9, 13, 17]          # Handgelenk + Fingeransaetze = Handflaeche
TIPS, BASES = [8, 12, 16, 20], [5, 9, 13, 17]


def probe(f):
    s = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                   "stream=width,height:stream_side_data=rotation", "-of", "json", str(f)],
                                  capture_output=True, text=True).stdout)["streams"][0]
    w, h = s["width"], s["height"]
    rot = next((abs(int(d.get("rotation", 0))) for d in s.get("side_data_list", []) if "rotation" in d), 0)
    return (h, w) if rot in (90, 270) else (w, h)


def frames(f, fps, width=480):
    """Liefert (t, rgb) mit fester Abtastrate; ffmpeg dreht/skaliert (Autorotation an)."""
    w, h = probe(f)
    sh = round(h * width / w / 2) * 2
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(f), "-vf", f"fps={fps},scale={width}:{sh}", "-f", "rawvideo",
                          "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    n, size = 0, width * sh * 3
    while True:
        buf = p.stdout.read(size)
        if len(buf) < size:
            break
        yield n / fps, np.frombuffer(buf, np.uint8).reshape(sh, width, 3)
        n += 1
    p.wait()


def analyse(f, fps):
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision
    if not MODEL.exists():
        MODEL.parent.mkdir(exist_ok=True)
        subprocess.run(["curl", "-sSL", "-m", "120", "-o", str(MODEL), MODEL_URL], check=True)
    opts = vision.HandLandmarkerOptions(base_options=BaseOptions(model_asset_path=str(MODEL)), running_mode=vision.RunningMode.VIDEO,
                                        num_hands=2, min_hand_detection_confidence=0.5, min_tracking_confidence=0.5)
    w, h = probe(f)
    samples = []
    with vision.HandLandmarker.create_from_options(opts) as lm:
        for t, img in frames(f, fps):
            res = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(img)), int(t * 1000))
            best = None
            for pts, hd in zip(res.hand_landmarks, res.handedness):
                xs, ys = np.array([p.x for p in pts]), np.array([p.y for p in pts])
                palm = (xs[PALM].mean(), ys[PALM].mean())
                groesse = float(np.hypot(xs[5] - xs[17], ys[5] - ys[17]) * 2.2)
                # Offen: Fingerspitzen weit weg vom Handgelenk im Verhaeltnis zu den Fingeransaetzen
                reach = np.hypot(xs[TIPS] - xs[0], ys[TIPS] - ys[0]) / (np.hypot(xs[BASES] - xs[0], ys[BASES] - ys[0]) + 1e-6)
                offen = float(np.clip((reach.mean() - 1.1) / 0.8, 0, 1))
                cand = [round(t, 3), round(float(palm[0]), 4), round(float(palm[1]), 4), round(offen, 2), round(groesse, 4),
                        hd[0].category_name[0]]
                if best is None or cand[4] > best[4]:  # bei zwei Haenden die groessere (naehere)
                    best = cand
            if best:
                samples.append(best)
    return {"w": w, "h": h, "fps": fps, "samples": glaetten(samples, fps), "events": ereignisse(samples, fps)}


def glaetten(s, fps):
    """Leichte Glaettung (gleitender Mittelwert ueber 3 Werte) gegen Zittern; Luecken bleiben Luecken."""
    out = []
    for i, x in enumerate(s):
        nb = [y for y in s[max(0, i - 1):i + 2] if abs(y[0] - x[0]) <= 1.5 / fps]
        out.append([x[0], *[round(float(np.mean([y[k] for y in nb])), 4) for k in (1, 2, 3, 4)], x[5]])
    return out


def ereignisse(s, fps):
    """hebt: Handflaeche steigt in <= 1 s um >= 12 % der Bildhoehe · offen: Hand oeffnet sich · senkt: faellt wieder."""
    ev, last = [], {}
    for i, x in enumerate(s):
        fenster = [y for y in s[:i] if x[0] - 1.0 <= y[0] < x[0]]
        if fenster:
            hoch = max(y[2] for y in fenster) - x[2]
            tief = x[2] - min(y[2] for y in fenster)
            if hoch >= 0.12 and x[0] - last.get("hebt", -9) > 1.5:
                start = next(y for y in fenster if y[2] == max(z[2] for z in fenster))
                ev.append({"t": start[0], "typ": "hebt", "oben": x[0], "x": x[1], "y": x[2]}); last["hebt"] = x[0]
            if tief >= 0.12 and x[0] - last.get("senkt", -9) > 1.5 and last.get("hebt", -9) > last.get("senkt", -9):
                ev.append({"t": x[0], "typ": "senkt"}); last["senkt"] = x[0]
        prev = s[i - 1] if i else None
        if prev and prev[3] < 0.5 <= x[3] and x[0] - prev[0] <= 1.5 / fps and x[0] - last.get("offen", -9) > 1.0:
            ev.append({"t": x[0], "typ": "offen", "x": x[1], "y": x[2]}); last["offen"] = x[0]
    return ev


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("ziel")
    ap.add_argument("--nur", default="")
    ap.add_argument("--fps", type=int, default=15)
    a = ap.parse_args()
    ziel = Path(a.ziel).resolve()
    if ziel.is_file():
        jobs = [(ziel, ziel.with_suffix(".hand.json"))]
    else:
        data = json.loads((ziel / "analysis" / "blocks.json").read_text(encoding="utf-8"))
        nur = set(filter(None, a.nur.split(",")))
        alle = {**data["blocks"], **data["broll"]}
        srcs = {b["src"] for k, b in alle.items() if (not nur or k in nur) and not b["src"].endswith((".wav", ".m4a", ".mp3"))}
        jobs = [(ROOT / "remotion" / "public" / s, ziel / "analysis" / "hand" / (Path(s).name + ".json")) for s in sorted(srcs)]
    for src, out in jobs:
        r = analyse(src, a.fps)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(r), encoding="utf-8")
        ev = ", ".join(f"{e['typ']} {e['t']:.2f}s" for e in r["events"]) or "keine"
        print(f"{src.name}: Hand in {len(r['samples'])} Frames ({len(r['samples']) / a.fps:.1f}s) · Ereignisse: {ev}")
