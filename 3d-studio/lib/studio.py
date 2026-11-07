"""Gemeinsame Bausteine fuer alle Blender-Modelle (Blender 4.0, Cycles auf CPU, kein Denoiser noetig).

Ein Modell-Skript importiert dieses Modul, baut Form, Material, Licht und Kamera und ruft am Ende `rendern()` auf.
Aufruf immer ueber `3d-studio/render.sh` – nicht direkt.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

# ---------- Aufrufparameter (von render.sh nach "--" uebergeben) ----------

def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = {"out": "out", "vorschau": False, "frames": None, "still": None, "schritt": 1, "entwurf": False}
    i = 0
    while i < len(a):
        if a[i] == "--out":
            out["out"] = a[i + 1]; i += 1
        elif a[i] == "--vorschau":
            out["vorschau"] = True
        elif a[i] == "--frames":
            s, e = a[i + 1].split("-"); out["frames"] = (int(s), int(e)); i += 1
        elif a[i] == "--still":
            out["still"] = int(a[i + 1]); i += 1
        elif a[i] == "--entwurf":                 # ganzes Video klein + wenig Samples (Vorschau fuer den Nutzer)
            out["entwurf"] = True
        elif a[i] == "--schritt":                 # nur jedes n-te Bild (Bewegungsprobe)
            out["schritt"] = int(a[i + 1]); i += 1
        i += 1
    return out


# ---------- Szene ----------

def neue_szene(hintergrund=(0.0035, 0.0035, 0.004), frames=72, fps=30):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.frame_start, s.frame_end = 1, frames
    s.render.fps = fps
    s.view_settings.view_transform = "AgX"
    s.view_settings.look = "AgX - Medium High Contrast"
    w = bpy.data.worlds.new("Welt")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (*hintergrund, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    s.world = w
    return s


def hex_farbe(h):
    """'#E8F320' -> lineares RGB (fuer Materialien)."""
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


# ---------- Materialien ----------

def material(name, **werte):
    """Principled BSDF mit Blender-4-Namen, z. B. material('Stahl', base=(..), metallic=1, roughness=.3)."""
    namen = {
        "base": "Base Color", "metallic": "Metallic", "roughness": "Roughness", "ior": "IOR",
        "alpha": "Alpha", "coat": "Coat Weight", "coat_roughness": "Coat Roughness",
        "transmission": "Transmission Weight", "emission": "Emission Color",
        "emission_strength": "Emission Strength", "specular": "Specular IOR Level",
        "anisotropic": "Anisotropic",
    }
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    for k, v in werte.items():
        if k in ("base", "emission") and len(v) == 3:
            v = (*v, 1)
        p.inputs[namen[k]].default_value = v
    if "base" in werte:                       # Vorschaufarbe fuer Workbench (Formkontrolle)
        m.diffuse_color = p.inputs["Base Color"].default_value
    m.metallic, m.roughness = werte.get("metallic", 0.0), werte.get("roughness", 0.5)
    return m


def zuweisen(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)


def kanten_material(obj, m):
    """Zweites Material nur auf die Seitenflaechen (Normalen nicht nach oben/unten), z. B. Leuchtkante."""
    obj.data.materials.append(m)
    for p in obj.data.polygons:
        if abs(p.normal.z) < 0.5:
            p.material_index = len(obj.data.materials) - 1


# ---------- Form ----------

def platte(name, b, t, d, z, radius=0.08, segmente=6):
    """Abgerundete Platte (Breite b, Tiefe t, Dicke d), Unterkante bei z."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z + d / 2))
    o = bpy.context.object
    o.name = name
    o.scale = (b, t, d)
    bpy.ops.object.transform_apply(scale=True)
    bev = o.modifiers.new("Rundung", "BEVEL")
    bev.width = min(radius, d * 0.45)
    bev.segments = segmente
    bev.limit_method = "ANGLE"
    bpy.ops.object.shade_smooth()
    return o


def glatt(o):
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.shade_smooth()
    o.select_set(False)


# ---------- Licht ----------

def flaechenlicht(name, ort, ziel, staerke, groesse=(2, 2), farbe=(1, 1, 1)):
    d = bpy.data.lights.new(name, "AREA")
    d.shape = "RECTANGLE"
    d.size, d.size_y = groesse
    d.energy = staerke
    d.color = farbe
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.location = ort
    richte_aus(o, ziel)
    return o


def richte_aus(o, ziel):
    r = Vector(ziel) - Vector(o.location)
    o.rotation_euler = r.to_track_quat("-Z", "Y").to_euler()


# ---------- Kamera ----------

def kamera(ort, ziel, brennweite=60):
    c = bpy.data.cameras.new("Kamera")
    c.lens = brennweite
    o = bpy.data.objects.new("Kamera", c)
    bpy.context.collection.objects.link(o)
    o.location = ort
    richte_aus(o, ziel)
    bpy.context.scene.camera = o
    return o


def kreisfahrt(kam, ziel, radius, hoehe, winkel_von, winkel_bis, f_von, f_bis):
    """Kamera faehrt auf einem Kreisbogen um das Ziel (Grad), Keyframes mit weicher Kurve.
    radius/hoehe: Zahl oder (von, bis) – so faehrt die Kamera zugleich ran oder weg."""
    rv, rb = radius if isinstance(radius, tuple) else (radius, radius)
    hv, hb = hoehe if isinstance(hoehe, tuple) else (hoehe, hoehe)
    for f, w, r, h in ((f_von, winkel_von, rv, hv), (f_bis, winkel_bis, rb, hb)):
        a = math.radians(w)
        kam.location = (ziel[0] + r * math.sin(a), ziel[1] - r * math.cos(a), h)
        richte_aus(kam, ziel)
        kam.keyframe_insert("location", frame=f)
        kam.keyframe_insert("rotation_euler", frame=f)
    weich(kam)


def weich(o):
    """Alle Keyframes eines Objekts mit Ease-in-out (Bezier, automatisch geglaettet)."""
    if o.animation_data and o.animation_data.action:
        for fc in o.animation_data.action.fcurves:
            for k in fc.keyframe_points:
                k.interpolation = "BEZIER"
                k.easing = "AUTO"
                k.handle_left_type = k.handle_right_type = "AUTO_CLAMPED"


# ---------- Rendern ----------

def rendern(a, aufloesung=1080, samples=96, hoehe=None):
    """aufloesung = Breite; hoehe fuer andere Formate als 1:1 (z. B. 1280 × 720)."""
    s = bpy.context.scene
    s.render.resolution_x, s.render.resolution_y = aufloesung, hoehe or aufloesung
    s.render.resolution_percentage = 50 if a["vorschau"] else 100
    s.cycles.samples = 24 if a["vorschau"] else samples
    if a["schritt"] > 1:                         # Bewegungsprobe: klein und schnell
        s.render.resolution_percentage, s.cycles.samples = 30, 12
    if a["entwurf"]:
        s.render.resolution_percentage, s.cycles.samples = 50, 16
    s.cycles.use_adaptive_sampling = True
    s.cycles.adaptive_threshold = 0.02
    s.cycles.use_denoising = False          # Ubuntu-Blender hat kein OpenImageDenoise
    s.cycles.sample_clamp_indirect = 3.0    # Gluehwuermchen kappen
    s.cycles.blur_glossy = 1.0              # rauscharme Spiegelungen
    s.cycles.caustics_reflective = s.cycles.caustics_refractive = False
    s.cycles.max_bounces = 8
    s.cycles.transparent_max_bounces = 12
    s.render.image_settings.file_format = "PNG"
    s.render.image_settings.color_depth = "8"
    s.render.threads_mode = "AUTO"
    out = os.path.abspath(a["out"])
    os.makedirs(out, exist_ok=True)
    if a["still"] is not None:
        s.frame_set(a["still"])
        s.render.filepath = os.path.join(out, f"still_{a['still']:04d}.png")
        bpy.ops.render.render(write_still=True)
        return
    if a["frames"]:
        s.frame_start, s.frame_end = a["frames"]
    s.frame_step = a["schritt"]
    s.render.filepath = os.path.join(out, "frames", "f_")
    bpy.ops.render.render(animation=True)
