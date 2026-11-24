#!/usr/bin/env python3
"""Carcura Außenwäsche – VORSCHAU-Video aus den vier vorhandenen Zuständen (verschmutzt, Schaum, nass, sauber).

WICHTIG: Das ist kein fotorealistischer Film. Grundlage sind vier KI-generierte Einzelbilder (762 × 506 px) mit
identischer Kamera. Sie werden auf 1920 px hochgerechnet (Lanczos) und mit schwerkraftgerichteten Masken ineinander
überführt (Schaum und Spülwasser laufen von oben nach unten mit unregelmäßiger Laufkante, das Abtrocknen erfolgt
fleckig). Es entstehen keine neuen Details, keine echte Fluidsimulation und keine echten Wassertropfen.
Ersatz: ein echtes Rendering oder eine Aufnahme gleicher Länge unter demselben Dateinamen ablegen.

Aufruf: python3 src/video/build_preview_video.py   (aus Carcura_Claude_Gesamtprojekt)
Ausgabe: src/assets/video/ (MP4 H.264 + WebM VP9, Desktop 1920×1080 und Mobil 1080×718, Posterbilder)
"""
import os, subprocess
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(HERE), "assets")
OUT = os.path.join(SRC, "video")
os.makedirs(OUT, exist_ok=True)
FPS, W = 30, 1920
NAMES = ["00-dreckig", "01-schaum", "02-gespuelt", "03-sauber"]
rng = np.random.default_rng(7)


def load(n):
    im = Image.open(os.path.join(SRC, "film", n + ".webp")).convert("RGB")
    h = round(W * im.height / im.width)
    im = im.resize((W, h), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.6, percent=60, threshold=2))
    return np.asarray(im, dtype=np.float32)


A = [load(n) for n in NAMES]
H = A[0].shape[0]
ys = np.linspace(0, 1, H, dtype=np.float32)[:, None]


def smooth_noise_1d(n, scale, seed):
    r = np.random.default_rng(seed).standard_normal(int(n / scale) + 4)
    x = np.linspace(0, len(r) - 3, n)
    i = x.astype(int); f = x - i
    f = f * f * (3 - 2 * f)
    return (r[i] * (1 - f) + r[i + 1] * f).astype(np.float32)


def noise_2d(scale, seed):
    r = np.random.default_rng(seed).random((max(2, H // scale), max(2, W // scale))).astype(np.float32)
    im = Image.fromarray((r * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(scale / 3))
    return np.asarray(im, dtype=np.float32) / 255.0


# Laufkanten: grobe Welle + feine Rinnsale, die vorauslaufen (Schwerkraft)
wave = smooth_noise_1d(W, 160, 1) * 0.045 + smooth_noise_1d(W, 40, 2) * 0.018
rills = np.clip(smooth_noise_1d(W, 26, 3), 0, None) ** 1.5 * 0.022  # breite, kurze Ausläufer statt dünner Streifen
blot = noise_2d(48, 4) * 0.7 + noise_2d(12, 5) * 0.3


def gravity_mask(t, feather=0.06):
    """t 0..1: Front wandert von oben nach unten; Rinnsale laufen vor der Front."""
    front = -0.12 + t * 1.3 + wave + rills
    return np.clip((front[None, :] - ys) / feather, 0, 1)


def dry_mask(t):
    """Abtrocknen: fleckig, oben zuerst (warmes Hallenlicht, Wasser läuft nach unten ab)."""
    thr = t * 1.25 - 0.1
    field = blot * 0.75 + ys * 0.35
    return np.clip((thr - field) / 0.08, 0, 1)


def ease(x):
    x = min(1.0, max(0.0, x)); return x * x * (3 - 2 * x)


# Zeitplan (Sekunden)
P = [("hold", 0, 2.0), ("foam", 0, 2.6), ("hold", 1, 1.2), ("rinse", 1, 2.6), ("hold", 2, 1.1), ("dry", 2, 2.2), ("hold", 3, 1.6)]
frames = []
for kind, i, dur in P:
    n = round(dur * FPS)
    for k in range(n):
        frames.append((kind, i, (k + 1) / n))
total = len(frames)

crop_y = int((H - 1080) * 0.55)
enc = lambda size, path: ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-"]
cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
       "-filter_complex", f"[0:v]split=2[a][b];[a]crop={W}:1080:0:{crop_y}[d];[b]scale=1080:-2:flags=lanczos[m]",
       "-map", "[d]", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart", os.path.join(OUT, "carcura-aussenwaesche-1920x1080.mp4"),
       "-map", "[m]", "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart", os.path.join(OUT, "carcura-aussenwaesche-mobil.mp4")]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for kind, i, t in frames:
    if kind == "hold":
        img = A[i]
    else:
        m = gravity_mask(ease(t)) if kind in ("foam", "rinse") else dry_mask(ease(t))
        img = A[i] * (1 - m[..., None]) + A[i + 1] * m[..., None]
    p.stdin.write(np.clip(img, 0, 255).astype(np.uint8).tobytes())
p.stdin.close(); p.wait()
assert p.returncode == 0, "ffmpeg fehlgeschlagen"

# WebM (VP9) als zweite Quelle für Browser ohne H.264 sowie Posterbilder (erster Frame)
for name in ("carcura-aussenwaesche-1920x1080", "carcura-aussenwaesche-mobil"):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(OUT, name + ".mp4"), "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34",
                    "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", "-an", os.path.join(OUT, name + ".webm")], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(OUT, name + ".mp4"), "-frames:v", "1", "-q:v", "3", os.path.join(OUT, name + "-poster.jpg")], check=True)
print(total, "Frames,", total / FPS, "s")
