"""Musik und Soundeffekte für die Keramik-Story – komplett selbst erzeugt (keine Fremdrechte), passend zum Zeitplan.

Musik: Problemteil in Moll (tiefe Fläche, Herzschlag, Spannung), Riser in „wende“, Aufschlag bei „loesung“,
danach Dur (C–G–Am–F) mit Fläche, Arpeggio und leichtem Beat bis zum Schluss.
Effekte: Hülle-Klick, Zoom-Whoosh, Einschläge der Gefahren, Polier-Swoosh, Keramik-Aufschlag, Tropfen, Welle, Pops, Glitzer.
Mischung: Stimme vorn, Musik wird unter der Stimme abgesenkt (Sidechain), Ziel -14 LUFS (Instagram).

Aufruf: python3 ton.py   (liest ausgabe/zeitplan.json und ausgabe/stimme_roh.wav, schreibt ausgabe/ton.wav)
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

HIER = Path(__file__).resolve().parent
AUS = HIER / "ausgabe"
SR = 48000
RNG = np.random.default_rng(3)

zp = json.load(open(AUS / "zeitplan.json", encoding="utf-8"))
DAUER = zp["dauer"]
SATZ = {s["id"]: s for s in zp["saetze"]}
N = int(DAUER * SR) + SR


def wort(sid, stamm, k_ersatz, anzahl):
    s = SATZ[sid]
    for w, a, _ in s.get("woerter", []):
        if w.startswith(stamm):
            return a
    return s["start"] + (s["ende"] - s["start"]) * k_ersatz / max(1, anzahl)


def tt(n):
    return np.arange(n) / SR


def filt(x, art, f, ordnung=2):
    return sosfilt(butter(ordnung, np.array(f) / (SR / 2), art, output="sos"), x)


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def huelle(n, a=.01, r=.3):
    e = np.ones(n)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] *= np.linspace(1, 0, nr)
    return e


def lege(spur, klang, t0, db=0.0):
    i = int(t0 * SR)
    if i >= len(spur) or i + len(klang) <= 0:
        return
    k = klang * 10 ** (db / 20)
    if i < 0:
        k, i = k[-i:], 0
    n = min(len(k), len(spur) - i)
    spur[i:i + n] += k[:n]


def hall(x, dauer=2.4, mix=.28):
    n = int(dauer * SR)
    ir = RNG.standard_normal((n, 2)) * np.exp(-np.linspace(0, 7, n))[:, None]
    ir[:, 0] = filt(ir[:, 0], "lowpass", 6000)
    ir[:, 1] = filt(ir[:, 1], "lowpass", 6000)
    out = np.zeros((len(x), 2))
    for ch in range(2):
        out[:, ch] = fftconvolve(x if x.ndim == 1 else x[:, ch], ir[:, ch])[:len(x)]
    out /= np.max(np.abs(out)) + 1e-9
    trocken = np.stack([x, x], 1) if x.ndim == 1 else x
    return trocken * (1 - mix) + out * mix * np.max(np.abs(trocken))


# ---------- Klangbausteine ----------
def flaeche(noten, dauer, hell=1800):
    n = int(dauer * SR); t = tt(n); s = np.zeros(n)
    for m in noten:
        for d in (-.07, 0, .06):                       # leicht verstimmte Sägezähne = breite Fläche
            f = hz(m) * 2 ** (d / 12)
            s += (2 * ((t * f) % 1) - 1) * .2
    s = filt(s, "lowpass", hell)
    return s * huelle(n, .8, 1.2) / len(noten)


def pluck(m, dauer=.5):
    n = int(dauer * SR); t = tt(n); f = hz(m)
    s = (np.sin(2 * np.pi * f * t) + .35 * np.sin(2 * np.pi * 2 * f * t) + .12 * np.sin(2 * np.pi * 3 * f * t)) * np.exp(-t * 7)
    return s * huelle(n, .004, .05) * .5


def kick():
    n = int(.4 * SR); t = tt(n)
    return np.sin(2 * np.pi * (45 + 90 * np.exp(-t * 30)) * t) * np.exp(-t * 9) * .9


def herz():
    n = int(.55 * SR); t = tt(n)
    eins = np.sin(2 * np.pi * 52 * t) * np.exp(-t * 18)
    zwei = np.zeros(n); k = int(.2 * SR)
    zwei[k:] = (np.sin(2 * np.pi * 46 * t[:n - k]) * np.exp(-t[:n - k] * 20)) * .7
    return (eins + zwei) * .9


def shaker():
    n = int(.08 * SR)
    return filt(RNG.standard_normal(n), "highpass", 7000) * np.exp(-tt(n) * 60) * .25


def riser(dauer):
    n = int(dauer * SR); t = tt(n); v = t / dauer
    ton = np.sin(2 * np.pi * (200 * t + 500 * t * t / dauer)) * v ** 2 * .3
    rau = filt(RNG.standard_normal(n), "bandpass", [800, 6000]) * v ** 3 * .35
    return (ton + rau) * huelle(n, .05, .03)


def aufschlag():
    n = int(2.2 * SR); t = tt(n)
    boom = np.sin(2 * np.pi * (38 + 80 * np.exp(-t * 7)) * t) * np.exp(-t * 2.2)
    knall = filt(RNG.standard_normal(n), "lowpass", 3000) * np.exp(-t * 18) * .6
    return (boom + knall) * .9


def glitzer():
    n = int(1.4 * SR); t = tt(n); s = np.zeros(n)
    for i, m in enumerate((88, 91, 95, 100, 103)):
        k = int(i * .07 * SR); f = hz(m)
        s[k:] += np.sin(2 * np.pi * f * t[:n - k]) * np.exp(-t[:n - k] * 5) * .15
    return s


def whoosh(dauer=.6, lo=400, hi=5000):
    n = int(dauer * SR); v = tt(n) / dauer
    w = filt(RNG.standard_normal(n), "bandpass", [lo, hi]) * np.sin(np.pi * v) ** 2
    return w * .5


def klick():
    n = int(.06 * SR); t = tt(n)
    return (np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 160) + filt(RNG.standard_normal(n), "highpass", 3000) * np.exp(-t * 200) * .4) * .7


def pop():
    n = int(.18 * SR); t = tt(n)
    return np.sin(2 * np.pi * (420 + 900 * np.exp(-t * 40)) * t) * np.exp(-t * 26) * .6


def tropf():
    n = int(.22 * SR); t = tt(n)
    return np.sin(2 * np.pi * (500 + 1500 * t / .22) * t) * np.exp(-t * 30) * .5


def regen(dauer=1.0):
    n = int(dauer * SR)
    return filt(RNG.standard_normal(n), "highpass", 2500) * huelle(n, .05, .4) * .25


def salz():
    n = int(.9 * SR); s = np.zeros(n)
    for _ in range(26):
        k = int(RNG.uniform(0, .75) * SR); m = int(.015 * SR)
        s[k:k + m] += filt(RNG.standard_normal(m), "highpass", 5000) * np.exp(-tt(m) * 300) * RNG.uniform(.2, .5)
    return s


def platsch():
    n = int(.35 * SR); t = tt(n)
    return (filt(RNG.standard_normal(n), "lowpass", 900) * np.exp(-t * 22) + np.sin(2 * np.pi * 90 * t) * np.exp(-t * 25) * .6) * .8


def fehlerton():
    n = int(.35 * SR); t = tt(n)
    return (np.sin(2 * np.pi * 220 * t) * (t < .14) + np.sin(2 * np.pi * 185 * t) * (t >= .14)) * np.exp(-t * 5) * huelle(n, .005, .08) * .35


def welle(dauer=1.6):
    n = int(dauer * SR); v = tt(n) / dauer
    w = filt(RNG.standard_normal(n), "bandpass", [300, 3500]) * np.sin(np.pi * v) * (1 + .3 * np.sin(2 * np.pi * 7 * tt(n)))
    return w * .45


def sonne_schwell(dauer=1.5):
    n = int(dauer * SR); t = tt(n)
    return (np.sin(2 * np.pi * hz(64) * t) + .5 * np.sin(2 * np.pi * hz(71) * t)) * np.sin(np.pi * t / dauer) ** 2 * .18


# ---------- Musik ----------
musik = np.zeros(N)
t_gef, t_wen, t_loe = SATZ["gefahr"]["start"], SATZ["wende"]["start"], SATZ["loesung"]["start"]
t_uv, t_abl, t_sch = SATZ["uv"]["start"], SATZ["ablauf"]["start"], SATZ["schluss"]["start"]
# Teil A: A-Moll-Fläche + Herzschlag
lege(musik, flaeche([45, 52, 57], t_loe + .2, hell=900), 0, -6)
lege(musik, flaeche([64, 69], t_loe - t_gef + .2, hell=1400), t_gef, -16)
schlag = .75
t = t_gef
while t < t_wen:
    staerke = -14 + 8 * min(1, (t - t_gef) / max(.1, t_wen - t_gef))
    lege(musik, herz(), t, staerke)
    t += schlag
lege(musik, riser(t_loe - t_wen), t_wen, -4)
# Teil B: Dur, ab dem Aufschlag
TAKT = 4 * .62                                        # 97 bpm
AKK = [[48, 55, 60, 64], [43, 50, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57]]   # C G Am F
ARP = [[60, 64, 67, 72], [59, 62, 67, 71], [57, 60, 64, 69], [57, 60, 65, 69]]
t, i = t_loe, 0
while t < DAUER + .5:
    lege(musik, flaeche(AKK[i % 4], TAKT + .6, hell=2200), t, -8)
    if t >= t_uv - .1:
        for k in range(8):
            lege(musik, pluck(ARP[i % 4][k % 4] + (12 if k >= 4 else 0)), t + k * TAKT / 8, -14 if t < t_abl else -11)
    if t >= t_uv - .1:
        for k in range(4):
            if k % 2 == 0 or t >= t_abl:
                lege(musik, kick(), t + k * TAKT / 4, -12 if t < t_abl else -9)
    if t >= t_abl - .1:
        for k in range(8):
            lege(musik, shaker(), t + k * TAKT / 8 + TAKT / 16, -10)
    t += TAKT; i += 1
# Schluss: Akkord ausklingen lassen
ende = np.zeros(N); lege(ende, flaeche([48, 55, 60, 64, 67], DAUER - t_sch + .5, hell=2600), t_sch, -6)
musik += ende
ausblende = np.ones(N); k0 = int((DAUER - 1.2) * SR); ausblende[k0:] = np.clip(np.linspace(1, 0, N - k0) * 1.0, 0, 1)
musik *= ausblende
musik = hall(musik, 2.6, .3)

# ---------- Effekte ----------
fx = np.zeros(N)
h = SATZ["haken"]; lege(fx, klick(), h["start"] + .55 * (h["ende"] - h["start"]) + .4, -4)
lege(fx, whoosh(.7), SATZ["auto"]["start"] - .1, -10)
lege(fx, whoosh(.8, 200, 3000), t_gef - .45, -6)
tw = [wort("gefahr", "sonne", 0, 4), wort("gefahr", "regen", 1, 4), wort("gefahr", "streu", 2, 4), wort("gefahr", "vogel", 3, 4)]
for z in tw:
    lege(fx, aufschlag()[: int(.6 * SR)] * huelle(int(.6 * SR), .001, .3), z, -12)
lege(fx, sonne_schwell(1.2), tw[0] - .1, -6)
lege(fx, regen(1.0), tw[1], -4)
lege(fx, salz(), tw[2], -2)
lege(fx, platsch(), tw[3] + .05, -2)
for st in ("stumpf", "flecken", "dreck"):
    lege(fx, fehlerton(), wort("problem", st, 3, 13), -8)
lege(fx, whoosh(1.3, 1500, 9000), t_wen, -8)
lege(fx, aufschlag(), t_loe - .02, -1)
lege(fx, glitzer(), t_loe + .5, -6)
lege(fx, sonne_schwell(1.6), t_uv - .2, -6)
t0 = SATZ["wasser"]["start"] - .35
for d in (0, .3, .12, .42, .65):
    lege(fx, tropf(), t0 + d + .38, -6)
ww = wort("schmutz", "wäsche", 6, 10) - .1
lege(fx, welle(1.6), ww, -3)
lege(fx, glitzer(), ww + 1.6, -8)
for st, k in (("wasch", 6), ("knet", 7), ("polier", 8), ("keramik", 13)):
    lege(fx, pop(), wort("ablauf", st, k, 18), -6)
lege(fx, pop(), SATZ["set"]["start"], -5)
lege(fx, aufschlag()[: int(1.0 * SR)] * huelle(int(1.0 * SR), .001, .5), wort("preis", "700", 2, 4) - .1, -5)
lege(fx, glitzer(), wort("preis", "700", 2, 4), -7)
lege(fx, whoosh(.5), SATZ["cta"]["start"] - .15, -9)
lege(fx, pop(), SATZ["cta"]["start"], -5)
lege(fx, glitzer(), wort("schluss", "verdient", 6, 8), -5)
lege(fx, pop(), wort("teaser", "geschenk", 6, 9), -6)
lege(fx, glitzer(), wort("teaser", "geschenk", 6, 9) + .05, -8)
lege(fx, pop(), wort("geschenk", "waschset", 9, 12) - .2, -5)
lege(fx, glitzer(), wort("geschenk", "waschset", 9, 12), -6)
fx = hall(fx, 1.2, .18)


def schreibe(name, x):
    x = x / (np.max(np.abs(x)) + 1e-9) * .89
    (AUS / name).write_bytes(b"")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", str(AUS / name)],
                   input=x.astype(np.float32).tobytes(), check=True)


schreibe("musik.wav", musik)
schreibe("effekte.wav", fx)
# Mischung: Musik unter der Stimme absenken, Effekte dazu, Lautheit -14 LUFS
filt_kette = (
    "[0]aformat=channel_layouts=stereo,volume=1.0,asplit=2[v][sc];"
    "[1]volume=0.20[m];[m][sc]sidechaincompress=threshold=0.04:ratio=6:attack=15:release=350[md];"
    "[2]volume=0.42[f];"
    f"[v][md][f]amix=inputs=3:normalize=0,atrim=0:{DAUER:.3f},loudnorm=I=-14:TP=-1.5:LRA=9[a]"
)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(AUS / "stimme_roh.wav"), "-i", str(AUS / "musik.wav"),
                "-i", str(AUS / "effekte.wav"), "-filter_complex", filt_kette, "-map", "[a]", "-ar", "48000",
                str(AUS / "ton.wav")], check=True)
print("ton.wav fertig,", round(DAUER, 1), "s")
