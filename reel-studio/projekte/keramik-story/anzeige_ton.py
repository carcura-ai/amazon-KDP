"""Musik und Effekte für die Anzeige (24,5 s), komplett selbst erzeugt, keine Sprache. Nutzt die Klangbausteine aus ton.py.
Aufruf (venv mit scipy): python anzeige_ton.py  → ausgabe/anzeige_ton.wav"""
import subprocess
from pathlib import Path

HIER = Path(__file__).resolve().parent
exec(compile((HIER / "ton.py").read_text(encoding="utf-8").split("# ---------- Musik ----------")[0], "ton.py", "exec"))
DAUER = 26.8
N = int(DAUER * SR) + SR


def schellen(dauer):
    n = int(dauer * SR); s = np.zeros(n); schritt = .31
    for k in range(int(dauer / schritt)):
        m = int(.22 * SR); t = tt(m); i = int(k * schritt * SR)
        klang = (np.sin(2 * np.pi * 2637 * t) + .7 * np.sin(2 * np.pi * 3951 * t) + .5 * np.sin(2 * np.pi * 5274 * t)) * np.exp(-t * 22)
        klang += filt(RNG.standard_normal(m), "highpass", 7000) * np.exp(-t * 40) * .5
        e = max(0, min(m, n - i)); s[i:i + e] += klang[:e] * (.9 if k % 2 == 0 else .55)
    return s * huelle(n, .3, .8) * .22


# Musik: Problem in Moll mit Herzschlag, Riser, Aufschlag bei 8,0 s, danach Dur mit Beat
musik = np.zeros(N)
lege(musik, flaeche([45, 52, 57], 8.2, hell=900), 0, -5)
lege(musik, flaeche([64, 69], 7.6, hell=1400), .4, -15)
t = 3.2
while t < 7.2:
    lege(musik, herz(), t, -12 + 7 * (t - 3.2) / 4); t += .75
lege(musik, riser(.95), 7.05, -4)
TAKT = 2.48
AKK = [[48, 55, 60, 64], [43, 50, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57]]
ARP = [[60, 64, 67, 72], [59, 62, 67, 71], [57, 60, 64, 69], [57, 60, 65, 69]]
t, i = 8.0, 0
while t < DAUER:
    lege(musik, flaeche(AKK[i % 4], TAKT + .6, hell=2200), t, -8)
    for k in range(8):
        lege(musik, pluck(ARP[i % 4][k % 4] + (12 if k >= 4 else 0)), t + k * TAKT / 8, -12)
    for k in range(4):
        lege(musik, kick(), t + k * TAKT / 4, -9 if t >= 15.1 or k % 2 == 0 else -40)
    if t >= 15.1:
        for k in range(8):
            lege(musik, shaker(), t + k * TAKT / 8 + TAKT / 16, -10)
    t += TAKT; i += 1
lege(musik, flaeche([48, 55, 60, 64, 67], 3.2, hell=2600), 23.7, -6)
aus = np.ones(N); k0 = int((DAUER - .9) * SR); aus[k0:] = np.clip(np.linspace(1, 0, N - k0), 0, 1)
musik = hall(musik * aus, 2.4, .3)

fx = np.zeros(N)
lege(fx, salz(), .15, -2)
lege(fx, regen(1.2), .75, -4)
for z in (1.7, 1.85, 2.0):
    lege(fx, platsch(), z, -9)
lege(fx, fehlerton(), 4.3, -7); lege(fx, fehlerton(), 5.6, -7)
lege(fx, whoosh(.7, 1500, 9000), 7.35, -8)
lege(fx, aufschlag(), 7.98, -1)
lege(fx, glitzer(), 8.5, -6)
for d in (0, .3, .12, .42, .65):
    lege(fx, tropf(), 9.6 + d + .38, -6)
lege(fx, pop(), 12.3, -8)
lege(fx, whoosh(.6), 14.9, -9)
lege(fx, pop(), 15.35, -7)
kurz = int(1.0 * SR); lege(fx, aufschlag()[:kurz] * huelle(kurz, .001, .5), 15.55, -5)
lege(fx, glitzer(), 15.65, -7)
lege(fx, pop(), 16.5, -5); lege(fx, glitzer(), 16.55, -6)
lege(fx, whoosh(.6), 22.85, -9)
lege(fx, schellen(DAUER - 23.0), 23.0, -4)
lege(fx, pop(), 24.05, -5)
fx = hall(fx, 1.2, .18)

AUS = HIER / "ausgabe"
for name, sig in (("anzeige_musik.wav", musik), ("anzeige_effekte.wav", fx)):
    sig = sig / (np.max(np.abs(sig)) + 1e-9) * .89
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", str(AUS / name)],
                   input=sig.astype(np.float32).tobytes(), check=True)
# Mit Sprecher (ausgabe/anzeige_stimme.wav aus anzeige_stimme.py): Musik wird unter der Stimme abgesenkt
stimme = AUS / "anzeige_stimme.wav"
if stimme.exists():
    kette = ("[2]aformat=channel_layouts=stereo,asplit=2[v][sc];[0]volume=0.2[m];[m][sc]sidechaincompress=threshold=0.04:ratio=6:attack=15:release=350[md];"
             f"[1]volume=0.4[f];[v][md][f]amix=inputs=3:normalize=0,atrim=0:{DAUER},loudnorm=I=-14:TP=-1.5:LRA=9[a]")
    extra = ["-i", str(stimme)]
else:
    kette, extra = f"[0]volume=0.6[m];[1]volume=0.5[f];[m][f]amix=inputs=2:normalize=0,atrim=0:{DAUER},loudnorm=I=-14:TP=-1.5:LRA=9[a]", []
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(AUS / "anzeige_musik.wav"), "-i", str(AUS / "anzeige_effekte.wav"), *extra,
                "-filter_complex", kette, "-map", "[a]", "-ar", "48000", str(AUS / "anzeige_ton.wav")], check=True)
print("anzeige_ton.wav fertig")
