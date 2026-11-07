"""Mittelmotor-Supersportwagen – Proportionen aus Referenzfotos (Lamborghini Huracán, Audi R8, Porsche 911 GT3;
Wikimedia Commons, nur lokal angesehen), Formensprache gemittelt. Kein Nachbau eines bestimmten Modells, keine Logos
(Design- und Markenschutz). Messwerte und Quellen: 3d-studio/referenzen/SPORTWAGEN-PROPORTIONEN.md

X = Laenge (Front bei +X), Y = Breite, Z = Hoehe, Boden z = 0. Laenge 4,35 m · Breite 1,93 · Hoehe 1,15 · Radstand 2,62.
"""
import math

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

import studio as st

ACHSE_V, ACHSE_H = 1.31, -1.31
RAD_R, SPUR = 0.335, 0.83
FELGE_R = 0.262                       # 20 Zoll

# Stationen (aus der Seitenansicht gemessen, d = Abstand zur Nasenspitze, x = 2,31 - 0,978·d):
#   x, Boden, max. Breite, Hoehe Charakterlinie, Schulterhoehe, Schulterbreite, Mitte oben (Haube/Deck), Kabine 0..1
STATIONEN = [
    (2.310, 0.15, 0.84, 0.29, 0.42, 0.78, 0.40, 0.0),    # Front breit und stumpf (kein Keil in der Draufsicht)
    (2.232, 0.13, 0.92, 0.30, 0.48, 0.87, 0.45, 0.0),
    (2.017, 0.12, 0.95, 0.33, 0.58, 0.91, 0.52, 0.0),
    (1.674, 0.12, 0.955, 0.39, 0.67, 0.92, 0.58, 0.0),
    (1.332, 0.12, 0.962, 0.43, 0.75, 0.925, 0.655, 0.0),   # Vorderachse: Kotfluegel ueber der Haube
    (1.088, 0.12, 0.95, 0.45, 0.78, 0.89, 0.735, 0.0),
    (0.941, 0.12, 0.93, 0.46, 0.80, 0.86, 0.835, 0.22),    # Fuss A-Saeule, weit vorn (Cab-forward)
    (0.598, 0.12, 0.905, 0.46, 0.80, 0.84, 0.86, 0.70),
    (0.237, 0.12, 0.90, 0.46, 0.82, 0.835, 0.88, 0.93),
    (-0.135, 0.12, 0.905, 0.47, 0.84, 0.845, 0.90, 1.0),  # Dachspitze 1,15 m
    (-0.575, 0.12, 0.93, 0.48, 0.87, 0.88, 0.92, 0.75),
    (-0.966, 0.125, 0.955, 0.50, 0.90, 0.93, 0.93, 0.36),  # Motorabdeckung
    (-1.310, 0.13, 0.965, 0.51, 0.92, 0.95, 0.92, 0.15),  # Hinterachse: breite Haunches
    (-1.600, 0.15, 0.955, 0.52, 0.91, 0.93, 0.90, 0.03),
    (-1.850, 0.18, 0.92, 0.53, 0.88, 0.89, 0.875, 0.0),
    (-1.950, 0.24, 0.88, 0.53, 0.84, 0.84, 0.84, 0.0),
    (-2.010, 0.30, 0.80, 0.53, 0.78, 0.76, 0.78, 0.0),
    (-2.040, 0.36, 0.74, 0.53, 0.70, 0.70, 0.70, 0.0),   # Heckabschluss
]
DACH = {"kante_b": 0.55, "kante_z": 1.10, "mitte_z": 1.15, "einzug": 0.07}
# Punkt-Indizes je Halbschnitt: 0 Boden-Mitte · 1 Schweller unten · 2 Schweller oben · 3 Charakterlinie · 4 unter Schulter
# 5 Schulter · 6 Guertel/Deck · 7 Fenster-Mitte · 8 Dachkante · 9 Dach-Mitte
CREASES = {2: 0.85, 3: 0.92, 5: 0.9, 6: 0.85, 8: 0.7}


def _querschnitt(s):
    x, zb, w, zm, zsh, wsh, zc, c = s
    deck = [                                   # Kotfluegel-Plateau aussen, dann Tal zur Haubenmitte
        (wsh * 0.84, zsh - 0.012),
        (wsh * 0.58, zc + (zsh - zc) * 0.30),
        (wsh * 0.26, zc + 0.004),
        (0.0, zc),
    ]
    zg = zsh + 0.03
    kabine = [
        (wsh - 0.05, zg),
        ((wsh - 0.05 + DACH["kante_b"]) / 2 - DACH["einzug"], (zg + DACH["kante_z"]) / 2 + 0.02),
        (DACH["kante_b"], DACH["kante_z"]),
        (0.0, DACH["mitte_z"]),
    ]
    oben = [(dy + (ky - dy) * c, dz + (kz - dz) * c) for (dy, dz), (ky, kz) in zip(deck, kabine)]
    # Flanke: Schweller deutlich eingezogen, scharfe Charakterlinie, darueber leicht eingezogene Flaeche (Schattenkante)
    unten = [(0.0, zb), (w * 0.88, zb), (w * 0.955, zb + 0.09), (w, zm), (w - 0.03, zm + (zsh - zm) * 0.45), (wsh, zsh)]
    return x, unten + oben


def _material_index(xa, xb, j, ca, cb):
    """0 Lack · 1 Glas · 2 Schwarz glaenzend (Einlaesse, Schweller, Diffusor) · 3 Unterboden"""
    xm = (xa + xb) / 2
    if j == 0:
        return 3
    if j in (6, 7) and min(ca, cb) >= 0.5 and -0.66 < xm < 0.9:
        return 1                                          # Seitenscheiben mit spitzem Ende hinten
    if j == 8 and 0.24 < xm < 0.96 and min(ca, cb) > 0.04:
        return 1                                          # Frontscheibe zwischen den A-Saeulen
    if j == 8 and -1.12 < xm < -0.62:
        return 2                                          # Motorabdeckung: dunkle Lamellen (nicht durchsichtig)
    if j == 1 and -0.98 < xm < 0.98:
        return 2                                          # schwarzer Seitenschweller
    if j in (1, 2, 3) and xm > 2.06:
        return 2                                          # grosse Front-Lufteinlaesse
    if j in (0, 1, 2) and xm < -1.84:
        return 2                                          # Diffusor
    return 0


def karosserie(lack, glas, schwarz, unterboden=None):
    me = bpy.data.meshes.new("Karosserie")
    bm = bmesh.new()
    reihen, cs = [], []
    for s in STATIONEN:
        x, pts = _querschnitt(s)
        cs.append(s[7])
        reihen.append([bm.verts.new((x, y, z)) for y, z in pts])
    for i in range(len(reihen) - 1):
        for j in range(len(reihen[i]) - 1):
            f = bm.faces.new((reihen[i][j], reihen[i + 1][j], reihen[i + 1][j + 1], reihen[i][j + 1]))
            f.material_index = _material_index(STATIONEN[i][0], STATIONEN[i + 1][0], j, cs[i], cs[i + 1])
    vorn = bm.faces.new(list(reversed(reihen[0])))
    vorn.material_index = 2
    hinten = bm.faces.new(reihen[-1])
    hinten.material_index = 2
    crease = bm.edges.layers.float.get("crease_edge") or bm.edges.layers.float.new("crease_edge")
    for i in range(len(reihen) - 1):
        for j, staerke in CREASES.items():
            if j in (6, 8) and min(cs[i], cs[i + 1]) < 0.3:
                staerke = 0.5 if j == 6 else 0.0                # auf Haube/Deck weichere Kante
            e = bm.edges.get((reihen[i][j], reihen[i + 1][j]))
            if e and staerke:
                e[crease] = staerke
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("Karosserie", me)
    bpy.context.collection.objects.link(o)
    tief = unterboden or st.material("Tiefschwarz", base=(0.0015, 0.0015, 0.0017), roughness=0.95, specular=0.03)
    for m in (lack, glas, schwarz, tief):
        me.materials.append(m)
    spiegel_mod = o.modifiers.new("Spiegel", "MIRROR")
    spiegel_mod.use_axis = (False, True, False)
    spiegel_mod.use_clip = True
    sub = o.modifiers.new("Glatt", "SUBSURF")
    sub.levels = sub.render_levels = 3
    sub.use_creases = True
    _anwenden(o)
    _radhaeuser(o)
    _einlaesse(o, tief)
    st.glatt(o)
    o.data.use_auto_smooth = True
    o.data.auto_smooth_angle = math.radians(45)
    return o


def _anwenden(o):
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def _schnitt(body, cutter, material=None):
    """Boolean-Differenz; mit material bekommen die Schnittflaechen dessen Material (saubere Kante, Innenleben schwarz)."""
    if material is not None:
        cutter.data.materials.append(material)
    b = body.modifiers.new("Schnitt", "BOOLEAN")
    b.operation, b.solver, b.object = "DIFFERENCE", "EXACT", cutter
    if material is not None:
        b.material_mode = "TRANSFER"
    _anwenden(body)
    bpy.data.objects.remove(cutter)


def _radhaeuser(body):
    for x in (ACHSE_V, ACHSE_H):
        for sy in (1, -1):
            bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=RAD_R + 0.03, depth=0.5,
                                                location=(x, sy * 1.0, RAD_R + 0.005), rotation=(math.pi / 2, 0, 0))
            _schnitt(body, bpy.context.object)


def _einlaesse(body, schwarz):   # schwarz = tiefschwarzes Innenleben
    """Echte Vertiefungen mit schwarzem Innenleben: Seiteneinlass hinter der Tuer, zwei Front-Einlaesse."""
    for sy in (1, -1):
        # Seiteneinlass: keilfoermig, oben breiter, laeuft nach vorn spitz aus
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.80, sy * 1.02, 0.66))
        c = bpy.context.object
        c.scale = (0.46, 0.22, 0.20)
        c.rotation_euler = (sy * math.radians(8), math.radians(-12), 0)
        _schnitt(body, c, schwarz)
        # Front-Einlass unter dem Scheinwerfer
        bpy.ops.mesh.primitive_cube_add(size=1, location=(2.22, sy * 0.62, 0.215))
        c = bpy.context.object
        c.scale = (0.30, 0.42, 0.11)
        c.rotation_euler = (0, math.radians(-10), sy * math.radians(14))
        _schnitt(body, c, schwarz)


def radhausschalen(schwarz):
    teile = []
    for x in (ACHSE_V, ACHSE_H):
        for sy in (1, -1):
            bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=RAD_R + 0.025, depth=0.36, end_fill_type="NOTHING",
                                                location=(x, sy * 0.78, RAD_R + 0.005), rotation=(math.pi / 2, 0, 0))
            rohr = bpy.context.object
            bpy.ops.mesh.primitive_circle_add(vertices=64, radius=RAD_R + 0.025, fill_type="NGON",
                                              location=(x, sy * 0.60, RAD_R + 0.005), rotation=(math.pi / 2, 0, 0))
            deckel = bpy.context.object
            for o in (rohr, deckel):
                o.name = "Radhaus"
                st.zuweisen(o, schwarz)
                teile.append(o)
    return teile


def rad(x, sy, gummi, felge, scheibe, sattel):
    """Niederquerschnittsreifen (Torus), 20-Zoll-Felge mit 5 Y-Speichen, grosse Bremse mit Sattel."""
    teile = []
    y = sy * SPUR
    breite = 0.25 if x > 0 else 0.30
    flanke = RAD_R - FELGE_R
    bpy.ops.mesh.primitive_torus_add(major_segments=128, minor_segments=24, major_radius=FELGE_R + flanke / 2,
                                     minor_radius=flanke / 2 + 0.004, location=(x, y, RAD_R), rotation=(math.pi / 2, 0, 0))
    r = bpy.context.object
    r.name = "Reifen"
    r.scale = (1, 1, breite / (flanke + 0.008))
    st.glatt(r)
    st.zuweisen(r, gummi)
    teile.append(r)
    aussen = y + sy * (breite / 2 - 0.012)
    # Felgenbett (Ring) mit sichtbarer Tiefe
    bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=FELGE_R + 0.004, depth=breite * 0.92, location=(x, y, RAD_R),
                                        rotation=(math.pi / 2, 0, 0), end_fill_type="NOTHING")
    bett = bpy.context.object
    bett.name = "Felgenbett"
    st.zuweisen(bett, felge)
    teile.append(bett)
    bpy.ops.mesh.primitive_torus_add(major_segments=128, minor_segments=12, major_radius=FELGE_R, minor_radius=0.012,
                                     location=(x, aussen, RAD_R), rotation=(math.pi / 2, 0, 0))
    horn = bpy.context.object
    horn.name = "Felgenhorn"
    st.zuweisen(horn, felge)
    teile.append(horn)
    for k in range(5):                                    # 5 Y-Speichen: Stamm + zwei Aeste
        w = 2 * math.pi * k / 5
        for ast, laenge, mitte, dicke in ((0.0, 0.12, 0.085, 0.034), (0.20, 0.13, 0.19, 0.022), (-0.20, 0.13, 0.19, 0.022)):
            ww = w + ast
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x + math.cos(ww) * mitte, aussen - sy * 0.03,
                                                              RAD_R + math.sin(ww) * mitte))
            sp = bpy.context.object
            sp.scale = (laenge, 0.035, dicke)
            sp.rotation_euler = (0, -ww, 0)
            b2 = sp.modifiers.new("Kante", "BEVEL")
            b2.width, b2.segments = 0.006, 2
            st.zuweisen(sp, felge)
            teile.append(sp)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.06, depth=0.06, location=(x, aussen - sy * 0.035, RAD_R),
                                        rotation=(math.pi / 2, 0, 0))
    nabe = bpy.context.object
    st.zuweisen(nabe, felge)
    teile.append(nabe)
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.19, depth=0.032, location=(x, aussen - sy * 0.11, RAD_R),
                                        rotation=(math.pi / 2, 0, 0))
    bs = bpy.context.object
    st.zuweisen(bs, scheibe)
    teile.append(bs)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x - 0.13, aussen - sy * 0.09, RAD_R + 0.105))
    sa = bpy.context.object
    sa.scale = (0.19, 0.05, 0.085)
    sa.rotation_euler = (0, math.radians(-40), 0)
    b3 = sa.modifiers.new("Kante", "BEVEL")
    b3.width, b3.segments = 0.016, 3
    st.zuweisen(sa, sattel)
    teile.append(sa)
    return teile


def _treffer(body, ursprung, richtung):
    deps = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(body, deps)
    loc, nor, _, _ = bvh.ray_cast(Vector(ursprung), Vector(richtung).normalized())
    return loc, nor


def leiste(body, punkte_aussen, richtung, material, dicke=0.012, abstand=0.004, name="Leiste"):
    """Duenne Leiste auf der Karosserie (Punkte von aussen auf die Oberflaeche projiziert)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = dicke
    cu.bevel_resolution = 4
    sp = cu.splines.new("POLY")
    pts = []
    for p in punkte_aussen:
        loc, nor = _treffer(body, p, richtung)
        if loc is not None:
            pts.append(loc + nor * abstand)
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (*p, 1)
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    cu.materials.append(material)
    return o


def innenraum(material):
    """Grobe Innenausstattung, nur damit die Kabine Tiefe bekommt: Schalensitze, Lenkrad, Armaturenbrett."""
    teile = []
    for sy in (1, -1):
        for name, ort, skal, rot in (("Sitzflaeche", (-0.32, sy * 0.36, 0.30), (0.50, 0.42, 0.10), 0),
                                     ("Lehne", (-0.62, sy * 0.36, 0.62), (0.12, 0.42, 0.62), -18)):
            bpy.ops.mesh.primitive_cube_add(size=1, location=ort)
            o = bpy.context.object
            o.name = name
            o.scale = skal
            o.rotation_euler = (0, math.radians(rot), 0)
            bv = o.modifiers.new("Rund", "BEVEL")
            bv.width, bv.segments = 0.05, 3
            st.zuweisen(o, material)
            teile.append(o)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.42, 0, 0.66))
    a = bpy.context.object
    a.name = "Armaturenbrett"
    a.scale = (0.40, 1.50, 0.22)
    st.zuweisen(a, material)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.17, minor_radius=0.018, location=(0.12, -0.36, 0.70),
                                     rotation=(0, math.radians(68), 0))
    lr = bpy.context.object
    lr.name = "Lenkrad"
    st.zuweisen(lr, material)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.74, 0, 0.60))
    tw = bpy.context.object
    tw.name = "Trennwand"
    tw.scale = (0.03, 1.0, 0.80)
    st.zuweisen(tw, material)
    return teile + [a, lr, tw]


def details(body, licht_vorn, licht_hinten, schwarz):
    teile = []
    for sy in (1, -1):
        # Scheinwerfer: flacher, kantiger Pfeil an der Fahrzeugecke (Tagfahrlicht-Strich + Unterkante)
        oben = [(3.0, sy * (0.40 + 0.50 * t), 0.455 + 0.07 * t) for t in [i / 14 for i in range(15)]]
        unten = [(3.0, sy * (0.62 + 0.26 * t), 0.405 + 0.09 * t) for t in [i / 10 for i in range(11)]]
        teile.append(leiste(body, oben, (-1, 0, -0.25), licht_vorn, dicke=0.009, name="Tagfahrlicht"))
        teile.append(leiste(body, unten, (-1, 0, -0.25), licht_vorn, dicke=0.006, name="Scheinwerfer"))
        # Tuerfuge + Tuergriff-Kante
        fuge = []
        fuge += [(0.86, sy * 2.0, 0.24 + 0.55 * t / 10) for t in range(11)]
        fuge += [(0.86 - 1.42 * t / 12, sy * 2.0, 0.24) for t in range(1, 13)]
        fuge += [(-0.56, sy * 2.0, 0.24 + 0.62 * t / 10) for t in range(1, 11)]
        teile.append(leiste(body, fuge, (0, -sy, 0), schwarz, dicke=0.0025, abstand=0.0, name="Tuerfuge"))
        # Rueckleuchte: schmaler roter Strich ueber dem Heck, zieht in die Flanke
        heck = [(-3.0, sy * (0.10 + 0.72 * t), 0.74 - 0.02 * t) for t in [i / 16 for i in range(17)]]
        teile.append(leiste(body, heck, (1, 0, 0), licht_hinten, dicke=0.011, name="Rueckleuchte"))
        # Auspuff: zwei Endrohre im Diffusor
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.045, depth=0.12, location=(-2.03, sy * 0.13, 0.28),
                                            rotation=(0, math.pi / 2, 0))
        ar = bpy.context.object
        ar.name = "Endrohr"
        st.zuweisen(ar, st.material("Endrohr", base=(0.06, 0.06, 0.065), metallic=1.0, roughness=0.3))
        teile.append(ar)
    # Frontsplitter: duenne schwarze Lippe unter der Nase
    bpy.ops.mesh.primitive_cube_add(size=1, location=(2.17, 0, 0.115))
    sp = bpy.context.object
    sp.name = "Splitter"
    sp.scale = (0.24, 1.62, 0.018)
    bv = sp.modifiers.new("Kante", "BEVEL")
    bv.width, bv.segments = 0.008, 2
    st.zuweisen(sp, schwarz)
    teile.append(sp)
    # Diffusor-Finnen
    for yy in (-0.42, -0.21, 0.21, 0.42):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-1.94, yy, 0.21))
        fi = bpy.context.object
        fi.name = "Finne"
        fi.scale = (0.22, 0.012, 0.12)
        st.zuweisen(fi, schwarz)
        teile.append(fi)
    return teile
