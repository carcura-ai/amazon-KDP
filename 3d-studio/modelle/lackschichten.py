"""Lackaufbau als Explosionsansicht: Blech, Grundierung, Basislack, Klarlack, Keramik – mit Wasserperlen.

Einsatz: carcura.info/keramikversiegelung/ – beim Scrollen fahren die Schichten auseinander.
Frames 1–48: 1–6 zusammen · 6–40 auseinander · 40–48 halten. Beschriftung kommt als HTML (scharf, SEO, editierbar).
"""
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bpy  # noqa: E402
import studio as st  # noqa: E402

a = st.args()
s = st.neue_szene(frames=48, fps=24)

GELB = st.hex_farbe("#E8F320")
B, T = 2.2, 1.5          # Plattengroesse
LUECKE = 0.42            # Abstand je Schicht im Explosionszustand

# ---------- Form + Material ----------
schichten = [
    ("Blech", 0.14, st.material("Stahl", base=(0.56, 0.57, 0.6), metallic=1.0, roughness=0.18)),
    ("Grundierung", 0.06, st.material("KTL", base=(0.16, 0.165, 0.175), roughness=0.75)),
    ("Basislack", 0.06, st.material("Basislack", base=(0.01, 0.03, 0.09), metallic=0.7, roughness=0.1,
                                    coat=1.0, coat_roughness=0.04)),
    # klare Schichten: dunkle Basis + niedrige Deckkraft = Glas ohne Milch, Glanz kommt aus den Spiegelungen
    ("Klarlack", 0.07, st.material("Klarlack", base=(0.02, 0.025, 0.03), roughness=0.03, alpha=0.14, specular=1.0)),
    ("Keramik", 0.035, st.material("Keramik", base=(0.02, 0.025, 0.02), roughness=0.01, alpha=0.12, specular=1.0)),
]
leuchtkante = st.material("Leuchtkante", base=(0, 0, 0), emission=GELB, emission_strength=6.0)
klarkante = st.material("Klarkante", base=(0, 0, 0), emission=(0.8, 0.88, 1.0), emission_strength=0.9)

z = 0.0
objekte = []
for name, d, m in schichten:
    o = st.platte(name, B, T, d, z, radius=0.07)
    st.zuweisen(o, m)
    objekte.append(o)
    z += d
st.kanten_material(objekte[-1], leuchtkante)   # Keramik = Schutzschicht in Markenfarbe
st.kanten_material(objekte[-2], klarkante)     # Klarlack dezent sichtbar machen
mitte = z / 2

# Wasserperlen auf der Keramik (Abperl-Effekt)
wasser = st.material("Wasser", base=(1, 1, 1), roughness=0.0, transmission=1.0, ior=1.33)
keramik = objekte[-1]
oben = z
random.seed(7)
plaetze = []
while len(plaetze) < 16:
    x, y, r = random.uniform(-0.9, 0.9), random.uniform(-0.58, 0.58), random.uniform(0.045, 0.11)
    if all((x - px) ** 2 + (y - py) ** 2 > (r + pr + 0.05) ** 2 for px, py, pr in plaetze):
        plaetze.append((x, y, r))
for i, (x, y, r) in enumerate(plaetze):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=48, ring_count=24, location=(x, y, oben + r * 0.62))
    p = bpy.context.object
    p.name = f"Perle{i}"
    p.scale.z = 0.8
    bpy.ops.object.shade_smooth()
    st.zuweisen(p, wasser)
    p.parent = keramik
    p.matrix_parent_inverse = keramik.matrix_world.inverted()

# ---------- Animation: auseinanderfahren ----------
for i, o in enumerate(objekte):
    versatz = (i - 2) * LUECKE
    for f, dz in ((1, 0), (6, 0), (40, versatz), (48, versatz)):
        o.location.z = dz
        o.keyframe_insert("location", index=2, frame=f)
    st.weich(o)

# ---------- Licht ----------
ziel = (0, 0, mitte)
st.flaechenlicht("Hauptlicht", (-3.2, -3.0, 4.2), ziel, 900, (3.5, 3.5))
st.flaechenlicht("Streifen", (0.4, 3.4, 3.6), ziel, 700, (6.0, 0.35))          # Spiegelkante auf den Lackflaechen
st.flaechenlicht("Kante", (3.6, 2.2, 1.2), ziel, 350, (1.0, 4.0), (0.85, 0.9, 1.0))
st.flaechenlicht("Unten", (0.0, -2.5, -2.4), ziel, 120, (4.0, 1.0))

# ---------- Kamera ----------
kam = st.kamera((0, -7, 3), ziel, brennweite=55)
st.kreisfahrt(kam, ziel, radius=(4.6, 6.2), hoehe=(2.2, 2.9), winkel_von=-34, winkel_bis=-18, f_von=1, f_bis=48)

st.rendern(a, aufloesung=960, samples=192)
