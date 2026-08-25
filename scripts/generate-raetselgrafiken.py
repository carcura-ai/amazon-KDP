#!/usr/bin/env python
"""Erzeugt alle 24 Raetselgrafiken (rechte Doppelseiten) fuer Miros Lichterwald-
Adventskalender programmatisch/vektoriell -- keine KI-Bildgenerierung noetig.

Grund: Labyrinthe, Punkte-verbinden, Zaehlaufgaben, Suchbilder etc. brauchen
garantierte Korrektheit (exakte Anzahl, eindeutig loesbarer Weg) -- das liefert
Code zuveraessiger als ein Diffusionsmodell. Ergebnis: 300-DPI-PNGs, eine je
Rätselseite, passend fuer scripts/build-interior-pdf.py.

Aufruf:
  python scripts/generate-raetselgrafiken.py --ausgabe <ordner>
"""
import argparse
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

DPI = 300
PAGE_PX = int(round(8.5 * DPI))  # 2550
MARGIN = int(0.4 * DPI)  # Innenrand/Sicherheitsabstand
INK = (30, 30, 30)
WHITE = (255, 255, 255)

# Farbcodes aus character-bibles/ (fuer Zuordnungsraetsel Tag 4/12/20)
FARBEN = {
    "miro": (47, 184, 172),      # Miro Schwanzspitze (türkis)
    "lotte": (124, 143, 166),    # Lotte Gefieder (blaugrau)
    "rosa": (62, 122, 76),       # Waldtante Rosa Umhang (gruen)
    "igel": (224, 138, 43),      # Igel Muetze (orange)
    "maus": (242, 199, 68),      # Maus Schleife (gelb)
}


def neue_seite():
    return Image.new("RGB", (PAGE_PX, PAGE_PX), WHITE)


def schrift(groesse):
    for kandidat in ("arial.ttf", "calibri.ttf", "verdana.ttf"):
        try:
            return ImageFont.truetype(kandidat, groesse)
        except OSError:
            continue
    return ImageFont.load_default()


def kopfzeile(draw, text):
    f = schrift(56)
    draw.text((MARGIN, MARGIN // 2), text, fill=INK, font=f)


# ---------------------------------------------------------------- Labyrinth

def labyrinth(seed, groesse, titel):
    random.seed(seed)
    img = neue_seite()
    draw = ImageDraw.Draw(img)
    kopfzeile(draw, titel)

    top = MARGIN * 2
    area = PAGE_PX - top - MARGIN
    cols = rows = groesse
    cell = area // cols
    ox = (PAGE_PX - cell * cols) // 2
    oy = top

    walls = {(x, y): {"N": True, "S": True, "E": True, "W": True} for x in range(cols) for y in range(rows)}
    visited = set()

    def carve(x, y):
        visited.add((x, y))
        dirs = [("N", 0, -1), ("S", 0, 1), ("E", 1, 0), ("W", -1, 0)]
        random.shuffle(dirs)
        for d, dx, dy in dirs:
            nx, ny = x + dx, y + dy
            if 0 <= nx < cols and 0 <= ny < rows and (nx, ny) not in visited:
                walls[(x, y)][d] = False
                opp = {"N": "S", "S": "N", "E": "W", "W": "E"}[d]
                walls[(nx, ny)][opp] = False
                carve(nx, ny)

    carve(0, 0)

    lw = max(4, cell // 12)
    for x in range(cols):
        for y in range(rows):
            px, py = ox + x * cell, oy + y * cell
            w = walls[(x, y)]
            if w["N"]:
                draw.line([(px, py), (px + cell, py)], fill=INK, width=lw)
            if w["W"]:
                draw.line([(px, py), (px, py + cell)], fill=INK, width=lw)
            if x == cols - 1:
                draw.line([(px + cell, py), (px + cell, py + cell)], fill=INK, width=lw)
            if y == rows - 1:
                draw.line([(px, py + cell), (px + cell, py + cell)], fill=INK, width=lw)

    # Start (Miro, Kreis türkis) und Ziel (Kerze, gelber Stern)
    r = cell // 3
    draw.ellipse([ox + r, oy + r, ox + 3 * r, oy + 3 * r], fill=FARBEN["miro"])
    ex, ey = ox + (cols - 1) * cell + cell // 2, oy + (rows - 1) * cell + cell // 2
    draw.ellipse([ex - r, ey - r, ex + r, ey + r], fill=(230, 180, 40))
    return img


# ---------------------------------------------------------- Punkte verbinden

STERN5 = [(0, -100), (95, 31), (59, 81), (-59, 81), (-95, 31)]  # Zickzack-Reihenfolge Pentagramm
BAUM8 = [(0, -120), (-40, -40), (-15, -40), (-70, 40), (-25, 40), (-90, 120), (90, 120), (25, 40)]
STERN10 = [(0, -140), (33, -43), (133, -43), (54, 17), (82, 113), (0, 54), (-82, 113), (-54, 17), (-133, -43), (-33, -43)]


def punkte_verbinden(punkte, titel, radius=800):
    img = neue_seite()
    draw = ImageDraw.Draw(img)
    kopfzeile(draw, titel)
    cx, cy = PAGE_PX // 2, PAGE_PX // 2 + 100
    skala = radius / 140
    f = schrift(48)
    for i, (x, y) in enumerate(punkte, start=1):
        px, py = cx + int(x * skala), cy + int(y * skala)
        draw.ellipse([px - 14, py - 14, px + 14, py + 14], fill=INK)
        draw.text((px + 20, py - 30), str(i), fill=INK, font=f)
    return img


# ---------------------------------------------------------------------- Zaehlen

def zaehlen(anzahl, titel, form="zapfen", seed=0):
    random.seed(seed)
    img = neue_seite()
    draw = ImageDraw.Draw(img)
    kopfzeile(draw, titel)
    top = MARGIN * 3
    positions = []
    tries = 0
    while len(positions) < anzahl and tries < 5000:
        tries += 1
        x = random.randint(MARGIN + 100, PAGE_PX - MARGIN - 100)
        y = random.randint(top + 100, PAGE_PX - MARGIN - 100)
        if all((x - px) ** 2 + (y - py) ** 2 > 260 ** 2 for px, py in positions):
            positions.append((x, y))
    for x, y in positions:
        if form == "zapfen":
            draw.ellipse([x - 45, y - 70, x + 45, y + 70], fill=(140, 90, 50))
        elif form == "plaetzchen":
            draw.ellipse([x - 55, y - 55, x + 55, y + 55], fill=(210, 160, 90))
        else:
            draw.ellipse([x - 60, y - 45, x + 60, y + 45], fill=(160, 120, 90))
    return img


# --------------------------------------------------------------------- Zuordnen

def zuordnen(paare, titel):
    """paare: Liste von (item_label, farbname) -- linke Spalte Item, rechte Spalte Tiername in gleicher Farbe."""
    img = neue_seite()
    draw = ImageDraw.Draw(img)
    kopfzeile(draw, titel)
    top = MARGIN * 3
    n = len(paare)
    step = (PAGE_PX - top - MARGIN) // n
    f = schrift(44)
    for i, (label, farbe) in enumerate(paare):
        y = top + i * step + step // 2
        col = FARBEN[farbe]
        draw.ellipse([MARGIN, y - 50, MARGIN + 100, y + 50], fill=col)
        draw.text((MARGIN + 130, y - 22), label, fill=INK, font=f)
        draw.ellipse([PAGE_PX - MARGIN - 100, y - 50, PAGE_PX - MARGIN, y + 50], fill=col)
        draw.text((PAGE_PX - MARGIN - 260, y - 22), farbe.capitalize(), fill=INK, font=f)
    return img


# --------------------------------------------------------------------- Suchbild

def suchbild(anzahl_ziel, titel, seed):
    random.seed(seed)
    img = neue_seite()
    draw = ImageDraw.Draw(img)
    kopfzeile(draw, titel)
    top = MARGIN * 3
    positions = []
    tries = 0
    total = anzahl_ziel + random.randint(8, 12)
    while len(positions) < total and tries < 6000:
        tries += 1
        x = random.randint(MARGIN + 80, PAGE_PX - MARGIN - 80)
        y = random.randint(top + 80, PAGE_PX - MARGIN - 80)
        if all((x - px) ** 2 + (y - py) ** 2 > 200 ** 2 for px, py in positions):
            positions.append((x, y))
    for i, (x, y) in enumerate(positions):
        if i < anzahl_ziel:
            draw.ellipse([x - 35, y - 35, x + 35, y + 35], outline=(200, 40, 40), width=8)
            draw.ellipse([x - 15, y - 15, x + 15, y + 15], fill=(230, 180, 40))
        else:
            draw.ellipse([x - 30, y - 40, x + 30, y + 40], fill=(90, 140, 90))
    return img


# ---------------------------------------------------------------- Schwungübung

def schwungubung(art, titel):
    img = neue_seite()
    draw = ImageDraw.Draw(img)
    kopfzeile(draw, titel)
    cx, cy = PAGE_PX // 2, PAGE_PX // 2 + 100
    pts = []
    if art == "schneeflocke":
        import math
        for a in range(0, 360, 15):
            rad = math.radians(a)
            pts.append((cx + int(700 * math.cos(rad)), cy + int(700 * math.sin(rad))))
            draw.line([(cx, cy), pts[-1]], fill=(180, 180, 220), width=6)
    elif art == "welle":
        import math
        prev = None
        for i in range(-800, 801, 8):
            y = cy + int(200 * math.sin(i / 100))
            p = (cx + i, y)
            if prev:
                draw.line([prev, p], fill=(180, 180, 220), width=10)
            prev = p
    else:  # schleife/girlande
        import math
        prev = None
        for i in range(0, 361, 3):
            rad = math.radians(i)
            x = cx + int(700 * math.cos(rad) * math.sin(rad * 2))
            y = cy + int(500 * math.sin(rad))
            p = (x, y)
            if prev:
                draw.line([prev, p], fill=(180, 180, 220), width=10)
            prev = p
    return img


# -------------------------------------------------------------- Ausmalen nach Muster

def ausmalen_muster(anzahl, folge, titel, vorgemalt=2):
    img = neue_seite()
    draw = ImageDraw.Draw(img)
    kopfzeile(draw, titel)
    top = MARGIN * 3
    cols = 6
    rows = (anzahl + cols - 1) // cols
    cell = min((PAGE_PX - 2 * MARGIN) // cols, (PAGE_PX - top - MARGIN) // rows)
    for i in range(anzahl):
        r, c = divmod(i, cols)
        x = MARGIN + c * cell + cell // 2
        y = top + r * cell + cell // 2
        farbe_index = i % len(folge)
        outline = folge[farbe_index]
        fill = outline if i < vorgemalt else None
        draw.ellipse([x - cell // 3, y - cell // 3, x + cell // 3, y + cell // 3], outline=INK, width=6, fill=fill)
    return img


# --------------------------------------------------------------- Schattenrätsel

def schattenraetsel(titel, seed):
    random.seed(seed)
    img = neue_seite()
    draw = ImageDraw.Draw(img)
    kopfzeile(draw, titel)
    top = MARGIN * 3
    formen = [("rund", 220), ("spitz", 260), ("klein", 140)]
    step = (PAGE_PX - top - MARGIN) // len(formen)
    for i, (art, groesse) in enumerate(formen):
        y = top + i * step + step // 2
        x = PAGE_PX // 2
        if art == "rund":
            draw.ellipse([x - groesse, y - groesse, x + groesse, y + groesse], fill=(20, 20, 20))
        elif art == "spitz":
            draw.polygon([(x, y - groesse), (x - groesse, y + groesse), (x + groesse, y + groesse)], fill=(20, 20, 20))
        else:
            draw.ellipse([x - groesse, y - groesse // 2, x + groesse, y + groesse // 2], fill=(20, 20, 20))
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ausgabe", required=True)
    args = ap.parse_args()
    out = Path(args.ausgabe)
    out.mkdir(parents=True, exist_ok=True)

    seiten = {
        6: labyrinth(1, 4, "Hilf Miro durch den Wald zur Kerze!"),
        8: punkte_verbinden(STERN5, "Verbinde die Punkte 1 bis 5!"),
        10: zaehlen(4, "Zaehle die Tannenzapfen!", "zapfen", 3),
        12: zuordnen([("Tuerkiser Schal", "miro"), ("Blaue Muetze", "lotte"), ("Gruener Handschuh", "rosa")], "Welches Kleidungsstueck hat die Farbe seines Tieres?"),
        14: suchbild(3, "Finde 3 Gloeckchen im Bild!", 5),
        16: schwungubung("schneeflocke", "Fahre die Linie mit dem Stift nach!"),
        18: ausmalen_muster(10, [(210, 50, 50), (60, 140, 70)], "Male die Kreise rot, die Sterne gruen!", 2),
        20: schattenraetsel("Welcher Schatten gehoert zu welchem Tier?", 7),
        22: labyrinth(2, 5, "Hilf Miro durch den groesseren Wald!"),
        24: punkte_verbinden(BAUM8, "Verbinde die Punkte 1 bis 8!"),
        26: zaehlen(7, "Zaehle die Plaetzchen auf dem Teller!", "plaetzchen", 11),
        28: zuordnen([("Orange Laterne", "igel"), ("Tuerkise Laterne", "miro"), ("Gelbe Laterne", "maus"), ("Gruene Laterne", "rosa")], "Welche Laterne hat die Farbe seines Tieres?"),
        30: suchbild(3, "Finde 3 Handschuhe im Winterbild!", 13),
        32: schwungubung("welle", "Fahre die Wellenlinie nach, ohne abzusetzen!"),
        34: ausmalen_muster(18, [(210, 50, 50), (60, 140, 70), (230, 190, 60)], "Male nach dem Muster: Rot, Gruen, Gelb!", 3),
        36: schattenraetsel("Welcher Schatten gehoert zu welchem Vogel?", 17),
        38: labyrinth(3, 6, "Hilf Miro durch den langen Wald!"),
        40: punkte_verbinden(STERN10, "Verbinde die Punkte 1 bis 10!"),
        42: zaehlen(9, "Zaehle alle Waldtiere im Bild!", "tier", 19),
        44: zuordnen([("Tuerkise Kerzen", "miro"), ("Blaue Sterne", "lotte"), ("Gruene Plaetzchen", "rosa"), ("Orange Zapfen", "igel"), ("Gelbe Gloeckchen", "maus")], "Wer bringt was mit? (Farbcode)"),
        46: suchbild(3, "Finde 3 Perlen im grossen Festbild!", 21),
        48: schwungubung("schleife", "Fahre die Schleifenlinie nach!"),
        50: ausmalen_muster(24, [(210, 50, 50), (60, 140, 70), (230, 190, 60)], "Male das grosse Bild nach dem Muster!", 4),
        52: suchbild(24, "Finde alle 24 Perlen im Festbild!", 24),
    }

    for seite_nr, img in sorted(seiten.items()):
        pfad = out / f"seite-{seite_nr:02d}.png"
        img.save(pfad, dpi=(DPI, DPI))
        print(f"geschrieben: {pfad.name}")

    print(f"\n{len(seiten)} Raetselgrafiken erzeugt in {out}")
    print("Fehlend/noch offen: linke Szenenseiten (Miro/Lotte-Illustrationen) -- siehe Fooocus-Pipeline.")


if __name__ == "__main__":
    main()
