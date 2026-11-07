"""Proportions-Abgleich: orthografische Seitenansicht (200 px/m, Mitte x=0,12, z=0,6) zum Ueberlagern mit Referenzfotos."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bpy  # noqa: E402
import studio as st  # noqa: E402
import studio_auto as sa  # noqa: E402

a = st.args()
s = st.neue_szene(frames=1)
m = sa.materialien()
sa.auto(m)
c = bpy.data.cameras.new("Ortho")
c.type = "ORTHO"
c.ortho_scale = 5.0
kam = bpy.data.objects.new("Ortho", c)
s.collection.objects.link(kam)
kam.location = (0.12, -10, 0.6)
kam.rotation_euler = (1.5708, 0, 0)
s.camera = kam
s.render.engine = "BLENDER_WORKBENCH"
s.display.shading.color_type = "SINGLE"          # weisse Silhouette auf Schwarz → Umriss per Kantenfilter
s.display.shading.single_color = (1, 1, 1)
s.display.shading.light = "FLAT"
s.world.color = (0, 0, 0)
s.view_settings.view_transform = "Standard"
s.render.resolution_x, s.render.resolution_y = 1000, 400
s.render.filepath = os.path.join(os.path.abspath(a["out"]), "seite_ortho.png")
bpy.ops.render.render(write_still=True)
