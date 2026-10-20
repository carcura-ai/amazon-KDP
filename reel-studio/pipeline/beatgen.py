#!/usr/bin/env python3
"""Eigene Beats im Carcura-Stil (808-Drumcomputer-Klaenge, vollstaendig selbst erzeugt: keine Lizenz, keine Nennung).

Aufruf: python3 -I pipeline/beatgen.py projekte/<name> --stil phonk|cloud|strasse [--bpm 145] [--dauer 20] [--seed 1]
Ergebnis: projekte/<name>/musik/<stil>_<bpm>_<seed>.wav + .beats.json (exaktes Beat-Raster fuer "schnitt": "beat")
Stile (Vorbild Nutzer-Playlist „526“): phonk = Drift-Phonk (Cowbell-Riff, verzerrter 808, Hi-Hat-Rolls),
cloud = BONES/$uicideboy$-Prinzip (duestere Flaechen, Half-Time), strasse = KITSCHKRIEG-Prinzip (minimal, 808, Pluck).
"""
import argparse, json, wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, lfilter

SR = 44100
MOLL = [0, 2, 3, 5, 7, 8, 10, 12]


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def filt(x, kind, f):
    b, a = butter(2, np.array(f) / (SR / 2), kind)
    return lfilter(b, a, x)


def env(n, attack=0.002, decay=8.0):
    t = np.arange(n) / SR
    return np.minimum(1, t / attack) * np.exp(-t * decay)


def kick(n=int(0.5 * SR)):
    t = np.arange(n) / SR
    f = 50 * (1 + 3.5 * np.exp(-t * 45))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) + 0.3 * np.random.randn(n) * np.exp(-t * 400)


def bass(midi, n, slide_to=None, drive=2.5):
    t = np.arange(n) / SR
    f = np.full(n, hz(midi))
    if slide_to is not None:  # 808-Slide in der zweiten Haelfte
        k = n // 2
        f[k:] = hz(midi) * (hz(slide_to) / hz(midi)) ** np.minimum(1, (t[k:] - t[k]) / 0.08)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.25 * np.sin(2 * ph)
    a = np.minimum(1, t / 0.005) * np.minimum(1, (t[-1] - t) / 0.03 + 1e-3)
    return np.tanh(drive * x * a) / np.tanh(drive)


def clap(n=int(0.3 * SR)):
    t = np.arange(n) / SR
    noise = filt(np.random.randn(n), "bandpass", [900, 5000])
    bursts = sum(np.exp(-np.maximum(0, t - d) * 60) * (t >= d) for d in (0, 0.012, 0.024))
    return 0.6 * noise * bursts * np.exp(-t * 10) + 0.3 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 40)


def hat(open_=False):
    n = int((0.35 if open_ else 0.06) * SR)
    return filt(np.random.randn(n), "highpass", 7000) * env(n, 0.001, 9 if open_ else 70)


def cowbell(midi, n=int(0.4 * SR)):
    t = np.arange(n) / SR
    f = hz(midi)
    sq = np.sign(np.sin(2 * np.pi * f * t)) + np.sign(np.sin(2 * np.pi * f * 1.4818 * t))
    return filt(sq, "bandpass", [f * 0.8, min(f * 4, 15000)]) * (0.7 * np.exp(-t * 18) + 0.3 * np.exp(-t * 4))


def pad(midis, n):
    t = np.arange(n) / SR
    x = sum(2 * ((hz(m) * d * t) % 1) - 1 for m in midis for d in (0.996, 1.0, 1.004))
    x = filt(x / (3 * len(midis)), "lowpass", 900)
    return x * np.minimum(1, t / 0.4) * np.minimum(1, (t[-1] - t) / 0.3 + 1e-3)


def pluck(midi, n=int(0.35 * SR)):
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * hz(midi) * t + 1.5 * np.sin(2 * np.pi * hz(midi) * 2 * t) * np.exp(-t * 20)) * np.exp(-t * 11)


def place(track, sig, pos, gain=1.0):
    i = int(pos * SR)
    if i >= len(track):
        return
    sig = sig[: len(track) - i]
    track[i:i + len(sig)] += gain * sig


def build(stil, bpm, dauer, seed):
    rng = np.random.default_rng(seed)
    np.random.seed(seed)
    step = 60 / bpm / 4  # 16tel
    bars = int(np.ceil(dauer / (16 * step))) + 1
    n = int(bars * 16 * step * SR)
    drums, low, mel = np.zeros(n), np.zeros(n), np.zeros(n)
    root = int(rng.choice([34, 35, 37, 39]))  # Tonart (808-Grundton A#1..D#2)

    for b in range(bars):
        t0 = b * 16 * step
        A = b % 2 == 0
        if stil == "phonk":
            for s in (0, 6, 10) if A else (0, 3, 10, 14):
                place(drums, kick(), t0 + s * step, 0.9)
            for s in (4, 12):
                place(drums, clap(), t0 + s * step, 0.8)
            for s in range(16):  # 16tel-Hats, Rolls am Ende jeder 2. Phrase
                place(drums, hat(), t0 + s * step, 0.22 + 0.08 * (s % 2 == 0))
                if not A and s >= 14:
                    place(drums, hat(), t0 + (s + 0.5) * step, 0.18)
            riff = {0: 0, 3: 0, 6: 7, 8: 5, 10: 3, 12: 0, 14: 3} if A else {0: 0, 3: 0, 6: 7, 8: 8, 10: 7, 12: 5, 14: 3}
            for s, d in riff.items():
                place(mel, cowbell(root + 36 + d), t0 + s * step, 0.42)
            notes = [(0, 0, 6, None), (6, 0, 4, 3), (10, 3, 6, None)] if A else [(0, 0, 6, None), (6, -2, 4, None), (10, -4, 6, 0)]
            for s, d, length, sl in notes:
                place(low, bass(root + d, int(length * step * SR), None if sl is None else root + sl, drive=3.0), t0 + s * step, 1.05)
        elif stil == "cloud":
            for s in (0, 11) if A else (0, 3, 11):
                place(drums, kick(), t0 + s * step, 0.8)
            place(drums, clap(), t0 + 8 * step, 0.75)  # Half-Time-Snare
            for s in range(0, 16, 2):
                place(drums, hat(), t0 + s * step, 0.2)
            if not A:
                for k in range(6):
                    place(drums, hat(), t0 + (12 + k * 2 / 3) * step, 0.15)
            chord = [root + 24, root + 27, root + 31] if A else [root + 20, root + 24, root + 27]
            place(mel, pad(chord, int(16 * step * SR)), t0, 0.9)
            place(low, bass(root if A else root - 4, int(15 * step * SR), drive=1.8), t0, 0.8)
        else:  # strasse
            for s in (0, 7, 10):
                place(drums, kick(), t0 + s * step, 0.85)
            for s in (4, 12):
                place(drums, clap(), t0 + s * step, 0.6)
            for s in range(2, 16, 4):
                place(drums, hat(), t0 + s * step + 0.012, 0.25)
            arp = [0, 3, 7, 10] if A else [-4, 0, 3, 7]
            for k, s in enumerate((2, 6, 9, 14)):
                place(mel, pluck(root + 36 + arp[k]), t0 + s * step, 0.45)
            for s, length in ((0, 7), (7, 3), (10, 6)):
                place(low, bass(root + (0 if A else -4), int(length * step * SR), drive=2.0), t0 + s * step, 0.75)

    # Pumpen: Melodie/Flaeche weichen der Kick (Sidechain-Gefuehl)
    duck = np.ones(n)
    for b in range(bars * 4):
        i = int(b * 4 * step * SR)
        k = min(n - i, int(0.18 * SR))
        duck[i:i + k] *= 0.45 + 0.55 * np.linspace(0, 1, k)
    mix = drums + low + mel * duck
    mix = np.tanh(1.4 * mix)
    mix = 0.89 * mix / np.max(np.abs(mix))
    return mix[: int(dauer * SR) + SR], [round(i * 4 * step, 4) for i in range(int(dauer / (4 * step)) + 2)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("projekt")
    ap.add_argument("--stil", choices=["phonk", "cloud", "strasse"], default="phonk")
    ap.add_argument("--bpm", type=int)
    ap.add_argument("--dauer", type=float, default=20)
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()
    bpm = a.bpm or {"phonk": 145, "cloud": 140, "strasse": 96}[a.stil]
    x, beats = build(a.stil, bpm, a.dauer, a.seed)
    d = Path(a.projekt).resolve() / "musik"; d.mkdir(parents=True, exist_ok=True)
    out = d / f"{a.stil}_{bpm}_{a.seed}.wav"
    with wave.open(str(out), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        s16 = (x * 32767).astype(np.int16)
        w.writeframes(np.column_stack([s16, s16]).tobytes())
    out.with_suffix(".beats.json").write_text(json.dumps({"bpm": bpm, "bester_start": 0, "beats": beats, "quelle": "eigener Beat (beatgen.py)"}), encoding="utf-8")
    print(f"musik/{out.name}  ({bpm} bpm, {len(beats)} Beats, eigene Produktion – keine Nennung noetig)")


if __name__ == "__main__":
    main()
