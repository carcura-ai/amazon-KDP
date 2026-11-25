"""Musik (ruhige Weltraum-Fläche mit leichtem Puls) unter die Stimme legen, Lautheit -14 LUFS.
Aufruf (venv mit scipy): python ton.py videos/001-venus   → videos/…/ton.wav"""
import json, subprocess, sys
from pathlib import Path
HIER = Path(__file__).resolve().parent
BAU = HIER.parent.parent / "reel-studio/projekte/keramik-story/ton.py"
exec(compile(BAU.read_text(encoding="utf-8").split("# ---------- Musik ----------")[0].replace(
    'zp = json.load(open(AUS / "zeitplan.json", encoding="utf-8"))', 'zp = {"dauer": 1, "saetze": []}'), "ton.py", "exec"))
ordner = HIER / sys.argv[1]
DAUER = json.load(open(ordner / "woerter.json"))["dauer"] + 1.2
N = int(DAUER * SR) + SR
musik = np.zeros(N)
AKK = [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]]   # Am F C G
t, i, TAKT = 0.0, 0, 2.6
while t < DAUER:
    lege(musik, flaeche(AKK[i % 4], TAKT + .8, hell=1600), t, -8)
    for k in range(4):
        lege(musik, pluck(AKK[i % 4][(k % 3) + 1] + 12), t + k * TAKT / 4 + .1, -17)
        lege(musik, kick() * .5, t + k * TAKT / 4, -16)
    t += TAKT; i += 1
aus = np.ones(N); k0 = int((DAUER - 1.0) * SR); aus[k0:] = np.clip(np.linspace(1, 0, N - k0), 0, 1)
musik = hall(musik * aus, 2.8, .35)
musik = musik / (np.max(np.abs(musik)) + 1e-9) * .89
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", str(ordner / "musik.wav")],
               input=musik.astype(np.float32).tobytes(), check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(ordner / "stimme.wav"), "-i", str(ordner / "musik.wav"), "-filter_complex",
                "[0]aformat=channel_layouts=stereo,asplit=2[v][sc];[1]volume=0.22[m];[m][sc]sidechaincompress=threshold=0.04:ratio=6:attack=15:release=350[md];"
                f"[v][md]amix=inputs=2:normalize=0:duration=longest,atrim=0:{DAUER:.2f},loudnorm=I=-14:TP=-1.5:LRA=9[a]",
                "-map", "[a]", "-ar", "48000", str(ordner / "ton.wav")], check=True)
print("ton.wav fertig", round(DAUER, 1), "s")
