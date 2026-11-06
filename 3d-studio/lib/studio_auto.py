"""Studio und Materialien fuer Auto-Szenen (Sportwagen-Waesche, Keramik-Motive)."""
import math

import bpy

import studio as st
import sportwagen as sw

GELB = st.hex_farbe("#E8F320")


def materialien():
    return {
        # Schwarzlack: dunkle Basis ohne Metall-Schleier, Glanz kommt nur aus dem Klarlack (coat)
        "lack": st.material("Lack", base=(0.006, 0.0065, 0.008), roughness=0.5, specular=0.15,
                            coat=1.0, coat_roughness=0.012),
        "glas": st.material("Glas", base=(0.004, 0.005, 0.006), roughness=0.0, specular=1.0),
        "schwarz": st.material("Kunststoff", base=(0.01, 0.01, 0.011), roughness=0.45),
        "gummi": st.material("Gummi", base=(0.016, 0.016, 0.018), roughness=0.72),
        "felge": st.material("Felge", base=(0.22, 0.225, 0.235), metallic=1.0, roughness=0.18),
        "scheibe": st.material("Bremsscheibe", base=(0.3, 0.3, 0.31), metallic=1.0, roughness=0.42),
        "sattel": st.material("Sattel", base=GELB, roughness=0.3, coat=1.0, coat_roughness=0.05),
        "vorn": st.material("Scheinwerfer", base=(0, 0, 0), emission=(1, 0.97, 0.92), emission_strength=12),
        "hinten": st.material("Rueckleuchte", base=(0, 0, 0), emission=(1, 0.03, 0.015), emission_strength=8),
        "boden": boden_material(),
    }


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
    return body


def studio(m):
    bpy.ops.mesh.primitive_plane_add(size=60)
    st.zuweisen(bpy.context.object, m["boden"])
    ziel = (0, 0, 0.5)
    for i, y in enumerate((-1.2, 0.0, 1.2)):                       # drei Deckenstreifen = Lichtkanten auf Haube/Dach
        st.flaechenlicht(f"Decke{i}", (0.2, y, 4.6), (0.2, y, 0), 650, (5.5, 0.35))
    st.flaechenlicht("Seite", (1.0, -7.5, 2.6), (0.3, 0, 0.7), 550, (7.0, 0.6))    # Lichtband auf der Schulterlinie
    st.flaechenlicht("Kante L", (-5.5, -3.5, 1.8), ziel, 900, (1.2, 3.0), (0.85, 0.9, 1.0))
    st.flaechenlicht("Kante R", (-5.0, 4.0, 2.2), ziel, 700, (1.2, 3.0), (0.85, 0.9, 1.0))
    # gelbe Akzentlinie im Hintergrund (Markenfarbe), spiegelt sich im nassen Boden
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-6.0, 7.0, 2.6), rotation=(0, 0, math.radians(-49.5)))
    leiste = bpy.context.object
    leiste.scale = (0.03, 30.0, 0.03)
    st.zuweisen(leiste, st.material("Akzent", base=(0, 0, 0), emission=GELB, emission_strength=5))
