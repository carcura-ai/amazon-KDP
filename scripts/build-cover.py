#!/usr/bin/env python
"""Baut das vollstaendige KDP-Taschenbuch-Cover (Vorderseite+Ruecken+Rueckseite) als
PDF, in den live von kdp.amazon.com/help (2026-08-25) geprueften Massen fuer ein
56-seitiges SW-Taschenbuch, Trimm 8,5x8,5 Zoll.

Erwartet optional ein Vordergrundbild (Miro-Illustration) unter --motiv; ohne
Motiv wird ein farbiger Platzhalter mit Hinweistext gesetzt.

Aufruf:
  python scripts/build-cover.py --ausgabe <pfad.pdf> [--motiv <pfad.png>]
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

DPI = 300
BLEED = 0.125
TRIM = 8.5
SPINE = 0.126  # 56 Seiten SW auf weiss: 56 * 0.002252"

W_IN = BLEED + TRIM + SPINE + TRIM + BLEED  # 17.376
H_IN = BLEED + TRIM + BLEED  # 8.75

W_PX = int(round(W_IN * DPI))
H_PX = int(round(H_IN * DPI))

TANNENGRUEN = (31, 92, 74)
TUERKIS = (47, 184, 172)
WHITE = (255, 255, 255)


def schrift(groesse, bold=True):
    for k in (["arialbd.ttf"] if bold else ["arial.ttf"]):
        try:
            return ImageFont.truetype(k, groesse)
        except OSError:
            continue
    return ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ausgabe", required=True)
    ap.add_argument("--motiv", default=None, help="optionales Vordergrundbild (Miro), quadratisch")
    args = ap.parse_args()

    img = Image.new("RGB", (W_PX, H_PX), TANNENGRUEN)
    draw = ImageDraw.Draw(img)

    front_x0 = int(round((BLEED + TRIM + SPINE) * DPI))
    front_w = int(round(TRIM * DPI))

    if args.motiv and Path(args.motiv).exists():
        motiv = Image.open(args.motiv).convert("RGB").resize((front_w, front_w))
        img.paste(motiv, (front_x0, H_PX - front_w))
    else:
        draw.rectangle([front_x0 + 100, H_PX - front_w + 100, front_x0 + front_w - 100, H_PX - 100],
                        outline=TUERKIS, width=10)
        fk = schrift(70)
        hinweis = "[Platzhalter -- Miro-Coverillustration ausstehend]"
        bbox = draw.textbbox((0, 0), hinweis, font=fk)
        w = bbox[2] - bbox[0]
        draw.text((front_x0 + (front_w - w) // 2, H_PX // 2), hinweis, fill=WHITE, font=fk)

    ftitel = schrift(150)
    funtertitel = schrift(60)
    freihe = schrift(50)

    titel = "Miros Lichterwald-\nAdventskalender"
    y = int(0.5 * DPI)
    for zeile in titel.split("\n"):
        bbox = draw.textbbox((0, 0), zeile, font=ftitel)
        w = bbox[2] - bbox[0]
        draw.text((front_x0 + (front_w - w) // 2, y), zeile, fill=WHITE, font=ftitel,
                   stroke_width=4, stroke_fill=TANNENGRUEN)
        y += 170

    reihe = "MIRO FUCHS · BAND 1"
    bbox = draw.textbbox((0, 0), reihe, font=freihe)
    w = bbox[2] - bbox[0]
    draw.text((front_x0 + (front_w - w) // 2, int(0.3 * DPI)), reihe, fill=TUERKIS, font=freihe)

    untertitel = "24 Rätsel bis Weihnachten · Für Kinder von 3 bis 5 Jahren"
    bbox = draw.textbbox((0, 0), untertitel, font=funtertitel)
    w = bbox[2] - bbox[0]
    draw.text((front_x0 + (front_w - w) // 2, H_PX - 300), untertitel, fill=WHITE, font=funtertitel)

    # Rueckseite (links vom Bleed)
    back_x0 = int(round(BLEED * DPI)) + 120
    back_w = int(round(TRIM * DPI)) - 240
    fback = schrift(48, bold=False)
    frueck_titel = schrift(64)
    ruecktext = ("Jeden Tag im Advent wartet Miro der Fuchs mit einer kleinen Aufgabe.\n\n"
                 "24 altersgerechte Rätsel — Labyrinthe, Punkte verbinden, Zählen, Zuordnen,\n"
                 "Suchbilder und Schwungübungen.\n\n"
                 "56 Seiten, Schwarzweiß zum Ausmalen, mit Lösungsteil.\n\n"
                 "Braucht keine Schere und keinen Kleber.")
    draw.text((back_x0, int(0.7 * DPI)), "Miro Fuchs", fill=TUERKIS, font=frueck_titel)
    y2 = int(1.3 * DPI)
    for absatz in ruecktext.split("\n"):
        draw.text((back_x0, y2), absatz, fill=WHITE, font=fback)
        y2 += 80
    draw.ellipse([back_x0, H_PX - 400, back_x0 + 220, H_PX - 180], outline=WHITE, width=6)
    falter = schrift(44)
    draw.text((back_x0 + 45, H_PX - 320), "3–5\nJahre", fill=WHITE, font=falter, align="center")

    ausgabe = Path(args.ausgabe)
    ausgabe.parent.mkdir(parents=True, exist_ok=True)
    img.save(ausgabe, "PDF", resolution=DPI)
    img.resize((W_PX // 3, H_PX // 3)).save(ausgabe.with_suffix(".preview.png"))
    print(f"Cover geschrieben: {ausgabe} ({W_IN:.3f} x {H_IN:.3f} Zoll, {DPI} DPI)")


if __name__ == "__main__":
    main()
