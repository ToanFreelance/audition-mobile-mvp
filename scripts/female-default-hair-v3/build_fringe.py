"""Build the Hunyuan bob and a layered opaque fringe in the approved face scene."""
import sys
import bpy
import numpy as np
import hashlib
from pathlib import Path
shell_path, output = (Path(arg).resolve() for arg in sys.argv[sys.argv.index('--') + 1:])
reference = Path(bpy.data.filepath)
if hashlib.sha256(reference.read_bytes()).hexdigest() != 'd8cdbbd9a543a0b6ba9efbd623c3e40d9f9ce2ab07ce770d948f558d9bf9b506':
    raise ValueError('Open the hash-locked V1 Blender scene before rebuilding the V3 hair')
output.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
s = bpy.context.scene
for o in list(s.objects):
    if o.name.startswith('S04_') or o.name == 'Style04_HeadAttachment':
        bpy.data.objects.remove(o, do_unlink=True)
hair = bpy.data.collections.new('Style 04 · Hunyuan bob')
s.collection.children.link(hair)
fringe = bpy.data.collections.new('Rebuilt fringe · individual locks')
hair.children.link(fringe)
bpy.ops.import_scene.gltf(filepath=str(shell_path))
bob = next((o for o in bpy.context.selected_objects if o.type == 'MESH'))
bob.name = 'Style04_Crown_Sides_Nape'
for col in list(bob.users_collection):
    col.objects.unlink(bob)
hair.objects.link(bob)
bob.data.materials[0].name = 'Hunyuan · source PBR'
p = bob.data.materials[0].node_tree.nodes.get('Principled BSDF')
p.inputs['Specular IOR Level'].default_value = 0.24
m = bpy.data.materials.new('Fringe · lilac fibre pigment')
m.use_nodes = True
p = m.node_tree.nodes.get('Principled BSDF')
p.inputs['Roughness'].default_value = 0.47
p.inputs['Specular IOR Level'].default_value = 0.29
tex = m.node_tree.nodes.new('ShaderNodeTexImage')
tex.image = bpy.data.images.load(str(Path(__file__).with_name('fringe-pigment.png')))
tex.image.pack()
m.node_tree.links.new(tex.outputs['Color'], p.inputs['Base Color'])

def interp(knots, t):
    """Interpolate the artist guides with a uniform Catmull-Rom spline."""
    a = np.array(knots)
    u = t * (len(a) - 1)
    i = min(int(u), len(a) - 2)
    q = u - i
    v0, v1, v2, v3 = (a[max(0, i - 1)], a[i], a[i + 1], a[min(len(a) - 1, i + 2)])
    return 0.5 * (2 * v1 + (-v0 + v2) * q + (2 * v0 - 5 * v1 + 4 * v2 - v3) * q * q + (-v0 + 3 * v1 - 3 * v2 + v3) * q * q * q)
# Four x guide stations, end height, width, bend, layer depth, and lock count.
guides = [
    ('TempleL', [-0.025, -0.109, -0.165, -0.209], 0.602, 0.045, -0.005, -0.001, 4),
    ('SweepL', [-0.006, -0.078, -0.125, -0.16], 0.623, 0.046, -0.004, 0.006, 5),
    ('PartL', [-0.002, -0.047, -0.069, -0.083], 0.671, 0.035, 0.011, 0.002, 4),
    ('VeilL', [0.001, -0.025, -0.035, -0.022], 0.635, 0.032, 0.011, 0.011, 4),
    ('Center', [0.006, 0.0, 0.002, 0.036], 0.601, 0.045, 0.018, 0.014, 6),
    ('CenterR', [0.013, 0.023, 0.049, 0.078], 0.619, 0.039, 0.021, 0.01, 5),
    ('PartR', [0.017, 0.046, 0.079, 0.098], 0.667, 0.03, 0.009, 0.002, 4),
    ('SweepR', [0.027, 0.086, 0.135, 0.181], 0.636, 0.043, 0.009, 0.003, 5),
    ('TempleR', [0.036, 0.125, 0.177, 0.22], 0.599, 0.034, 0.014, -0.002, 4),
]

def one_lock(name, xs, tip, w, bend, layer, j, count, idx):
    r = (j + 0.5) / count * 2 - 1
    rootz = 0.979 + 0.008 * np.sin(idx + 1.8 * j)
    tip = tip - 0.015 + 0.036 * abs(r) ** 1.8 + 0.014 * np.sin(2.4 * j + idx * 1.73)
    dx = r * w * (0.98 + 0.22 * np.sin(idx + 0.4))
    xs = np.array(xs) + np.array([0.18, 0.64, 0.83, 1.18]) * dx
    xs[-1] += bend * (1 - r * r) + 0.011 * np.sin(j * 2.1 + idx)
    nseg, across = (46, 8)
    verts = []
    faces = []
    uv = []
    for k in range(nseg + 1):
        t = k / nseg
        zz = interp([rootz, 0.885, 0.753, tip], t)
        cx = interp(xs, t)
        sweep = {1: -0.025, 2: 0.02, 3: 0.03, 4: 0.048, 5: 0.035, 6: -0.012}.get(idx, 0.012)
        # Turn the individual tips across the brow in the lower third.
        lower = max(0, (t - 0.62) / 0.38)
        cx += sweep * (lower ** 2.8 - 0.45 * lower) + 0.006 * np.sin(j + idx) * lower ** 2
        depth = interp([0.167, 0.28, 0.337, 0.317], t) - 0.87 * cx * cx + layer * np.sin(np.pi * t) ** 0.65
        depth += 0.0025 * np.cos(j * 1.6 + idx) * np.sin(np.pi * t)
        width = w / count * (1.32 + 0.23 * np.cos(j + idx))
        width *= interp([0.21, 1.12, 1.1, 0.9, 0.42, 0.008], t)
        for l in range(across + 1):
            u = l / across * 2 - 1
            arch = (1 - u * u) * width * (0.24 + 0.12 * np.sin(idx * 0.83))
            xx = cx + width * u
            yy = -(depth + arch - 0.93 * (xx * xx - cx * cx))
            verts.append((xx, yy, zz + 0.0014 * u * np.sin(np.pi * t)))
            uv.append((0.08 + 0.82 * (0.5 + 0.5 * u), 1 - t))
    for k in range(nseg):
        for l in range(across):
            a = k * (across + 1) + l
            faces.append((a, a + across + 1, a + across + 2, a + 1))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    fringe.objects.link(obj)
    mesh.materials.append(m)
    uvmap = mesh.uv_layers.new(name='Flow')
    for poly in mesh.polygons:
        poly.use_smooth = True
        for li in poly.loop_indices:
            uvmap.data[li].uv = uv[mesh.loops[li].vertex_index]
for idx, (name, xs, tip, w, bend, layer, count) in enumerate(guides):
    for j in range(count):
        one_lock(f'S04_{name}_{j + 1:02d}', xs, tip, w, bend, layer, j, count, idx)
bpy.ops.object.select_all(action='DESELECT')
for o in hair.all_objects:
    o.select_set(True)
bpy.context.view_layer.objects.active = bob
bpy.ops.export_scene.gltf(filepath=str(output / 'Style04-V3-Hair.glb'), export_format='GLB', use_selection=True, export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=str(output / 'Style04-V3-Authoring.blend'), compress=True)
