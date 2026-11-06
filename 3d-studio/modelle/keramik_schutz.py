"""Keramik-Schutz: Motorhauben-Ausschnitt, mittig geteilt – links ohne, rechts mit Keramik. 192 Bilder, 24 fps, 1:1.

1–12 ruhig · 12–66 WASSER (links flache Tropfen kleben, rechts runde Perlen, die abrollen) · 66–120 UV (links bleicht aus,
rechts stoppt die Keramik die Strahlen) · 120–176 SCHMUTZ + Spuelen (rechts laeuft alles ab, links bleibt Dreck) ·
176–192 halten. Beschriftung „ohne / mit Keramik“ und die Kapitel kommen als HTML.
Vereinfachte Darstellung: Werte laut Hersteller (Kontaktwinkel bis 165°, UV-Schutz, Abperleffekt).
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
import studio as st  # noqa: E402

a = st.args()
s = st.neue_szene(hintergrund=(0, 0, 0), frames=192, fps=24)
GELB = st.hex_farbe("#E8F320")
VIOLETT = (0.30, 0.06, 1.0)
random.seed(5)

B, T = 1.15, 2.6          # Halbbreite je Seite, Tiefe (Hang zur Kamera) – fuellt das Bild
NEIGUNG = math.radians(12)
WOELB = 0.06              # Woelbung der Haube (lokal z = -WOELB * x²)


def flaeche_z(x):
    return -WOELB * x * x


# ---------- Haube: zwei Haelften ----------

def haelfte(name, x0, x1):
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=48, y_subdivisions=8, size=1)
    o = bpy.context.object
    o.name = name
    for v in o.data.vertices:
        x = x0 + (v.co.x + 0.5) * (x1 - x0)
        y = v.co.y * T
        v.co = (x, y, flaeche_z(x))
    sol = o.modifiers.new("Dicke", "SOLIDIFY")
    sol.thickness, sol.offset = 0.03, -1
    bev = o.modifiers.new("Kante", "BEVEL")
    bev.width, bev.segments, bev.limit_method = 0.008, 3, "ANGLE"
    st.glatt(o)
    o.rotation_euler.x = NEIGUNG
    return o


rot = (0.32, 0.008, 0.012)
lack_ohne = st.material("Lack ohne", base=rot, metallic=0.45, roughness=0.3, coat=1.0, coat_roughness=0.03)
lack_mit = st.material("Lack mit", base=rot, metallic=0.45, roughness=0.3, coat=1.0, coat_roughness=0.012)
links = haelfte("Ohne", -B, -0.004)
rechts = haelfte("Mit", 0.004, B)
st.zuweisen(links, lack_ohne)
st.zuweisen(rechts, lack_mit)

# UV-Schaden links: Farbe bleicht aus, Klarlack wird stumpf (Keyframes auf Material-Eingaengen)
p = lack_ohne.node_tree.nodes["Principled BSDF"]
for f, farbe, rau, coat in ((66, rot, 0.3, 1.0), (118, (0.26, 0.11, 0.10), 0.72, 0.15)):
    p.inputs["Base Color"].default_value = (*farbe, 1)
    p.inputs["Roughness"].default_value = rau
    p.inputs["Coat Weight"].default_value = coat
    for k in ("Base Color", "Roughness", "Coat Weight"):
        p.inputs[k].keyframe_insert("default_value", frame=f)

# Keramikschicht rechts: hauchduenn, Kante in Markenfarbe, leuchtet beim UV-Treffer kurz auf
bpy.ops.mesh.primitive_grid_add(x_subdivisions=24, y_subdivisions=4, size=1)
schicht = bpy.context.object
schicht.name = "Keramik"
for v in schicht.data.vertices:
    x = 0.004 + (v.co.x + 0.5) * (B - 0.004)
    v.co = (x, v.co.y * T, flaeche_z(x) + 0.004)
sol = schicht.modifiers.new("Dicke", "SOLIDIFY")
sol.thickness = 0.003
schicht.rotation_euler.x = NEIGUNG
keramik = st.material("Keramik", base=(0.02, 0.025, 0.02), roughness=0.0, alpha=0.08, specular=1.0,
                      emission=GELB, emission_strength=0.0)
st.zuweisen(schicht, keramik)
kp = keramik.node_tree.nodes["Principled BSDF"]
for f, e in ((70, 0.0), (80, 0.1), (112, 0.1), (122, 0.0)):
    kp.inputs["Emission Strength"].default_value = e
    kp.inputs["Emission Strength"].keyframe_insert("default_value", frame=f)
kante = st.material("Kante", base=(0, 0, 0), emission=GELB, emission_strength=7.0)
bpy.ops.mesh.primitive_cube_add(size=1)
trenn = bpy.context.object
trenn.name = "Trennlinie"
trenn.scale = (0.004, T, 0.012)
trenn.location = (0, 0, 0.004)
trenn.rotation_euler.x = NEIGUNG
st.zuweisen(trenn, kante)


def welt(x, y, z_ueber):
    """Lokale Haubenkoordinate (x, y, Hoehe ueber der Flaeche) → Weltkoordinate."""
    lz = flaeche_z(x) + z_ueber
    c, sn = math.cos(NEIGUNG), math.sin(NEIGUNG)
    return (x, y * c - lz * sn, y * sn + lz * c)


def key(o, f, ort=None, skal=None):
    if ort is not None:
        o.location = ort
        o.keyframe_insert("location", frame=f)
    if skal is not None:
        o.scale = skal
        o.keyframe_insert("scale", frame=f)


wasser = st.material("Wasser", base=(1, 1, 1), roughness=0.0, transmission=1.0, ior=1.33)


def kugel(name, r, mat, seg=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=r)
    o = bpy.context.object
    o.name = name
    st.glatt(o)
    st.zuweisen(o, mat)
    return o


# ---------- Akt 1: WASSER ----------
for seite in ("ohne", "mit"):
    for i in range(22):
        x = random.uniform(0.06, 0.52) * (-1 if seite == "ohne" else 1)
        y = random.uniform(-0.45, 0.55)
        r = random.uniform(0.011, 0.024)
        f0 = random.randint(12, 38)                  # Aufprall
        d = kugel(f"Tropfen_{seite}_{i}", r, wasser)
        key(d, 1, welt(x, y, 0.9), (0, 0, 0))
        key(d, f0 - 9, welt(x, y, 0.9), (0, 0, 0))
        key(d, f0 - 8, welt(x, y, 0.9), (0.6, 0.6, 1.4))           # faellt gestreckt
        key(d, f0, welt(x, y, r * 0.6), (1, 1, 0.8))
        if seite == "ohne":
            # ohne Keramik: flacher Tropfen (Kontaktwinkel deutlich kleiner), bleibt kleben und kriecht kaum
            breit = random.uniform(1.5, 1.9)
            key(d, f0 + 5, welt(x, y, r * 0.3), (breit, breit * random.uniform(0.85, 1.1), 0.36))
            key(d, 66, welt(x, y - 0.012, r * 0.28), (breit * 1.05, breit * 1.12, 0.34))
            key(d, 72, welt(x, y - 0.012, r * 0.2), (0, 0, 0))      # vor dem UV-Akt trocknet er weg
        else:
            # runde Perle (Kontaktwinkel bis 165° laut Hersteller), rollt den Hang hinab zur Kamera
            key(d, f0 + 4, welt(x, y, r * 0.86), (1.03, 1.03, 0.9))
            start = f0 + random.randint(5, 14)
            key(d, start, welt(x, y, r * 0.86), (1.0, 1.0, 0.9))
            ende = start + int(14 + (y + 1.0) * 10)
            key(d, ende, welt(x + random.uniform(-0.03, 0.03), -1.0, r * 0.86), (1, 1, 0.9))   # rollt aus dem Bild
        st.weich(d)

# ---------- Akt 2: UV ----------
uv = st.material("UV", base=(0, 0, 0), emission=VIOLETT, emission_strength=3.5)
blitz = st.material("Blitz", base=(0, 0, 0), emission=GELB, emission_strength=14.0)
for seite in ("ohne", "mit"):
    for i in range(26):
        x = random.uniform(0.05, 0.55) * (-1 if seite == "ohne" else 1)
        y = random.uniform(-0.4, 0.6)
        f0 = random.randint(68, 108)
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.0035, depth=0.32)
        strahl = bpy.context.object
        strahl.name = f"UV_{seite}_{i}"
        st.zuweisen(strahl, uv)
        richt = (0.18, 0.25, 1.0)                    # Sonne von oben hinten links
        n = math.sqrt(sum(c * c for c in richt))
        richt = tuple(c / n for c in richt)
        strahl.rotation_euler = Vector(richt).to_track_quat("Z", "Y").to_euler()
        ziel = welt(x, y, 0.0 if seite == "ohne" else 0.03)
        start = tuple(z + c * 1.4 for z, c in zip(ziel, richt))
        tief = tuple(z - c * (0.18 if seite == "ohne" else 0.0) for z, c in zip(ziel, richt))
        key(strahl, 1, start, (0, 0, 0))
        key(strahl, f0 - 1, start, (0, 0, 0))
        key(strahl, f0, start, (1, 1, 1))
        key(strahl, f0 + 7, tief, (1, 1, 1))         # links dringt er ein, rechts endet er auf der Keramik
        key(strahl, f0 + 8, tief, (0, 0, 0))
        for fc in strahl.animation_data.action.fcurves:
            for k in fc.keyframe_points:
                k.interpolation = "LINEAR"
        if seite == "mit":
            b = kugel(f"Blitz_{i}", 0.012, blitz, seg=16)
            key(b, 1, ziel, (0, 0, 0))
            key(b, f0 + 6, ziel, (0, 0, 0))
            key(b, f0 + 8, ziel, (1.3, 1.3, 0.4))
            key(b, f0 + 13, ziel, (0, 0, 0))

# ---------- Akt 3: SCHMUTZ + Spuelen ----------
dreck = st.material("Schmutz", base=(0.05, 0.038, 0.025), roughness=0.95)
for seite in ("ohne", "mit"):
    for i in range(95):
        x = random.uniform(0.04, 0.56) * (-1 if seite == "ohne" else 1)
        y = random.uniform(-0.45, 0.6)
        r = random.uniform(0.003, 0.011) if random.random() < 0.8 else random.uniform(0.012, 0.02)
        f0 = random.randint(124, 136)
        k = kugel(f"Dreck_{seite}_{i}", 1.0, dreck, seg=12)
        k.rotation_euler = (NEIGUNG, 0, random.uniform(0, math.pi))          # unregelmaessig ausgerichtet
        sx, sy = r * random.uniform(1.0, 2.2), r * random.uniform(0.8, 1.6)
        key(k, 1, welt(x, y, 0.002), (0, 0, 0))
        key(k, f0, welt(x, y, 0.002), (0, 0, 0))
        key(k, f0 + 3, welt(x, y, 0.002), (sx, sy, r * 0.12))
        vorbei = 150 + int((0.6 - y) / 1.05 * 20)       # Spuelfront laeuft von oben (hinten) nach unten (vorn)
        key(k, vorbei, welt(x, y, 0.002), (sx, sy, r * 0.12))
        if seite == "mit" or random.random() < 0.3:
            key(k, vorbei + 9, welt(x, -1.0, 0.004), (sx * 0.8, sy * 1.5, r * 0.2))   # rutscht mit dem Wasser ab
        else:
            key(k, vorbei + 6, welt(x, y - 0.03, 0.002), (sx, sy * 2.4, r * 0.22))           # bleibt, zieht Schliere
        st.weich(k)

# Spuelen: rechts rollen Perlen von oben durch und nehmen den Dreck mit, links breitet sich ein Film aus
for i in range(26):
    x = random.uniform(0.05, 0.55)
    r = random.uniform(0.012, 0.022)
    f0 = random.randint(146, 156)
    d = kugel(f"Spuel_mit_{i}", r, wasser)
    key(d, 1, welt(x, 0.75, r * 0.86), (0, 0, 0))
    key(d, f0, welt(x, 0.75, r * 0.86), (1, 1, 0.9))
    key(d, f0 + 22, welt(x + random.uniform(-0.03, 0.03), -1.0, r * 0.86), (1, 1, 0.9))
    st.weich(d)
for i in range(12):
    x = -random.uniform(0.06, 0.52)
    y = random.uniform(-0.3, 0.55)
    r = random.uniform(0.02, 0.035)
    f0 = random.randint(150, 160)
    d = kugel(f"Spuel_ohne_{i}", r, wasser)
    key(d, 1, welt(x, y, r * 0.3), (0, 0, 0))
    key(d, f0, welt(x, y, r * 0.3), (0, 0, 0))
    key(d, f0 + 8, welt(x, y, r * 0.3), (1.7, 1.9, 0.36))
    key(d, 192, welt(x, y - 0.02, r * 0.28), (1.8, 2.1, 0.34))
    st.weich(d)

# ---------- Licht + Kamera ----------
ziel = (0, 0.15, 0.0)
st.flaechenlicht("Horizont", (0, 4.5, 1.1), ziel, 900, (9.0, 0.7))            # Lichtband spiegelt sich ueber die Haube
st.flaechenlicht("Front", (0, -2.6, 2.1), ziel, 140, (3.0, 1.5))              # hinter der Kamera: zeigt die Lackfarbe,
                                                                              # spiegelt sich nicht im Bild
kam = st.kamera((0, -1.3, 0.55), ziel, brennweite=38)
for f, ort in ((1, (0, -1.34, 0.57)), (192, (0, -1.2, 0.52))):
    kam.location = ort
    st.richte_aus(kam, ziel)
    kam.keyframe_insert("location", frame=f)
    kam.keyframe_insert("rotation_euler", frame=f)
st.weich(kam)

st.rendern(a, aufloesung=960, samples=96)
