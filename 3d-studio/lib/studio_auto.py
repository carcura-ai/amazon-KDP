"""Studio und Materialien fuer Auto-Szenen (Sportwagen-Waesche, Keramik-Motive)."""
import math
import os

import bpy

import studio as st
import sportwagen as sw

GELB = st.hex_farbe("#E8F320")


def materialien():
    return {
        # Schwarzlack: dunkle Basis ohne Metall-Schleier, Glanz kommt nur aus dem Klarlack (coat)
        "lack": lack_material(),
        # getoentes Glas: spiegelt wie Glas, laesst den Innenraum schemenhaft durch (Alpha statt Transmission = rauscharm)
        "glas": st.material("Glas", base=(0.003, 0.0035, 0.004), roughness=0.0, specular=1.0, alpha=0.72),
        "innen": st.material("Innenraum", base=(0.025, 0.025, 0.027), roughness=0.7),
        "schwarz": st.material("Kunststoff", base=(0.01, 0.01, 0.011), roughness=0.45),
        "gummi": st.material("Gummi", base=(0.016, 0.016, 0.018), roughness=0.72),
        "felge": st.material("Felge", base=(0.62, 0.63, 0.65), metallic=1.0, roughness=0.16),   # Silber, Speichen lesbar
        "scheibe": st.material("Bremsscheibe", base=(0.3, 0.3, 0.31), metallic=1.0, roughness=0.42),
        "sattel": st.material("Sattel", base=GELB, roughness=0.3, coat=1.0, coat_roughness=0.05),
        "vorn": st.material("Scheinwerfer", base=(0, 0, 0), emission=(1, 0.97, 0.92), emission_strength=12),
        "hinten": st.material("Rueckleuchte", base=(0, 0, 0), emission=(1, 0.03, 0.015), emission_strength=8),
        "boden": boden_material(),
    }


LACKE = {   # Name → (Basisfarbe linear, Metallic, Rauheit Basis, Specular)
    "schwarz": ((0.006, 0.0065, 0.008), 0.0, 0.5, 0.15),
    "gelb": (st.hex_farbe("#F2C500"), 0.2, 0.25, 0.5),      # kraeftiges Sportwagen-Gelb (Carcura-Akzent bleibt im Sattel)
    "silber": ((0.55, 0.56, 0.58), 0.9, 0.28, 0.5),
    "rot": ((0.42, 0.01, 0.012), 0.35, 0.3, 0.5),
}


def lack_material():
    """Lackfarbe ueber Umgebungsvariable LACK (schwarz | gelb | silber | rot), Standard schwarz."""
    import os
    base, met, rau, spec = LACKE[os.environ.get("LACK", "schwarz")]
    return st.material("Lack", base=base, metallic=met, roughness=rau, specular=spec, coat=1.0, coat_roughness=0.012)


def boden_material():
    """Nasser Hallenboden: dunkel, Pfuetzen spiegeln (Rauheit per Rauschmuster 0,04–0,45)."""
    m = st.material("Boden", base=(0.004, 0.004, 0.0045), roughness=0.3, specular=0.5)
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 0.6
    tex.inputs["Detail"].default_value = 3.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[1].position = 0.48, 0.56
    ramp.color_ramp.elements[0].color = (0.15, 0.15, 0.15, 1)
    ramp.color_ramp.elements[1].color = (0.6, 0.6, 0.6, 1)
    nt.links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Roughness"])
    return m


def auto(m):
    body = sw.karosserie(m["lack"], m["glas"], m["schwarz"])
    teile = [body] + sw.radhausschalen(m["schwarz"])
    for x in (sw.ACHSE_V, sw.ACHSE_H):
        for sy in (1, -1):
            teile += sw.rad(x, sy, m["gummi"], m["felge"], m["scheibe"], m["sattel"])
    teile += sw.details(body, m["vorn"], m["hinten"], m["schwarz"])
    teile += sw.innenraum(m["innen"])
    coll = bpy.data.collections.new("Auto")                     # fuer Licht-Verknuepfung (Kantenlichter nur aufs Auto)
    bpy.context.scene.collection.children.link(coll)
    for t in teile:
        coll.objects.link(t)
    return body


HDRI = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "hdri", "monochrome_studio_02_2k.hdr")


def hdri_welt(staerke=1.0, drehung=0.0):
    """Echtes Fotostudio (HDRI) fuer Licht und Spiegelungen; die Kamera selbst sieht weiter Schwarz (Studiowand davor)."""
    w = bpy.context.scene.world
    nt = w.node_tree
    bg = nt.nodes["Background"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Rotation"].default_value = (0, 0, math.radians(drehung))
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(HDRI)
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
    nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = staerke
    lp = nt.nodes.new("ShaderNodeLightPath")
    schwarz = nt.nodes.new("ShaderNodeBackground")
    schwarz.inputs["Color"].default_value = (0, 0, 0, 1)
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
    nt.links.new(bg.outputs["Background"], mix.inputs[1])
    nt.links.new(schwarz.outputs["Background"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], nt.nodes["World Output"].inputs["Surface"])


def studio(m):
    bpy.context.scene.view_settings.look = "AgX - Punchy"       # kraeftigere Lackfarben als "Medium High Contrast"
    hdri_welt(staerke=float(os.environ.get("HDRI_STAERKE", "0.55")), drehung=float(os.environ.get("HDRI_DREHUNG", "0")))
    bpy.context.scene.view_settings.exposure = float(os.environ.get("BELICHTUNG", "-0.6"))   # satte Lackfarbe statt Pastell
    bpy.ops.mesh.primitive_plane_add(size=60)
    st.zuweisen(bpy.context.object, m["boden"])
    ziel = (0, 0, 0.5)
    for i, y in enumerate((-1.2, 0.0, 1.2)):                       # drei Deckenstreifen = Lichtkanten auf Haube/Dach
        d = st.flaechenlicht(f"Decke{i}", (0.2, y, 4.6), (0.2, y, 0), 650, (5.5, 0.35))
        d.visible_diffuse = False                                   # nur Spiegelung, kein Aufhellen
    nur_auto = bpy.data.collections.get("Auto")
    for licht in (st.flaechenlicht("Seite", (1.0, -7.5, 2.6), (0.3, 0, 0.7), 550, (7.0, 0.6)),   # Band auf der Schulter
                  st.flaechenlicht("Kante L", (-5.5, -3.5, 1.8), ziel, 900, (1.2, 3.0), (0.85, 0.9, 1.0)),
                  st.flaechenlicht("Kante R", (-5.0, 4.0, 2.2), ziel, 700, (1.2, 3.0), (0.85, 0.9, 1.0))):
        if nur_auto:                                            # keine hellen Flecken im nassen Boden
            licht.light_linking.receiver_collection = nur_auto
    # dunkle Studiowand hinter dem Auto mit weichem Lichtverlauf (fuellt das obere Bilddrittel ruhig)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(-7.5, 7.5, 3.0), rotation=(math.radians(90), 0, math.radians(42)))   # quer zur Blickrichtung
    wand = bpy.context.object
    wand.name = "Wand"
    wand.scale = (40, 8, 1)
    st.zuweisen(wand, st.material("Wand", base=(0.035, 0.036, 0.04), roughness=0.95, specular=0.0))
    st.flaechenlicht("Wandlicht", (-4.2, 4.2, 0.4), (-7.5, 7.5, 3.5), 900, (10.0, 0.8))
