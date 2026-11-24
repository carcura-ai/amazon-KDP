#!/usr/bin/env python3
"""Carcura Außenwäsche als Scroll-Effekt: Bausteine für src/assets/js/wash.js.

Statt eines Videos oder hunderter Einzelbilder liefert die Seite nur:
  - die vier Zustände (verschmutzt, Schaum, gespült, sauber) je Desktop (1600 px) und Mobil (1080 px)
  - eine Verlaufskarte field.png (R = Laufkante je Spalte, G = Trocknungsflecken)
Der Browser mischt die Zustände per WebGL abhängig von der Scrollposition. Die Formeln sind dieselben wie in
build_preview_video.py (gleiche Zufallswerte), das Ergebnis entspricht also der Videovorschau.

WICHTIG: Grundlage sind vier KI-generierte Einzelbilder (762 × 506 px). Hochrechnen erzeugt keine neuen Details.

Aufruf: python3 src/video/build_scroll_assets.py   (aus Carcura_Claude_Gesamtprojekt)
Ausgabe: src/assets/wash/
"""
import os
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(HERE), "assets")
OUT = os.path.join(SRC, "wash")
NAMES = ["00-dreckig", "01-schaum", "02-gespuelt", "03-sauber"]
SIZES = {"d": (1600, 72), "m": (1080, 70)}  # Breite, WebP-Qualität
W = 1920  # Rechenbreite der Verlaufskarte wie im Video, danach halbiert


def smooth_noise_1d(n, scale, seed):
    r = np.random.default_rng(seed).standard_normal(int(n / scale) + 4)
    x = np.linspace(0, len(r) - 3, n)
    i = x.astype(int); f = x - i
    f = f * f * (3 - 2 * f)
    return (r[i] * (1 - f) + r[i + 1] * f).astype(np.float32)


def noise_2d(h, scale, seed):
    r = np.random.default_rng(seed).random((max(2, h // scale), max(2, W // scale))).astype(np.float32)
    im = Image.fromarray((r * 255).astype(np.uint8)).resize((W, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(scale / 3))
    return np.asarray(im, dtype=np.float32) / 255.0


for key, (w, q) in SIZES.items():
    os.makedirs(os.path.join(OUT, key), exist_ok=True)
    for k, n in enumerate(NAMES):
        im = Image.open(os.path.join(SRC, "film", n + ".webp")).convert("RGB")
        im = im.resize((w, round(w * im.height / im.width)), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.6, percent=60, threshold=2))
        im.save(os.path.join(OUT, key, f"{k}.webp"), quality=q, method=6)

src = Image.open(os.path.join(SRC, "film", NAMES[0] + ".webp"))
H = round(W * src.height / src.width)
# Reihenfolge der Zufallsaufrufe wie im Video: wave (1, 2), rills (3), blot (4, 5)
prof = smooth_noise_1d(W, 160, 1) * 0.045 + smooth_noise_1d(W, 40, 2) * 0.018 + np.clip(smooth_noise_1d(W, 26, 3), 0, None) ** 1.5 * 0.022
blot = noise_2d(H, 48, 4) * 0.7 + noise_2d(H, 12, 5) * 0.3
r = np.clip((prof + 0.1) / 0.3, 0, 1)  # im Shader: prof = r * 0.3 - 0.1
field = np.zeros((H, W, 3), np.uint8)
field[..., 0] = np.round(r * 255)[None, :]
field[..., 1] = np.round(np.clip(blot, 0, 1) * 255)
Image.fromarray(field).resize((W // 2, H // 2), Image.BILINEAR).save(os.path.join(OUT, "field.png"), optimize=True)
print("prof", round(float(prof.min()), 3), round(float(prof.max()), 3))
