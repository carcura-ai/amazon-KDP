"""Sportwagen-Waesche (Vorwaesche): dreckig → Schaum → Spuelen → Glanz, Wasser perlt ab (Keramik). 168 Bilder, 24 fps, 1:1.

Ablauf: 1–8 dreckig · 8–40 Schaum von vorn nach hinten · 40–52 einwirken · 52–104 Spuelen mit Lanze ·
104–150 Kamera faehrt an die Haube, Lichtstreifen ueber den Lack, Tropfen perlen · 150–168 halten.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bpy  # noqa: E402
import studio as st  # noqa: E402
import studio_auto as sa  # noqa: E402
import waesche as wa  # noqa: E402

a = st.args()
s = st.neue_szene(hintergrund=(0, 0, 0), frames=168, fps=24)
m = sa.materialien()
schaum = wa.front("Schaumfront", 3.1, -3.1, 8, 40)
spuel = wa.front("Spuelfront", 3.1, -3.1, 52, 104)
for name in ("lack", "glas", "felge"):                       # Staub auch auf Scheiben und Felgen
    wa.dreckiger_lack(m[name], spuel)
auto = sa.auto(m)
sa.studio(m)

mat_schaum = st.material("Schaum", base=(0.86, 0.87, 0.89), roughness=0.45, specular=0.4)
mat_wasser = st.material("Wasser", base=(1, 1, 1), roughness=0.0, transmission=1.0, ior=1.33)
mat_spray = st.material("Spruehnebel", base=(0.95, 0.97, 1.0), roughness=0.1, alpha=0.22, specular=0.9)
mat_stahl = st.material("Stahl", base=(0.6, 0.6, 0.62), metallic=1.0, roughness=0.25)
wa.schaum_und_tropfen(auto, schaum, spuel, mat_schaum, mat_wasser)
wa.lanze(spuel, 50, 106, mat_stahl, mat_spray)

# Schluss: Lichtstreifen faehrt ueber Haube und Dach (Glanz zeigen)
glanz = st.flaechenlicht("Glanz", (3.2, -0.3, 2.6), (3.2, -0.3, 0), 0, (0.35, 4.0))
lack_coll = bpy.data.collections.new("NurLack")                 # Licht-Verknuepfung: Streifen trifft nur das Auto
bpy.context.scene.collection.children.link(lack_coll)
lack_coll.objects.link(auto)
glanz.light_linking.receiver_collection = lack_coll
for f, x, e in ((112, 3.2, 0), (116, 3.0, 900), (146, -2.6, 900), (150, -3.0, 0)):
    glanz.location.x = x
    glanz.data.energy = e
    glanz.keyframe_insert("location", index=0, frame=f)
    glanz.data.keyframe_insert("energy", frame=f)

kam = st.kamera((5.7, -6.3, 0.95), (0.0, 0, 0.5), brennweite=50)
# Totale (Auto fuellt ~80 % der Breite) → langsam naeher → am Ende Fahrt an die Haube (Tropfen sichtbar)
for f, ort, ziel in ((1, (5.9, -6.5, 0.95), (0.0, 0, 0.5)), (100, (5.2, -5.75, 0.95), (0.0, 0, 0.5)),
                     (150, (2.55, -2.75, 1.25), (1.15, 0, 0.72)), (168, (2.45, -2.62, 1.24), (1.15, 0, 0.72))):
    kam.location = ort
    st.richte_aus(kam, ziel)
    kam.keyframe_insert("location", frame=f)
    kam.keyframe_insert("rotation_euler", frame=f)
st.weich(kam)

st.rendern(a, aufloesung=960, samples=96)
