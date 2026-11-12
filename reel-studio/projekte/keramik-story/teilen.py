"""Teilt die fertige Story in zwei Teile für Instagram (ein Story-Abschnitt darf höchstens 60 s lang sein).

Schnitt direkt vor „Genau da setzen wir an“: Teil 1 endet mit der offenen Frage „Aber wer schützt ihn?“,
Teil 2 beginnt mit der Lösung. Aufruf: python3 teilen.py   → ausgabe/keramik-story-teil1.mp4 und -teil2.mp4
"""
import json
import subprocess
from pathlib import Path

AUS = Path(__file__).resolve().parent / "ausgabe"
z = json.load(open(AUS / "zeitplan.json", encoding="utf-8"))
s = {x["id"]: x for x in z["saetze"]}
schnitt = round((s["ursache"]["ende"] + s["wende"]["start"]) / 2 + .1, 2)
quelle = str(AUS / "keramik-story.mp4")
gemeinsam = ["-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"]
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", quelle, "-t", str(schnitt),
                "-af", f"afade=t=out:st={schnitt - .25:.2f}:d=0.25", *gemeinsam, str(AUS / "keramik-story-teil1.mp4")], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(schnitt), "-i", quelle,
                "-af", "afade=t=in:d=0.12", *gemeinsam, str(AUS / "keramik-story-teil2.mp4")], check=True)
print(f"Schnitt bei {schnitt} s: Teil 1 = {schnitt:.1f} s, Teil 2 = {z['dauer'] - schnitt:.1f} s")
