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

# SW-Muster aus character-bibles/nebenfiguren.md (fuer Zuordnungsraetsel Tag 4/12/20).
# Farbe funktioniert im Schwarz-Weiss-Innenteil nicht als Loesungsregel -- jede Figur
# bekommt stattdessen ein eindeutig unterscheidbares Strichmuster.
MUSTER = {
    "miro": "sterne",
    "lotte": "wellen",
    "rosa": "blaetter",
    "igel": "punkte",
    "maus": "streifen",
}


def muster_zeichnen(zielbild, cx, cy, r, muster):
    """Zeichnet ein eindeutiges SW-Muster in einen Kreis (Umriss + Fuellmuster).
    Nutzt eine Kachel mit Kreismaske, damit Musterlinien sauber am Kreisrand
    abgeschnitten werden (wichtig fuer 'streifen', die sonst ueberstehen)."""
    d = int(r * 2)
    tile = Image.new("RGB", (d, d), WHITE)
    tdraw = ImageDraw.Draw(tile)
    tc = r
    if muster == "sterne":
        for dx, dy, s in [(-r * 0.4, -r * 0.3, r * 0.28), (r * 0.35, r * 0.1, r * 0.25), (0, r * 0.45, r * 0.2)]:
            _stern(tdraw, tc + dx, tc + dy, s)
    elif muster == "wellen":
        import math
        for i in range(-2, 3):
            y = tc + i * r * 0.32
            pts = [(tc + t / 100 * r * 0.9, y + math.sin(t / 15) * r * 0.12) for t in range(-100, 101, 5)]
            tdraw.line(pts, fill=INK, width=5)
    elif muster == "blaetter":
        import math
        for ang in (0, 120, 240):
            rad = math.radians(ang)
            lx, ly = tc + math.cos(rad) * r * 0.35, tc + math.sin(rad) * r * 0.35
            tdraw.ellipse([lx - r * 0.32, ly - r * 0.18, lx + r * 0.32, ly + r * 0.18], outline=INK, width=5)
            tdraw.line([(lx - r * 0.3, ly), (lx + r * 0.3, ly)], fill=INK, width=3)
    elif muster == "punkte":
        for gx in (-1, 0, 1):
            for gy in (-1, 0, 1):
                px, py = tc + gx * r * 0.42, tc + gy * r * 0.42
                tdraw.ellipse([px - r * 0.1, py - r * 0.1, px + r * 0.1, py + r * 0.1], fill=INK)
    elif muster == "streifen":
        for off in range(-4, 5):
            x0 = off * r * 0.35
            tdraw.line([(x0, d), (x0 + d, 0)], fill=INK, width=9)

    mask = Image.new("L", (d, d), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, d, d], fill=255)
    zielbild.paste(tile, (int(cx - r), int(cy - r)), mask)
    ImageDraw.Draw(zielbild).ellipse([cx - r, cy - r, cx + r, cy + r], outline=INK, width=6)


def _stern(draw, cx, cy, s, fill=None):
    import math
    pts = []
    for i in range(10):
        ang = math.radians(-90 + i * 36)
        rad = s if i % 2 == 0 else s * 0.4
        pts.append((cx + math.cos(ang) * rad, cy + math.sin(ang) * rad))
    if fill:
        draw.polygon(pts, fill=fill)
    else:
        draw.polygon(pts, outline=INK, width=3)


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

    # Start (Miro, gefuellter Kreis) und Ziel (Kerze, gefuellter Stern) -- SW, per Form unterscheidbar
    r = cell // 3
    sx, sy = ox + 2 * r, oy + 2 * r
    draw.ellipse([sx - r, sy - r, sx + r, sy + r], fill=INK)
    ex, ey = ox + (cols - 1) * cell + cell // 2, oy + (rows - 1) * cell + cell // 2
    _stern(draw, ex, ey, r * 1.1, fill=INK)
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

def zuordnen(paare, titel, seed=42):
    """paare: Liste von (item_label, figur) -- linke Spalte Item-Symbol mit SW-Muster,
    rechte Spalte Tier-Symbol mit demselben Muster, aber in ANDERER Zeilenreihenfolge
    (deterministisch gemischt) -- sonst waere die Loesung durch reine Zeilen-Ausrichtung
    trivial und keine echte Zuordnungsaufgabe. Loesungsregel = Muster, nicht Position."""
    random.seed(seed)
    img = neue_seite()
    draw = ImageDraw.Draw(img)
    kopfzeile(draw, titel)
    top = MARGIN * 3
    n = len(paare)
    step = (PAGE_PX - top - MARGIN) // n
    f = schrift(40)
    rechts_reihenfolge = list(range(n))
    while True:
        random.shuffle(rechts_reihenfolge)
        if all(rechts_reihenfolge[i] != i for i in range(n)):
            break
    r_icon = 70
    for i, (label, figur) in enumerate(paare):
        y = top + i * step + step // 2
        muster_zeichnen(img, MARGIN + r_icon, y, r_icon, MUSTER[figur])
        draw.text((MARGIN + r_icon * 2 + 30, y - 20), label, fill=INK, font=f)
    for slot, quelle_i in enumerate(rechts_reihenfolge):
        label, figur = paare[quelle_i]
        y = top + slot * step + step // 2
        muster_zeichnen(img, PAGE_PX - MARGIN - r_icon, y, r_icon, MUSTER[figur])
        bbox = draw.textbbox((0, 0), figur.capitalize(), font=f)
        w = bbox[2] - bbox[0]
        draw.text((PAGE_PX - MARGIN - r_icon * 2 - 30 - w, y - 20), figur.capitalize(), fill=INK, font=f)
    return img


# --------------------------------------------------------------------- Suchbild

def suchbild(anzahl_ziel, titel, seed, nummeriert=False, mindestabstand=200):
    random.seed(seed)
    img = neue_seite()
    draw = ImageDraw.Draw(img)
    kopfzeile(draw, titel)
    top = MARGIN * 3
    positions = []
    tries = 0
    total = anzahl_ziel + random.randint(8, 12)
    while len(positions) < total and tries < 20000:
        tries += 1
        x = random.randint(MARGIN + 80, PAGE_PX - MARGIN - 80)
        y = random.randint(top + 80, PAGE_PX - MARGIN - 80)
        if all((x - px) ** 2 + (y - py) ** 2 > mindestabstand ** 2 for px, py in positions):
            positions.append((x, y))
    # Harte Pruefung statt stillschweigend zu wenige Zielobjekte auszuliefern --
    # "richtige Anzahl" ist eine Kernanforderung, kein Best-Effort.
    assert len(positions) >= anzahl_ziel, (
        f"suchbild: nur {len(positions)} Positionen gepackt, {anzahl_ziel} Ziele gefordert "
        f"(Seed {seed}) -- mindestabstand verkleinern oder Seitenflaeche vergroessern"
    )
    f = schrift(34) if nummeriert else None
    for i, (x, y) in enumerate(positions):
        if i < anzahl_ziel:
            draw.ellipse([x - 35, y - 35, x + 35, y + 35], outline=(200, 40, 40), width=8)
            draw.ellipse([x - 15, y - 15, x + 15, y + 15], fill=(230, 180, 40))
            if nummeriert:
                draw.text((x - 10, y - 75), str(i + 1), fill=INK, font=f)
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
        12: zuordnen([("Schal", "miro"), ("Muetze", "lotte"), ("Handschuh", "rosa")], "Welches Kleidungsstueck hat das gleiche Muster wie sein Tier?"),
        14: suchbild(3, "Finde 3 Gloeckchen im Bild!", 5),
        16: schwungubung("schneeflocke", "Fahre die Linie mit dem Stift nach!"),
        18: ausmalen_muster(10, [(210, 50, 50), (60, 140, 70)], "Male abwechselnd rot und gruen!", 2),
        20: schattenraetsel("Welcher Schatten gehoert zu welchem Tier?", 7),
        22: labyrinth(2, 5, "Hilf Miro durch den groesseren Wald!"),
        24: punkte_verbinden(BAUM8, "Verbinde die Punkte 1 bis 8!"),
        26: zaehlen(7, "Zaehle die Plaetzchen auf dem Teller!", "plaetzchen", 11),
        28: zuordnen([("Laterne", "igel"), ("Laterne", "miro"), ("Laterne", "maus"), ("Laterne", "rosa")], "Welche Laterne hat das gleiche Muster wie sein Tier?"),
        30: suchbild(3, "Finde 3 Handschuhe im Winterbild!", 13),
        32: schwungubung("welle", "Fahre die Wellenlinie nach, ohne abzusetzen!"),
        34: ausmalen_muster(18, [(210, 50, 50), (60, 140, 70), (230, 190, 60)], "Male nach dem Muster: Rot, Gruen, Gelb!", 3),
        36: schattenraetsel("Welcher Schatten gehoert zu welchem Vogel?", 17),
        38: labyrinth(3, 6, "Hilf Miro durch den langen Wald!"),
        40: punkte_verbinden(STERN10, "Verbinde die Punkte 1 bis 10!"),
        42: zaehlen(9, "Zaehle alle Waldtiere im Bild!", "tier", 19),
        44: zuordnen([("Kerzen", "miro"), ("Praesentkarte", "lotte"), ("Plaetzchen", "rosa"), ("Zapfen", "igel"), ("Gloeckchen", "maus")], "Wer bringt was mit? (Muster zeigt es)"),
        46: suchbild(3, "Finde 3 Perlen im grossen Festbild!", 21),
        48: schwungubung("schleife", "Fahre die Schleifenlinie nach!"),
        50: ausmalen_muster(24, [(210, 50, 50), (60, 140, 70), (230, 190, 60)], "Male das grosse Bild nach dem Muster!", 4),
        52: suchbild(24, "Finde alle 24 Perlen im Festbild!", 24, nummeriert=True, mindestabstand=160),
    }

    for seite_nr, img in sorted(seiten.items()):
        pfad = out / f"seite-{seite_nr:02d}.png"
        img.save(pfad, dpi=(DPI, DPI))
        print(f"geschrieben: {pfad.name}")

    print(f"\n{len(seiten)} Raetselgrafiken erzeugt in {out}")
    print("Fehlend/noch offen: linke Szenenseiten (Miro/Lotte-Illustrationen) -- siehe Fooocus-Pipeline.")


if __name__ == "__main__":
    main()
