"""Wohnzimmer Dachgeschoss - Neugestaltung "Warm Dark Loft" (private Visualisierung, keine Werbung).

Der Raum wird aus den Massen in wohnzimmer_masse.py gebaut (Architektur unveraendert: Schraegen, Gaube, Fenster,
Dachfenster, Tueren, Pfosten, Heizkoerper, Revisionsklappe). Neu sind nur Oberflaechen, Moebel, Deko und Licht.

Aufruf aus dem Repo-Wurzelordner:
  blender -b --factory-startup -noaudio --python 3d-studio/modelle/wohnzimmer.py -- \
      --out 3d-studio/out/wohnzimmer --ansicht 1 [--form] [--vorschau] [--samples N] [--breite PX]
  --ansicht 1..5 | oben   Kamera + Lichtstimmung (ANSICHTEN unten)
  --form                  Workbench-Tonmodell zur Formkontrolle (Sekunden)
  --vorschau              halbe Aufloesung, 48 Samples

Rauschen: Ubuntu-Blender hat keinen Denoiser. Deshalb werden Diffus-, Glanz- und Transmissionsanteile als Paesse
gerendert, die indirekten Anteile kantenerhaltend gefiltert (A-Trous, gefuehrt von Normale, Tiefe, Albedo) und
wieder zusammengesetzt. Direktes Licht, Spiegelungen und Texturen bleiben scharf.
"""
import math
import os
import random
import sys

HIER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HIER, "..", "lib"))
sys.path.insert(0, HIER)
import bmesh  # noqa: E402
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import studio as st  # noqa: E402
import wohnzimmer_masse as M  # noqa: E402

R2 = math.sqrt(2)


# ====================================================================== Aufruf

def eigene_args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    o = {"ansicht": "1", "form": False, "samples": None, "breite": 1600, "nur_post": False, "belichtung": None}
    for i, x in enumerate(a):
        if x == "--ansicht":
            o["ansicht"] = a[i + 1]
        elif x == "--form":
            o["form"] = True
        elif x == "--samples":
            o["samples"] = int(a[i + 1])
        elif x == "--breite":
            o["breite"] = int(a[i + 1])
        elif x == "--nur-post":
            o["nur_post"] = True
        elif x == "--belichtung":
            o["belichtung"] = float(a[i + 1])
    return o


A = st.args()
E = eigene_args()

# Kamera: Handy-Weitwinkel (36-mm-Sensor), Augenhoehe 1,5 m stehend bzw. 1,15 m sitzend, Format 4:3
ANSICHTEN = {
    "1": dict(datei="1-eingang-tag", ort=(-0.30, -0.25, 1.50), ziel=(7.0, -0.05, 1.25), mm=22, hoch=True,
              licht="tag"),
    "2": dict(datei="2-eingang-abend-led", ort=(-0.30, -0.25, 1.50), ziel=(7.0, -0.05, 1.25), mm=22, hoch=True,
              licht="abend_led"),
    "3": dict(datei="3-couch-gaube", ort=(4.05, -1.58, 1.17), ziel=(5.75, 2.95, 1.15), mm=22, hoch=False,
              licht="abend_voll"),
    "4": dict(datei="4-gaube-eingang-tag", ort=(4.50, 0.50, 1.50), ziel=(0.0, -0.40, 1.00), mm=24, hoch=True,
              licht="tag"),
    "5": dict(datei="5-leseecke", ort=(3.00, 0.05, 1.32), ziel=(0.95, -1.95, 1.05), mm=22, hoch=False,
              licht="daemmerung"),
    "oben": dict(datei="0-draufsicht", ort=(3.45, 0.33, 12.0), ziel=(3.45, 0.33, 0.0), mm=0, hoch=False,
                 licht="tag"),
}
V = ANSICHTEN[E["ansicht"]]


# ====================================================================== Szene

s = st.neue_szene(frames=1)
s.view_settings.look = "AgX - Base Contrast"
WARM = (1.0, 0.52, 0.22)        # ~2700 K
KERZE = (1.0, 0.38, 0.10)


def hx(h):
    return st.hex_farbe(h)


# ====================================================================== Material-Bausteine

def _nt(m):
    return m.node_tree.nodes, m.node_tree.links


def _p(m):
    return m.node_tree.nodes["Principled BSDF"]


def mat(name, base, rough=0.6, vorschau=None, **kw):
    m = st.material(name, base=base, roughness=rough, **{k: v for k, v in kw.items() if k in (
        "metallic", "ior", "alpha", "coat", "coat_roughness", "transmission", "emission", "emission_strength",
        "specular", "anisotropic")})
    p = _p(m)
    if "sheen" in kw:
        p.inputs["Sheen Weight"].default_value = kw["sheen"]
        p.inputs["Sheen Roughness"].default_value = kw.get("sheen_rough", 0.4)
    m.diffuse_color = (*(vorschau or base), 1)
    return m


def position(nt):
    n, _ = nt
    return n.new("ShaderNodeNewGeometry").outputs["Position"]


def bump_an(m, hoehe_out, staerke, distanz):
    n, l = _nt(m)
    b = n.new("ShaderNodeBump")
    b.inputs["Strength"].default_value = staerke
    b.inputs["Distance"].default_value = distanz
    l.new(hoehe_out, b.inputs["Height"])
    l.new(b.outputs["Normal"], _p(m).inputs["Normal"])
    return b


def skaliert(m, vec_out, sx, sy, sz):
    n, l = _nt(m)
    mp = n.new("ShaderNodeVectorMath")
    mp.operation = "MULTIPLY"
    mp.inputs[1].default_value = (sx, sy, sz)
    l.new(vec_out, mp.inputs[0])
    return mp.outputs[0]


def rauschen(m, vec_out, scale, detail=4, rough=0.55):
    n, l = _nt(m)
    t = n.new("ShaderNodeTexNoise")
    t.inputs["Scale"].default_value = scale
    t.inputs["Detail"].default_value = detail
    t.inputs["Roughness"].default_value = rough
    l.new(vec_out, t.inputs["Vector"])
    return t.outputs["Fac"]


def rampe(m, fac_out, stops):
    """stops = [(pos, (r,g,b)), ...]"""
    n, l = _nt(m)
    r = n.new("ShaderNodeValToRGB")
    el = r.color_ramp.elements
    el[0].position, el[0].color = stops[0][0], (*stops[0][1], 1)
    el[1].position, el[1].color = stops[-1][0], (*stops[-1][1], 1)
    for pos, c in stops[1:-1]:
        e = el.new(pos)
        e.color = (*c, 1)
    l.new(fac_out, r.inputs["Fac"])
    return r.outputs["Color"]


def holz(name, hell, dunkel, maserung="z", rough=0.5, streifen=40.0):
    """Eiche/Buche: gestreckte Rauschmaserung entlang der Faserachse."""
    m = mat(name, hell, rough, vorschau=hell)
    n, l = _nt(m)
    s_ = {"x": (0.7, streifen, streifen), "y": (streifen, 0.7, streifen), "z": (streifen, streifen, 0.7)}[maserung]
    v = skaliert(m, position((n, l)), *s_)
    f1 = rauschen(m, v, 3.0, 8, 0.62)
    farbe = rampe(m, f1, [(0.30, dunkel), (0.55, hell), (0.75, tuple(min(1, c * 1.12) for c in hell))])
    l.new(farbe, _p(m).inputs["Base Color"])
    bump_an(m, f1, 0.08, 0.002)
    return m


def holzdecke_weiss(name, teiler):
    """Nut-und-Feder-Profilholz, matt weiss gestrichen: Fugen und Brettkanten bleiben sichtbar, Aeste nicht.
    Bretter laufen laengs zum Raum (FOTO), Fugen also bei konstantem y; teiler = Brettraster in y-Richtung."""
    weiss = hx("#F1EEE8")
    m = mat(name, weiss, 0.82)
    n, l = _nt(m)
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(position((n, l)), sep.inputs[0])
    div = n.new("ShaderNodeMath"); div.operation = "DIVIDE"; div.inputs[1].default_value = teiler
    l.new(sep.outputs["Y"], div.inputs[0])
    fr = n.new("ShaderNodeMath"); fr.operation = "FRACT"
    l.new(div.outputs[0], fr.inputs[0])
    fuge = n.new("ShaderNodeValToRGB")       # 0 = Fuge, 1 = Brettflaeche (Feder leicht gefast)
    el = fuge.color_ramp.elements
    el[0].position, el[0].color = 0.0, (0, 0, 0, 1)
    el[1].position, el[1].color = 0.035, (1, 1, 1, 1)
    e = el.new(0.975); e.color = (1, 1, 1, 1)
    e = el.new(1.0); e.color = (0.35, 0.35, 0.35, 1)
    l.new(fr.outputs[0], fuge.inputs["Fac"])
    fl = n.new("ShaderNodeMath"); fl.operation = "FLOOR"
    l.new(div.outputs[0], fl.inputs[0])
    wn = n.new("ShaderNodeTexWhiteNoise"); wn.noise_dimensions = "1D"
    l.new(fl.outputs[0], wn.inputs["W"])
    var = n.new("ShaderNodeMapRange")
    var.inputs["To Min"].default_value, var.inputs["To Max"].default_value = 0.955, 1.0
    l.new(wn.outputs["Value"], var.inputs["Value"])
    fugenton = n.new("ShaderNodeMapRange")
    fugenton.inputs["To Min"].default_value, fugenton.inputs["To Max"].default_value = 0.62, 1.0
    l.new(fuge.outputs["Color"], fugenton.inputs["Value"])
    mul = n.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
    l.new(var.outputs[0], mul.inputs[0]); l.new(fugenton.outputs[0], mul.inputs[1])
    farbe = n.new("ShaderNodeMix"); farbe.data_type = "RGBA"; farbe.blend_type = "MULTIPLY"
    farbe.inputs["Factor"].default_value = 1.0
    farbe.inputs[6].default_value = (*weiss, 1)
    comb = n.new("ShaderNodeCombineColor")
    for k in ("Red", "Green", "Blue"):
        l.new(mul.outputs[0], comb.inputs[k])
    l.new(comb.outputs[0], farbe.inputs[7])
    l.new(farbe.outputs[2], _p(m).inputs["Base Color"])
    bump_an(m, fuge.outputs["Color"], 0.55, 0.004)
    return m


def tapete():
    """Vliestapete warmes dunkles Taupe/Mokka, matt, feine Leinenstruktur."""
    farbe = hx("#66554A")
    m = mat("Tapete Mokka", farbe, 0.9)
    n, l = _nt(m)
    pos = position((n, l))
    grob = rauschen(m, pos, 2.5, 3, 0.5)
    ton = rampe(m, grob, [(0.35, tuple(c * 0.93 for c in farbe)), (0.65, tuple(c * 1.05 for c in farbe))])
    l.new(ton, _p(m).inputs["Base Color"])
    w1 = n.new("ShaderNodeTexWave"); w1.wave_type = "BANDS"; w1.bands_direction = "Z"
    w1.inputs["Scale"].default_value = 260; w1.inputs["Distortion"].default_value = 2.0
    w1.inputs["Detail"].default_value = 2
    l.new(pos, w1.inputs["Vector"])
    fein = rauschen(m, pos, 420, 2, 0.5)
    mix = n.new("ShaderNodeMath"); mix.operation = "ADD"
    l.new(w1.outputs["Fac"], mix.inputs[0]); l.new(fein, mix.inputs[1])
    bump_an(m, mix.outputs[0], 0.12, 0.001)
    return m


def laminat():
    """Bestehender Laminatboden Eiche-Optik mittelbraun, Dielen quer zum Raum (FOTO)."""
    m = mat("Laminat Eiche", (0.30, 0.17, 0.08), 0.42)
    n, l = _nt(m)
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(position((n, l)), sep.inputs[0])
    cmb = n.new("ShaderNodeCombineXYZ")          # x/y getauscht: Dielen laufen quer (FOTO 1/13)
    l.new(sep.outputs["Y"], cmb.inputs["X"]); l.new(sep.outputs["X"], cmb.inputs["Y"])
    pos = cmb.outputs[0]
    br = n.new("ShaderNodeTexBrick")
    br.offset, br.offset_frequency, br.squash_frequency = 0.5, 2, 1
    br.inputs["Color1"].default_value = (0.20, 0.13, 0.078, 1)
    br.inputs["Color2"].default_value = (0.28, 0.19, 0.118, 1)
    br.inputs["Mortar"].default_value = (0.06, 0.035, 0.018, 1)
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = 0.0012
    br.inputs["Mortar Smooth"].default_value = 0.2
    br.inputs["Bias"].default_value = 0.0
    br.inputs["Brick Width"].default_value = 1.285
    br.inputs["Row Height"].default_value = 0.193
    l.new(pos, br.inputs["Vector"])
    v = skaliert(m, pos, 0.55, 34, 34)
    f = rauschen(m, v, 2.6, 8, 0.65)
    mas = rampe(m, f, [(0.3, (0.70, 0.70, 0.70)), (0.55, (1.0, 1.0, 1.0)), (0.8, (1.18, 1.18, 1.18))])
    mul = n.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    l.new(br.outputs["Color"], mul.inputs[6]); l.new(mas, mul.inputs[7])
    l.new(mul.outputs[2], _p(m).inputs["Base Color"])
    rr = n.new("ShaderNodeMapRange")
    rr.inputs["To Min"].default_value, rr.inputs["To Max"].default_value = 0.85, 0.40
    l.new(br.outputs["Fac"], rr.inputs["Value"])
    l.new(rr.outputs[0], _p(m).inputs["Roughness"])
    add = n.new("ShaderNodeMath"); add.operation = "MULTIPLY_ADD"
    add.inputs[1].default_value = 0.15
    l.new(f, add.inputs[0]); l.new(br.outputs["Fac"], add.inputs[2])
    bump_an(m, add.outputs[0], 0.25, 0.0015)
    return m


def stoff(name, farbe, sheen=0.6, rippen=0.0, noppen=0.0, rough=0.9):
    m = mat(name, farbe, rough, sheen=sheen, sheen_rough=0.35)
    n, l = _nt(m)
    pos = position((n, l))
    if rippen:
        w = n.new("ShaderNodeTexWave"); w.wave_type = "BANDS"; w.bands_direction = "X"
        w.inputs["Scale"].default_value = rippen
        l.new(pos, w.inputs["Vector"])
        bump_an(m, w.outputs["Fac"], 0.12, 0.002)
    elif noppen:
        bump_an(m, rauschen(m, pos, noppen, 3, 0.6), 0.35, 0.003)
    else:
        bump_an(m, rauschen(m, pos, 380, 2, 0.5), 0.12, 0.001)
    return m


def leder(name, farbe):
    m = mat(name, farbe, 0.42, coat=0.15, coat_roughness=0.3)
    n, l = _nt(m)
    pos = position((n, l))
    f = rauschen(m, pos, 9, 3, 0.5)
    l.new(rampe(m, f, [(0.3, tuple(c * 0.82 for c in farbe)), (0.7, tuple(min(1, c * 1.12) for c in farbe))]),
          _p(m).inputs["Base Color"])
    bump_an(m, rauschen(m, pos, 260, 3, 0.6), 0.08, 0.001)
    return m


def vorhangstoff(name, farbe):
    """Leinen-Optik, leicht lichtdurchlaessig (Mix aus Principled und Translucent)."""
    m = stoff(name, farbe, sheen=0.4, rough=0.95)
    n, l = _nt(m)
    out = n["Material Output"]
    tr = n.new("ShaderNodeBsdfTranslucent")
    tr.inputs["Color"].default_value = (*farbe, 1)
    mx = n.new("ShaderNodeMixShader")
    mx.inputs["Fac"].default_value = 0.32
    l.new(_p(m).outputs[0], mx.inputs[1]); l.new(tr.outputs[0], mx.inputs[2])
    l.new(mx.outputs[0], out.inputs["Surface"])
    return m


def glas():
    m = bpy.data.materials.new("Glas")
    m.use_nodes = True
    n, l = _nt(m)
    n.remove(_p(m))
    tr = n.new("ShaderNodeBsdfTransparent")
    gl = n.new("ShaderNodeBsdfGlossy"); gl.inputs["Roughness"].default_value = 0.0
    lw = n.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.12
    mx = n.new("ShaderNodeMixShader")
    l.new(lw.outputs["Fresnel"], mx.inputs["Fac"])
    l.new(tr.outputs[0], mx.inputs[1]); l.new(gl.outputs[0], mx.inputs[2])
    l.new(mx.outputs[0], n["Material Output"].inputs["Surface"])
    m.diffuse_color = (0.7, 0.8, 0.9, 0.3)
    return m


def leuchtmat(name, farbe, staerke, basis=(0.9, 0.9, 0.88)):
    m = mat(name, basis, 0.5, emission=farbe, emission_strength=staerke)
    return m


def bildmat(name, pixel):
    """pixel: numpy (h, w, 3) sRGB 0..1 -> Bildtextur."""
    h, w, _ = pixel.shape
    img = bpy.data.images.new(name, w, h, alpha=False)
    rgba = np.ones((h, w, 4), np.float32)
    rgba[..., :3] = pixel[::-1]
    img.pixels.foreach_set(rgba.ravel())
    m = mat(name, (0.8, 0.8, 0.8), 0.75)
    n, l = _nt(m)
    t = n.new("ShaderNodeTexImage"); t.image = img; t.interpolation = "Cubic"
    tc = n.new("ShaderNodeTexCoord")
    l.new(tc.outputs["UV"], t.inputs["Vector"])
    l.new(t.outputs["Color"], _p(m).inputs["Base Color"])
    m.diffuse_color = (*pixel.reshape(-1, 3).mean(0), 1)
    return m


# ---------- Materialsatz ----------
MT = {
    "decke": holzdecke_weiss("Holzdecke weiss", 0.112),
    "decke_s": holzdecke_weiss("Holzdecke weiss Schraege", 0.112 / math.sqrt(2)),
    "tapete": tapete(),
    "boden": laminat(),
    "weiss_putz": mat("Putz weiss", hx("#EDEBE6"), 0.9),
    "laibung": mat("Laibung weiss", hx("#F2F0EC"), 0.85),
    "lack_weiss": mat("Lack weiss", hx("#F3F2EF"), 0.35),
    "kunststoff_weiss": mat("Fensterrahmen", hx("#F4F4F2"), 0.3),
    "sockel": mat("Sockelleiste weiss", hx("#F2F1EE"), 0.4),
    "glas": glas(),
    "eiche": holz("Eiche natur", hx("#C49A6C"), hx("#9C7448"), "x"),
    "eiche_v": holz("Eiche Lamelle", hx("#C29868"), hx("#946C42"), "z", rough=0.55),
    "buche": holz("Buche Tuer", hx("#D2A679"), hx("#B98A5C"), "z", rough=0.45),
    "kiefer_regal": holz("Holzregal", hx("#C8A077"), hx("#9E774E"), "x"),
    "filz": mat("Akustikfilz schwarz", (0.012, 0.012, 0.012), 1.0, sheen=0.3),
    "schwarz_matt": mat("Schwarz matt", (0.014, 0.014, 0.014), 0.55),
    "metall_schwarz": mat("Metall schwarz", (0.012, 0.012, 0.012), 0.38, metallic=0.4),
    "tv_glas": mat("TV Bildschirm", (0.003, 0.003, 0.0035), 0.06, specular=0.6),
    "alu": mat("Aluprofil", (0.62, 0.62, 0.63), 0.35, metallic=1.0),
    "cord": stoff("Cord Sand", hx("#B9A385"), sheen=0.7, rippen=140, rough=0.92),
    "cognac": leder("Kunstleder Cognac", hx("#7A4426")),
    "samt_cognac": stoff("Samt Cognac", hx("#8A5230"), sheen=1.0),
    "boucle_creme": stoff("Boucle Creme", hx("#E9E1D3"), sheen=0.5, noppen=320),
    "dunkelbraun": stoff("Kissen Dunkelbraun", hx("#4C3428"), sheen=0.8),
    "strick": stoff("Strickdecke Hafer", hx("#D6C8B3"), sheen=0.4, noppen=60),
    "teppich": stoff("Teppich Greige", hx("#9E968A"), sheen=0.6, noppen=500, rough=1.0),
    "leinen": vorhangstoff("Vorhang Leinen Sand", hx("#CFC4B2")),
    "plissee": vorhangstoff("Plissee Greige", hx("#BEB3A3")),
    "sisal": stoff("Sisal", hx("#BFA47F"), sheen=0.2, rippen=900, rough=1.0),
    "pluesch_grau": stoff("Pluesch anthrazit", hx("#61656F"), sheen=0.9, noppen=600),
    "zarge": mat("Zarge dunkelbraun", hx("#4A2F20"), 0.45),
    "fliese_flur": mat("Fliese Flur", hx("#CDBB9C"), 0.3),
    "keramik": mat("Keramik Sand", hx("#D9CDBB"), 0.55),
    "wachs": mat("Kerzenwachs", hx("#F1EADB"), 0.5),
    "fliese": mat("Fliese hell", hx("#E8E6E2"), 0.12),
    "fuge": mat("Fuge", hx("#BEBBB5"), 0.9),
    "passepartout": mat("Passepartout", hx("#F4F1EA"), 0.9),
    "rahmen_schwarz": mat("Rahmen schwarz", (0.015, 0.015, 0.015), 0.4),
    "griff": mat("Griff Edelstahl", (0.7, 0.7, 0.7), 0.25, metallic=1.0),
    "buchseiten": mat("Buchseiten", hx("#EFE7D6"), 0.9),
    "rauchmelder": mat("Rauchmelder", hx("#F5F5F3"), 0.4),
    "schirm_innen": mat("Schirm innen", hx("#EFE9DF"), 0.6),
    "schirm_leinen": vorhangstoff("Schirm Leinen", hx("#E8DECD")),
    # Leuchtflaechen (Staerke wird je Lichtstimmung gesetzt)
    "led": leuchtmat("LED-Streifen", WARM, 0.0),
    "opal": leuchtmat("Deckenleuchte opal", WARM, 0.0, basis=hx("#F4F2EE")),
    "flamme": leuchtmat("Flamme", KERZE, 0.0, basis=(1, 0.9, 0.7)),
    "birne": leuchtmat("Leuchtmittel", WARM, 0.0, basis=(0.95, 0.92, 0.85)),
}
BUCHFARBEN = ["#3F3A34", "#A7754B", "#D9CBB5", "#6B4A35", "#2F3B3A", "#C2A27C"]


# ====================================================================== Geometrie-Bausteine

def neu_obj(name, me, m=None):
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    if m is not None:
        o.data.materials.append(m)
    return o


def netz(name, verts, faces, m=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    return neu_obj(name, me, m)


def glaetten(o, winkel=35):
    for p in o.data.polygons:
        p.use_smooth = True
    o.data.use_auto_smooth = True
    o.data.auto_smooth_angle = math.radians(winkel)


def quader(name, x0, x1, y0, y1, z0, z1, m, fase=0.0, seg=2):
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
         (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    o = netz(name, v, f, m)
    if fase > 0:
        b = o.modifiers.new("Fase", "BEVEL")
        b.width, b.segments, b.limit_method = fase, seg, "ANGLE"
        glaetten(o)
    return o


def kissen(name, b, t, h, m, rund=0.035, stufen=2):
    """Polster um den Ursprung: abgerundeter Quader, unterteilt (weich)."""
    o = quader(name, -b / 2, b / 2, -t / 2, t / 2, -h / 2, h / 2, m)
    bev = o.modifiers.new("Rund", "BEVEL")
    bev.width, bev.segments = min(rund, h * 0.45), 3
    sub = o.modifiers.new("Weich", "SUBSURF")
    sub.levels = sub.render_levels = stufen
    glaetten(o, 180)
    return o


def zylinder(name, r, h, m, ort=(0, 0, 0), seg=40, r2=None, rot=(0, 0, 0)):
    """Zylinder/Kegelstumpf, Unterkante im Ursprung (lokal), dann an ort."""
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=h, location=(0, 0, h / 2))
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r, radius2=r2, depth=h, location=(0, 0, h / 2))
    o = bpy.context.object
    o.name = name
    bpy.ops.object.transform_apply(location=True)
    o.location, o.rotation_euler = ort, rot
    o.data.materials.append(m)
    glaetten(o, 50)
    return o


def kugel(name, r, m, ort, skala=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=48, ring_count=24, location=ort)
    o = bpy.context.object
    o.name, o.scale = name, skala
    o.data.materials.append(m)
    glaetten(o, 180)
    return o


def drehkoerper(name, profil, m, ort, seg=64):
    """profil = [(radius, z), ...] von unten nach oben -> Lathe."""
    verts, faces = [], []
    n = len(profil)
    for i in range(seg):
        a = 2 * math.pi * i / seg
        for r, z in profil:
            verts.append((r * math.cos(a), r * math.sin(a), z))
    for i in range(seg):
        j = (i + 1) % seg
        for k in range(n - 1):
            faces.append((i * n + k, j * n + k, j * n + k + 1, i * n + k + 1))
    o = netz(name, verts, faces, m)
    o.location = ort
    glaetten(o, 60)
    return o


def gruppe(name, ort=(0, 0, 0), drehung=0.0):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    e.location = ort
    e.rotation_euler = (0, 0, math.radians(drehung))
    return e


def an(eltern, *objs):
    for o in objs:
        o.parent = eltern
    return objs[0] if len(objs) == 1 else objs


def newell(pts):
    nx = ny = nz = 0.0
    for i, p in enumerate(pts):
        q = pts[(i + 1) % len(pts)]
        nx += (p[1] - q[1]) * (p[2] + q[2])
        ny += (p[2] - q[2]) * (p[0] + q[0])
        nz += (p[0] - q[0]) * (p[1] + q[1])
    return Vector((nx, ny, nz))


def flaeche(name, abbild, u0, u1, oben, knicke, loecher, m, normale, unten=0.0, dicke=0.05):
    """Ebene Wand/Schraege mit Rechteckloechern. abbild(u, v) -> xyz, oben(u) -> Oberkante (linear zwischen Knicken).
    loecher = [(ua, ub, va, vb)]. Normalen zeigen in den Raum, Dicke waechst nach aussen (dichtet Kanten)."""
    us = sorted({u0, u1, *[k for k in knicke if u0 < k < u1], *[c for lo in loecher for c in lo[:2]]})
    verts, faces = [], []
    nv = Vector(normale)
    for ua, ub in zip(us[:-1], us[1:]):
        um = (ua + ub) / 2
        zu = sorted((lo[2], lo[3]) for lo in loecher if lo[0] < um < lo[1])
        teile, cur = [], unten
        for va, vb in zu:
            teile.append((cur, va))
            cur = vb
        teile.append((cur, None))
        for lo, hi in teile:
            if hi is None:
                if lo >= max(oben(ua), oben(ub)) - 1e-6:
                    continue
                pts = [(ua, lo), (ub, lo), (ub, oben(ub)), (ua, oben(ua))]
            else:
                if hi - lo < 1e-6:
                    continue
                pts = [(ua, lo), (ub, lo), (ub, hi), (ua, hi)]
            p3 = [abbild(u, v) for u, v in pts]
            if newell(p3).dot(nv) < 0:
                p3.reverse()
            b0 = len(verts)
            verts += p3
            faces.append(tuple(range(b0, b0 + 4)))
    o = netz(name, verts, faces, m)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(o.data)
    bm.free()
    if dicke:
        so = o.modifiers.new("Dicke", "SOLIDIFY")
        so.thickness, so.offset, so.use_rim, so.use_even_offset = dicke, -1, False, True
    return o


def poly(name, pts, m, normale, dicke=0.05):
    p3 = list(pts)
    if newell(p3).dot(Vector(normale)) < 0:
        p3.reverse()
    o = netz(name, p3, [tuple(range(len(p3)))], m)
    if dicke:
        so = o.modifiers.new("Dicke", "SOLIDIFY")
        so.thickness, so.offset, so.use_rim, so.use_even_offset = dicke, -1, False, True
    return o


def ausrichten(o, richtung, xachse=(1, 0, 0)):
    """Lokale -Z-Achse (Lichtrichtung) auf 'richtung', lokale X moeglichst auf 'xachse'."""
    zl = -Vector(richtung).normalized()
    xl = Vector(xachse)
    xl = (xl - zl * xl.dot(zl)).normalized()
    yl = zl.cross(xl)
    o.rotation_euler = Matrix((xl, yl, zl)).transposed().to_euler()


# ====================================================================== Raumhuelle

def rohbau():
    D, GH = M.DECKE, M.GAUBE_H
    gx0, gy1 = M.GAUBE_X0, M.GAUBE_Y1
    poly("Boden", [(-0.2, M.YR - 0.2, 0), (M.L + 0.4, M.YR - 0.2, 0), (M.L + 0.4, gy1 + 0.4, 0),
                   (-0.2, gy1 + 0.4, 0)], MT["boden"], (0, 0, 1), 0.05)
    poly("Decke flach", [(0, M.YR + M.LAUF, D), (M.L, M.YR + M.LAUF, D), (M.L, M.YF, D), (0, M.YF, D)],
         MT["decke"], (0, 0, -1))
    # Rechte Schraege mit Dachfenster-Ausschnitt (ab Kniestock-Oberkante bis Oberkante Laibung)
    df, k = M.DF, M.dachfenster()
    xa, xb = df["x0"], df["x0"] + df["b"]
    flaeche("Schraege rechts", schraege(-1), 0, M.L, lambda u: M.S_MAX, [], [(xa, xb, 0.0, k["s_c1"])],
            MT["decke_s"], (0, 1, -1))
    flaeche("Kniestock rechts", lambda u, v: (u, M.YR, v), 0, M.L, lambda u: M.KNIE, [], [], MT["tapete"], (0, 1, 0))
    # Eingangswand (Giebel, Tueroeffnung) und gerade raumhohe Wand links vorn
    t = M.TUER
    flaeche("Eingangswand", lambda u, v: (0, u, v), M.YR, M.YF, M.schraege_hoehe, [M.YR + M.LAUF],
            [(t["y0"], t["y0"] + t["b"], 0, t["h"])], MT["tapete"], (1, 0, 0))
    flaeche("Gerade Wand links", lambda u, v: (u, M.YF, v), 0, M.WAND_X, lambda u: D, [], [], MT["tapete"],
            (0, -1, 0))
    # Nische unter der linken Schraege (Rueckwand + Seitenwand + Schraege)
    ny = M.NISCHE_Y
    zn = M.schraege_hoehe(ny)
    flaeche("Nische Seitenwand", lambda u, v: (M.WAND_X, u, v), M.YF, ny, M.schraege_hoehe, [], [], MT["tapete"],
            (1, 0, 0))
    flaeche("Nische Rueckwand", lambda u, v: (u, ny, v), M.WAND_X, gx0, lambda u: zn, [], [], MT["tapete"],
            (0, -1, 0))
    s0 = (M.YL - ny) * R2
    flaeche("Nische Schraege", schraege(1), M.WAND_X, gx0, lambda u: M.S_MAX, [], [], MT["decke_s"], (0, -1, -1),
            unten=s0)
    # Gaube: Decke, Zierleiste zur Raumdecke, Vorderwand, Aussenwand (Badtuer hinter Lamellen), Zwickel
    poly("Gaubendecke", [(gx0, M.YF, GH), (M.L, M.YF, GH), (M.L, gy1, GH), (gx0, gy1, GH)], MT["decke"], (0, 0, -1))
    poly("Gauben-Zierleiste", [(gx0, M.YF, GH), (M.L, M.YF, GH), (M.L, M.YF, D), (gx0, M.YF, D)], MT["decke"],
         (0, -1, 0))
    flaeche("Gaube Vorderwand", lambda u, v: (gx0, u, v), ny, gy1, lambda u: GH, [], [], MT["tapete"], (1, 0, 0))
    flaeche("Gaube Aussenwand", lambda u, v: (u, gy1, v), gx0, M.L, lambda u: GH, [], [], MT["tapete"], (0, -1, 0))
    yk = M.YF + (D - GH)              # hier schneidet die Nischen-Schraege die Gaubendecke
    poly("Zwickel Nische oben", [(gx0, M.YF, GH), (gx0, yk, GH), (gx0, M.YF, D)], MT["decke"], (-1, 0, 0))
    poly("Zwickel Gaube", [(gx0, yk, GH), (gx0, ny, GH), (gx0, ny, zn)], MT["tapete"], (1, 0, 0))
    # Hintere Stirnwand: Giebelteil + Gaubenteil mit Fenster
    flaeche("Stirnwand hinten", lambda u, v: (M.L, u, v), M.YR, M.YF, M.schraege_hoehe, [M.YR + M.LAUF], [],
            MT["tapete"], (-1, 0, 0))
    fg = M.FENSTER_G
    fy0, fy1 = fg["ym"] - fg["b"] / 2, fg["ym"] + fg["b"] / 2
    fz0, fz1 = fg["bruestung"], fg["bruestung"] + fg["h"]
    flaeche("Stirnwand Gaube", lambda u, v: (M.L, u, v), M.YF, gy1, lambda u: GH, [], [(fy0, fy1, fz0, fz1)],
            MT["tapete"], (-1, 0, 0))
    xr = M.L + M.GAUBE_LAIBUNG
    poly("Laibung G rechts", [(M.L, fy0, fz0), (xr, fy0, fz0), (xr, fy0, fz1), (M.L, fy0, fz1)], MT["laibung"],
         (0, 1, 0), 0.03)
    poly("Laibung G links", [(M.L, fy1, fz0), (xr, fy1, fz0), (xr, fy1, fz1), (M.L, fy1, fz1)], MT["laibung"],
         (0, -1, 0), 0.03)
    poly("Laibung G Sturz", [(M.L, fy0, fz1), (xr, fy0, fz1), (xr, fy1, fz1), (M.L, fy1, fz1)], MT["laibung"],
         (0, 0, -1), 0.03)
    quader("Fensterbank G", M.L - 0.035, xr, fy0 - 0.03, fy1 + 0.03, fz0 - 0.02, fz0, MT["lack_weiss"], 0.004)
    fenster("Gaubenfenster", Vector((M.L + 0.17, fg["ym"], (fz0 + fz1) / 2)), Vector((0, 1, 0)), Vector((0, 0, 1)),
            fg["b"], fg["h"], Vector((1, 0, 0)))
    portal("Portal Gaube", (xr + 0.02, fg["ym"], (fz0 + fz1) / 2), (-1, 0, 0), fg["b"], fg["h"], xachse=(0, 1, 0))
    # Dachfenster: untere Laibung senkrecht (Kniestockebene, Tapete), obere waagerecht, Seiten weiss
    ky, kz = k["knie"]
    vy, vz = k["verkl_o"]
    oy, oz = k["glas_o"]
    uy_, uz = k["glas_u"]
    poly("Dachfenster Bruestung", [(xa, M.YR, kz), (xb, M.YR, kz), (xb, M.YR, uz), (xa, M.YR, uz)], MT["tapete"],
         (0, 1, 0), 0.03)
    poly("Laibung DF oben", [(xa, vy, vz), (xb, vy, vz), (xb, oy, oz), (xa, oy, oz)], MT["laibung"], (0, 0, -1), 0.03)
    for nm, x, nx in (("links", xa, 1), ("rechts", xb, -1)):
        poly(f"Laibung DF {nm}", [(x, ky, kz), (x, vy, vz), (x, oy, oz), (x, uy_, uz)], MT["laibung"], (nx, 0, 0),
             0.03)
    nout = Vector((0, -1, 1)).normalized()
    hoch = Vector((0, 1, 1)).normalized()
    mitte = Vector(((xa + xb) / 2, (oy + uy_) / 2, (oz + uz) / 2))
    fenster("Dachfenster", mitte - nout * 0.03, Vector((1, 0, 0)), hoch, df["b"], df["glas"], nout)
    portal("Portal Dachfenster", tuple(mitte + nout * 0.06), tuple(-nout), df["b"], df["glas"], xachse=(1, 0, 0))
    plissee(mitte - nout * 0.08, hoch, df["b"] - 0.14, df["glas"] - 0.14)
    flur()


def flur():
    """Gefliester Flur hinter der Eingangstuer (nur damit die offene Tuer nicht ins Leere zeigt)."""
    x0, y0, y1, h = -2.4, -1.70, M.YF, 2.40
    poly("Flur Boden", [(x0, y0, 0.002), (0, y0, 0.002), (0, y1, 0.002), (x0, y1, 0.002)], MT["fliese_flur"], (0, 0, 1),
         0.02)
    poly("Flur Decke", [(x0, y0, h), (0, y0, h), (0, y1, h), (x0, y1, h)], MT["weiss_putz"], (0, 0, -1))
    poly("Flur Wand rechts", [(x0, y0, 0), (0, y0, 0), (0, y0, h), (x0, y0, h)], MT["weiss_putz"], (0, 1, 0))
    poly("Flur Wand links", [(x0, y1, 0), (0, y1, 0), (0, y1, h), (x0, y1, h)], MT["weiss_putz"], (0, -1, 0))
    poly("Flur Stirn", [(x0, y0, 0), (x0, y1, 0), (x0, y1, h), (x0, y0, h)], MT["weiss_putz"], (1, 0, 0))
    quader("Flur Tuer gegenueber", x0 + 0.005, x0 + 0.04, -0.6, 0.25, 0, 2.0, MT["buche"], 0.002)
    d = bpy.data.lights.new("Flur Licht", "AREA")
    d.shape, d.size, d.energy, d.color = "DISK", 0.3, 18 if V["licht"] == "tag" else 4, (1.0, 0.85, 0.65)
    o = bpy.data.objects.new("Flur Licht", d)
    bpy.context.collection.objects.link(o)
    o.location = (x0 / 2, (y0 + y1) / 2, h - 0.02)
    o.visible_camera = False


def schraege(seite):
    def f(x, sv):
        return M.schraege_punkt(seite, x, sv)
    return f


def fenster(name, mitte, ux, uy, b, h, normale_aussen):
    """Kunststofffenster weiss: Blendrahmen + Fluegel + Glas, Ebene durch mitte, Achsen ux (Breite), uy (Hoehe)."""
    rb = 0.065
    rot = Matrix((ux, uy, ux.cross(uy))).transposed().to_euler()

    def leiste(cx, cy, lx, ly, tief, nm):
        o = quader(nm, -lx / 2, lx / 2, -ly / 2, ly / 2, -tief / 2, tief / 2, MT["kunststoff_weiss"], 0.004)
        o.location, o.rotation_euler = mitte + ux * cx + uy * cy, rot
    for i, (dx, dy, lx, ly) in enumerate(((0, h / 2 - rb / 2, b, rb), (0, -h / 2 + rb / 2, b, rb),
                                          (b / 2 - rb / 2, 0, rb, h), (-b / 2 + rb / 2, 0, rb, h))):
        leiste(dx, dy, lx, ly, 0.07, f"{name} Rahmen {i}")
    fb, fh, fr = b - 2 * rb, h - 2 * rb, 0.055
    for i, (dx, dy, lx, ly) in enumerate(((0, fh / 2 - fr / 2, fb, fr), (0, -fh / 2 + fr / 2, fb, fr),
                                          (fb / 2 - fr / 2, 0, fr, fh), (-fb / 2 + fr / 2, 0, fr, fh))):
        leiste(dx, dy, lx, ly, 0.06, f"{name} Fluegel {i}")
    gb, gh = fb - 2 * fr + 0.01, fh - 2 * fr + 0.01
    c = mitte + normale_aussen * 0.005
    p = [c + ux * sx * gb / 2 + uy * sy * gh / 2 for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    netz(f"{name} Glas", [tuple(v) for v in p], [(0, 1, 2, 3)], MT["glas"])
    gr = quader(f"{name} Griff", -0.012, 0.012, -0.06, 0.012, -0.012, 0.012, MT["kunststoff_weiss"], 0.004)
    gr.location, gr.rotation_euler = mitte + ux * (b / 2 - rb - fr / 2) - normale_aussen * 0.05, rot


def portal(name, ort, richtung, b, h, xachse=(1, 0, 0)):
    d = bpy.data.lights.new(name, "AREA")
    d.shape, d.size, d.size_y = "RECTANGLE", b, h
    d.cycles.is_portal = True
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.location = ort
    ausrichten(o, richtung, xachse)
    return o


def plissee(mitte, hoch, b, h):
    """Plissee Greige im Fluegel: untere 45 % geschlossen (Falten 2,5 cm), oben frei."""
    n_out = Vector((0, -1, 1)).normalized()
    ux = Vector((1, 0, 0))
    anteil = 0.45
    falten = int(h * anteil / 0.025)
    verts, faces = [], []
    for i in range(falten + 1):
        t = -h / 2 + i * (h * anteil) / falten
        tief = 0.006 if i % 2 else -0.006
        for sx in (-1, 1):
            verts.append(tuple(mitte + ux * sx * b / 2 + hoch * t + n_out * tief))
    for i in range(falten):
        faces.append((2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2))
    netz("Plissee", verts, faces, MT["plissee"])
    oben = -h / 2 + h * anteil
    leiste = quader("Plissee Schiene", -b / 2, b / 2, -0.012, 0.012, -0.006, 0.006, MT["kunststoff_weiss"])
    leiste.location = mitte + hoch * oben
    leiste.rotation_euler = Matrix((ux, hoch, ux.cross(hoch))).transposed().to_euler()


def ausstattung_bestand():
    """Was bleibt: Tueren, Heizkoerper, Fliesenspiegel, Pfosten, Revisionsklappe, Rauchmelder, Schalter."""
    t = M.TUER
    y0, y1 = t["y0"], t["y0"] + t["b"]
    # Zarge dunkelbraun, Tuerblatt Buche, offen (Band auf der Heizkoerperseite, schwenkt in den Raum)
    for nm, a, b_, z0, z1 in (("Zarge links", y1, y1 + 0.055, 0, t["h"] + 0.055),
                              ("Zarge rechts", y0 - 0.055, y0, 0, t["h"] + 0.055),
                              ("Zarge oben", y0 - 0.055, y1 + 0.055, t["h"], t["h"] + 0.055)):
        quader(nm, -0.05, 0.012, a, b_, z0, z1, MT["zarge"], 0.003)
    g = gruppe("Eingangstuer", (0.0, y1 - 0.005, 0), t["offen"])
    blatt = quader("Eingangstuer Blatt", 0.0, 0.04, -t["b"] + 0.01, 0, 0.008, t["h"] - 0.005, MT["buche"], 0.002)
    teile = [blatt]
    for sx, nm in ((-0.012, "innen"), (0.052, "aussen")):
        teile.append(quader(f"Tuergriff {nm}", sx - 0.004, sx + 0.004, -t["b"] + 0.06, -t["b"] + 0.19, 1.04, 1.06,
                            MT["griff"], 0.004))
        teile.append(quader(f"Tuerschild {nm}", sx - 0.002, sx + 0.006, -t["b"] + 0.055, -t["b"] + 0.09, 0.85, 1.12,
                            MT["griff"], 0.002))
    an(g, *teile)
    sy = M.SCHALTER["y"]
    quader("Lichtschalter", 0, 0.012, sy - 0.04, sy + 0.04, 1.01, 1.09, MT["lack_weiss"], 0.004)
    quader("Steckdose", 0, 0.012, sy - 0.04, sy + 0.04, 0.93, 1.0, MT["lack_weiss"], 0.004)
    f = M.FLIESEN
    fliesen(f["y0"], f["y0"] + f["b"], f["z0"], f["z0"] + f["h"])
    h = M.HEIZ_E
    heizkoerper("Heizkoerper Eingang", (0.075, h["y0"] + h["b"] / 2, h["z0"]), h["b"], h["h"], (1, 0, 0))
    fg = M.FENSTER_G
    heizkoerper("Heizkoerper Gaube", (M.L - 0.07, fg["ym"] + 0.05, 0.15), 1.0, 0.6, (-1, 0, 0))
    # Pfosten mit Kopfbaendern (weiss verputzt): vorn bis an die Pfette (Deckenkante), hinten bis Zierleiste
    p = M.PFOSTEN
    hs = p["s"] / 2
    quader("Pfosten", p["x"] - hs, p["x"] + hs, p["y"] - hs, p["y"] + hs, 0, M.GAUBE_H, MT["weiss_putz"], 0.006)
    for nm, sx, ztop in (("Kopfband vorn", -1, M.DECKE), ("Kopfband hinten", 1, M.DECKE)):
        k = p["kopfband"]
        laenge = k * R2 + 0.08
        o = quader(nm, -laenge / 2, laenge / 2, -0.06, 0.06, -0.06, 0.06, MT["weiss_putz"], 0.006)
        o.location = (p["x"] + sx * (hs + k / 2), p["y"], ztop - k / 2)
        o.rotation_euler = (0, -math.radians(45) * sx, 0)
    # Revisionsklappe: zweifluegelig, in Wandfarbe gestrichen (Empfehlung), Vorhaengeschloss
    r = M.REV
    for i, (a_, b_) in enumerate(((r["xm"] - r["b"] / 2, r["xm"] - 0.002), (r["xm"] + 0.002, r["xm"] + r["b"] / 2))):
        quader(f"Revisionsklappe {i}", a_, b_, M.YR, M.YR + 0.018, r["z0"], r["z0"] + r["h"], MT["tapete"], 0.003)
    zm = r["z0"] + r["h"] - 0.12
    quader("Ueberwurf", r["xm"] - 0.03, r["xm"] + 0.03, M.YR + 0.018, M.YR + 0.024, zm - 0.02, zm + 0.02, MT["griff"])
    quader("Vorhaengeschloss", r["xm"] - 0.02, r["xm"] + 0.02, M.YR + 0.024, M.YR + 0.042, zm - 0.07, zm - 0.02,
           MT["griff"], 0.004)
    zylinder("Rauchmelder", 0.055, 0.035, MT["rauchmelder"], ort=((M.GAUBE_X0 + M.L) / 2, 1.95, M.GAUBE_H - 0.035))


def fliesen(y0, y1, z0, z1):
    quader("Fliesenspiegel Fuge", 0, 0.006, y0, y1, z0, z1, MT["fuge"])
    raster = 0.15
    ny, nz = max(1, round((y1 - y0) / raster)), max(1, round((z1 - z0) / raster))
    ry, rz = (y1 - y0) / ny, (z1 - z0) / nz
    verts, faces = [], []
    for i in range(ny):
        for j in range(nz):
            a, b_ = y0 + i * ry + 0.0015, y0 + (i + 1) * ry - 0.0015
            c, d = z0 + j * rz + 0.0015, z0 + (j + 1) * rz - 0.0015
            b0 = len(verts)
            verts += [(0.009, a, c), (0.009, b_, c), (0.009, b_, d), (0.009, a, d)]
            faces.append((b0, b0 + 1, b0 + 2, b0 + 3))
    o = netz("Fliesen", verts, faces, MT["fliese"])
    so = o.modifiers.new("Dicke", "SOLIDIFY")
    so.thickness, so.offset = 0.004, -1


def heizkoerper(name, fuss_mitte, b, h, normale):
    n = Vector(normale)
    q = Vector((-n.y, n.x, 0))
    o = quader(name, -b / 2, b / 2, -0.035, 0.035, 0, h, MT["lack_weiss"], 0.008)
    o.location = Vector(fuss_mitte)
    o.rotation_euler = (0, 0, math.atan2(q.y, q.x))
    for i in range(int(b / 0.05)):
        r = quader(f"{name} Rille {i}", -0.004, 0.004, -0.0365, -0.034, 0.03, h - 0.03, MT["fuge"])
        r.parent = o
        r.location = (-b / 2 + 0.025 + i * 0.05, 0, 0)
    ventil = zylinder(f"{name} Ventil", 0.014, 0.09, MT["lack_weiss"])
    ventil.parent = o
    ventil.location = (b / 2 + 0.02, 0.0, h - 0.12)


def sockelleisten():
    h, d = 0.06, 0.013
    t = M.TUER
    S = MT["sockel"]

    def sx(nm, x, a, b_, nach):          # Leiste an Wand x = const, Raum in Richtung nach (+1/-1)
        x0, x1 = sorted((x, x + nach * d))
        quader(nm, x0, x1, a, b_, 0, h, S, 0.002)

    def sy(nm, y, a, b_, nach):
        y0, y1 = sorted((y, y + nach * d))
        quader(nm, a, b_, y0, y1, 0, h, S, 0.002)
    sx("Sockel Eingang rechts", 0, M.YR, t["y0"] - 0.055, 1)
    sx("Sockel Eingang links", 0, t["y0"] + t["b"] + 0.055, M.FLIESEN["y0"], 1)
    sy("Sockel gerade Wand", M.YF, 0, M.WAND_X, -1)
    sx("Sockel Nische Seite", M.WAND_X, M.YF, M.NISCHE_Y, 1)
    sy("Sockel Nische Rueckwand", M.NISCHE_Y, M.WAND_X, M.GAUBE_X0, -1)
    sx("Sockel Gaube Vorderwand", M.GAUBE_X0, M.NISCHE_Y, M.GAUBE_Y1, 1)
    sy("Sockel Kniestock rechts", M.YR, 0, M.L, 1)
    sx("Sockel Stirnwand hinten", M.L, M.YR, M.GAUBE_Y1, -1)


# ====================================================================== Neue Einrichtung

def lamellenwand():
    """Akustikpaneele Eiche auf schwarzem Filz, raumhoch an der Gauben-Aussenwand, ueber die Badtuer gefuehrt
    (verdeckte Tuer: Lamellen an der Tueroberkante mit Schattenfuge geteilt). Gibt die Vorderkante (y) zurueck."""
    L_ = M.LAMELLE
    y = M.GAUBE_Y1
    xa, xb = M.GAUBE_X0 + 0.02, M.L - 0.02
    quader("Filz", xa, xb, y - L_["filz"], y, 0.0, M.GAUBE_H, MT["filz"])
    bt = M.BADTUER
    t0, t1 = bt["x0"], bt["x0"] + bt["b"]
    ys1, ys0 = y - L_["filz"], y - L_["filz"] - L_["tiefe"]
    verts, faces = [], []

    def latte(x0, x1, z0, z1):
        b0 = len(verts)
        verts.extend([(x0, ys0, z0), (x1, ys0, z0), (x1, ys1, z0), (x0, ys1, z0),
                      (x0, ys0, z1), (x1, ys0, z1), (x1, ys1, z1), (x0, ys1, z1)])
        faces.extend([(b0, b0 + 3, b0 + 2, b0 + 1), (b0 + 4, b0 + 5, b0 + 6, b0 + 7), (b0, b0 + 1, b0 + 5, b0 + 4),
                      (b0 + 1, b0 + 2, b0 + 6, b0 + 5), (b0 + 2, b0 + 3, b0 + 7, b0 + 6),
                      (b0 + 3, b0, b0 + 4, b0 + 7)])
    x = xa + (L_["raster"] - L_["breite"]) / 2
    while x + L_["breite"] <= xb:
        m = x + L_["breite"] / 2
        if t0 < m < t1:
            latte(x, x + L_["breite"], 0.008, bt["h"] - 0.003)
            latte(x, x + L_["breite"], bt["h"] + 0.003, M.GAUBE_H - 0.004)
        else:
            latte(x, x + L_["breite"], 0.008, M.GAUBE_H - 0.004)
        x += L_["raster"]
    o = netz("Lamellen Eiche", verts, faces, MT["eiche_v"])
    b = o.modifiers.new("Fase", "BEVEL")
    b.width, b.segments = 0.0015, 1
    quader("LED Lamelle Blende", xa, xb, y - 0.075, y - 0.035, M.GAUBE_H - 0.025, M.GAUBE_H, MT["schwarz_matt"])
    o = quader("LED Lamelle Leuchtstreifen", xa, xb, y - 0.055, y - 0.037, M.GAUBE_H - 0.03, M.GAUBE_H - 0.025,
               MT["led"])
    o.visible_diffuse = o.visible_glossy = o.visible_shadow = False
    return ys0


def tv_ecke(y_front):
    lb = M.LOWBOARD
    x0, x1 = lb["x0"], lb["x0"] + lb["b"]
    y1 = y_front - 0.005
    y0 = y1 - lb["t"]
    quader("Lowboard Korpus", x0, x1, y0 + 0.003, y1, lb["z0"], lb["z0"] + lb["h"], MT["schwarz_matt"], 0.004)
    for i in range(2):
        xa = x0 + 0.003 + i * lb["b"] / 2
        quader(f"Lowboard Front {i}", xa, xa + lb["b"] / 2 - 0.006, y0, y0 + 0.003, lb["z0"] + 0.004,
               lb["z0"] + lb["h"] - 0.004, MT["schwarz_matt"], 0.002)
    o = quader("LED Lowboard Leuchtstreifen", x0 + 0.05, x1 - 0.05, y0 + 0.05, y0 + 0.07, lb["z0"] - 0.006, lb["z0"],
               MT["led"])
    o.visible_diffuse = o.visible_glossy = o.visible_shadow = False
    top = lb["z0"] + lb["h"]
    drehkoerper("Vase Lowboard", [(0.0, 0), (0.045, 0.0), (0.06, 0.05), (0.055, 0.12), (0.03, 0.17), (0.026, 0.2),
                                  (0.0, 0.2)], MT["keramik"], (x0 + 0.18, y0 + 0.2, top))
    kerze("Kerze Lowboard", (x0 + 0.32, y0 + 0.16, top), 0.035, 0.12)
    buecher("Buecher Lowboard", (x1 - 0.2, y0 + 0.2, top), [(0.24, 0.17, 0.03), (0.22, 0.16, 0.025)], 8)
    # Fernseher am Schwenkarm, leicht zur Couch gedreht
    bw, bh = M.tv_masse()
    tv = M.TV
    ziel = Vector((M.COUCHTISCH["x"], M.YR + M.COUCH["wand"] + M.COUCH["t"] / 2))
    c = Vector((tv["x"], tv["y"]))
    n = (ziel - c).normalized()
    g = gruppe("TV", (tv["x"], tv["y"], tv["z"]), math.degrees(math.atan2(n.y, n.x)))
    teile = [quader("TV Gehaeuse", -0.03, 0.0, -bw / 2, bw / 2, -bh / 2, bh / 2, MT["schwarz_matt"], 0.004),
             quader("TV Bild", 0.0, 0.002, -bw / 2 + 0.006, bw / 2 - 0.006, -bh / 2 + 0.006, bh / 2 - 0.006,
                    MT["tv_glas"]),
             quader("TV Ruecken", -0.06, -0.03, -0.2, 0.2, -0.15, 0.15, MT["schwarz_matt"], 0.01)]
    an(g, *teile)
    quader("Arm Wandplatte", tv["x"] - 0.08, tv["x"] + 0.08, y_front - 0.02, y_front, tv["z"] - 0.2, tv["z"] + 0.2,
           MT["metall_schwarz"], 0.004)
    hinten = c - n * 0.06
    wand = Vector((tv["x"], y_front - 0.02))
    lg = (hinten - wand).length
    o = quader("Arm", 0, lg, -0.02, 0.02, -0.025, 0.025, MT["metall_schwarz"], 0.006)
    o.location = (wand.x, wand.y, tv["z"])
    o.rotation_euler = (0, 0, math.atan2(hinten.y - wand.y, hinten.x - wand.x))


def couchbereich():
    c = M.COUCH
    x0, x1 = c["x0"], c["x0"] + c["b"]
    yb = M.YR + c["wand"]
    yf = yb + c["t"]
    arm, fuss = 0.17, 0.11
    quader("Couch Rahmen", x0, x1, yb + 0.01, yf - 0.02, fuss, fuss + 0.2, MT["cord"], 0.03, 3)
    o = kissen("Couch Ruecken Rahmen", c["b"], 0.20, 0.36, MT["cord"], 0.05)
    o.location = ((x0 + x1) / 2, yb + 0.10, fuss + 0.2 + 0.16)
    for nm, xa in (("Armlehne vorn", x0), ("Armlehne hinten", x1 - arm)):
        o = kissen(f"Couch {nm}", arm, c["t"] - 0.02, 0.36, MT["cord"], 0.05)
        o.location = (xa + arm / 2, (yb + yf) / 2 - 0.01, fuss + 0.18 + 0.1)
    sb = (c["b"] - 2 * arm) / 3
    for i in range(3):
        xm = x0 + arm + sb * (i + 0.5)
        o = kissen(f"Couch Sitzkissen {i}", sb - 0.008, c["t"] - 0.24, 0.15, MT["cord"], 0.045)
        o.location = (xm, yf - (c["t"] - 0.24) / 2 - 0.02, c["sitz"] - 0.075)
        o = kissen(f"Couch Rueckenkissen {i}", sb - 0.01, 0.19, 0.36, MT["cord"], 0.06)
        o.location = (xm, yb + 0.29, c["sitz"] + 0.13)
        o.rotation_euler = (math.radians(9), 0, 0)
    for i, fx in enumerate((x0 + 0.06, (x0 + x1) / 2, x1 - 0.06)):
        for fy in (yb + 0.07, yf - 0.08):
            zylinder(f"Couch Fuss {i}", 0.022, fuss, MT["metall_schwarz"], ort=(fx, fy, 0), r2=0.016)
    zk = [("samt_cognac", x0 + arm + 0.22, 0.48, 12), ("boucle_creme", x0 + arm + 0.55, 0.45, -8),
          ("dunkelbraun", x1 - arm - 0.62, 0.42, 6), ("samt_cognac", x1 - arm - 0.28, 0.48, -14),
          ("boucle_creme", (x0 + x1) / 2 + 0.05, 0.40, 3)]
    for i, (mk, xm, gr, dreh) in enumerate(zk):
        o = kissen(f"Zierkissen {i}", gr, 0.13, gr, MT[mk], 0.06, 2)
        o.location = (xm, yb + 0.43, c["sitz"] + gr / 2 - 0.02)
        o.rotation_euler = (math.radians(20), math.radians(dreh), 0)
        o.scale = (1, 0.8, 1)
    strickdecke(x1 - arm, yb, yf, c["sitz"])
    bt = M.BEISTELL
    zylinder("Beistelltisch Platte", bt["d"] / 2, 0.016, MT["metall_schwarz"], ort=(bt["x"], bt["y"], bt["h"] - 0.016))
    zylinder("Beistelltisch Saeule", 0.014, bt["h"] - 0.016, MT["metall_schwarz"], ort=(bt["x"], bt["y"], 0))
    zylinder("Beistelltisch Fuss", 0.15, 0.012, MT["metall_schwarz"], ort=(bt["x"], bt["y"], 0))
    kerze("Kerze Beistell", (bt["x"] - 0.05, bt["y"] + 0.06, bt["h"]), 0.03, 0.09)
    buecher("Buch Beistell", (bt["x"] + 0.03, bt["y"] - 0.04, bt["h"]), [(0.21, 0.15, 0.03)], 2)
    sl = M.STEH_COUCH
    stehleuchte_kuppel("Stehleuchte Couch", (sl["x"], sl["y"]), 1.48, (x1 - 0.3, yb + 0.5))
    t = M.TEPPICH
    quader("Teppich", t["x0"], t["x0"] + t["b"], t["y0"], t["y0"] + t["t"], 0, 0.012, MT["teppich"], 0.005)
    ct = M.COUCHTISCH
    zylinder("Couchtisch Platte", ct["d"] / 2, 0.03, MT["eiche"], ort=(ct["x"], ct["y"], ct["h"] - 0.03), seg=96)
    zylinder("Couchtisch Saeule", 0.06, ct["h"] - 0.03, MT["metall_schwarz"], ort=(ct["x"], ct["y"], 0.012))
    zylinder("Couchtisch Fuss", 0.22, 0.02, MT["metall_schwarz"], ort=(ct["x"], ct["y"], 0.012), seg=64)
    zylinder("Tablett", 0.17, 0.015, MT["schwarz_matt"], ort=(ct["x"] + 0.1, ct["y"] + 0.08, ct["h"]))
    for i, (dx, dy, hk) in enumerate(((0.05, 0.12, 0.14), (0.15, 0.04, 0.10), (0.16, 0.16, 0.07))):
        kerze(f"Kerze Couchtisch {i}", (ct["x"] + dx, ct["y"] + dy, ct["h"] + 0.015), 0.035, hk)
    buecher("Buecher Couchtisch", (ct["x"] - 0.16, ct["y"] - 0.1, ct["h"]),
            [(0.30, 0.23, 0.03), (0.26, 0.20, 0.025)], 21)


def strickdecke(x_arm, yb, yf, sitz):
    """Grobstrickdecke ueber die hintere Armlehne gelegt (Profil in x-z, entlang y extrudiert, leicht gewellt)."""
    arm_oben = 0.57
    profil = [(x_arm - 0.42, sitz + 0.005), (x_arm - 0.12, sitz + 0.01), (x_arm - 0.02, arm_oben - 0.04),
              (x_arm + 0.06, arm_oben + 0.012), (x_arm + 0.14, arm_oben + 0.005), (x_arm + 0.185, arm_oben - 0.06),
              (x_arm + 0.195, sitz - 0.12)]
    ya, yb_ = yb + 0.32, yb + 0.78
    ny = 14
    verts, faces = [], []
    for j in range(ny + 1):
        y = ya + (yb_ - ya) * j / ny
        for k, (x, z) in enumerate(profil):
            welle = 0.012 * math.sin(j * 1.3 + k * 0.9)
            verts.append((x + welle * 0.5, y, z + welle))
    n = len(profil)
    for j in range(ny):
        for k in range(n - 1):
            faces.append((j * n + k, j * n + k + 1, (j + 1) * n + k + 1, (j + 1) * n + k))
    o = netz("Strickdecke", verts, faces, MT["strick"])
    so = o.modifiers.new("Dicke", "SOLIDIFY")
    so.thickness, so.offset = 0.022, 1
    sub = o.modifiers.new("Weich", "SUBSURF")
    sub.levels = sub.render_levels = 2
    glaetten(o, 180)


def stehleuchte_kuppel(name, fuss, hoehe, ziel):
    """Schwarze Stehleuchte, Kuppelschirm leicht zum Ziel geneigt."""
    x, y = fuss
    zylinder(f"{name} Fuss", 0.14, 0.02, MT["metall_schwarz"], ort=(x, y, 0))
    zylinder(f"{name} Stange", 0.011, hoehe, MT["metall_schwarz"], ort=(x, y, 0))
    r = (Vector(ziel) - Vector(fuss)).normalized()
    kopf = Vector((x + r.x * 0.12, y + r.y * 0.12, hoehe))
    arm = quader(f"{name} Ausleger", 0, 0.14, -0.008, 0.008, -0.008, 0.008, MT["metall_schwarz"])
    arm.location, arm.rotation_euler = (x, y, hoehe), (0, 0, math.atan2(r.y, r.x))
    schirm = drehkoerper(f"{name} Schirm", [(0.004, 0.13), (0.06, 0.125), (0.12, 0.08), (0.155, 0.0),
                                             (0.150, 0.0), (0.115, 0.077), (0.058, 0.118), (0.004, 0.122)],
                         MT["metall_schwarz"], tuple(kopf - Vector((0, 0, 0.11))))
    schirm.rotation_euler = (math.radians(12) * r.y, math.radians(-12) * r.x, 0)
    innen = drehkoerper(f"{name} Schirm innen", [(0.004, 0.118), (0.058, 0.114), (0.113, 0.074), (0.146, 0.002)],
                        MT["schirm_innen"], schirm.location)
    innen.rotation_euler = schirm.rotation_euler
    kugel(f"{name} Leuchtmittel", 0.03, MT["birne"], tuple(kopf - Vector((0, 0, 0.06))))
    LAMPEN.append(dict(name=name, ort=tuple(kopf - Vector((0, 0, 0.065))), art="kuppel"))


def leseecke():
    se = M.SESSEL
    ziel = Vector((M.COUCHTISCH["x"] - 0.4, M.COUCHTISCH["y"] + 0.5))
    blick = (ziel - Vector((se["x"], se["y"]))).normalized()
    g = gruppe("Sessel", (se["x"], se["y"], 0), math.degrees(math.atan2(blick.y, blick.x)) - 90)
    b, t = se["b"], se["t"]
    teile = []
    o = kissen("Sessel Korpus", b, t, 0.12, MT["cognac"], 0.04); o.location = (0, 0, 0.28); teile.append(o)
    o = kissen("Sessel Sitzkissen", b - 0.20, t - 0.16, 0.12, MT["cognac"], 0.05); o.location = (0, 0.05, 0.39)
    teile.append(o)
    o = kissen("Sessel Lehne", b - 0.06, 0.16, 0.60, MT["cognac"], 0.06)
    o.location = (0, -t / 2 + 0.12, 0.62); o.rotation_euler = (math.radians(13), 0, 0); teile.append(o)
    o = kissen("Sessel Rueckenkissen", b - 0.22, 0.12, 0.44, MT["cognac"], 0.05)
    o.location = (0, -t / 2 + 0.24, 0.64); o.rotation_euler = (math.radians(13), 0, 0); teile.append(o)
    for sx in (-1, 1):
        o = kissen(f"Sessel Armlehne {sx}", 0.10, t - 0.04, 0.26, MT["cognac"], 0.04)
        o.location = (sx * (b / 2 - 0.05), 0.0, 0.43); teile.append(o)
    for sx in (-1, 1):
        for sy in (-1, 1):
            o = zylinder("Sessel Bein", 0.016, 0.24, MT["metall_schwarz"], r2=0.011)
            o.location = (sx * (b / 2 - 0.07), sy * (t / 2 - 0.07), 0)
            o.rotation_euler = (math.radians(6 * sy), math.radians(-6 * sx), 0)
            teile.append(o)
    an(g, *teile)
    # Leseleuchte schwarz mit Arm, Kopf zum Sessel
    sl = M.STEH_LESE
    x, y = sl["x"], sl["y"]
    zylinder("Leseleuchte Fuss", 0.13, 0.02, MT["metall_schwarz"], ort=(x, y, 0))
    zylinder("Leseleuchte Stange", 0.010, 1.42, MT["metall_schwarz"], ort=(x, y, 0))
    zielp = Vector((se["x"] + 0.05, se["y"] + 0.05, 0.55))
    kopf = Vector((x, y, 1.42))
    arm_h = Vector(((zielp - kopf).x, (zielp - kopf).y, 0)).normalized()
    ende = kopf + arm_h * 0.32 + Vector((0, 0, 0.05))
    lg = (ende - kopf).length
    o = quader("Leseleuchte Arm", 0, lg, -0.007, 0.007, -0.007, 0.007, MT["metall_schwarz"])
    o.location = kopf
    o.rotation_euler = (0, -math.atan2(ende.z - kopf.z, (ende - kopf).xy.length), math.atan2(arm_h.y, arm_h.x))
    richtung = (zielp - ende).normalized()
    kegel = drehkoerper("Leseleuchte Schirm", [(0.0, 0.0), (0.03, 0.0), (0.05, 0.06), (0.075, 0.16),
                                                (0.072, 0.16), (0.047, 0.062), (0.0, 0.004)],
                        MT["metall_schwarz"], tuple(ende))
    kegel.rotation_euler = richtung.to_track_quat("Z", "Y").to_euler()
    kugel("Leseleuchte Leuchtmittel", 0.022, MT["birne"], tuple(ende + richtung * 0.07))
    LAMPEN.append(dict(name="Leseleuchte", ort=tuple(ende + richtung * 0.08), art="spot", richtung=tuple(richtung)))
    # Sideboard Eiche am Kniestock (vorne rechts)
    sb = M.SIDEBOARD
    x0, x1 = sb["x0"], sb["x0"] + sb["b"]
    y0, y1 = M.YR + 0.02, M.YR + 0.02 + sb["t"]
    bein = 0.12
    quader("Sideboard Korpus", x0, x1, y0, y1 - 0.004, bein, sb["h"], MT["eiche"], 0.004)
    for i in range(3):
        xa = x0 + 0.003 + i * sb["b"] / 3
        quader(f"Sideboard Front {i}", xa, xa + sb["b"] / 3 - 0.006, y1 - 0.004, y1 + 0.014, bein + 0.006,
               sb["h"] - 0.006, MT["eiche"], 0.002)
    for fx in (x0 + 0.05, x1 - 0.05):
        for fy in (y0 + 0.05, y1 - 0.05):
            zylinder("Sideboard Bein", 0.014, bein, MT["metall_schwarz"], ort=(fx, fy, 0), r2=0.01)
    top = sb["h"]
    buecher("Buecher Sideboard", (x0 + 0.85, y0 + 0.2, top), [(0.26, 0.19, 0.035), (0.24, 0.18, 0.03),
                                                             (0.23, 0.16, 0.028)], 4)
    drehkoerper("Vase Sideboard", [(0.0, 0), (0.05, 0.0), (0.07, 0.06), (0.068, 0.16), (0.04, 0.24), (0.03, 0.27),
                                   (0.034, 0.29), (0.0, 0.29)], MT["keramik"], (x0 + 0.62, y0 + 0.22, top))
    kerze("Kerze Sideboard", (x0 + 0.70, y0 + 0.30, top), 0.04, 0.16)
    bild_lehnen("Bild Sideboard gross", (x0 + 0.30, M.YR + 0.06, top), 0.40, 0.50, BILDER["sw"])
    bild_lehnen("Bild Sideboard klein", (x0 + 0.52, M.YR + 0.12, top), 0.30, 0.40, BILDER["erd2"])


def kratzbaum():
    """Vorhandener grosser Kratzbaum (anthrazit, ca. 0,9 x 0,55 x 1,8 m) an der geraden Wand vorne links."""
    k = M.KRATZBAUM
    x0, y0 = k["x0"], k["y0"]
    x1, y1 = x0 + k["b"], y0 + k["t"]
    P, S = MT["pluesch_grau"], MT["sisal"]

    def brett(nm, xa, xb, ya, yb, z, d=0.03):
        quader(f"Kratzbaum {nm}", xa, xb, ya, yb, z, z + d, P, 0.012)

    def pfosten(nm, x, y, za, zb, m=S, r=0.045):
        zylinder(f"Kratzbaum {nm}", r, zb - za, m, ort=(x, y, za))
    brett("Boden", x0, x1, y0, y1, 0, 0.04)
    quader("Kratzbaum Hoehle unten", x0 + 0.38, x1 - 0.02, y0 + 0.08, y1 - 0.02, 0.04, 0.40, P, 0.02)
    zylinder("Kratzbaum Eingang unten", 0.09, 0.012, MT["schwarz_matt"], ort=(x0 + 0.64, y0 + 0.085, 0.20),
             rot=(math.pi / 2, 0, 0))
    brett("Ebene 1", x0, x1 - 0.1, y0, y1, 0.55)
    brett("Ebene 1 Ausleger", x0 - 0.06, x0 + 0.28, y0 - 0.05, y0 + 0.25, 0.42)
    brett("Ebene 2", x0 + 0.05, x0 + 0.55, y0, y1, 0.95)
    brett("Ebene 2 Ausleger", x1 - 0.32, x1 + 0.04, y0 - 0.04, y0 + 0.30, 0.82)
    quader("Kratzbaum Hoehle oben", x1 - 0.50, x1, y0 + 0.02, y1, 1.32, 1.68, P, 0.025)
    zylinder("Kratzbaum Eingang oben", 0.06, 0.012, MT["schwarz_matt"], ort=(x1 - 0.25, y0 + 0.025, 1.50),
             rot=(math.pi / 2, 0, 0))
    brett("Liegeflaeche oben", x1 - 0.54, x1 + 0.02, y0, y1 + 0.0, 1.68, 0.07)
    brett("Ebene 3", x0, x0 + 0.40, y0 + 0.05, y1, 1.42)
    drehkoerper("Kratzbaum Haengematte", [(0.0, 0.0), (0.10, 0.01), (0.17, 0.06), (0.20, 0.13), (0.195, 0.13),
                                         (0.165, 0.065), (0.10, 0.017), (0.0, 0.008)], P, (x0 + 0.18, y0 + 0.08, 1.12))
    for i, (px, py, za, zb, m) in enumerate((
            (x0 + 0.10, y0 + 0.10, 0.04, 0.55, S), (x0 + 0.30, y1 - 0.10, 0.04, 0.55, P),
            (x0 + 0.12, y0 + 0.12, 0.58, 0.95, S), (x0 + 0.45, y1 - 0.12, 0.58, 0.95, P),
            (x1 - 0.20, y0 + 0.14, 0.58, 1.32, S), (x1 - 0.12, y1 - 0.08, 0.40, 1.32, P),
            (x0 + 0.10, y0 + 0.22, 0.98, 1.42, S), (x0 + 0.32, y1 - 0.10, 0.98, 1.42, P),
            (x0 + 0.08, y0 + 0.02, 0.0, 0.42, S))):
        pfosten(f"Pfosten {i}", px, py, za, zb, m, 0.05 if m is S else 0.04)
    zylinder("Kratzbaum Seil", 0.012, 0.30, S, ort=(x0 + 0.05, y0 - 0.02, 0.95 - 0.30))
    kugel("Kratzbaum Ball", 0.035, P, (x0 + 0.42, y0 - 0.01, 0.62))


def hinterer_bereich():
    """Vorhandenes Bambusregal an der hinteren Stirnwand bleibt, darueber ein grosses Bild (Erdtoene)."""
    r = M.REGAL_HINTEN
    x1 = M.L - 0.01
    x0 = x1 - r["t"]
    ya, yb = r["y0"], r["y0"] + r["b"]
    d = 0.018
    for nm, a, b_ in (("Seite r", ya, ya + d), ("Seite l", yb - d, yb)):
        quader(f"Regal {nm}", x0, x1, a, b_, 0, r["h"], MT["kiefer_regal"], 0.002)
    for i, z in enumerate((0.05, 0.36, 0.66, r["h"] - d)):
        quader(f"Regal Boden {i}", x0, x1, ya + d, yb - d, z, z + d, MT["kiefer_regal"], 0.002)
    buecher("Buecher Regal", (x0 + 0.15, ya + 0.06, 0.36 + d), [(0.24, 0.17, 0.035), (0.22, 0.16, 0.03),
                                                               (0.25, 0.18, 0.04), (0.21, 0.15, 0.025)], 11,
            stehend=True)
    drehkoerper("Schale Regal", [(0.0, 0), (0.05, 0.0), (0.09, 0.04), (0.095, 0.06), (0.0, 0.01)], MT["keramik"],
                (x0 + 0.15, (ya + yb) / 2, 0.66 + d))
    tischleuchte((x0 + 0.15, (ya + yb) / 2, r["h"]))
    bild_wand("Bild Stirnwand", (M.L - 0.012, -0.30, 1.72), 0.70, 0.95, BILDER["erd1"], (-1, 0, 0))


def tischleuchte(fuss):
    x, y, z = fuss
    drehkoerper("Tischleuchte Fuss", [(0.0, 0), (0.06, 0), (0.075, 0.08), (0.06, 0.18), (0.015, 0.24),
                                      (0.012, 0.30), (0.0, 0.30)], MT["keramik"], (x, y, z))
    drehkoerper("Tischleuchte Schirm", [(0.15, 0.0), (0.11, 0.2), (0.108, 0.2), (0.147, 0.0)],
                MT["schirm_leinen"], (x, y, z + 0.26))
    kugel("Tischleuchte Leuchtmittel", 0.025, MT["birne"], (x, y, z + 0.33))
    LAMPEN.append(dict(name="Tischleuchte", ort=(x, y, z + 0.33), art="punkt"))


def vorhaenge():
    """Bodenlange Vorhaenge Leinen-Optik an Deckenschiene vor dem Gaubenfenster (hintere Stirnwand), aufgezogen."""
    fg = M.FENSTER_G
    xv = M.L - 0.18
    fy0, fy1 = fg["ym"] - fg["b"] / 2, fg["ym"] + fg["b"] / 2
    quader("Vorhangschiene", xv - 0.012, xv + 0.012, fy0 - 0.36, M.GAUBE_Y1 - 0.04, M.GAUBE_H - 0.02, M.GAUBE_H,
           MT["lack_weiss"])
    for nm, ya, yb in (("rechts", fy0 - 0.34, fy0 + 0.07), ("links", fy1 - 0.07, M.GAUBE_Y1 - 0.06)):
        nx, nz = 60, 30
        verts, faces = [], []
        random.seed(len(nm))
        phase = random.random() * 6
        for j in range(nz + 1):
            z = 0.012 + (M.GAUBE_H - 0.03 - 0.012) * j / nz
            unten = 1 - j / nz
            for i in range(nx + 1):
                y = ya + (yb - ya) * i / nx
                a = 0.034 + 0.012 * unten
                xw = xv + a * math.sin((y - ya) / (yb - ya) * 2 * math.pi * 3.5 + phase) \
                    + 0.006 * math.sin(i * 0.7 + j * 0.4)
                verts.append((xw, y, z))
        for j in range(nz):
            for i in range(nx):
                faces.append((j * (nx + 1) + i, j * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i + 1,
                              (j + 1) * (nx + 1) + i))
        o = netz(f"Vorhang {nm}", verts, faces, MT["leinen"])
        so = o.modifiers.new("Dicke", "SOLIDIFY")
        so.thickness = 0.003
        glaetten(o, 180)


def deckenleuchte():
    d = M.DECKENLEUCHTE
    z = M.DECKE
    zylinder("Deckenleuchte Ring", d["d"] / 2, 0.05, MT["metall_schwarz"], ort=(d["x"], d["y"], z - 0.05), seg=96)
    zylinder("Deckenleuchte Opal", d["d"] / 2 - 0.012, 0.006, MT["opal"], ort=(d["x"], d["y"], z - 0.054), seg=96)
    LAMPEN.append(dict(name="Deckenleuchte", ort=(d["x"], d["y"], z - 0.06), art="decke"))


VOUTEN = []      # (name, xa, xb, y_wand, z_oberkante_wand, Raumrichtung)


def led_profile():
    """LED-Aluprofil an der Oberkante des rechten Kniestocks und der Nischen-Rueckwand: liegt auf einer schmalen
    Lichtvoute (Brett + Blende, weiss), damit es Abstand zur Schraege hat und das Licht die Schraege hochstreicht."""
    VOUTEN.extend([("rechts", 0.0, M.L, M.YR, M.KNIE, 1),
                   ("Nische", M.WAND_X, M.GAUBE_X0, M.NISCHE_Y, M.schraege_hoehe(M.NISCHE_Y), -1)])
    for nm, xa, xb, y, zt, sy in VOUTEN:
        zv = zt - 0.07

        def yy(a, b):
            return sorted((y + sy * a, y + sy * b))
        quader(f"Lichtvoute {nm} Brett", xa, xb, *yy(0, 0.10), zv - 0.018, zv, MT["lack_weiss"], 0.002)
        quader(f"Lichtvoute {nm} Blende", xa, xb, *yy(0.092, 0.11), zv - 0.03, zv + 0.045, MT["lack_weiss"], 0.002)
        quader(f"LED-Profil {nm}", xa + 0.02, xb - 0.02, *yy(0.055, 0.075), zv, zv + 0.012, MT["alu"])
        o = quader(f"LED-Profil {nm} Opal", xa + 0.02, xb - 0.02, *yy(0.058, 0.072), zv + 0.012, zv + 0.015,
                   MT["led"])
        o.visible_diffuse = o.visible_glossy = o.visible_shadow = False


def kerze(name, fuss, r, h):
    x, y, z = fuss
    zylinder(name, r, h, MT["wachs"], ort=(x, y, z))
    zylinder(f"{name} Docht", 0.0015, 0.012, MT["schwarz_matt"], ort=(x, y, z + h))
    f = kugel(f"{name} Flamme", 0.006, MT["flamme"], (x, y, z + h + 0.018), skala=(1, 1, 2.4))
    f.visible_shadow = False
    KERZEN.append((x, y, z + h + 0.02))


def buecher(name, ort, masse, seed, stehend=False):
    random.seed(seed)
    x, y, z = ort
    for i, (lb, bb, dk) in enumerate(masse):
        farbe = MT.setdefault(f"buch{seed}{i}", mat(f"Buch {seed}-{i}", hx(random.choice(BUCHFARBEN)), 0.6))
        if stehend:      # Ruecken zum Raum (-x), Dicke entlang y
            o = quader(f"{name} {i}", -bb / 2, bb / 2, 0, dk, 0, lb, farbe, 0.002)
            o.location = (x, y, z)
            y += dk + 0.002
        else:
            o = quader(f"{name} {i}", -lb / 2, lb / 2, -bb / 2, bb / 2, 0, dk, farbe, 0.002)
            o.location = (x, y, z)
            o.rotation_euler = (0, 0, math.radians(random.uniform(-12, 12)))
            s_ = quader(f"{name} {i} Seiten", -lb / 2 + 0.004, lb / 2 - 0.001, -bb / 2 + 0.004, bb / 2 - 0.004,
                        0.003, dk - 0.003, MT["buchseiten"])
            s_.parent = o
            s_.location = (0.002, 0, 0)
            z += dk


def bild_rahmen(name, b, h, bildmat_):
    """Rahmen 2 cm schwarz + Passepartout + Motiv, lokal: Flaeche in x-z, Vorderseite -y."""
    teile = []
    r, tief = 0.02, 0.022
    for i, (cx, cz, lx, lz) in enumerate(((0, h / 2 - r / 2, b, r), (0, -h / 2 + r / 2, b, r),
                                          (b / 2 - r / 2, 0, r, h), (-b / 2 + r / 2, 0, r, h))):
        teile.append(quader(f"{name} Rahmen {i}", cx - lx / 2, cx + lx / 2, -tief, 0, cz - lz / 2, cz + lz / 2,
                            MT["rahmen_schwarz"], 0.002))
    teile.append(quader(f"{name} Passepartout", -b / 2 + r, b / 2 - r, -0.006, -0.004, -h / 2 + r, h / 2 - r,
                        MT["passepartout"]))
    mb, mh = (b - 2 * r) * 0.72, (h - 2 * r) * 0.74
    mot = netz(f"{name} Motiv", [(-mb / 2, -0.0065, -mh / 2), (mb / 2, -0.0065, -mh / 2), (mb / 2, -0.0065, mh / 2),
                                 (-mb / 2, -0.0065, mh / 2)], [(0, 1, 2, 3)], bildmat_)
    uv = mot.data.uv_layers.new()
    for li, (u, v) in zip(range(4), ((0, 0), (1, 0), (1, 1), (0, 1))):
        uv.data[li].uv = (u, v)
    teile.append(mot)
    teile.append(quader(f"{name} Glas", -b / 2 + r, b / 2 - r, -0.0035, -0.003, -h / 2 + r, h / 2 - r, MT["glas"]))
    return teile


def bild_wand(name, mitte, b, h, bm, normale):
    g = gruppe(name, mitte, math.degrees(math.atan2(normale[1], normale[0])) + 90)
    an(g, *bild_rahmen(name, b, h, bm))


def bild_lehnen(name, fuss, b, h, bm):
    """An den Kniestock gelehnt (Vorderseite in +y), 7 Grad geneigt."""
    x, y, z = fuss
    g = gruppe(name, (x, y, z), 180)
    g.rotation_euler = (math.radians(7), 0, math.pi)
    teile = bild_rahmen(name, b, h, bm)
    for t_ in teile:
        t_.location.z += h / 2
    an(g, *teile)


# ====================================================================== Bilder (eigene Motive, prozedural)

def bilder_malen():
    def leinwand(w, h, farbe):
        a = np.ones((h, w, 3), np.float32) * np.array(farbe, np.float32)
        rng = np.random.default_rng(3)
        a += rng.normal(0, 0.008, (h, w, 1)).astype(np.float32)
        return a
    yy, xx = np.mgrid[0:1000, 0:700]
    # 1: Erdtoene, Boegen (gross, Stirnwand)
    e1 = leinwand(700, 1000, (0.91, 0.87, 0.80))
    cx, cy = 350, 640
    for r, c in ((300, (0.71, 0.42, 0.29)), (215, (0.85, 0.72, 0.57)), (130, (0.42, 0.29, 0.22))):
        mask = ((xx - cx) ** 2 + (yy - cy) ** 2 < r * r) & (yy < cy)
        mask |= (np.abs(xx - cx) < r) & (yy >= cy) & (yy < 900)
        e1[mask] = c
    sonne = (xx - 520) ** 2 + (yy - 210) ** 2 < 70 ** 2
    e1[sonne] = (0.55, 0.36, 0.25)
    # 2: Schwarz-Weiss, Pinselkreis
    yy2, xx2 = np.mgrid[0:800, 0:600]
    sw = leinwand(600, 800, (0.93, 0.92, 0.90))
    rr = np.sqrt((xx2 - 300) ** 2 + (yy2 - 380) ** 2)
    ang = np.arctan2(yy2 - 380, xx2 - 300)
    dicke = 26 + 14 * np.sin(ang * 3) + 10 * np.cos(ang * 7)
    ring = (np.abs(rr - 190) < dicke / 2) & (ang > -2.6)
    sw[ring] = (0.07, 0.07, 0.07)
    sw[(xx2 - 395) ** 2 + (yy2 - 250) ** 2 < 22 ** 2] = (0.07, 0.07, 0.07)
    # 3: Erdtoene, Landschaft in Baendern
    yy3, xx3 = np.mgrid[0:800, 0:600]
    e2 = leinwand(600, 800, (0.90, 0.85, 0.77))
    e2[(xx3 - 300) ** 2 + (yy3 - 330) ** 2 < 95 ** 2] = (0.76, 0.50, 0.33)
    h1 = 470 + 40 * np.sin(xx3 / 95.0)
    e2[yy3 > h1] = (0.62, 0.47, 0.35)
    h2 = 590 + 30 * np.sin(xx3 / 70.0 + 2)
    e2[yy3 > h2] = (0.36, 0.26, 0.20)
    return {"erd1": bildmat("Motiv Boegen", e1), "sw": bildmat("Motiv Kreis SW", sw),
            "erd2": bildmat("Motiv Landschaft", e2)}


# ====================================================================== Licht

LAMPEN, KERZEN = [], []


def flaechen_led(name, ort, richtung, laenge, breite, watt, xachse=(1, 0, 0), spread=150):
    d = bpy.data.lights.new(name, "AREA")
    d.shape, d.size, d.size_y = "RECTANGLE", laenge, breite
    d.energy, d.color = watt, WARM
    d.spread = math.radians(spread)
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.location = ort
    ausrichten(o, richtung, xachse)
    o.visible_camera = False
    return o


def punkt(name, ort, watt, radius=0.03, farbe=WARM):
    d = bpy.data.lights.new(name, "POINT")
    d.energy, d.color, d.shadow_soft_size = watt, farbe, radius
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.location = ort
    o.visible_camera = False
    return o


def spot(name, ort, richtung, watt, winkel=70, radius=0.02):
    d = bpy.data.lights.new(name, "SPOT")
    d.energy, d.color, d.shadow_soft_size = watt, WARM, radius
    d.spot_size, d.spot_blend = math.radians(winkel), 0.6
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.location = ort
    ausrichten(o, richtung)
    o.visible_camera = False
    return o


def welt(art):
    w = s.world
    n, l = w.node_tree.nodes, w.node_tree.links
    bg = n["Background"]
    if art in ("tag", "daemmerung"):
        horizont, zenit, staerke = {"tag": ((0.95, 0.96, 1.0), (0.42, 0.6, 0.95), 3.5),
                                    "daemmerung": ((0.55, 0.42, 0.45), (0.07, 0.10, 0.24), 0.7)}[art]
        geo = n.new("ShaderNodeTexCoord")
        sep = n.new("ShaderNodeSeparateXYZ")
        l.new(geo.outputs["Generated"], sep.inputs[0])
        ramp = n.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[0].color = 0.5, (*horizont, 1)
        ramp.color_ramp.elements[1].position, ramp.color_ramp.elements[1].color = 0.95, (*zenit, 1)
        l.new(sep.outputs["Z"], ramp.inputs["Fac"])
        l.new(ramp.outputs["Color"], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = staerke
    else:   # abend: tiefes Nachtblau
        bg.inputs["Color"].default_value = (0.05, 0.08, 0.2, 1)
        bg.inputs["Strength"].default_value = 0.04


def licht(art):
    welt(art)
    an_ = {
        "tag": dict(sonne=True),
        "abend_led": dict(led=True),
        "abend_voll": dict(led=True, lampen=True, decke=True, kerzen=True),
        "daemmerung": dict(led=True, lampen=True, kerzen=True),
    }[art]
    if an_.get("sonne"):
        d = bpy.data.lights.new("Sonne", "SUN")
        d.energy, d.angle, d.color = 3.2, math.radians(1.2), (1.0, 0.95, 0.88)
        o = bpy.data.objects.new("Sonne", d)
        bpy.context.collection.objects.link(o)
        ausrichten(o, (-0.80, -0.25, -0.55))     # durch das Gaubenfenster (Stirnwand)
    if an_.get("led"):
        MT["led"].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 18.0
        # Kniestock-Lichtleisten: strahlen schraeg nach oben auf die Schraegen
        for nm, xa, xb, y, zt, sy in VOUTEN:
            lg = xb - xa - 0.04
            flaechen_led(f"LED Voute {nm}", ((xa + xb) / 2, y + sy * 0.065, zt - 0.054), (0, sy * 0.30, 0.95), lg,
                         0.012, 14 * lg, spread=130)
        flaechen_led("LED Lamellen", ((M.GAUBE_X0 + M.L) / 2, M.GAUBE_Y1 - 0.046, M.GAUBE_H - 0.03),
                     (0, 0.35, -0.94), M.L - M.GAUBE_X0 - 0.06, 0.012, 30, spread=120)
        lb = M.LOWBOARD
        flaechen_led("LED Lowboard", (lb["x0"] + lb["b"] / 2, M.GAUBE_Y1 - 0.03 - lb["t"] + 0.06, lb["z0"] - 0.008),
                     (0, 0, -1), lb["b"] - 0.1, 0.02, 9)
    if an_.get("lampen"):
        MT["birne"].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 30.0
        for lp in LAMPEN:
            if lp["art"] == "kuppel":
                punkt(lp["name"] + " Licht", lp["ort"], 26, 0.03)
            elif lp["art"] == "spot":
                spot(lp["name"] + " Licht", lp["ort"], lp["richtung"], 30, 75)
            elif lp["art"] == "punkt":
                punkt(lp["name"] + " Licht", lp["ort"], 10, 0.03)
    if an_.get("decke"):
        MT["opal"].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 2.5
        lp = [x for x in LAMPEN if x["art"] == "decke"][0]
        d = bpy.data.lights.new("Deckenleuchte Licht", "AREA")
        d.shape, d.size, d.energy, d.color = "DISK", M.DECKENLEUCHTE["d"] - 0.03, 22, WARM
        o = bpy.data.objects.new("Deckenleuchte Licht", d)
        bpy.context.collection.objects.link(o)
        o.location = lp["ort"]
        o.visible_camera = False
    if an_.get("kerzen"):
        MT["flamme"].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 25.0
        for i, k in enumerate(KERZEN):
            punkt(f"Kerze Licht {i}", k, 0.35, 0.008, KERZE)


# ====================================================================== Rendern + Rauschfilter

PAESSE = ["DiffDir", "DiffInd", "DiffCol", "GlossDir", "GlossInd", "GlossCol", "TransDir", "TransInd", "TransCol",
          "Emit", "Env", "Normal", "Depth", "Image"]


def paesse(ordner):
    vl = s.view_layers[0]
    for k in ("diffuse_direct", "diffuse_indirect", "diffuse_color", "glossy_direct", "glossy_indirect",
              "glossy_color", "transmission_direct", "transmission_indirect", "transmission_color", "emit",
              "environment", "normal", "z"):
        setattr(vl, "use_pass_" + k, True)
    s.use_nodes = True
    nt = s.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new("CompositorNodeRLayers")
    comp = nt.nodes.new("CompositorNodeComposite")
    nt.links.new(rl.outputs["Image"], comp.inputs["Image"])
    fo = nt.nodes.new("CompositorNodeOutputFile")
    fo.base_path = ordner
    fo.format.file_format, fo.format.color_depth, fo.format.exr_codec = "OPEN_EXR", "32", "ZIP"
    fo.file_slots.clear()
    for p in PAESSE:
        fo.file_slots.new(p + "_")
        nt.links.new(rl.outputs[p], fo.inputs[p + "_"])


def lade(pfad):
    img = bpy.data.images.load(pfad, check_existing=False)
    img.colorspace_settings.name = "Non-Color"
    w, h = img.size
    arr = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(arr)
    bpy.data.images.remove(img)
    return arr.reshape(h, w, 4)


def atrous(bild, n, z, alb, stufen, sn=48, sz=0.015, sa=0.18):
    """Kantenerhaltender A-Trous-Filter (B3-Spline), gefuehrt von Normale, relativer Tiefe und Albedo."""
    H, W, _ = bild.shape
    k1 = np.array([1 / 16, 1 / 4, 3 / 8, 1 / 4, 1 / 16], np.float32)
    out = bild
    for i in range(stufen):
        sp = 2 ** i
        p = 2 * sp
        P = np.pad(out, ((p, p), (p, p), (0, 0)), mode="edge")
        Np = np.pad(n, ((p, p), (p, p), (0, 0)), mode="edge")
        Zp = np.pad(z, ((p, p), (p, p)), mode="edge")
        Ap = np.pad(alb, ((p, p), (p, p), (0, 0)), mode="edge")
        acc = np.zeros_like(out)
        ws = np.zeros((H, W), np.float32)
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                ys, xs = slice(p + dy * sp, p + dy * sp + H), slice(p + dx * sp, p + dx * sp + W)
                wn = np.clip((n * Np[ys, xs]).sum(-1), 0, 1) ** sn
                wz = np.exp(-np.abs(z - Zp[ys, xs]) / (sz * z * (1 + 0.5 * sp) + 1e-3))
                wa = np.exp(-((alb - Ap[ys, xs]) ** 2).sum(-1) / (sa * sa))
                ww = (k1[dy + 2] * k1[dx + 2]) * wn * wz * wa
                acc += ww[..., None] * P[ys, xs]
                ws += ww
        out = acc / np.maximum(ws, 1e-8)[..., None]
    return out


def speichern(rgb, pfad, weissabgleich=(1, 1, 1)):
    H, W, _ = rgb.shape
    img = bpy.data.images.new("Ergebnis", W, H, alpha=True, float_buffer=True)
    for name in ("Linear Rec.709", "Linear"):
        try:
            img.colorspace_settings.name = name
            break
        except TypeError:
            pass
    rgba = np.ones((H, W, 4), np.float32)
    rgba[..., :3] = np.maximum(rgb, 0) * np.array(weissabgleich, np.float32)
    img.pixels.foreach_set(rgba.ravel())
    s.render.image_settings.file_format = "PNG"
    s.render.image_settings.color_depth = "8"
    img.save_render(pfad, scene=s)


def zusammensetzen(ordner, ziel, weissabgleich):
    P = {k: lade(os.path.join(ordner, f"{k}_0001.exr")) for k in PAESSE}
    n = P["Normal"][..., :3]
    z = P["Depth"][..., 0]
    alb = P["DiffCol"][..., :3]
    rgb = lambda k: P[k][..., :3]  # noqa: E731
    roh = (rgb("DiffCol") * (rgb("DiffDir") + rgb("DiffInd")) + rgb("GlossCol") * (rgb("GlossDir") + rgb("GlossInd"))
           + rgb("TransCol") * (rgb("TransDir") + rgb("TransInd")) + rgb("Emit") + rgb("Env"))
    abw = np.abs(roh - rgb("Image")).mean() / max(rgb("Image").mean(), 1e-6)
    print(f"WOHNZIMMER: Pass-Rekonstruktion Abweichung {abw * 100:.2f} %")
    dind = atrous(rgb("DiffInd"), n, z, alb, 5)
    ddir = atrous(rgb("DiffDir"), n, z, alb, 2, sa=0.12)
    gind = atrous(rgb("GlossInd"), n, z, rgb("GlossCol"), 3)
    tind = atrous(rgb("TransInd"), n, z, rgb("TransCol"), 4)
    tdir = atrous(rgb("TransDir"), n, z, rgb("TransCol"), 2)
    bild = (alb * (ddir + dind) + rgb("GlossCol") * (rgb("GlossDir") + gind)
            + rgb("TransCol") * (tdir + tind) + rgb("Emit") + rgb("Env"))
    speichern(bild, ziel, weissabgleich)
    speichern(rgb("Image"), ziel.replace(".png", "_roh.png"), weissabgleich)


# ====================================================================== Aufbau

BILDER = bilder_malen()
rohbau()
ausstattung_bestand()
sockelleisten()
x_lam = lamellenwand()
tv_ecke(x_lam)
couchbereich()
leseecke()
kratzbaum()
hinterer_bereich()
vorhaenge()
deckenleuchte()
led_profile()
licht(V["licht"])

# Kamera
if V["mm"]:
    kam = st.kamera(V["ort"], V["ziel"], V["mm"])
    kam.data.sensor_width = 36
else:   # Draufsicht ohne Decke
    kam = st.kamera(V["ort"], V["ziel"], 50)
    kam.data.type, kam.data.ortho_scale = "ORTHO", 9.6
    for o in s.objects:
        if o.type == "MESH" and (o.name.startswith(("Decke", "Schraege", "Gaubendecke", "Gauben-Zierleiste",
                                                    "Deckenleuchte", "LED Lamelle Blende", "Vorhangschiene",
                                                    "Rauchmelder", "Zwickel", "Nische Schraege", "Flur Decke",
                                                    "Laibung DF oben", "Kopfband"))):
            o.hide_render = True

lang = E["breite"] // (2 if A["vorschau"] else 1)
kurz = lang * 3 // 4
s.render.resolution_x, s.render.resolution_y = (kurz, lang) if V["hoch"] else (lang, kurz)
s.render.resolution_percentage = 100
out = os.path.abspath(A["out"])
os.makedirs(out, exist_ok=True)
ziel = os.path.join(out, V["datei"] + ".png")

if E["form"]:
    s.render.engine = "BLENDER_WORKBENCH"
    sh = s.display.shading
    sh.light, sh.color_type = "STUDIO", "MATERIAL"
    sh.show_cavity = True
    s.display.render_aa = "8"
    s.view_settings.view_transform = "Standard"
    s.render.filepath = ziel.replace(".png", "_form.png")
    bpy.ops.render.render(write_still=True)
else:
    s.cycles.samples = 48 if A["vorschau"] else (E["samples"] or {"tag": 128, "abend_led": 192, "abend_voll": 192,
                                                                   "daemmerung": 160}[V["licht"]])
    s.cycles.use_adaptive_sampling = True
    s.cycles.adaptive_threshold = 0.015
    s.cycles.use_denoising = False
    s.cycles.sample_clamp_direct = 12.0
    s.cycles.sample_clamp_indirect = 2.0
    s.cycles.blur_glossy = 1.0
    s.cycles.caustics_reflective = s.cycles.caustics_refractive = False
    s.cycles.max_bounces, s.cycles.diffuse_bounces, s.cycles.glossy_bounces = 8, 4, 3
    s.cycles.transmission_bounces, s.cycles.transparent_max_bounces = 4, 16
    s.cycles.use_light_tree = True
    s.render.threads_mode = "AUTO"
    s.view_settings.exposure = {"tag": 2.0, "abend_led": -0.4, "abend_voll": -0.2, "daemmerung": 0.0}[V["licht"]]
    wb = {"tag": (1, 1, 1), "abend_led": (0.86, 1.0, 1.32), "abend_voll": (0.86, 1.0, 1.32),
          "daemmerung": (0.9, 1.0, 1.2)}[V["licht"]]
    ordner = os.path.join(out, "paesse_" + E["ansicht"])
    os.makedirs(ordner, exist_ok=True)
    if E["belichtung"] is not None:
        s.view_settings.exposure = E["belichtung"]
    if not E["nur_post"]:
        paesse(ordner)
        s.render.filepath = os.path.join(out, "tmp_" + E["ansicht"])
        bpy.ops.render.render(write_still=False)
    zusammensetzen(ordner, ziel, wb)
print("WOHNZIMMER FERTIG", ziel)
