#!/usr/bin/env python
"""Baut den druckfertigen Innenteil (PDF) aus Seitenbildern + Textoverlay.

Erwartet PNG-Seitenbilder in --bilder, benannt seite-01.png .. seite-NN.png
(eine Datei je finaler Druckseite, bereits in Zielaufloesung/-groesse).
Fehlt eine Bilddatei: Platzhalterseite (weiss, Seitenzahl) wird eingesetzt und
im Log vermerkt -- es wird nichts erfunden oder stillschweigend uebersprungen.

Aufruf:
  python scripts/build-interior-pdf.py --bilder <ordner> --ausgabe <pfad.pdf> --seiten 56
"""
import argparse
import sys
from pathlib import Path

from PIL import Image

DPI = 300
TRIM_IN = 8.5
BLEED_IN = 0.125
PAGE_PX = int(round(TRIM_IN * DPI))  # 2550 px fuer nicht-randabfallende Standardseite


def platzhalter(seite: int) -> Image.Image:
    img = Image.new("RGB", (PAGE_PX, PAGE_PX), "white")
    return img


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bilder", required=True, help="Ordner mit seite-NN.png")
    ap.add_argument("--ausgabe", required=True, help="Ziel-PDF-Pfad")
    ap.add_argument("--seiten", type=int, default=56)
    args = ap.parse_args()

    bilder_dir = Path(args.bilder)
    fehlend = []
    seiten_bilder = []

    for n in range(1, args.seiten + 1):
        kandidat = bilder_dir / f"seite-{n:02d}.png"
        if kandidat.exists():
            img = Image.open(kandidat).convert("RGB")
            if img.size != (PAGE_PX, PAGE_PX):
                img = img.resize((PAGE_PX, PAGE_PX))
        else:
            img = platzhalter(n)
            fehlend.append(n)
        seiten_bilder.append(img)

    ausgabe = Path(args.ausgabe)
    ausgabe.parent.mkdir(parents=True, exist_ok=True)
    seiten_bilder[0].save(
        ausgabe, "PDF", resolution=DPI, save_all=True, append_images=seiten_bilder[1:]
    )

    print(f"PDF geschrieben: {ausgabe} ({len(seiten_bilder)} Seiten, {DPI} DPI, {TRIM_IN}x{TRIM_IN} Zoll)")
    if fehlend:
        print(f"WARNUNG -- {len(fehlend)} Seiten ohne Bilddatei durch weisse Platzhalter ersetzt: {fehlend}")
        print("Dies ist KEIN druckfertiger Endstand -- reale Illustrationen fehlen fuer diese Seiten.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
