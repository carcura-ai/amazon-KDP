#!/usr/bin/env python3
"""Foley-Textur: aus einem Geraeusch mit Pausen (Tuch, Applikator, Schwamm) eine durchgehende Spur bauen.

Nur die aktiven Stellen der Quelle (Huellkurve > Spitze - schwelle dB) werden mit weichen Ueberblendungen aneinandergereiht,
bis die Wunschlaenge erreicht ist; danach gleichmaessiger Pegel (RMS-Ziel) und Ein-/Ausblende. Optional ein Bett darunter.

Aufruf: python3 -I pipeline/foley.py <quelle> <dauer> <ausgabe.wav> [--von 0] [--bis 0] [--schwelle 18] [--ziel -37]
        [--bett <quelle2> --bett-von 0 --bett-db -12]
"""
import argparse, subprocess
import numpy as np

SR = 48000


def lade(pfad, von=0.0, bis=0.0):
    cmd = ["ffmpeg", "-v", "error", "-ss", str(von), *(["-to", str(bis)] if bis else []), "-i", pfad,
           "-ac", "2", "-ar", str(SR), "-af", "highpass=f=90", "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).reshape(-1, 2).copy()


def aktive_stuecke(a, schwelle):
    w = int(0.02 * SR)
    env = 20 * np.log10(np.sqrt((a[: len(a) // w * w].mean(1).reshape(-1, w) ** 2).mean(1)) + 1e-9)
    an = env > env.max() - schwelle
    stuecke, k = [], 0
    while k < len(an):
        if an[k]:
            j = k
            while j < len(an) and an[j]:
                j += 1
            if j - k >= 4:  # mind. 80 ms
                stuecke.append(a[k * w:j * w])
            k = j
        else:
            k += 1
    return stuecke


def textur(a, dauer, schwelle):
    stuecke = aktive_stuecke(a, schwelle)
    print(f"  {len(stuecke)} aktive Stellen, {sum(map(len, stuecke)) / SR:.1f} s Material")
    if not stuecke:
        raise SystemExit("keine aktiven Stellen gefunden – Schwelle erhoehen")
    xf = int(0.03 * SR)
    out, i = np.zeros((0, 2), np.float32), 0
    while len(out) < dauer * SR:
        s = stuecke[i % len(stuecke)]
        i += 1
        if len(out) and len(s) > 2 * xf:
            rampe = np.linspace(0, 1, xf, dtype=np.float32)[:, None]
            out[-xf:] = out[-xf:] * (1 - rampe) + s[:xf] * rampe
            s = s[xf:]
        out = np.concatenate([out, s])
    return out[: int(dauer * SR)]


def pegel(a, ziel):
    return a * 10 ** ((ziel - 20 * np.log10(np.sqrt((a ** 2).mean()) + 1e-9)) / 20)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("quelle"); ap.add_argument("dauer", type=float); ap.add_argument("ausgabe")
    ap.add_argument("--von", type=float, default=0.0); ap.add_argument("--bis", type=float, default=0.0)
    ap.add_argument("--schwelle", type=float, default=18.0); ap.add_argument("--ziel", type=float, default=-37.0)
    ap.add_argument("--bett"); ap.add_argument("--bett-von", type=float, default=0.0); ap.add_argument("--bett-db", type=float, default=-12.0)
    x = ap.parse_args()
    t = pegel(textur(lade(x.quelle, x.von, x.bis), x.dauer, x.schwelle), -20)
    if x.bett:
        b = lade(x.bett, x.bett_von, x.bett_von + x.dauer)[: len(t)]
        t[: len(b)] += pegel(b, -20 + x.bett_db)
    t = pegel(t, x.ziel)
    n_in, n_out = int(0.06 * SR), int(0.3 * SR)
    t[:n_in] *= np.linspace(0, 1, n_in, dtype=np.float32)[:, None]
    t[-n_out:] *= np.linspace(1, 0, n_out, dtype=np.float32)[:, None]
    t = np.clip(t, -0.98, 0.98)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", x.ausgabe],
                   input=t.astype(np.float32).tobytes(), check=True)
    print(f"{x.ausgabe}: {x.dauer}s, Ziel {x.ziel} dBFS RMS")
