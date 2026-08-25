#!/usr/bin/env python
"""Erzeugt Vorspann/Nachspann-Seiten (Text) und Platzhalter-Szenenseiten
(linke Doppelseiten, warten auf KI-Illustration) als 300-DPI-PNGs.

Aufruf:
  python scripts/generate-textseiten.py --ausgabe <ordner>
"""
import argparse
import json
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

DPI = 300
PAGE_PX = int(round(8.5 * DPI))
MARGIN = int(0.6 * DPI)
INK = (30, 30, 30)
WHITE = (255, 255, 255)
ACCENT = (47, 184, 172)


def schrift(groesse, bold=False):
    kandidaten = ["arialbd.ttf", "calibrib.ttf"] if bold else ["arial.ttf", "calibri.ttf"]
    for k in kandidaten:
        try:
            return ImageFont.truetype(k, groesse)
        except OSError:
            continue
    return ImageFont.load_default()


def seite(text_bloecke, titel_seite=False):
    img = Image.new("RGB", (PAGE_PX, PAGE_PX), WHITE)
    draw = ImageDraw.Draw(img)
    y = MARGIN * 2 if not titel_seite else PAGE_PX // 3
    for text, groesse, bold, mittig in text_bloecke:
        f = schrift(groesse, bold)
        for zeile in textwrap.wrap(text, width=max(10, 60 - groesse // 3)):
            bbox = draw.textbbox((0, 0), zeile, font=f)
            w = bbox[2] - bbox[0]
            x = (PAGE_PX - w) // 2 if mittig else MARGIN
            draw.text((x, y), zeile, fill=INK, font=f)
            y += int(groesse * 1.4)
        y += int(groesse * 0.6)
    return img


def platzhalter_szene(nr, mini_text):
    img = Image.new("RGB", (PAGE_PX, PAGE_PX), (235, 245, 243))
    draw = ImageDraw.Draw(img)
    f = schrift(52)
    fk = schrift(60, bold=True)
    draw.rectangle([40, 40, PAGE_PX - 40, PAGE_PX - 40], outline=ACCENT, width=6)
    draw.text((MARGIN, MARGIN), mini_text, fill=INK, font=f)
    label = f"[Platzhalter -- Illustration Tag {nr} ausstehend, siehe illustration-briefs.md]"
    bbox = draw.textbbox((0, 0), label, font=fk)
    w = bbox[2] - bbox[0]
    draw.text(((PAGE_PX - w) // 2, PAGE_PX // 2), label, fill=(150, 90, 20), font=fk)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ausgabe", required=True)
    args = ap.parse_args()
    out = Path(args.ausgabe)
    out.mkdir(parents=True, exist_ok=True)

    prompts = json.loads(Path(__file__).resolve().parent.parent.joinpath(
        "amazon-kdp-business/books/series/miro-fuchs/band-1/druckdaten/prompts.json"
    ).read_text(encoding="utf-8"))

    seiten = {}
    seiten[1] = seite([("Miro Fuchs", 90, True, True), ("Miros Lichterwald-Adventskalender", 60, True, True),
                        ("24 Rätsel bis Weihnachten", 44, False, True)], titel_seite=True)
    seiten[2] = seite([("© [Jahr] [Verlagsname/Autorenname einsetzen]. Alle Rechte vorbehalten.", 36, False, False),
                        ("Text und Konzept: [Name]. Illustration: [Name].", 36, False, False),
                        ("Kontakt: [E-Mail einsetzen]", 36, False, False)])
    seiten[3] = seite([("Dieses Buch gehört: ______________________", 44, False, False),
                        ("Miro freut sich, dass du dabei bist!", 44, False, False)])
    seiten[4] = seite([("Anleitung für Erwachsene", 52, True, False),
                        ("Liebe große Begleitperson,", 38, False, False),
                        ("jeden Tag im Advent wartet eine kleine Aufgabe mit Miro dem Fuchs.", 38, False, False),
                        ("Ein Rätsel dauert 5 bis 15 Minuten — ganz ohne Zeitdruck.", 38, False, False),
                        ("Ist eine Aufgabe zu schwer: gemeinsam anschauen, Miro hilft mit einem Tipp.", 38, False, False),
                        ("Die Lösungen findest du auf den letzten Seiten.", 38, False, False),
                        ("Wichtig: Nicht das Ergebnis zählt, sondern die gemeinsame Zeit mit Miro.", 38, False, False)])

    for eintrag in prompts["seiten"]:
        s = eintrag["seite"]
        seiten[s] = platzhalter_szene(eintrag["tag"], f"Tag {eintrag['tag']}: {eintrag['szene']}")

    seiten[53] = seite([("Lösungen Tag 1–12", 52, True, False),
                         ("Siehe lektorat.md und manuskript.md für den vollständigen Lösungstext je Tag.", 34, False, False)])
    seiten[54] = seite([("Lösungen Tag 13–24", 52, True, False),
                         ("Siehe lektorat.md und manuskript.md für den vollständigen Lösungstext je Tag.", 34, False, False)])
    seiten[55] = seite([("„Wir haben es geschafft — schau, wie schön der Lichterwald leuchtet!" , 40, False, False),
                         ("„Das schaffen wir zusammen — jedes Jahr wieder.“", 40, False, False)])
    seiten[56] = seite([("Miro Fuchs geht weiter:", 44, True, False),
                         ("In Band 2 hilft dir Miro an einem verregneten Tag.", 38, False, False),
                         ("Für Kinder ab 3 Jahren. Mehr unter [Verlags-/Autorenseite einsetzen].", 38, False, False)])

    for nr, img in sorted(seiten.items()):
        pfad = out / f"seite-{nr:02d}.png"
        img.save(pfad, dpi=(DPI, DPI))
    print(f"{len(seiten)} Text-/Platzhalterseiten erzeugt in {out}")


if __name__ == "__main__":
    main()
