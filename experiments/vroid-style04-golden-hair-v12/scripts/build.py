"""Author a parted, layered bob on the V1.1 rest head. Unit: metre."""

import bpy, math, json, random, pathlib
import numpy as np
from math import sin, cos, pi
from mathutils import Vector
from mathutils.bvhtree import BVHTree

r = pathlib.Path(__file__).resolve().parents[1]
scene = bpy.context.scene
rng = random.Random(120404)
rig = bpy.data.objects["Armature"]
scalp = bpy.data.objects["Scalp"]
stem = "Vita-Style04-Golden-Hair-V12"
item = "hair-style04-lavender-bob"
tree = BVHTree.FromPolygons(
    [scalp.matrix_world @ v.co for v in scalp.data.vertices],
    [p.vertices[:] for p in scalp.data.polygons],
)
face = bpy.data.objects["Face"]
skin = BVHTree.FromPolygons(
    [face.matrix_world @ v.co for v in face.data.vertices],
    [
        p.vertices[:]
        for p in face.data.polygons
        if "Face_00_SKIN" in face.data.materials[p.material_index].name
    ],
)


def clearance(x, y, z):
    if z < 1.445 or z > 1.635:
        return Vector((x, y, z))
    origin = Vector((0, 0.004, z))
    d = Vector((x, y - 0.004, 0))
    length = d.length
    if length > 0.001:
        normal = d / length
        hit = skin.ray_cast(origin + normal * 0.23, -normal, 0.23)[0]
        if hit and (hit - origin).length + 0.004 > length:
            return hit + normal * 0.004
    return Vector((x, y, z))


for n in ["Hair_Bob", "Hair_Lob", "Ribbon_Champagne"]:
    o = bpy.data.objects[n]
    o.hide_set(True)
    o.hide_render = True


def smooth(t):
    t = max(0, min(1, t))
    return t * t * (3 - 2 * t)


def bind(o):
    g = o.vertex_groups.new(name="J_Bip_C_Head")
    g.add(list(range(len(o.data.vertices))), 1, "REPLACE")
    o.parent = rig
    m = o.modifiers.new("Vita • Head", "ARMATURE")
    m.object = rig
    o["cosmeticSlot"] = "HairSlot"
    o["cosmeticId"] = item


def active(o):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = o
    o.select_set(True)


def make_material():
    m = bpy.data.materials.new("Style04 · Améthyste soie")
    m.use_nodes = True
    bs = m.node_tree.nodes["Principled BSDF"]
    bs.inputs["Roughness"].default_value = 0.56
    bs.inputs["Specular IOR Level"].default_value = 0.22
    im = bpy.data.images.load(str(r / "review/Style04-silk.png"))
    im.pack()
    n = m.node_tree.nodes.new("ShaderNodeTexImage")
    n.image = im
    n.interpolation = "Linear"
    m.node_tree.links.new(n.outputs["Color"], bs.inputs["Base Color"])
    cut = m.node_tree.nodes.new("ShaderNodeMath")
    cut.operation = "GREATER_THAN"
    cut.inputs[1].default_value = 0.42
    m.node_tree.links.new(n.outputs["Alpha"], cut.inputs[0])
    m.node_tree.links.new(cut.outputs[0], bs.inputs["Alpha"])
    m.use_backface_culling = False
    return m


silk = make_material()
verts = []
faces = []
uv = []
guide_sets = {"Nappe intérieure": [], "Voile extérieur": [], "Frange": [], "Tempes": []}
wisps = []


def path(a, t, k, end, layer, phase, half, swing, kind):
    side = 1 if a >= 0 else -1
    # A front-to-back part fans out across the dome; the fringe emerges from the front of that part.
    wt = 1 - 0.15 * smooth((t - 0.62) / 0.38) - 0.63 * smooth((t - 0.75) / 0.25)
    az = a + k * half * wt
    tail = smooth((t - 0.46) / 0.54)
    turn = (
        0.16 * math.tanh(3 * sin(a)) * sin(pi * t)
        + swing * (0.45 * sin(1.4 * pi * t) + tail)
        + 0.078 * sin(phase + 5.1 * t) * tail
    )
    if kind == "Frange":
        turn += 0.10 * sin(phase + 3 * t) * t + 0.07 * sin(2 * pi * t)
    curtain = smooth((abs(a) - 0.41) / 0.48) * (1 - smooth((abs(a) - 2.0) / 0.9))
    turn += (
        side
        * curtain
        * (0.34 * sin(pi * t) ** 1.5 + 0.24 * sin(2.3 * pi * t + 0.40) * tail)
    )
    if kind == "Tempes":
        turn += side * (0.19 * sin(2 * pi * t) - 0.23 * tail)
    if kind == "Lining":
        turn = 0.08 * sin(2 * az) * sin(pi * t)
    th = az + turn
    top = 1.701 + 0.0035 * layer + 0.003 * sin(a * 3)
    equator = 1.577
    length = (top - equator) * pi / 2 + equator - end
    d = length * t
    phi = min(pi / 2, d / (top - equator))
    z = equator + (top - equator) * cos(phi) - max(0, d - (top - equator) * pi / 2)
    rad = sin(phi)
    q = max(0, min(1, (equator - z) / 0.205))
    th -= side * curtain * (0.49 + 0.09 * sin(phase)) * smooth((q - 0.34) / 0.65)
    # Side curtains widen below the ears, then turn inward around the neck.
    xrad = (
        0.115 + 0.0048 * layer + 0.014 * sin(pi * q) - 0.027 * smooth((q - 0.53) / 0.43)
    )
    yrad = (
        0.119 + 0.004 * layer + 0.012 * sin(pi * q) - 0.016 * smooth((q - 0.61) / 0.39)
    )
    dome = (1 - rad) ** 1.4
    partx = -0.008 + 0.004 * cos(az)
    x = partx * dome + sin(th) * xrad * rad
    y = 0.008 - cos(th) * yrad * rad - 0.054 * cos(az) * dome
    if q > 0:
        x += side * (
            0.012 * sin(2 * pi * q + phase * 0.45) * q + 0.004 * sin(2 * az) * q
        )
        y -= 0.009 * sin(pi * q) * sin(th) ** 2
    # A gently convex transverse section. The atlas supplies the sub-strands.
    relief = 0.00085 * (1 - k * k) * sin(pi * t) + 0.001 * sin(phase + 2 * t) * rad
    x += sin(th) * relief
    y -= cos(th) * relief
    if t < 0.19:
        hit = tree.ray_cast(Vector((x, y, 1.8)), Vector((0, 0, -1)), 0.22)[0]
        if hit:
            z += (hit.z + 0.00045 + 0.003 * layer * smooth(t / 0.18) - z) * (
                1 - smooth(t / 0.19)
            )
    return clearance(x, y, z)


guide_map = {key: [] for key in guide_sets}


def card(a, end, layer, half, swing, phase, kind, seg):
    seq = []
    tile = rng.randrange(1, 8) if layer >= 0 else 0
    cross = 3 if kind in ["Nappe intérieure", "Voile extérieur"] else 2
    start = len(verts)
    for j in range(seg + 1):
        t = j / seg
        seq.append(path(a, t, 0, end, layer, phase, half, swing, kind))
        for i in range(cross + 1):
            k = 2 * i / cross - 1
            v = path(
                a, t, k, end + 0.005 * k * sin(phase), layer, phase, half, swing, kind
            )
            # Keep the painted reflection at the same head height as the card length changes.
            pigment = max(0.015, min(0.78, (1.702 - v.z) * 4.55))
            fade = smooth((t - 0.52) / 0.25)
            longitudinal = pigment * (1 - fade) + t * fade
            verts.append(v)
            uv.append(((tile + 0.012 + 0.976 * i / cross) / 8, 1 - longitudinal))
            if i and j:
                d = start + j * (cross + 1) + i
                faces.append((d - cross - 2, d - 1, d, d - cross - 1))
    guide_sets[kind].append(seq)
    guide_map[kind].append((start, cross + 1))
    if kind in ["Tempes", "Frange"] or (
        kind == "Voile extérieur" and rng.random() < 0.48
    ):
        k = rng.uniform(-0.85, 0.85)
        # Very fine free silhouette fibres extend beyond the tips of selected cards.
        wisps.append(
            [
                path(
                    a,
                    float(t),
                    k + 0.14 * sin(pi * t + phase),
                    end - 0.006,
                    layer + 0.12,
                    phase,
                    half,
                    swing,
                    kind,
                )
                for t in np.linspace(0, 1, 19)
            ]
        )


for layer, count in [(-0.7, 33), (0, 49), (1, 51)]:
    for i in range(count):
        a = -pi + 2 * pi * (i + 0.45 * layer + rng.uniform(-0.18, 0.18)) / count
        if a < -pi:
            a += 2 * pi
        aa = abs(a)
        blend = smooth((aa - 0.47) / 0.46)
        fringe = 1.55 + 0.010 * sin(7 * a + 0.6) + 0.008 * cos(13 * a)
        end = (
            (1 - blend) * fringe
            + blend * (1.373 + 0.011 * cos(3 * a - 0.6) + 0.008 * sin(8 * a))
            + 0.008 * max(0, layer)
            + (0.016 if layer < 0 else 0)
            + rng.uniform(-0.009, 0.009)
        )
        card(
            a,
            end,
            layer,
            pi / count * (2.0 if layer < 0 else rng.uniform(1.40, 1.64)),
            0.10 * sin(3 * a) + rng.uniform(-0.085, 0.085),
            rng.uniform(0, 6.28),
            "Voile extérieur" if layer > 0 else "Nappe intérieure",
            22,
        )
# Individually specified fringe lengths and sweep, with smaller supplementary strands in between.
for i, (a, end, sw) in enumerate(
    [
        (-0.78, 1.488, -0.12),
        (-0.64, 1.535, -0.19),
        (-0.54, 1.55, -0.12),
        (-0.42, 1.553, -0.13),
        (-0.31, 1.544, -0.04),
        (-0.20, 1.547, 0.045),
        (-0.105, 1.536, 0.10),
        (-0.025, 1.529, 0.12),
        (0.07, 1.539, 0.045),
        (0.19, 1.546, -0.065),
        (0.30, 1.556, 0.075),
        (0.41, 1.552, 0.12),
        (0.51, 1.548, 0.14),
        (0.62, 1.521, 0.16),
        (0.76, 1.487, 0.12),
    ]
):
    card(a, end, 1.65, rng.uniform(0.048, 0.083), sw, i * 1.81, "Frange", 22)
for side in (-1, 1):
    for i in range(10):
        a = side * (0.84 + i * 0.14 + rng.uniform(-0.025, 0.025))
        end = 1.369 + 0.024 * sin(0.47 * i + 0.8) + rng.uniform(-0.008, 0.008)
        card(
            a,
            end,
            1.75,
            rng.uniform(0.038, 0.072),
            side * rng.uniform(-0.12, 0.14),
            i * 0.71 + 2 * side,
            "Tempes",
            24,
        )


# Hand-placed S-shaped cheek layers. Each path traverses the temple, ear and nape.
# Their own centre lines join the editable guide set.
def catmull(points, t):
    v = t * (len(points) - 1)
    i = min(len(points) - 2, int(v))
    u = v - i
    a, b, c, d = [
        points[max(0, min(len(points) - 1, k))] for k in (i - 1, i, i + 1, i + 2)
    ]
    return 0.5 * (
        2 * b
        + (-a + c) * u
        + (2 * a - 5 * b + 4 * c - d) * u * u
        + (-a + 3 * b - 3 * c + d) * u**3
    )


for side in [-1, 1]:
    for layer in range(5):
        e = layer / 4
        controls = [
            (0.012 + e * 0.012, -0.049 + e * 0.012, 1.678),
            (0.067 + e * 0.020, -0.072 + e * 0.018, 1.665),
            (0.091 + e * 0.020, -0.090 + e * 0.023, 1.619),
            (0.098 + e * 0.020, -0.087 + e * 0.020, 1.565),
            (0.107 + e * 0.022, -0.068 + e * 0.018, 1.510),
            (0.111 + e * 0.019, -0.061 + e * 0.018, 1.451),
            (0.099 + e * 0.019, -0.064 + e * 0.020, 1.408),
            (
                0.077 + e * 0.017,
                -0.065 + e * 0.018,
                1.394 - 0.014 * e + 0.007 * sin(layer + side),
            ),
        ]
        controls = [Vector((side * x, y, z)) for x, y, z in controls]
        seq = []
        start = len(verts)
        cols = 4
        tile = 1 + (layer * 2) % 7
        for j in range(32):
            t = j / 31
            center = catmull(controls, t)
            if t < 0.19:
                hit = tree.ray_cast((center.x, center.y, 1.80), (0, 0, -1), 0.22)[0]
                if hit:
                    center.z += (hit.z + 0.00045 - center.z) * (1 - smooth(t / 0.19))
            width = (
                (0.0058 + 0.0014 * sin(layer * 2))
                * (0.3 + 0.7 * sin(pi * t) ** 0.48)
                * (1 - 0.7 * smooth((t - 0.82) / 0.18))
            )
            tangent = Vector((0.8 * side, 0.60, 0)).normalized()
            seq.append(center)
            for i in range(cols):
                k = 2 * i / (cols - 1) - 1
                p = (
                    center
                    + tangent * k * width
                    + Vector((0.0008 * side, -0.0013, 0)) * (1 - k * k)
                )
                verts.append(clearance(*p))
                pigment = min(0.78, max(0.015, (1.702 - p.z) * 4.55))
                f = smooth((t - 0.52) / 0.25)
                uv.append(
                    (
                        (tile + 0.018 + 0.964 * i / (cols - 1)) / 8,
                        1 - (pigment * (1 - f) + t * f),
                    )
                )
                if i and j:
                    n = start + j * cols + i
                    faces.append((n - cols - 1, n - 1, n, n - cols))
        guide_sets["Tempes"].append(seq)
        guide_map["Tempes"].append((start, cols))
# Overlapping underfur cards use a continuous sweep and a short feathered hem.
# This closes sight-lines across the back of the neck without extending the outer silhouette.
for i in range(35):
    a = -pi + (i + 0.5) * 2 * pi / 35
    start = len(verts)
    seg = 19
    cross = 4
    for j in range(seg + 1):
        t = j / seg
        for k in range(cross + 1):
            u = k / cross
            angle = a + (u - 0.5) * 2 * pi / 35 * 1.22
            blend = smooth((abs(angle) - 0.57) / 0.45)
            end = (1 - blend) * (1.554 + 0.009 * sin(angle * 10)) + blend * (
                1.407 + 0.008 * cos(4 * angle) + 0.013 * max(0, -cos(angle))
            )
            pp = path(
                angle,
                t,
                0,
                end,
                -0.86,
                0.65 * sin(angle * 3),
                0,
                0.04 * sin(angle),
                "Lining",
            )
            verts.append(pp)
            uv.append(
                (
                    (0.18 + 0.64 * u) / 8,
                    1 - (0.07 + 0.63 * t + 0.27 * smooth((t - 0.93) / 0.07)),
                )
            )
            if j and k:
                n = start + j * (cross + 1) + k
                faces.append((n - cross - 2, n - 1, n, n - cross - 1))
mesh = bpy.data.meshes.new("Style04 • UV cards")
mesh.from_pydata(verts, [], faces)
mesh.materials.append(silk)
mesh.update()
uvl = mesh.uv_layers.new(name="UVMap")
for l in mesh.loops:
    uvl.data[l.index].uv = uv[l.vertex_index]
for p in mesh.polygons:
    p.use_smooth = True
cards = bpy.data.objects.new("Style04_Cards", mesh)
scene.collection.objects.link(cards)
bind(cards)
collection = bpy.data.collections.new("Style 04 • Guides éditables")
scene.collection.children.link(collection)


def guides(name, lines):
    h = bpy.data.hair_curves.new(name)
    h.add_curves([len(p) for p in lines])
    h.position_data.foreach_set(
        "vector", np.array([list(v) for seq in lines for v in seq], dtype="f").ravel()
    )
    ob = bpy.data.objects.new(name, h)
    collection.objects.link(ob)
    return ob


for name, lines in guide_sets.items():
    g = guides(name, lines)
    h = g.data
    for i, attr in enumerate(["card_first", "card_columns"]):
        a = h.attributes.new(attr, "INT", "CURVE")
        a.data.foreach_set("value", np.array(guide_map[name], dtype="i")[:, i].copy())
    stored = h.attributes.new("last_card_position", "FLOAT_VECTOR", "POINT")
    stored.data.foreach_set(
        "vector", np.array([list(p) for seq in lines for p in seq], dtype="f").ravel()
    )
text = bpy.data.texts.new("Style04 · Cập nhật card từ guide.py")
text.write((r / "scripts/update_cards.py").read_text())
ob = guides("GBH • Finishing fibres", wisps)
h = ob.data
rad = h.attributes.new("radius", "FLOAT", "POINT")
rad.data.foreach_set(
    "value", np.tile(np.linspace(0.8, 0.06, 19, dtype="f"), len(wisps))
)
res = h.attributes.new("resolution", "INT", "CURVE")
res.data.foreach_set("value", np.ones(len(wisps), dtype="i"))


def op(result):
    assert "FINISHED" in result
    return list(result)


spec = "GBH Profile Polygon Hair Cards"
entry = repr((spec, "GBH Library - Essentials.blend"))
log = {
    "reload_library": op(bpy.ops.gbh.reload_library()),
    "node_group_append": op(bpy.ops.gbh.node_group_append(nodename=entry)),
}
bpy.context.preferences.addons[
    "bl_ext.user_default.gbhtool"
].preferences.lib_add_to_active_object = True
active(ob)
scene.hair_object = ob
log["node_group_add_to_object"] = op(
    bpy.ops.gbh.node_group_add_to_object(nodename=entry)
)
mod = ob.modifiers[spec]
mod["Input_11"] = 0.038
mod["Input_12"] = 3
ob.update_tag()
bpy.context.view_layer.update()
log["convert_hair"] = op(bpy.ops.gbh.convert_hair(convert_to="MESH"))
fibre = bpy.context.active_object
assert fibre.type == "MESH"
for c in list(fibre.users_collection):
    c.objects.unlink(fibre)
scene.collection.objects.link(fibre)
fibre.name = "Style04_Fine_Fibres"
bind(fibre)
# A central, fully opaque atlas sample on the narrow accent fibres permits one shared material.
if not fibre.data.uv_layers:
    uvf = fibre.data.uv_layers.new(name="SilkUV")
else:
    uvf = fibre.data.uv_layers.active
for l in fibre.data.loops:
    uvf.data[l.index].uv = (0.052, 0.53)
fibre.data.materials.clear()
fibre.data.materials.append(silk)
for p in fibre.data.polygons:
    p.use_smooth = True
    p.material_index = 0
scene.hair_object = None
collection.hide_viewport = True
collection.hide_render = True
log.update(
    lining_cards=35,
    group=spec,
    width=0.038,
    profile=3,
    curves=len(wisps),
    source_guides={k: len(v) for k, v in guide_sets.items()},
)
for o in (cards, fibre):
    o.data.calc_loop_triangles()
    log[o.name] = len(o.data.loop_triangles)
(r / "review/groom.json").write_text(json.dumps(log, indent=2))
cam = scene.camera
cam.location = (0, -3, 1.552)
cam.rotation_euler = (
    (Vector((0, 0, 1.536)) - cam.location).to_track_quat("-Z", "Y").to_euler()
)
cam.data.ortho_scale = 0.425
scene.render.resolution_x = 650
scene.render.resolution_y = 740
bpy.context.preferences.filepaths.save_version = 0
active(cards)
bpy.ops.wm.save_as_mainfile(filepath=str(r / "out" / (stem + ".blend")), compress=True)
