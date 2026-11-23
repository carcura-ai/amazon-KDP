"""Create an editable Carcura lighting and camera STARTING scene in Blender 4.3+.

This prepares materials, studio lights and camera/door keyframes. It is not a
finished fluid simulation or production cleaning animation. See RENDER-BRIEF.md.
Run: blender -b --python tools/build_blender_scene.py -- --preview
"""
import bpy
import math
import sys
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'blender'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'assets/models/CarConcept.glb'))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
# Enable denoising in Blender on a workstation with OpenImageDenoise support.
scene.cycles.use_denoising = False
scene.cycles.max_bounces = 8
scene.cycles.transmission_bounces = 6
scene.render.resolution_x = 1440
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.fps = 24
scene.frame_end = 360
scene.view_settings.view_transform = 'AgX'
scene.render.film_transparent = False

meshes = [o for o in scene.objects if o.type == 'MESH']
points = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
minimum = min(p.z for p in points)
car_roots = [o for o in scene.objects if o.parent is None]
for o in car_roots:
    o.location.z -= minimum
bpy.context.view_layer.update()

def material(name, color, metallic=0.0, roughness=0.5, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Roughness'].default_value = roughness
    if emission:
        node.inputs['Emission Color'].default_value = (*color, 1)
        node.inputs['Emission Strength'].default_value = emission
    return mat

floor_mat = material('Studio / charcoal floor', (0.012, 0.013, 0.016), 0.2, 0.3)
wall_mat = material('Studio / wall', (0.005, 0.006, 0.008), 0.1, 0.48)
white_emission = material('Studio / white strips', (0.85, 0.91, 1.0), emission=5)
lime_emission = material('Studio / Carcura accent', (0.8, 0.91, 0.02), emission=3)

def box(name, location, scale, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    o.data.materials.append(mat)
    return o

box('Studio / floor', (0, 0, -0.08), (26, 26, 0.15), floor_mat)
box('Studio / back wall', (0, 5.5, 2.5), (24, 0.18, 5.2), wall_mat)
box('Studio / left wall', (-8, -1, 2.5), (0.18, 14, 5.2), wall_mat)
for i in range(-10, 11):
    box('Studio / inspection strip %02d' % (i + 10), (i * 0.65, 5.38, 2.25), (0.025, 0.025, 3.5), white_emission)
box('Studio / yellow floor line', (0, 4.6, 0.015), (14, 0.035, 0.02), lime_emission)

def area(name, loc, target, energy, size, size_y, color=(1, 1, 1)):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size, data.size_y = energy * 0.45, 'RECTANGLE', size, size_y
    data.color = color
    o = bpy.data.objects.new(name, data)
    scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - o.location).to_track_quat('-Z', 'Y').to_euler()
    return o

area('Light / ceiling key', (0, 0, 5.5), (0, 0, 0), 1800, 4.5, 6)
area('Light / front strip', (1, 5, 3), (0, 0, 0.8), 1300, 6, 0.65)
area('Light / driver strip', (5, 0, 2.8), (0, 0, 0.7), 1250, 0.65, 5)
area('Light / rear rim', (-3, -3.5, 3.5), (0, 0, 0.7), 1600, 4, 1)
area('Light / soft fill', (-5, 2, 2.5), (0, 0, 0.8), 750, 3, 3)
area('Light / interior fill', (2, 0.8, 3), (0, 0, 0.6), 180, 1.8, 1.8)

world = bpy.data.worlds.new('Carcura / studio environment')
scene.world = world
world.use_nodes = True
nodes, links = world.node_tree.nodes, world.node_tree.links
env = nodes.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load(str(ROOT / 'assets/environment/studio_small_09_1k.hdr'))
bg = nodes.get('Background')
bg.inputs['Strength'].default_value = 0.04
links.new(env.outputs['Color'], bg.inputs['Color'])

def make_paint(mat):
    """Adjustable dirt/foam nodes; final fluid and tool work remains separate."""
    mat.use_nodes = True
    n, l = mat.node_tree.nodes, mat.node_tree.links
    n.clear()
    out = n.new('ShaderNodeOutputMaterial')
    bsdf = n.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.055, 0.065, 0.075, 1)
    bsdf.inputs['Metallic'].default_value = 0.82
    bsdf.inputs['Roughness'].default_value = 0.19
    bsdf.inputs['Coat Weight'].default_value = 1
    bsdf.inputs['Coat Roughness'].default_value = 0.08
    l.new(bsdf.outputs[0], out.inputs['Surface'])
    tex = n.new('ShaderNodeTexCoord')
    noise = n.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 17
    noise.inputs['Detail'].default_value = 4
    l.new(tex.outputs['Generated'], noise.inputs['Vector'])
    dirt = n.new('ShaderNodeValue'); dirt.name = 'DIRT'; dirt.label = 'Dirt amount / 0 clean, 1 dirty'
    foam = n.new('ShaderNodeValue'); foam.name = 'FOAM'; foam.label = 'Foam shader / not a liquid simulation'
    dirt.outputs[0].default_value = 0
    foam.outputs[0].default_value = 0
    mult = n.new('ShaderNodeMath'); mult.operation = 'MULTIPLY'
    l.new(noise.outputs['Fac'], mult.inputs[0]); l.new(dirt.outputs[0], mult.inputs[1])
    dirty_mix = n.new('ShaderNodeMixRGB'); dirty_mix.blend_type = 'MIX'
    dirty_mix.inputs[1].default_value = (0.055, 0.065, 0.075, 1)
    dirty_mix.inputs[2].default_value = (0.2, 0.12, 0.055, 1)
    l.new(mult.outputs[0], dirty_mix.inputs[0])
    foam_mix = n.new('ShaderNodeMixRGB'); foam_mix.inputs[2].default_value = (0.8, 0.81, 0.78, 1)
    l.new(dirty_mix.outputs[0], foam_mix.inputs[1]); l.new(foam.outputs[0], foam_mix.inputs[0])
    l.new(foam_mix.outputs[0], bsdf.inputs['Base Color'])
    bump = n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.08; bump.inputs['Distance'].default_value = 0.01
    l.new(noise.outputs['Fac'], bump.inputs['Height']); l.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat

paint = make_paint(bpy.data.materials.new('Carcura / graphite paint / controls'))
for o in meshes:
    for slot in o.material_slots:
        if slot.material and slot.material.name.startswith('Paint 1'):
            slot.material = paint
        if slot.material and slot.material.name == 'License':
            slot.material = material('Carcura / blank plate', (0.035, 0.035, 0.035), 0.1, 0.4)
    if 'Emblem' in o.name:
        o.hide_render = True

font_path = ROOT / 'assets/fonts/BigShoulders-variable.ttf'
font = bpy.data.fonts.load(str(font_path))
bpy.ops.object.text_add(location=(-3.7, 5.25, 2.9), rotation=(math.pi / 2, 0, 0))
sign = bpy.context.object
sign.name = 'Studio / CARCURA sign'
sign.data.body = 'CARCURA'
sign.data.font = font
sign.data.size = 0.85
sign.data.extrude = 0.002
sign.data.materials.append(white_emission)
# Text normal points toward the car and camera.
sign.rotation_euler.x = math.pi / 2

cam_data = bpy.data.cameras.new('Camera / scroll narrative')
cam = bpy.data.objects.new(cam_data.name, cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam_data.lens = 48
cam_data.clip_start = 0.025

def camera_pose(frame, position, target, lens=48):
    cam.location = position
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.keyframe_insert(data_path='location', frame=frame)
    cam.keyframe_insert(data_path='rotation_euler', frame=frame)
    cam_data.lens = lens
    cam_data.keyframe_insert(data_path='lens', frame=frame)

shots = [
    (1, (6.5, -7.0, 2.3), (0, 0, 0.65), 55, 'Exterior / establishing'),
    (60, (6.2, -6.8, 2.2), (0, 0, 0.65), 55, 'Exterior / cleaned'),
    (95, (4.2, 1.6, 1.9), (0.2, 0.0, 0.8), 48, 'Door opens'),
    (135, (1.35, 0.3, 1.65), (-0.2, 0.05, 0.7), 24, 'Interior / dirty to clean'),
    (180, (1.35, 0.3, 1.65), (-0.2, 0.05, 0.7), 24, 'Interior / hold'),
    (220, (3.9, -4.6, 2.5), (0.0, -1.25, 0.8), 65, 'Paint / polishing close-up'),
    (270, (3.9, -4.6, 2.5), (0.0, -1.25, 0.8), 65, 'Paint / coating close-up'),
    (320, (6.2, -6.8, 2.2), (0, 0, 0.65), 55, 'Finished / hero'),
    (360, (6.5, -7.0, 2.3), (0, 0, 0.65), 55, 'Finished / hold'),
]
for frame, position, target, lens, label in shots:
    camera_pose(frame, position, target, lens)
    marker = scene.timeline_markers.new(label, frame=frame)
    marker.camera = cam

door = bpy.data.objects.get('BodyDoorLColor1')
if door:
    door.rotation_mode = 'XYZ'
    closed = door.rotation_euler.copy()
    for frame, degrees in [(1, 0), (75, 0), (115, -68), (180, -68), (215, 0), (360, 0)]:
        door.rotation_euler = closed.copy()
        door.rotation_euler.y += math.radians(degrees)
        door.keyframe_insert(data_path='rotation_euler', frame=frame)

scene['PROJECT_STATUS'] = 'Editable base scene, not a completed cleaning animation'
scene['MODEL_CREDIT'] = 'Car Concept by Eric Chadwick / Darmstadt Graphics Group GmbH, 2024, CC BY 4.0; modified studio/materials'
scene['REMAINING'] = 'Art direction, dirt masks, interior cleaning states, foam and fluid simulations, tool/contact animation, final render approval'
scene['BRAND_ACCENT'] = '#E8F320'
scene.frame_set(1)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'Carcura_Studio_Base.blend'), compress=True)
(OUT / 'shots.json').write_text(json.dumps([{'frame':f,'position':p,'target':t,'lens':l,'label':n}for f,p,t,l,n in shots],indent=2))
if '--preview' in sys.argv:
    scene.render.resolution_x = 960
    scene.render.resolution_y = 600
    scene.cycles.samples = 48
    scene.render.filepath = str(OUT / 'studio-preview.png')
    bpy.ops.render.render(write_still=True)
print('CARCURA_SCENE_READY', str(OUT))
