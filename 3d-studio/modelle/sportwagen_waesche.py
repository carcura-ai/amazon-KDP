"""Sportwagen-Waesche: dreckig → Schaum → Spuelen → Glanz, Wasser perlt ab (Keramik). 144 Bilder, 24 fps, 1:1.

Ablauf: 1–20 dreckig · 20–56 Schaum von vorn nach hinten · 56–70 einwirken · 70–118 Spuelen mit Lanze ·
118–144 sauber, Lichtstreifen faehrt ueber den Lack, Tropfen perlen.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bpy  # noqa: E402
import studio as st  # noqa: E402
import studio_auto as sa  # noqa: E402
import waesche as wa  # noqa: E402

a = st.args()
s = st.neue_szene(hintergrund=(0, 0, 0), frames=144, fps=24)
m = sa.materialien()
schaum = wa.front("Schaumfront", 2.8, -2.8, 20, 56)
spuel = wa.front("Spuelfront", 2.8, -2.8, 70, 118)
wa.dreckiger_lack(m["lack"], spuel)
auto = sa.auto(m)
sa.studio(m)

mat_schaum = st.material("Schaum", base=(0.86, 0.87, 0.89), roughness=0.45, specular=0.4)
mat_wasser = st.material("Wasser", base=(1, 1, 1), roughness=0.0, transmission=1.0, ior=1.33)
mat_spray = st.material("Spruehnebel", base=(0.95, 0.97, 1.0), roughness=0.1, alpha=0.22, specular=0.9)
mat_stahl = st.material("Stahl", base=(0.6, 0.6, 0.62), metallic=1.0, roughness=0.25)
wa.schaum_und_tropfen(auto, schaum, spuel, mat_schaum, mat_wasser)
wa.lanze(spuel, 68, 120, mat_stahl, mat_spray)

# Schluss: Lichtstreifen faehrt ueber Haube und Dach (Glanz zeigen)
glanz = st.flaechenlicht("Glanz", (3.2, -0.3, 2.6), (3.2, -0.3, 0), 0, (0.35, 4.0))
lack_coll = bpy.data.collections.new("NurLack")                 # Licht-Verknuepfung: Streifen trifft nur das Auto
bpy.context.scene.collection.children.link(lack_coll)
lack_coll.objects.link(auto)
glanz.light_linking.receiver_collection = lack_coll
for f, x, e in ((118, 3.2, 0), (122, 3.0, 900), (142, -2.6, 900), (144, -3.0, 0)):
    glanz.location.x = x
    glanz.data.energy = e
    glanz.keyframe_insert("location", index=0, frame=f)
    glanz.data.keyframe_insert("energy", frame=f)

kam = st.kamera((4.6, -5.0, 1.35), (0.05, 0, 0.55), brennweite=34)
for f, ort in ((1, (4.0, -4.4, 1.3)), (144, (3.65, -4.0, 1.15))):
    kam.location = ort
    st.richte_aus(kam, (0.05, 0, 0.55))
    kam.keyframe_insert("location", frame=f)
    kam.keyframe_insert("rotation_euler", frame=f)
st.weich(kam)

st.rendern(a, aufloesung=960, samples=96)
