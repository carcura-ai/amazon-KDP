"""Formkontrolle Sportwagen: vier Ansichten (3/4 vorn, Seite, vorn, 3/4 hinten) mit Workbench in Sekunden.

Aufruf: blender -b --factory-startup -noaudio --python 3d-studio/modelle/sportwagen_form.py -- --out <ordner> [--cycles]
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bpy  # noqa: E402
import studio as st  # noqa: E402
import sportwagen as sw  # noqa: E402

a = st.args()
cycles = "--cycles" in sys.argv
s = st.neue_szene(frames=1)
GELB = st.hex_farbe("#E8F320")

m = {
    "lack": st.material("Lack", base=(0.005, 0.006, 0.008), metallic=0.4, roughness=0.25, coat=1.0, coat_roughness=0.02),
    "glas": st.material("Glas", base=(0.01, 0.012, 0.015), roughness=0.02, specular=1.0),
    "schwarz": st.material("Schwarz", base=(0.012, 0.012, 0.013), roughness=0.55),
    "gummi": st.material("Gummi", base=(0.018, 0.018, 0.02), roughness=0.7),
    "felge": st.material("Felge", base=(0.12, 0.12, 0.13), metallic=1.0, roughness=0.2),
    "scheibe": st.material("Bremsscheibe", base=(0.35, 0.35, 0.36), metallic=1.0, roughness=0.45),
    "sattel": st.material("Sattel", base=GELB, roughness=0.3, coat=1.0, coat_roughness=0.05),
    "vorn": st.material("Scheinwerfer", base=(0, 0, 0), emission=(1, 1, 1), emission_strength=8),
    "hinten": st.material("Rueckleuchte", base=(0, 0, 0), emission=(1, 0.02, 0.01), emission_strength=6),
}
body = sw.karosserie(m["lack"], m["glas"], m["schwarz"])
sw.radhausschalen(m["schwarz"])
for x in (sw.ACHSE_V, sw.ACHSE_H):
    for sy in (1, -1):
        sw.rad(x, sy, m["gummi"], m["felge"], m["scheibe"], m["sattel"])
sw.details(body, m["vorn"], m["hinten"], m["schwarz"])

bpy.ops.mesh.primitive_plane_add(size=40)
st.zuweisen(bpy.context.object, st.material("Boden", base=(0.02, 0.02, 0.022), roughness=0.35))

st.flaechenlicht("Decke", (0, 0, 5), (0, 0, 0), 2500, (6, 2.5))
st.flaechenlicht("Seite", (1.5, -6, 2.5), (0, 0, 0.6), 1200, (6, 2))
kam = st.kamera((0, -9, 2), (0, 0, 0.55), brennweite=50)

# Winkel: 0 = Seitenansicht von links (-Y), +90 = von vorn (+X)
ansichten = {"34vorn": (38, 8.2, 1.6), "seite": (0, 9.5, 0.8), "vorn": (90, 8.5, 0.9), "34hinten": (-40, 8.2, 1.7),
             "oben": (0, 0.01, 11)}
out = os.path.abspath(a["out"])
os.makedirs(out, exist_ok=True)
s.render.resolution_x, s.render.resolution_y = 960, 600
if cycles:
    s.cycles.samples = 32
else:
    s.render.engine = "BLENDER_WORKBENCH"
    s.display.shading.light = "STUDIO"
    s.display.shading.color_type = "SINGLE"          # Ton-Modell: Form ohne Materialablenkung beurteilen
    s.display.shading.single_color = (0.62, 0.62, 0.64)
    s.display.shading.show_specular_highlight = True
    s.display.shading.show_cavity = True
    s.view_settings.view_transform = "Standard"
ziel = (0, 0, 0.55)
for name, (w, r, h) in ansichten.items():
    if name == "oben":
        kam.location = (0, -0.01, h)
        kam.data.lens = 50
    else:
        aa = math.radians(w)
        kam.location = (r * math.sin(aa), -r * math.cos(aa), h)
    st.richte_aus(kam, ziel)
    s.render.filepath = os.path.join(out, f"form_{name}.png")
    bpy.ops.render.render(write_still=True)
