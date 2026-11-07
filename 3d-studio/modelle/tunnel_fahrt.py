"""Tunnelfahrt: Auto faehrt durch einen Tunnel aus Lichtboegen ueber nassen Boden; Lichtbaender laufen ueber den Lack.

Idee nach dem Tutorial „Make a Car Animation in Blender“ (BENY, YouTube) – eigene Umsetzung, kein Material uebernommen.
Kamera faehrt mit dem Auto mit (klassische Werbe-Einstellung), Raeder drehen passend zur Strecke, Bewegungsunschaerfe.
144 Bilder, 24 fps, 16:9. Auto = Platzhalter aus lib/sportwagen.py, spaeter das lizenzierte Modell.
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bpy  # noqa: E402
import studio as st  # noqa: E402
import studio_auto as sa  # noqa: E402
import sportwagen as sw  # noqa: E402

a = st.args()
s = st.neue_szene(hintergrund=(0, 0, 0), frames=144, fps=24)
GELB = st.hex_farbe("#E8F320")
STRECKE = 22.0                                   # Meter in 6 s ≈ 13 km/h – ruhig, Lichtbaender gut lesbar

m = sa.materialien()
auto_body = sa.auto(m)
teile = list(bpy.data.collections["Auto"].objects)

# ---------- Auto als Gruppe, Raeder mit eigener Drehachse ----------
wagen = bpy.data.objects.new("Wagen", None)
s.collection.objects.link(wagen)
achsen = []
for x in (sw.ACHSE_V, sw.ACHSE_H):
    for sy in (1, -1):
        e = bpy.data.objects.new("Rad", None)
        s.collection.objects.link(e)
        e.location = (x, sy * sw.SPUR, sw.RAD_R)
        e.parent = wagen
        achsen.append(e)
bpy.context.view_layer.update()                                # Weltmatrizen der Achsen aktuell, sonst falscher Drehpunkt
for t in teile:
    ziel = wagen
    sattel = any(ms.material and ms.material.name.startswith("Sattel") for ms in t.material_slots)
    if not sattel and t.type == "MESH" and not t.name.startswith("Radhaus"):
        for e in achsen:                                       # Radteile (Reifen, Felge, Speichen, Scheibe) drehen mit
            if abs(t.location.x - e.location.x) < 0.3 and abs(t.location.z - e.location.z) < 0.3 \
                    and t.location.y * e.location.y > 0 and abs(t.location.y) > 0.5:
                ziel = e
                break
    mw = t.matrix_world.copy()
    t.parent = ziel
    t.matrix_world = mw
for f, x in ((1, -STRECKE / 2), (144, STRECKE / 2)):
    wagen.location.x = x
    wagen.keyframe_insert("location", index=0, frame=f)
    for e in achsen:
        e.rotation_euler.y = (x + STRECKE / 2) / sw.RAD_R           # abrollen: Winkel = Weg / Radius
        e.keyframe_insert("rotation_euler", index=1, frame=f)
for o in [wagen] + achsen:
    for fc in o.animation_data.action.fcurves:
        for k in fc.keyframe_points:
            k.interpolation = "LINEAR"

# ---------- Tunnel aus Boegen mit LED-Innenkante ----------
def bogen(name, radius, dicke, breite, material):
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=1, major_segments=96, minor_segments=4,
                                     location=(0, 0, 0), rotation=(math.pi / 2, 0, math.pi / 2))
    o = bpy.context.object
    o.name = name
    o.scale = (1, 1, 1)
    me = o.data
    for v in me.vertices:                                     # Torus-Querschnitt → flaches Rechteck
        r = math.hypot(v.co.x, v.co.y)
        k = (r - radius)
        v.co.x *= (radius + max(-dicke, min(dicke, k))) / r
        v.co.y *= (radius + max(-dicke, min(dicke, k))) / r
        v.co.z = max(-breite, min(breite, v.co.z))
    bpy.ops.object.mode_set(mode="EDIT")                      # untere Haelfte weg (Bogen steht auf dem Boden)
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    for v in me.vertices:
        v.select = v.co.y < -0.01
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.delete(type="VERT")
    bpy.ops.object.mode_set(mode="OBJECT")
    st.zuweisen(o, material)
    arr = o.modifiers.new("Reihe", "ARRAY")
    arr.use_relative_offset, arr.use_constant_offset = False, True
    arr.constant_offset_displace = (0, 0, 2.2)             # lokale Z-Achse = Tunnelrichtung (Welt-X)
    arr.count = 26
    o.location.x = -28
    return o


stahl = st.material("Tunnelstahl", base=(0.05, 0.05, 0.055), metallic=1.0, roughness=0.35)
led = st.material("LED", base=(0, 0, 0), emission=(1.0, 0.97, 0.9), emission_strength=9.0)
bogen("Bogen", 3.6, 0.14, 0.12, stahl)
bogen("LED", 3.42, 0.035, 0.05, led)
# jeder vierte Bogen in Markenfarbe
akzent = bogen("Akzent", 3.42, 0.036, 0.051, st.material("LED Gelb", base=(0, 0, 0), emission=GELB, emission_strength=10.0))
akzent.modifiers["Reihe"].constant_offset_displace = (0, 0, 8.8)
akzent.modifiers["Reihe"].count = 7
akzent.location.x = -28 + 1.1

boden = st.material("Nasser Boden", base=(0.01, 0.01, 0.011), roughness=0.08, specular=0.6)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
b = bpy.context.object
b.scale = (80, 7.2, 1)
st.zuweisen(b, boden)

sa.hdri_welt(staerke=0.12)
s.view_settings.look = "AgX - Punchy"

# ---------- Kamera faehrt mit (vorn seitlich, tief) ----------
kam = st.kamera((3.4, -2.6, 0.8), (0.2, 0, 0.55), brennweite=26)   # innerhalb der Boegen (Radius 3,4 m)
kam.parent = wagen
for f, ort in ((1, (3.6, -2.5, 0.75)), (144, (2.0, -2.8, 0.95))):
    kam.location = ort
    st.richte_aus(kam, (0.2 if f == 1 else -0.4, 0, 0.55))
    kam.keyframe_insert("location", frame=f)
    kam.keyframe_insert("rotation_euler", frame=f)
st.weich(kam)

s.render.use_motion_blur = True
s.render.motion_blur_shutter = 0.5
st.rendern(a, aufloesung=1280, samples=96, hoehe=720)
