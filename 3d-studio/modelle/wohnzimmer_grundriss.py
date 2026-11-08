"""Grundriss Wohnzimmer DG im Massstab 1:50 (A4 quer) als SVG - aus denselben Massen wie das 3D-Modell.

Aufruf: python3 3d-studio/modelle/wohnzimmer_grundriss.py <ziel.svg>
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wohnzimmer_masse as M  # noqa: E402

S = 20.0                       # mm pro m auf dem Blatt (1:50)
OX, OY = 34.0, 44.0 + M.GAUBE_Y1 * S
WAND = 0.12                    # Darstellungsdicke Wand (m)

FARBE = dict(wand="#2B2724", moebel="#8C6B4F", text="#2B2724", mass="#6D6258", led="#E0A030", lamelle="#B08A5E",
             teppich="#D9D2C7", hoehe="#9C8F84")
teile = []


def P(x, y):
    return OX + x * S, OY - y * S


def linie(x0, y0, x1, y1, farbe=FARBE["wand"], w=0.35, strich=None):
    a, b = P(x0, y0)
    c, d = P(x1, y1)
    da = f' stroke-dasharray="{strich}"' if strich else ""
    teile.append(f'<line x1="{a:.2f}" y1="{b:.2f}" x2="{c:.2f}" y2="{d:.2f}" stroke="{farbe}" stroke-width="{w}"{da}/>')


def rechteck(x0, y0, x1, y1, fill="none", stroke=FARBE["moebel"], w=0.3, strich=None, rx=0.0):
    a, b = P(min(x0, x1), max(y0, y1))
    da = f' stroke-dasharray="{strich}"' if strich else ""
    teile.append(f'<rect x="{a:.2f}" y="{b:.2f}" width="{abs(x1 - x0) * S:.2f}" height="{abs(y1 - y0) * S:.2f}" '
                 f'rx="{rx * S:.2f}" fill="{fill}" stroke="{stroke}" stroke-width="{w}"{da}/>')


def kreis(x, y, r, fill="none", stroke=FARBE["moebel"], w=0.3):
    a, b = P(x, y)
    teile.append(f'<circle cx="{a:.2f}" cy="{b:.2f}" r="{r * S:.2f}" fill="{fill}" stroke="{stroke}" '
                 f'stroke-width="{w}"/>')


def polygon(pts, fill="none", stroke=FARBE["moebel"], w=0.3):
    s = " ".join(f"{P(x, y)[0]:.2f},{P(x, y)[1]:.2f}" for x, y in pts)
    teile.append(f'<polygon points="{s}" fill="{fill}" stroke="{stroke}" stroke-width="{w}"/>')


def text(x, y, t, groesse=2.4, farbe=FARBE["text"], anker="middle", dreh=0, fett=False, blatt=False):
    a, b = (x, y) if blatt else P(x, y)
    tr = f' transform="rotate({dreh} {a:.2f} {b:.2f})"' if dreh else ""
    fw = ' font-weight="600"' if fett else ""
    teile.append(f'<text x="{a:.2f}" y="{b:.2f}" font-size="{groesse}" fill="{farbe}" text-anchor="{anker}"'
                 f'{fw}{tr}>{t}</text>')


def masskette(x0, y0, x1, y1, abstand, label=None):
    """Masslinie parallel zur Strecke, um 'abstand' (m) nach links/oben versetzt."""
    dx, dy = x1 - x0, y1 - y0
    lg = math.hypot(dx, dy)
    nx, ny = -dy / lg * abstand, dx / lg * abstand
    a0, b0, a1, b1 = x0 + nx, y0 + ny, x1 + nx, y1 + ny
    linie(x0, y0, a0 + nx * 0.15, b0 + ny * 0.15, FARBE["mass"], 0.15)
    linie(x1, y1, a1 + nx * 0.15, b1 + ny * 0.15, FARBE["mass"], 0.15)
    linie(a0, b0, a1, b1, FARBE["mass"], 0.2)
    for xa, ya in ((a0, b0), (a1, b1)):
        linie(xa - 0.06, ya - 0.06, xa + 0.06, ya + 0.06, FARBE["mass"], 0.3)
    dreh = -math.degrees(math.atan2(dy, dx))
    if dreh <= -90 or dreh > 90:
        dreh += 180
    mx, my = (a0 + a1) / 2 + nx * 0.18, (b0 + b1) / 2 + ny * 0.18
    text(mx, my, label or f"{lg:.2f}".replace(".", ","), 2.2, FARBE["mass"], dreh=dreh)


def wand(pts):
    """Wandzug als dicke Linie (Innenkante auf den Massen)."""
    s = " ".join(f"{P(x, y)[0]:.2f},{P(x, y)[1]:.2f}" for x, y in pts)
    teile.append(f'<polyline points="{s}" fill="none" stroke="{FARBE["wand"]}" stroke-width="{WAND * S:.2f}" '
                 f'stroke-linejoin="miter"/>')


def baue():
    L, YR, YF, GY, GX = M.L, M.YR, M.YF, M.GAUBE_Y1, M.GAUBE_X0
    t = M.TUER
    # Boden (Raum) leicht getoent
    polygon([(0, YR), (L, YR), (L, GY), (GX, GY), (GX, M.NISCHE_Y), (M.WAND_X, M.NISCHE_Y), (M.WAND_X, YF), (0, YF)],
            fill="#F4EFE8", stroke="none")
    # Hoehenlinien unter der Schraege
    y2 = YR + (2.0 - M.KNIE)
    linie(0, YR + M.LAUF, L, YR + M.LAUF, FARBE["hoehe"], 0.2, "2,1")
    linie(0, y2, L, y2, FARBE["hoehe"], 0.2, "0.6,0.9")
    text(L + WAND + 0.05, YR + M.LAUF - 0.04, "2,35", 1.7, FARBE["hoehe"], "start")
    text(L + WAND + 0.05, y2 - 0.04, "2,00", 1.7, FARBE["hoehe"], "start")
    text(L + WAND + 0.05, YR + 0.03, "1,05", 1.7, FARBE["hoehe"], "start")
    yn2 = YF + (M.DECKE - 2.0)
    linie(M.WAND_X, yn2, GX, yn2, FARBE["hoehe"], 0.2, "0.6,0.9")
    # Teppich + Lamellenwand (unter den Moebeln)
    tp = M.TEPPICH
    rechteck(tp["x0"], tp["y0"], tp["x0"] + tp["b"], tp["y0"] + tp["t"], FARBE["teppich"], "#BFB5A8", 0.2)
    la = M.LAMELLE
    tief = la["filz"] + la["tiefe"]
    rechteck(GX + 0.02, GY - tief - 0.04, L - 0.02, GY, FARBE["lamelle"], FARBE["lamelle"], 0.1)
    x = GX + 0.04
    while x < L - 0.03:
        linie(x, GY - tief - 0.04, x, GY, "#5B4632", 0.08)
        x += la["raster"]
    # Waende
    d, NY, WX = WAND / 2, M.NISCHE_Y, M.WAND_X          # Wandstrich nach aussen: Innenkante = Mass
    wand([(-d, YF + d), (-d, YR - d), (L + d, YR - d), (L + d, GY + d), (GX - d, GY + d), (GX - d, NY + d),
          (WX - d, NY + d), (WX - d, YF + d), (-d, YF + d)])
    # Eingangstuer: Oeffnung, Blatt, Schwenkbogen (Band Heizkoerperseite, oeffnet nach innen)
    y0, y1 = t["y0"], t["y0"] + t["b"]
    a, b = P(-WAND - 0.01, y1)
    c, d = P(0.01, y0)
    teile.append(f'<rect x="{a:.2f}" y="{b:.2f}" width="{c - a:.2f}" height="{d - b:.2f}" fill="#F4EFE8"/>')
    w = math.radians(t["offen"])
    fx, fy = t["b"] * math.sin(w), y1 - t["b"] * math.cos(w)
    linie(0, y1, fx, fy, FARBE["wand"], 0.35)
    pa, pb = P(0, y0)
    pc, pd = P(fx, fy)
    teile.append(f'<path d="M {pa:.2f} {pb:.2f} A {t["b"] * S:.2f} {t["b"] * S:.2f} 0 0 1 {pc:.2f} {pd:.2f}" '
                 f'fill="none" stroke="{FARBE["mass"]}" stroke-width="0.15" stroke-dasharray="0.8,0.6"/>')
    text(-0.55, (y0 + y1) / 2, "Flur", 2.2, FARBE["mass"], dreh=-90)
    # Badtuer (verdeckt hinter Lamellen)
    bt = M.BADTUER
    a, b = P(bt["x0"], GY + WAND + 0.01)
    c, d = P(bt["x0"] + bt["b"], GY - 0.01)
    teile.append(f'<rect x="{a:.2f}" y="{b:.2f}" width="{c - a:.2f}" height="{d - b:.2f}" fill="#F4EFE8"/>')
    linie(bt["x0"], GY, bt["x0"] + bt["b"], GY, "#5B4632", 0.35, "1,0.6")
    text(bt["x0"] + bt["b"] / 2, GY + 0.22, "Bad (Tür verdeckt)", 2.0, FARBE["mass"])
    # Gaubenfenster (Stirnwand), Dachfenster (Projektion), Heizkoerper
    fg = M.FENSTER_G
    a, b = P(L - 0.01, fg["ym"] + fg["b"] / 2)
    c, d = P(L + WAND + 0.01, fg["ym"] - fg["b"] / 2)
    teile.append(f'<rect x="{a:.2f}" y="{b:.2f}" width="{c - a:.2f}" height="{d - b:.2f}" fill="#FFFFFF" '
                 f'stroke="{FARBE["wand"]}" stroke-width="0.2"/>')
    linie(L, fg["ym"] - fg["b"] / 2, L, fg["ym"] + fg["b"] / 2, FARBE["wand"], 0.2)
    k = M.dachfenster()
    df = M.DF
    rechteck(df["x0"], YR, df["x0"] + df["b"], k["verkl_o"][0], "none", FARBE["wand"], 0.25, "1.2,0.8")
    text(df["x0"] + df["b"] / 2, YR - 0.20, "Dachfenster (Projektion)", 1.8, FARBE["mass"])
    h = M.HEIZ_E
    rechteck(0.03, h["y0"], 0.11, h["y0"] + h["b"], "#FFFFFF", FARBE["wand"], 0.2)
    rechteck(L - 0.11, fg["ym"] + 0.05 - 0.5, L - 0.03, fg["ym"] + 0.05 + 0.5, "#FFFFFF", FARBE["wand"], 0.2)
    text(L - 0.25, fg["ym"] + 0.05, "Heizkörper", 1.7, FARBE["mass"], dreh=-90)
    # Revisionsklappe + Pfosten
    r = M.REV
    rechteck(r["xm"] - r["b"] / 2, YR, r["xm"] + r["b"] / 2, YR + 0.05, "#FFFFFF", FARBE["wand"], 0.25)
    text(r["xm"] + 0.35, YR - 0.20, "Revisionsklappe (bleibt erreichbar)", 1.8, FARBE["mass"], "start")
    p = M.PFOSTEN
    rechteck(p["x"] - p["s"] / 2, p["y"] - p["s"] / 2, p["x"] + p["s"] / 2, p["y"] + p["s"] / 2, "#FFFFFF",
             FARBE["wand"], 0.3)
    linie(GX, YF, L, YF, FARBE["wand"], 0.15, "2,1")
    text(p["x"] + 0.14, YF - 0.05, "Pfosten", 1.8, FARBE["mass"], "start")
    text((M.WAND_X + GX) / 2, (YF + M.NISCHE_Y) / 2 + 0.05, "Nische unter der Schräge", 1.8, FARBE["mass"])
    # LED-Linien
    linie(0.02, YR + 0.07, L - 0.02, YR + 0.07, FARBE["led"], 0.5, "1.6,0.6")
    linie(M.WAND_X + 0.02, M.NISCHE_Y - 0.07, GX - 0.02, M.NISCHE_Y - 0.07, FARBE["led"], 0.5, "1.6,0.6")
    linie(GX + 0.04, GY - tief - 0.07, L - 0.04, GY - tief - 0.07, FARBE["led"], 0.5, "1.6,0.6")
    # Moebel
    c = M.COUCH
    cx0, cx1 = c["x0"], c["x0"] + c["b"]
    cyb = YR + c["wand"]
    rechteck(cx0, cyb, cx1, cyb + c["t"], "#E7DCCB", FARBE["moebel"], 0.3, rx=0.04)
    rechteck(cx0 + 0.17, cyb, cx1 - 0.17, cyb + 0.22, "none", FARBE["moebel"], 0.2)
    for i in range(1, 3):
        xx = cx0 + 0.17 + (c["b"] - 0.34) * i / 3
        linie(xx, cyb + 0.22, xx, cyb + c["t"] - 0.02, FARBE["moebel"], 0.15)
    text((cx0 + cx1) / 2, cyb + 0.55, "Couch Cord Sand 260 × 95", 2.0)
    ct = M.COUCHTISCH
    kreis(ct["x"], ct["y"], ct["d"] / 2, "#E3CDAE")
    text(ct["x"], ct["y"] - 0.03, "Ø 80", 1.8)
    bt_ = M.BEISTELL
    kreis(bt_["x"], bt_["y"], bt_["d"] / 2, "#3A3A3A", "#1E1E1E")
    for nm in ("STEH_COUCH", "STEH_LESE"):
        sl = getattr(M, nm)
        kreis(sl["x"], sl["y"], 0.14, "none", "#1E1E1E", 0.3)
        kreis(sl["x"], sl["y"], 0.03, "#1E1E1E", "#1E1E1E", 0.1)
    se = M.SESSEL
    ziel = (ct["x"] - 0.4, ct["y"] + 0.5)
    w = math.atan2(ziel[1] - se["y"], ziel[0] - se["x"]) - math.pi / 2
    pts = []
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        lx, ly = sx * se["b"] / 2, sy * se["t"] / 2
        pts.append((se["x"] + lx * math.cos(w) - ly * math.sin(w), se["y"] + lx * math.sin(w) + ly * math.cos(w)))
    polygon(pts, "#C9895A", "#7A4A28")
    text(se["x"], se["y"] - 0.02, "Sessel", 1.8, "#FFFFFF")
    sb = M.SIDEBOARD
    rechteck(sb["x0"], YR + 0.02, sb["x0"] + sb["b"], YR + 0.02 + sb["t"], "#E3CDAE")
    text(sb["x0"] + sb["b"] / 2, YR + 0.18, "Sideboard 110", 1.8)
    kb = M.KRATZBAUM
    rechteck(kb["x0"], kb["y0"], kb["x0"] + kb["b"], kb["y0"] + kb["t"], "#9EA1A8", "#4E525C")
    text(kb["x0"] + kb["b"] / 2, kb["y0"] + kb["t"] / 2 - 0.03, "Kratzbaum", 1.9)
    lb = M.LOWBOARD
    yf = GY - tief - 0.005
    rechteck(lb["x0"], yf - lb["t"], lb["x0"] + lb["b"], yf, "#3A3A3A", "#1E1E1E")
    text(lb["x0"] + 0.28, yf - lb["t"] + 0.08, "Lowboard", 1.7, "#FFFFFF")
    bw, _ = M.tv_masse()
    tv = M.TV
    zx, zy = ct["x"], YR + c["wand"] + c["t"] / 2
    n = math.atan2(zy - tv["y"], zx - tv["x"])
    tx, ty = -math.sin(n), math.cos(n)
    linie(tv["x"] - tx * bw / 2, tv["y"] - ty * bw / 2, tv["x"] + tx * bw / 2, tv["y"] + ty * bw / 2, "#111111", 0.8)
    text(tv["x"] - 0.35, yf - lb["t"] - 0.22, 'TV 50" am Schwenkarm', 1.8)
    text(GX + 0.55, GY - 0.25, "Lamellenwand Eiche", 1.8, FARBE["moebel"])
    text(GX + 0.55, GY - 0.42, "(über die Badtür)", 1.6, FARBE["moebel"])
    text(GX + 1.55, YF + 0.70, "Gaube · Decke 2,20 m", 2.0, FARBE["mass"])
    rg = M.REGAL_HINTEN
    rechteck(L - 0.01 - rg["t"], rg["y0"], L - 0.01, rg["y0"] + rg["b"], "#E3CDAE")
    text(L - 0.2, rg["y0"] + rg["b"] / 2, "Regal", 1.6, dreh=-90)
    fy0, fy1 = fg["ym"] - fg["b"] / 2, fg["ym"] + fg["b"] / 2
    for ya, yb in ((fy0 - 0.34, fy0 + 0.07), (fy1 - 0.07, GY - 0.06)):
        linie(L - 0.18, ya, L - 0.18, yb, "#B5A58F", 0.7, "0.5,0.4")
    dl = M.DECKENLEUCHTE
    kreis(dl["x"], dl["y"], dl["d"] / 2, "none", FARBE["hoehe"], 0.2)
    linie(dl["x"] - 0.08, dl["y"], dl["x"] + 0.08, dl["y"], FARBE["hoehe"], 0.2)
    linie(dl["x"], dl["y"] - 0.08, dl["x"], dl["y"] + 0.08, FARBE["hoehe"], 0.2)
    # Masse
    masskette(0, YR, L, YR, -0.62)
    masskette(L, YR, L, YF, -0.45, "3,20")
    masskette(L, YF, L, GY, -0.45)
    masskette(0, YF, M.WAND_X, YF, 0.32)
    masskette(GX, GY, L, GY, 0.62)
    masskette(cx0, cyb + c["t"] + 0.02, cx1, cyb + c["t"] + 0.02, 0.18, "2,60")
    masskette(tp["x0"], tp["y0"] + tp["t"], tp["x0"] + tp["b"], tp["y0"] + tp["t"], 0.16, "Teppich 2,90 × 2,00")
    linie(ct["x"] + 0.9, cyb + c["t"], ct["x"] + 0.9, tv["y"], FARBE["mass"], 0.15, "1,0.6")
    text(ct["x"] + 0.98, (cyb + c["t"] + tv["y"]) / 2, f"Sitzabstand TV ca. {tv['y'] - (cyb + 0.35):.1f} m".replace(
        ".", ","), 1.8, FARBE["mass"], "start", dreh=-90)


def blatt(ziel):
    baue()
    r = OX + M.L * S + 24.0
    leg = [
        ("Wand / Kniestock", FARBE["wand"], "line"),
        ("LED-Lichtleiste 2700 K (indirekt)", FARBE["led"], "dash"),
        ("Akustik-Lamellen Eiche auf Filz", FARBE["lamelle"], "rect"),
        ("Dachfenster (Projektion)", FARBE["wand"], "dashthin"),
        ("lichte Höhe 2,00 m / 2,35 m", FARBE["hoehe"], "dashthin"),
    ]
    kopf = (f'<text x="{OX}" y="16" font-size="5.2" font-weight="600" fill="{FARBE["text"]}">'
            f'Wohnzimmer DG – Grundriss Neugestaltung „Warm Dark Loft“</text>'
            f'<text x="{OX}" y="22.5" font-size="2.6" fill="{FARBE["mass"]}">Maßstab 1:50 auf A4 · Maße in m · '
            f'aus Raumbeschreibung und 13 Fotos rekonstruiert, nicht aufgemessen – vor Kauf/Bestellung nachmessen'
            f'</text>')
    lg = []
    y = 40.0
    lg.append(f'<text x="{r}" y="{y - 6}" font-size="3" font-weight="600" fill="{FARBE["text"]}">Legende</text>')
    for t_, f, art in leg:
        if art == "line":
            lg.append(f'<line x1="{r}" y1="{y - 0.8}" x2="{r + 8}" y2="{y - 0.8}" stroke="{f}" stroke-width="2"/>')
        elif art == "dash":
            lg.append(f'<line x1="{r}" y1="{y - 0.8}" x2="{r + 8}" y2="{y - 0.8}" stroke="{f}" stroke-width="0.6" '
                      f'stroke-dasharray="1.6,0.6"/>')
        elif art == "rect":
            lg.append(f'<rect x="{r}" y="{y - 1.8}" width="8" height="2" fill="{f}"/>')
        else:
            lg.append(f'<line x1="{r}" y1="{y - 0.8}" x2="{r + 8}" y2="{y - 0.8}" stroke="{f}" stroke-width="0.3" '
                      f'stroke-dasharray="1.2,0.8"/>')
        lg.append(f'<text x="{r + 11}" y="{y}" font-size="2.5" fill="{FARBE["text"]}">{t_}</text>')
        y += 6
    notizen = [
        "Architektur unverändert: Schrägen 45°, Gaube, Fenster, Dachfenster,",
        "Türen, Pfosten, Heizkörper und Revisionsklappe bleiben an ihrem Platz.",
        "Neu: Tapete Mokka, Decke weiß gestrichen, Sockelleisten weiß,",
        "Lamellenwand über die Badtür (verdeckte Tür), Lichtvoute mit LED.",
        "Couch auf Gleitern: Revisionsklappe bleibt erreichbar.",
        "Raumlänge 7,0 m (Beschreibung, per Fotoperspektive geprüft).",
    ]
    y += 4
    lg.append(f'<text x="{r}" y="{y}" font-size="3" font-weight="600" fill="{FARBE["text"]}">Hinweise</text>')
    for z in notizen:
        y += 4.6
        lg.append(f'<text x="{r}" y="{y}" font-size="2.3" fill="{FARBE["text"]}">{z}</text>')
    # Massstabsbalken 0-1-2 m
    bx, by = r, 182.0
    for i in range(4):
        f = FARBE["wand"] if i % 2 == 0 else "#FFFFFF"
        lg.append(f'<rect x="{bx + i * S / 2}" y="{by}" width="{S / 2}" height="1.6" fill="{f}" '
                  f'stroke="{FARBE["wand"]}" stroke-width="0.2"/>')
    for i, t_ in enumerate(("0", "1", "2 m")):
        lg.append(f'<text x="{bx + i * S}" y="{by + 5}" font-size="2.2" text-anchor="middle" '
                  f'fill="{FARBE["text"]}">{t_}</text>')
    svg = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 297 210" '
           'font-family="Inter, Helvetica, Arial, sans-serif">\n'
           '<rect width="297" height="210" fill="#FFFFFF"/>\n' + kopf + "\n" + "\n".join(teile) + "\n"
           + "\n".join(lg) + "\n</svg>\n")
    os.makedirs(os.path.dirname(os.path.abspath(ziel)), exist_ok=True)
    with open(ziel, "w", encoding="utf-8") as f:
        f.write(svg)
    print("GRUNDRISS", ziel)


if __name__ == "__main__":
    blatt(sys.argv[1] if len(sys.argv) > 1 else "3d-studio/out/wohnzimmer/6-grundriss.svg")
