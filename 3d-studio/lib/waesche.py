"""Waesche-Effekte: Schmutz im Lack, Schaum, Spuelstrahl, Abperl-Tropfen – gesteuert ueber zwei Fronten (Empties).

Front = Empty, das sich entlang X von vorn (+X) nach hinten bewegt. Was die Front passiert hat, ist eingeschaeumt
bzw. gespuelt. Lack, Schaum und Tropfen lesen die Position der Fronten – ein Keyframe-Paar steuert alles.
"""
import math

import bpy

import studio as st


def front(name, x_von, x_bis, f_von, f_bis):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    for f, x in ((f_von, x_von), (f_bis, x_bis)):
        e.location = (x, 0, 0)
        e.keyframe_insert("location", index=0, frame=f)
    for fc in e.animation_data.action.fcurves:
        for k in fc.keyframe_points:
            k.interpolation = "LINEAR"
    return e


# ---------- Lack mit Schmutzschicht ----------

def dreckiger_lack(lack, spuel):
    """Erweitert den Lack: Staub/Schmutz (unten dichter), verschwindet, wo die Spuelfront vorbei ist."""
    nt = lack.node_tree
    out = nt.nodes["Material Output"]
    sauber = nt.nodes["Principled BSDF"]
    dreck = nt.nodes.new("ShaderNodeBsdfPrincipled")
    dreck.inputs["Base Color"].default_value = (0.105, 0.1, 0.09, 1)   # grauer Strassenstaub
    dreck.inputs["Roughness"].default_value = 0.92
    dreck.inputs["Specular IOR Level"].default_value = 0.2

    tc = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 9.0
    noise.inputs["Detail"].default_value = 12.0
    lauf = nt.nodes.new("ShaderNodeMapping")                       # senkrecht gestreckt = Laufspuren vom Regen
    lauf.inputs["Scale"].default_value = (1.0, 1.0, 0.22)
    nt.links.new(tc.outputs["Object"], lauf.inputs["Vector"])
    nt.links.new(lauf.outputs["Vector"], noise.inputs["Vector"])
    # Hoehe: unten mehr Dreck (Spritzwasser), oben Staubfilm
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
    hoehe = nt.nodes.new("ShaderNodeMapRange")
    hoehe.inputs["From Min"].default_value, hoehe.inputs["From Max"].default_value = 0.25, 0.85
    hoehe.inputs["To Min"].default_value, hoehe.inputs["To Max"].default_value = 0.85, 0.38
    nt.links.new(sep.outputs["Z"], hoehe.inputs["Value"])
    flecken = nt.nodes.new("ShaderNodeMapRange")
    flecken.inputs["From Min"].default_value, flecken.inputs["From Max"].default_value = 0.2, 0.75
    flecken.inputs["To Min"].default_value = 0.3                        # ueberall Staubfilm, Flecken nur dichter
    nt.links.new(noise.outputs["Fac"], flecken.inputs["Value"])
    dichte = nt.nodes.new("ShaderNodeMath"); dichte.operation = "MULTIPLY"
    nt.links.new(hoehe.outputs["Result"], dichte.inputs[0])
    nt.links.new(flecken.outputs["Result"], dichte.inputs[1])

    # Spuelfront: Koordinaten relativ zum Empty → x > 0 heisst „schon gespuelt“
    tf = nt.nodes.new("ShaderNodeTexCoord")
    tf.object = spuel
    sf = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tf.outputs["Object"], sf.inputs["Vector"])
    sauber_fak = nt.nodes.new("ShaderNodeMapRange")
    sauber_fak.inputs["From Min"].default_value, sauber_fak.inputs["From Max"].default_value = -0.05, 0.25
    nt.links.new(sf.outputs["X"], sauber_fak.inputs["Value"])
    rest = nt.nodes.new("ShaderNodeMath"); rest.operation = "SUBTRACT"
    rest.inputs[0].default_value = 1.0
    nt.links.new(sauber_fak.outputs["Result"], rest.inputs[1])
    menge = nt.nodes.new("ShaderNodeMath"); menge.operation = "MULTIPLY"
    nt.links.new(dichte.outputs["Value"], menge.inputs[0])
    nt.links.new(rest.outputs["Value"], menge.inputs[1])

    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(menge.outputs["Value"], mix.inputs["Fac"])
    nt.links.new(sauber.outputs["BSDF"], mix.inputs[1])
    nt.links.new(dreck.outputs["BSDF"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return lack


# ---------- Geometry Nodes: Schaum + Tropfen auf der Karosserie ----------

def _n(ng, typ, **inputs):
    n = ng.nodes.new(typ)
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def _feld_front(ng, front_obj, gegen):
    """Position.x minus Front.x (Feld)."""
    info = ng.nodes.new("GeometryNodeObjectInfo")
    info.inputs["Object"].default_value = front_obj
    info.transform_space = "ORIGINAL"
    sep_f = ng.nodes.new("ShaderNodeSeparateXYZ")
    ng.links.new(info.outputs["Location"], sep_f.inputs["Vector"])
    pos = ng.nodes.new("GeometryNodeInputPosition")
    sep_p = ng.nodes.new("ShaderNodeSeparateXYZ")
    ng.links.new(pos.outputs["Position"], sep_p.inputs["Vector"])
    d = ng.nodes.new("ShaderNodeMath"); d.operation = "SUBTRACT"
    ng.links.new(sep_p.outputs["X"], d.inputs[0])
    ng.links.new(sep_f.outputs["X"], d.inputs[1])
    return d.outputs["Value"]


def _bereich(ng, wert, von, bis, a=0.0, b=1.0):
    mr = ng.nodes.new("ShaderNodeMapRange")
    mr.clamp = True
    mr.inputs["From Min"].default_value, mr.inputs["From Max"].default_value = von, bis
    mr.inputs["To Min"].default_value, mr.inputs["To Max"].default_value = a, b
    ng.links.new(wert, mr.inputs["Value"])
    return mr.outputs["Result"]


def _mal(ng, *werte):
    akt = werte[0]
    for w in werte[1:]:
        m = ng.nodes.new("ShaderNodeMath"); m.operation = "MULTIPLY"
        for i, x in enumerate((akt, w)):
            if isinstance(x, (int, float)):
                m.inputs[i].default_value = x
            else:
                ng.links.new(x, m.inputs[i])
        akt = m.outputs["Value"]
    return akt


def _zufall(ng, lo, hi, seed):
    r = ng.nodes.new("FunctionNodeRandomValue")
    r.data_type = "FLOAT"
    r.inputs[2].default_value, r.inputs[3].default_value = lo, hi        # Float-Min/Max (Index 2/3)
    r.inputs["Seed"].default_value = seed
    return r.outputs[1]


def _normal_z_groesser(ng, grenze):
    nrm = ng.nodes.new("GeometryNodeInputNormal")
    sep = ng.nodes.new("ShaderNodeSeparateXYZ")
    ng.links.new(nrm.outputs["Normal"], sep.inputs["Vector"])
    cmp = ng.nodes.new("FunctionNodeCompare")
    cmp.data_type, cmp.operation = "FLOAT", "GREATER_THAN"
    ng.links.new(sep.outputs["Z"], cmp.inputs[0])
    cmp.inputs[1].default_value = grenze
    return cmp.outputs["Result"]


def schaum_und_tropfen(body, schaum, spuel, mat_schaum, mat_wasser, dichte=5200, tropfen_dichte=900):
    ng = bpy.data.node_groups.new("Waesche", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    gin, gout = ng.nodes.new("NodeGroupInput"), ng.nodes.new("NodeGroupOutput")
    join = ng.nodes.new("GeometryNodeJoinGeometry")
    ng.links.new(gin.outputs[0], join.inputs[0])

    # Schaum: Punkte auf allem, was nicht nach unten zeigt
    vert = ng.nodes.new("GeometryNodeDistributePointsOnFaces")
    vert.inputs["Density"].default_value = dichte
    vert.inputs["Seed"].default_value = 3
    ng.links.new(gin.outputs[0], vert.inputs["Mesh"])
    ng.links.new(_normal_z_groesser(ng, -0.25), vert.inputs["Selection"])
    rausch = ng.nodes.new("ShaderNodeTexNoise")                  # Front nicht linealgerade, sondern wolkig
    rausch.inputs["Scale"].default_value = 2.2
    versatz_f = _bereich(ng, rausch.outputs["Fac"], 0.3, 0.7, -0.35, 0.35)
    def plus(a_, b_):
        n = ng.nodes.new("ShaderNodeMath"); n.operation = "ADD"
        ng.links.new(a_, n.inputs[0]); ng.links.new(b_, n.inputs[1])
        return n.outputs["Value"]
    da = plus(_feld_front(ng, schaum, None), versatz_f)
    db = plus(_feld_front(ng, spuel, None), versatz_f)
    wachsen = _bereich(ng, da, 0.0, 0.45)                 # hinter der Schaumfront waechst er
    bleiben = _bereich(ng, db, -0.08, 0.12, 1.0, 0.0)     # vor der Spuelfront ist er weg
    groesse = _mal(ng, wachsen, bleiben, _zufall(ng, 0.010, 0.026, 11))
    # leicht nach aussen versetzt, damit der Schaum auf dem Lack liegt
    versatz = ng.nodes.new("ShaderNodeVectorMath"); versatz.operation = "SCALE"
    ng.links.new(vert.outputs["Normal"], versatz.inputs[0])
    ng.links.new(_mal(ng, groesse, 0.55), versatz.inputs["Scale"])
    setpos = ng.nodes.new("GeometryNodeSetPosition")
    ng.links.new(vert.outputs["Points"], setpos.inputs["Geometry"])
    ng.links.new(versatz.outputs["Vector"], setpos.inputs["Offset"])
    kugel = ng.nodes.new("GeometryNodeMeshIcoSphere")
    kugel.inputs["Radius"].default_value, kugel.inputs["Subdivisions"].default_value = 1.0, 2
    smat = ng.nodes.new("GeometryNodeSetMaterial")
    smat.inputs["Material"].default_value = mat_schaum
    ng.links.new(kugel.outputs["Mesh"], smat.inputs["Geometry"])
    inst = ng.nodes.new("GeometryNodeInstanceOnPoints")
    ng.links.new(setpos.outputs["Geometry"], inst.inputs["Points"])
    ng.links.new(smat.outputs["Geometry"], inst.inputs["Instance"])
    ng.links.new(groesse, inst.inputs["Scale"])
    ng.links.new(inst.outputs["Instances"], join.inputs[0])

    # Tropfen: nur auf nach oben zeigenden Flaechen, erscheinen nach dem Spuelen (Abperleffekt)
    tr = ng.nodes.new("GeometryNodeDistributePointsOnFaces")
    tr.inputs["Density"].default_value = tropfen_dichte
    tr.inputs["Seed"].default_value = 17
    ng.links.new(gin.outputs[0], tr.inputs["Mesh"])
    ng.links.new(_normal_z_groesser(ng, 0.55), tr.inputs["Selection"])
    db2 = _feld_front(ng, spuel, None)
    da_tr = _bereich(ng, db2, 0.15, 0.5)
    tgr = _mal(ng, da_tr, _zufall(ng, 0.003, 0.0075, 23))
    tv = ng.nodes.new("ShaderNodeVectorMath"); tv.operation = "SCALE"
    ng.links.new(tr.outputs["Normal"], tv.inputs[0])
    ng.links.new(_mal(ng, tgr, 0.45), tv.inputs["Scale"])
    tpos = ng.nodes.new("GeometryNodeSetPosition")
    ng.links.new(tr.outputs["Points"], tpos.inputs["Geometry"])
    ng.links.new(tv.outputs["Vector"], tpos.inputs["Offset"])
    perle = ng.nodes.new("GeometryNodeMeshUVSphere")
    perle.inputs["Segments"].default_value, perle.inputs["Rings"].default_value = 24, 12
    perle.inputs["Radius"].default_value = 1.0
    wmat = ng.nodes.new("GeometryNodeSetMaterial")
    wmat.inputs["Material"].default_value = mat_wasser
    ng.links.new(perle.outputs["Mesh"], wmat.inputs["Geometry"])
    tinst = ng.nodes.new("GeometryNodeInstanceOnPoints")
    ng.links.new(tpos.outputs["Geometry"], tinst.inputs["Points"])
    ng.links.new(wmat.outputs["Geometry"], tinst.inputs["Instance"])
    ng.links.new(tr.outputs["Rotation"], tinst.inputs["Rotation"])
    skal = ng.nodes.new("ShaderNodeCombineXYZ")
    ng.links.new(tgr, skal.inputs["X"]); ng.links.new(tgr, skal.inputs["Y"])
    ng.links.new(_mal(ng, tgr, 0.75), skal.inputs["Z"])
    ng.links.new(skal.outputs["Vector"], tinst.inputs["Scale"])
    ng.links.new(tinst.outputs["Instances"], join.inputs[0])

    ng.links.new(join.outputs[0], gout.inputs[0])
    mod = body.modifiers.new("Waesche", "NODES")
    mod.node_group = ng
    return mod


# ---------- Spuellanze mit Strahl ----------

def lanze(spuel, f_an, f_aus, mat_metall, mat_spruehen, hoehe=1.3, abstand=1.75, laenge=1.6):
    """Lanze haengt an der Spuelfront, zielt schraeg nach unten auf die Karosserie; Strahl als Tropfen-Schwarm."""
    halter = bpy.data.objects.new("Lanze", None)
    bpy.context.collection.objects.link(halter)
    halter.parent = spuel
    halter.location = (0.18, -abstand, hoehe)
    halter.rotation_euler = (math.radians(-24), 0, math.radians(-6))   # lokale +Y zeigt zum Auto, leicht nach unten
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.02, radius2=0.008, depth=0.06, location=(0, 0.0, 0),
                                    rotation=(-math.pi / 2, 0, 0))
    duese = bpy.context.object
    duese.parent = halter
    st.zuweisen(duese, mat_metall)

    me = bpy.data.meshes.new("Strahl")
    me.from_pydata([(0, 0, 0)], [], [])
    strahl = bpy.data.objects.new("Strahl", me)
    bpy.context.collection.objects.link(strahl)
    strahl.parent = halter
    strahl.location = (0, 0.03, 0)
    ng = bpy.data.node_groups.new("Strahl", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    gin, gout = ng.nodes.new("NodeGroupInput"), ng.nodes.new("NodeGroupOutput")
    zeit = ng.nodes.new("GeometryNodeInputSceneTime")
    seed = ng.nodes.new("FunctionNodeFloatToInt")
    ng.links.new(zeit.outputs["Frame"], seed.inputs[0])
    pts = ng.nodes.new("GeometryNodePoints")
    pts.inputs["Count"].default_value = 2600

    def zufall(lo, hi, s):
        r = ng.nodes.new("FunctionNodeRandomValue")
        r.data_type = "FLOAT"
        r.inputs[2].default_value, r.inputs[3].default_value = lo, hi
        add = ng.nodes.new("ShaderNodeMath"); add.operation = "ADD"
        ng.links.new(seed.outputs[0], add.inputs[0]); add.inputs[1].default_value = s
        i2 = ng.nodes.new("FunctionNodeFloatToInt")
        ng.links.new(add.outputs[0], i2.inputs[0])
        ng.links.new(i2.outputs[0], r.inputs["Seed"])
        return r.outputs[1]

    t = zufall(0.0, 1.0, 0)
    w = zufall(0.0, 6.2832, 1000)
    r = zufall(0.0, 1.0, 2000)
    tl = ng.nodes.new("ShaderNodeMath"); tl.operation = "MULTIPLY"
    ng.links.new(t, tl.inputs[0]); tl.inputs[1].default_value = laenge
    spread = ng.nodes.new("ShaderNodeMath"); spread.operation = "MULTIPLY"
    ng.links.new(t, spread.inputs[0]); spread.inputs[1].default_value = 0.42     # Faecher wird nach aussen breiter
    sr = ng.nodes.new("ShaderNodeMath"); sr.operation = "MULTIPLY"
    ng.links.new(spread.outputs[0], sr.inputs[0]); ng.links.new(r, sr.inputs[1])
    cosw = ng.nodes.new("ShaderNodeMath"); cosw.operation = "COSINE"; ng.links.new(w, cosw.inputs[0])
    sinw = ng.nodes.new("ShaderNodeMath"); sinw.operation = "SINE"; ng.links.new(w, sinw.inputs[0])
    xx = ng.nodes.new("ShaderNodeMath"); xx.operation = "MULTIPLY"
    ng.links.new(cosw.outputs[0], xx.inputs[0]); ng.links.new(sr.outputs[0], xx.inputs[1])
    zz = ng.nodes.new("ShaderNodeMath"); zz.operation = "MULTIPLY"
    ng.links.new(sinw.outputs[0], zz.inputs[0]); ng.links.new(sr.outputs[0], zz.inputs[1])
    zz2 = ng.nodes.new("ShaderNodeMath"); zz2.operation = "MULTIPLY"                # Flachstrahl-Duese: oben/unten schmaler
    ng.links.new(zz.outputs[0], zz2.inputs[0]); zz2.inputs[1].default_value = 0.35
    vec = ng.nodes.new("ShaderNodeCombineXYZ")
    ng.links.new(xx.outputs[0], vec.inputs["X"]); ng.links.new(tl.outputs[0], vec.inputs["Y"])
    ng.links.new(zz2.outputs[0], vec.inputs["Z"])
    ng.links.new(vec.outputs[0], pts.inputs["Position"])
    tropfen = ng.nodes.new("GeometryNodeMeshUVSphere")
    tropfen.inputs["Segments"].default_value, tropfen.inputs["Rings"].default_value = 8, 4
    tmat = ng.nodes.new("GeometryNodeSetMaterial")
    tmat.inputs["Material"].default_value = mat_spruehen
    ng.links.new(tropfen.outputs["Mesh"], tmat.inputs["Geometry"])
    inst = ng.nodes.new("GeometryNodeInstanceOnPoints")
    ng.links.new(pts.outputs["Geometry"], inst.inputs["Points"])
    ng.links.new(tmat.outputs["Geometry"], inst.inputs["Instance"])
    inst.inputs["Scale"].default_value = (0.003, 0.06, 0.003)                   # Streifen in Strahlrichtung
    ng.links.new(inst.outputs["Instances"], gout.inputs[0])
    mod = strahl.modifiers.new("Strahl", "NODES")
    mod.node_group = ng

    for f, sichtbar in ((1, 0), (f_an - 1, 0), (f_an, 1), (f_aus, 1), (f_aus + 1, 0)):
        for o in (halter,):
            o.scale = (sichtbar,) * 3 if sichtbar else (0.0001,) * 3
            o.keyframe_insert("scale", frame=f)
    for fc in halter.animation_data.action.fcurves:
        for k in fc.keyframe_points:
            k.interpolation = "CONSTANT"
    return halter
