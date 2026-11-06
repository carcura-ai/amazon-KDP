"""Eigener Mittelmotor-Sportwagen (keine Marke, kein Vorbild-Modell) aus Querschnitten gebaut.

Masse (Meter, realistische Klasse): Laenge 4,45 · Breite 1,95 · Hoehe 1,18 · Radstand 2,62 · Rad 0,68.
X = Laenge (Front bei +X), Y = Breite, Z = Hoehe, Boden bei z = 0.
"""
import math

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

import studio as st

ACHSE_V, ACHSE_H = 1.31, -1.31
RAD_R, SPUR = 0.34, 0.83

# Stationen: x, Boden, max. Breite, Hoehe der max. Breite, Schulter-Hoehe, Schulter-Breite, Deck-Mitte, Kabine 0..1
# Keilform: Nase tief, Guertellinie steigt nach hinten, Kotfluegel ueber den Achsen breiter als die Tueren (Taille).
STATIONEN = [
    # x       zb    ws     zm    zsh   wsh    zdeck  c
    (2.245, 0.26, 0.50, 0.32, 0.38, 0.40, 0.39, 0.0),
    (2.210, 0.18, 0.80, 0.33, 0.47, 0.72, 0.47, 0.0),
    (2.100, 0.13, 0.92, 0.35, 0.58, 0.86, 0.56, 0.0),
    (1.850, 0.12, 0.965, 0.40, 0.70, 0.92, 0.64, 0.0),
    (1.550, 0.12, 0.98, 0.43, 0.77, 0.94, 0.69, 0.0),
    (1.310, 0.12, 0.98, 0.44, 0.80, 0.94, 0.72, 0.0),
    (1.050, 0.12, 0.96, 0.45, 0.80, 0.90, 0.76, 0.0),
    (0.850, 0.12, 0.94, 0.46, 0.81, 0.87, 0.80, 0.08),
    (0.500, 0.12, 0.93, 0.46, 0.82, 0.86, 0.82, 0.55),
    (0.150, 0.12, 0.93, 0.46, 0.83, 0.86, 0.84, 0.95),
    (-0.250, 0.12, 0.935, 0.46, 0.85, 0.87, 0.86, 1.0),
    (-0.700, 0.12, 0.95, 0.47, 0.88, 0.90, 0.88, 0.92),
    (-1.050, 0.12, 0.975, 0.48, 0.91, 0.94, 0.90, 0.65),
    (-1.310, 0.13, 1.00, 0.49, 0.91, 0.96, 0.90, 0.40),
    (-1.600, 0.14, 0.985, 0.50, 0.89, 0.94, 0.88, 0.15),
    (-1.900, 0.17, 0.94, 0.51, 0.85, 0.89, 0.85, 0.02),
    (-2.120, 0.25, 0.87, 0.52, 0.79, 0.81, 0.79, 0.0),
    (-2.200, 0.33, 0.80, 0.53, 0.73, 0.72, 0.73, 0.0),
    (-2.235, 0.42, 0.62, 0.52, 0.64, 0.54, 0.64, 0.0),
]
DACH = {"guertel_hoehe": 0.035, "kante_b": 0.54, "kante_z": 1.08, "mitte_z": 1.14, "einzug": 0.06}
SCHULTER, GUERTEL = 5, 6          # Punkt-Indizes mit scharfer Kante (Crease)


def _querschnitt(s):
    """10 Punkte je Halbschnitt: Boden, Schwellerkante, max. Breite, Schulter (scharf), Deck bzw. Kabine."""
    x, zb, ws, zm, zsh, wsh, zdeck, c = s
    deck = [
        (wsh * 0.74, zdeck + (zsh - zdeck) * 0.62),
        (wsh * 0.46, zdeck + (zsh - zdeck) * 0.22 + 0.008),
        (wsh * 0.20, zdeck + 0.012),
        (0.0, zdeck + 0.014),
    ]
    zg = zsh + DACH["guertel_hoehe"]
    kabine = [
        (wsh - 0.045, zg),
        ((wsh - 0.045 + DACH["kante_b"]) / 2 - DACH["einzug"], (zg + DACH["kante_z"]) / 2),
        (DACH["kante_b"], DACH["kante_z"]),
        (0.0, DACH["mitte_z"]),
    ]
    oben = [(dy + (ky - dy) * c, dz + (kz - dz) * c) for (dy, dz), (ky, kz) in zip(deck, kabine)]
    unten = [(0.0, zb), (ws * 0.90, zb), (ws * 0.985, zb + 0.10), (ws, zm), (wsh + 0.025, zsh - 0.05), (wsh, zsh)]
    return x, unten + oben


def _material_index(xa, xb, j, ca, cb):
    """0 Lack · 1 Glas · 2 Schwarz (Lufteinlass, Grill). j = Flaeche zwischen Punkt j und j+1."""
    xm = (xa + xb) / 2
    if j in (6, 7) and min(ca, cb) >= 0.5 and -1.0 < xm < 0.45:
        return 1                                   # Seitenscheiben
    if j == 8 and 0.10 < xm < 0.80 and min(ca, cb) > 0.05:
        return 1                                   # Frontscheibe
    if j == 8 and -1.40 < xm < -0.85:
        return 1                                   # Heckscheibe ueber dem Motor
    if j in (1, 2) and xm > 2.0:
        return 2                                   # Front-Lufteinlaesse unten
    return 0


def karosserie(lack, glas, schwarz):
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
    crease = bm.edges.layers.float.get("crease_edge") or bm.edges.layers.float.new("crease_edge")
    bm.edges.ensure_lookup_table()
    for i in range(len(reihen) - 1):
        for j, staerke in ((SCHULTER, 0.75), (GUERTEL, 0.6 if min(cs[i], cs[i + 1]) > 0.3 else 0.0)):
            e = bm.edges.get((reihen[i][j], reihen[i + 1][j]))
            if e and staerke:
                e[crease] = staerke
    # Kappen vorn und hinten
    for r in (reihen[0], reihen[-1]):
        f = bm.faces.new(r if r is reihen[-1] else list(reversed(r)))
        f.material_index = 2 if r is reihen[0] else 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("Karosserie", me)
    bpy.context.collection.objects.link(o)
    for m in (lack, glas, schwarz):
        me.materials.append(m)
    spiegel = o.modifiers.new("Spiegel", "MIRROR")
    spiegel.use_axis = (False, True, False)
    spiegel.use_clip = True
    sub = o.modifiers.new("Glatt", "SUBSURF")
    sub.levels = sub.render_levels = 3
    sub.use_creases = True
    _anwenden(o)
    _radhaeuser(o)
    st.glatt(o)
    o.data.use_auto_smooth = True
    o.data.auto_smooth_angle = math.radians(50)
    return o


def _anwenden(o):
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def _radhaeuser(body):
    """Radlaeufe als Ausschnitt (Boolean), danach Radhausschalen von innen."""
    for x in (ACHSE_V, ACHSE_H):
        for sy in (1, -1):
            bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=RAD_R + 0.045, depth=0.5,
                                                location=(x, sy * 1.0, RAD_R + 0.01), rotation=(math.pi / 2, 0, 0))
            cut = bpy.context.object
            b = body.modifiers.new("Radlauf", "BOOLEAN")
            b.operation = "DIFFERENCE"
            b.solver = "EXACT"
            b.object = cut
            _anwenden(body)
            bpy.data.objects.remove(cut)


def radhausschalen(schwarz):
    """Offene Roehre + innerer Deckel: dunkles Radhaus hinter dem Rad, aussen offen."""
    teile = []
    for x in (ACHSE_V, ACHSE_H):
        for sy in (1, -1):
            bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=RAD_R + 0.04, depth=0.36, end_fill_type="NOTHING",
                                                location=(x, sy * 0.78, RAD_R + 0.01), rotation=(math.pi / 2, 0, 0))
            rohr = bpy.context.object
            bpy.ops.mesh.primitive_circle_add(vertices=64, radius=RAD_R + 0.04, fill_type="NGON",
                                              location=(x, sy * 0.60, RAD_R + 0.01), rotation=(math.pi / 2, 0, 0))
            deckel = bpy.context.object
            for o in (rohr, deckel):
                o.name = "Radhaus"
                st.zuweisen(o, schwarz)
                teile.append(o)
    return teile


def rad(x, sy, gummi, felge, scheibe, sattel):
    teile = []
    y = sy * SPUR
    # Reifen: gestreckter Torus = Niederquerschnitt mit runder Flanke, innen offen fuer die Felge
    bpy.ops.mesh.primitive_torus_add(major_segments=96, minor_segments=24, major_radius=0.2925, minor_radius=0.0475,
                                     location=(x, y, RAD_R), rotation=(math.pi / 2, 0, 0))
    r = bpy.context.object
    r.name = "Reifen"
    r.scale = (1, 1, 2.85)                 # nach Drehung = Breite in Y (0,27 m)
    st.glatt(r)
    st.zuweisen(r, gummi)
    teile.append(r)
    aussen = y + sy * 0.125
    # Felge: Ring + 5 Doppelspeichen + Nabe
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.245, depth=0.04, location=(x, aussen - sy * 0.03, RAD_R),
                                        rotation=(math.pi / 2, 0, 0))
    ring = bpy.context.object
    st.zuweisen(ring, felge)
    teile.append(ring)
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.228, depth=0.06, location=(x, aussen - sy * 0.035, RAD_R),
                                        rotation=(math.pi / 2, 0, 0))
    loch = bpy.context.object
    bo = ring.modifiers.new("Innen", "BOOLEAN")
    bo.operation, bo.solver, bo.object = "DIFFERENCE", "EXACT", loch
    bpy.context.view_layer.objects.active = ring
    bpy.ops.object.modifier_apply(modifier="Innen")
    bpy.data.objects.remove(loch)
    for k in range(10):
        w = 2 * math.pi * (k // 2) / 5 + (0.10 if k % 2 else -0.10)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x + math.cos(w) * 0.13, aussen - sy * 0.04, RAD_R + math.sin(w) * 0.13))
        sp = bpy.context.object
        sp.scale = (0.20, 0.03, 0.026)
        sp.rotation_euler = (0, -w, 0)
        b2 = sp.modifiers.new("Kante", "BEVEL")
        b2.width, b2.segments = 0.006, 2
        st.zuweisen(sp, felge)
        teile.append(sp)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.055, depth=0.05, location=(x, aussen - sy * 0.035, RAD_R),
                                        rotation=(math.pi / 2, 0, 0))
    nabe = bpy.context.object
    st.zuweisen(nabe, felge)
    teile.append(nabe)
    # Bremsscheibe + Bremssattel (Markenfarbe)
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.19, depth=0.03, location=(x, aussen - sy * 0.10, RAD_R),
                                        rotation=(math.pi / 2, 0, 0))
    bs = bpy.context.object
    st.zuweisen(bs, scheibe)
    teile.append(bs)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x - 0.12, aussen - sy * 0.085, RAD_R + 0.10))
    sa = bpy.context.object
    sa.scale = (0.16, 0.045, 0.09)
    sa.rotation_euler = (0, math.radians(-38), 0)
    b3 = sa.modifiers.new("Kante", "BEVEL")
    b3.width, b3.segments = 0.015, 3
    st.zuweisen(sa, sattel)
    teile.append(sa)
    return teile


def _treffer(body, ursprung, richtung):
    deps = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(body, deps)
    loc, nor, _, _ = bvh.ray_cast(Vector(ursprung), Vector(richtung).normalized())
    return loc, nor


def leiste(body, punkte_aussen, richtung, material, dicke=0.012, abstand=0.004, name="Leiste"):
    """Duenne Leiste auf der Karosserie: Punkte von aussen auf die Oberflaeche projizieren, als Kurve mit Rundprofil."""
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


def details(body, licht_vorn, licht_hinten, schwarz):
    teile = []
    for sy in (1, -1):
        # Scheinwerfer: schmaler LED-Strich, folgt der Front
        pts = [(2.6, sy * (0.58 + 0.30 * t), 0.56 + 0.05 * t) for t in [i / 12 for i in range(13)]]
        teile.append(leiste(body, pts, (-1, 0, 0), licht_vorn, dicke=0.011, name="Scheinwerfer"))
    # Rueckleuchte: durchgehende Lichtleiste
    pts = [(-2.6, y / 20 * 0.86, 0.74) for y in range(-20, 21)]
    teile.append(leiste(body, pts, (1, 0, 0), licht_hinten, dicke=0.013, name="Rueckleuchte"))
    return teile
