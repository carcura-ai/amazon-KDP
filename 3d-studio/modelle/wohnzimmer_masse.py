"""Masse Wohnzimmer Dachgeschoss - einzige Quelle fuer 3D-Modell (wohnzimmer.py) und Grundriss (wohnzimmer_grundriss.py).

Stand 08.11.2026: aus Raumbeschreibung + 13 Fotos des Nutzers rekonstruiert (keine Zollstock-Masse).
Werte mit "FOTO" sind aus den Fotos geschaetzt, "ANNAHME" ist frei gesetzt. Vor einer Bestellung nachmessen.

Koordinaten (Blick vom Eingang in den Raum, wie Foto 1):
  x = Raumlaenge ab Eingangswand (0) bis hintere Stirnwand (L)
  y = Breite: rechte Kniestockflucht -2,25 ... Pfettenlinie links +0,95 ... Gauben-Aussenwand +2,95
  z = Hoehe ab Fertigfussboden
"""
import math

# ---------- Dach ----------
KNIE = 1.05                  # Kniestock rechts (Beschreibung)
DECKE = 2.35                 # flacher Deckenstreifen (Beschreibung)
LAUF = DECKE - KNIE          # 45 Grad: Lauf = Steigung = 1,30
YR = -2.25                   # rechte Kniestockflucht
YF = YR + LAUF + 1.90        # 0,95: linke Kante flacher Deckenstreifen = Pfettenlinie (Streifen 1,90 breit, FOTO 13)
YL = YF + LAUF               # 2,25: gedachte linke Kniestockflucht (nur hinter Bad/Nische, im Raum nicht sichtbar)
S_MAX = LAUF * math.sqrt(2)  # Schraegenlaenge Kniestock bis Deckenstreifen (1,84)

# ---------- Grundriss ----------
L = 4.80                     # FOTO: Kette Essplatz-Dachfenster-Klappe-TV-Moebel + Gaube 2,2 m (Beschreibung: 7,0 geschaetzt)
B = YF - YR                  # 3,20 Raumbreite vorne (Kniestock bis gerade Wand)

WAND_X = 1.75                # gerade raumhohe Wand links (y = YF) von x = 0 bis hier (Kratzbaum + Schrank, FOTO 10)
NISCHE_Y = 1.55              # Rueckwand der Nische unter der Schraege (heute Katzenklo, FOTO 9)
GAUBE_X0 = 2.40              # Gauben-Vorderwand (ab Nische), Gaube bis hintere Stirnwand
GAUBE_Y1 = 2.95              # Gauben-Aussenwand mit Badtuer (2,0 tief ab Pfettenlinie, Beschreibung)
GAUBE_H = 2.20               # flache Gaubendecke (Beschreibung)
PFOSTEN = dict(x=2.47, y=YF, s=0.15, kopfband=0.38)
BADTUER = dict(x0=2.52, b=0.80, h=2.00)                     # in der Gauben-Aussenwand; freie Wand bis Fensterecke 1,4 m
FENSTER_G = dict(ym=2.10, b=1.00, h=1.00, bruestung=1.00)   # in der hinteren Stirnwand (FOTO 7/8)
GAUBE_LAIBUNG = 0.30

# ---------- Eingangswand x = 0 ----------
TUER = dict(y0=-0.75, b=0.86, h=2.00, offen=100)             # oeffnet nach innen, Band auf der Heizkoerperseite (FOTO 13)
SCHALTER = dict(y=-0.86)                                    # links neben der Tuer (vom Raum aus gesehen)
HEIZ_E = dict(y0=0.47, b=0.32, z0=0.12, h=0.62)             # schmal, zwischen Tuer und gerader Wand
FLIESEN = dict(y0=0.42, b=0.46, z0=0.0, h=0.90)

# ---------- Dachfenster rechte Schraege ----------
# Glas parallel zur Dachflaeche, um 'tiefe' nach aussen versetzt; untere Laibung senkrecht (Kniestockebene),
# obere Laibung waagerecht (FOTO 2/11/12).
DF = dict(x0=1.55, b=0.80, tiefe=0.22, glas=1.10)

# ---------- Revisionsklappe rechter Kniestock (direkt hinter dem Dachfenster, FOTO 12) ----------
REV = dict(xm=3.00, b=0.80, z0=0.18, h=0.70)

# ---------- Neue Einrichtung ----------
LAMELLE = dict(breite=0.027, tiefe=0.021, raster=0.040, filz=0.009)
LOWBOARD = dict(x0=3.40, b=1.10, t=0.40, z0=0.25, h=0.38)   # vor der Lamellenwand (Gauben-Aussenwand)
TV = dict(diag_zoll=50, x=3.95, y=2.75, z=1.18)             # Schwenkarm, leicht zur Couch gedreht
COUCH = dict(x0=1.80, b=2.60, t=0.95, wand=0.10, sitz=0.44, ruecken=0.75)
TEPPICH = dict(x0=1.65, b=2.90, y0=-1.45, t=2.00)
COUCHTISCH = dict(x=3.10, y=-0.40, d=0.80, h=0.43)
BEISTELL = dict(x=4.60, y=-1.55, d=0.36, h=0.50)
STEH_COUCH = dict(x=4.58, y=-1.10)
SESSEL = dict(x=1.28, y=-1.12, b=0.78, t=0.80)
STEH_LESE = dict(x=0.30, y=-1.12)
SIDEBOARD = dict(x0=0.10, b=1.10, t=0.40, h=0.55)
KRATZBAUM = dict(x0=0.85, b=0.90, y0=0.40, t=0.55, h=1.80)  # vorhandener grosser Kratzbaum, Wandmitte
REGAL_HINTEN = dict(y0=-0.60, b=0.42, t=0.30, h=0.95)       # vorhandenes Bambusregal bleibt
DECKENLEUCHTE = dict(x=2.40, y=0.0, d=0.45)


def schraege_punkt(seite, x, s):
    """Punkt auf der Dachschraege. seite = -1 rechts, +1 links; s = Weg auf der Schraege ab Kniestock-Oberkante."""
    k = s / math.sqrt(2)
    if seite < 0:
        return (x, YR + k, KNIE + k)
    return (x, YL - k, KNIE + k)


def schraege_hoehe(y):
    """Lichte Hoehe unter Schraege/Deckenstreifen an der Stelle y (ohne Gaube)."""
    if y < YR + LAUF:
        return KNIE + (y - YR)
    if y > YF:
        return DECKE - (y - YF)
    return DECKE


def dachfenster():
    """Kennpunkte (y, z) des Dachfensters im Schnitt: Laibung unten/oben, Glas unten/oben."""
    t, g = DF["tiefe"], DF["glas"]
    r = math.sqrt(2)
    s_g0 = t                                   # Glasunterkante liegt senkrecht ueber der Kniestockflucht
    s_g1 = s_g0 + g
    s_c1 = s_g1 + t                            # Oberkante Ausschnitt in der Verkleidung (obere Laibung waagerecht)
    glas = lambda s: (YR + s / r - t / r, KNIE + s / r + t / r)  # noqa: E731
    return dict(s_c1=s_c1, glas_u=glas(s_g0), glas_o=glas(s_g1),
                verkl_o=(YR + s_c1 / r, KNIE + s_c1 / r), knie=(YR, KNIE))


def tv_masse():
    d = TV["diag_zoll"] * 0.0254
    return d * 16 / math.hypot(16, 9), d * 9 / math.hypot(16, 9)
