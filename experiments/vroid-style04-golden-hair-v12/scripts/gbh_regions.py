"""Tiếp tục từ checkpoint V1.2. GBH quét tiết diện mọi card ngoài trên guide đã có."""

from pathlib import Path
from collections import defaultdict
from math import sin, cos, atan2, exp
import bpy, json, math, numpy as np
from mathutils import Vector

r = Path(__file__).resolve().parents[1]
s = bpy.context.scene
card = bpy.data.objects["Style04_Cards"]
original = card.data
old_uv = original.uv_layers.active
uvs = {}
for l in original.loops:
    uvs[l.vertex_index] = old_uv.data[l.index].uv[:]


def gn(name):
    g = bpy.data.node_groups.new(name, "GeometryNodeTree")
    for io in ["INPUT", "OUTPUT"]:
        g.interface.new_socket(
            name="Geometry", in_out=io, socket_type="NodeSocketGeometry"
        )
    return g, g.nodes.new("NodeGroupInput"), g.nodes.new("NodeGroupOutput")


def attr(g, name, typ):
    a = g.nodes.new("GeometryNodeInputNamedAttribute")
    a.data_type = typ
    a.inputs["Name"].default_value = name
    return a.outputs["Attribute"]


def socket(g, src, dst):
    g.links.new(src, dst)


def addmod(ob, group):
    m = ob.modifiers.new(group.name, "NODES")
    m.node_group = group


pre, inp, out = gn("Style04 · capture guide position")
n = pre.nodes.new("GeometryNodeStoreNamedAttribute")
n.data_type = "FLOAT_VECTOR"
n.domain = "POINT"
n.inputs["Name"].default_value = "guide_center"
socket(pre, inp.outputs[0], n.inputs["Geometry"])
socket(pre, pre.nodes.new("GeometryNodeInputPosition").outputs[0], n.inputs["Value"])
socket(pre, n.outputs[0], out.inputs[0])
post, inp, out = gn("Style04 · orienter et ajuster le profil GBH")


def vector_math(op, a, b):
    n = post.nodes.new("ShaderNodeVectorMath")
    n.operation = op
    socket(post, a, n.inputs[0])
    socket(post, b, n.inputs["Scale"] if op == "SCALE" else n.inputs[1])
    return n.outputs[0]


center = attr(post, "guide_center", "FLOAT_VECTOR")
offset = vector_math(
    "SUBTRACT", post.nodes.new("GeometryNodeInputPosition").outputs[0], center
)
rot = post.nodes.new("ShaderNodeVectorRotate")
rot.rotation_type = "AXIS_ANGLE"
for key, val in [
    ("Vector", offset),
    ("Axis", attr(post, "roll_axis", "FLOAT_VECTOR")),
    ("Angle", attr(post, "roll_angle", "FLOAT")),
]:
    socket(post, val, rot.inputs[key])
pos = vector_math(
    "ADD",
    center,
    vector_math("SCALE", rot.outputs[0], attr(post, "section_scale", "FLOAT")),
)
setpos = post.nodes.new("GeometryNodeSetPosition")
socket(post, inp.outputs[0], setpos.inputs[0])
socket(post, pos, setpos.inputs["Position"])
socket(post, setpos.outputs[0], out.inputs[0])


def evaluate(ob):
    # Blender 4.3 exposes evaluated Hair Curves mesh components through Object Info.
    proxy = bpy.data.objects.new("GBH measurement", bpy.data.meshes.new("proxy"))
    s.collection.objects.link(proxy)
    group, gi, go = gn("Read GBH mesh component")
    info = group.nodes.new("GeometryNodeObjectInfo")
    info.inputs["Object"].default_value = ob
    socket(group, info.outputs["Geometry"], go.inputs[0])
    addmod(proxy, group)
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(proxy.evaluated_get(deps), depsgraph=deps)
    bpy.data.objects.remove(proxy, do_unlink=True)
    bpy.data.node_groups.remove(group)
    return mesh


from mathutils.bvhtree import BVHTree

face = bpy.data.objects["Face"]
skin = BVHTree.FromPolygons(
    [face.matrix_world @ v.co for v in face.data.vertices],
    [
        p.vertices[:]
        for p in face.data.polygons
        if "Face_00_SKIN" in face.data.materials[p.material_index].name
    ],
)


def avoid_skin(point):
    if not 1.427 < point.z < 1.649:
        return point
    origin = Vector((0, 0.004, point.z))
    unit = (point - origin).normalized()
    hit = skin.ray_cast(origin + 0.25 * unit, -unit, 0.25)[0]
    if hit and (hit - origin).length + 0.006 > (point - origin).length:
        return hit + unit * 0.006
    return point


def overlapping_vertices(mesh):
    tree = BVHTree.FromPolygons(
        [v.co for v in mesh.vertices], [p.vertices[:] for p in mesh.polygons]
    )
    return {
        i for polygon, _ in tree.overlap(skin) for i in mesh.polygons[polygon].vertices
    }


def nudge(point):
    return point + 0.0015 * Vector((point.x, point.y - 0.004, 0)).normalized()


def swept(point):
    # Shift the fringe along the forehead. Lift the low fringe lining to open gaps.
    x, y, z = point
    angle = atan2(x, 0.008 - y)
    t = max(0.0, min(1.0, (1.692 - z) / 0.154))
    front = exp(-((abs(angle) / 0.83) ** 6))
    tip = max(0.0, min(1.0, (1.605 - z) / 0.064))
    twist = (
        0.125 * sin(2.15 * math.pi * t + 0.2 + 0.52 * sin(4 * angle)) * t * front
        + 0.11 * sin(7 * angle + 0.4) * tip * front
    )
    side = exp(-(((abs(angle) - 1.46) / 0.80) ** 2))
    twist += (
        (
            0.135 * sin((1.696 - z) * 23 + 0.5 + 0.33 * sin(4 * angle))
            + 0.055 * sin(5 * angle)
        )
        * t
        * side
    )
    u, v = x, y - 0.008
    lift = (0.009 + 0.006 * sin(angle * 8 + 0.55)) * front * tip
    return avoid_skin(
        Vector(
            (
                u * cos(twist) - v * sin(twist),
                0.008 + u * sin(twist) + v * cos(twist),
                z + lift,
            )
        )
    )


# Reload the delivery atlas into the embedded image, preserving the V1.1 materials.
atlas = next(
    n.image for n in original.materials[0].node_tree.nodes if n.type == "TEX_IMAGE"
)
atlas.filepath = str(r / "review/Style04-silk.png")
atlas.unpack(method="REMOVE")
atlas.reload()
atlas.pack()
batch = defaultdict(list)
last = 0
for o in list(s.objects):
    if o.type != "CURVES" or "card_first" not in o.data.attributes:
        continue
    for i, c in enumerate(o.data.curves):
        h = o.data
        start = h.attributes["card_first"].data[i].value
        cols = h.attributes["card_columns"].data[i].value
        line = [p.position.copy() for p in c.points]
        end = line[-1]
        region = (
            "Fringe"
            if o.name == "Frange"
            else "Sides"
            if o.name == "Tempes"
            else "Back"
            if end.y > 0.036
            else "Crown"
        )
        batch[(region, cols)].append((start, line))
        last = max(last, start + cols * len(line))
collection = bpy.data.collections.new("STYLE04 • GBH live regions")
s.collection.children.link(collection)
spec = "GBH Profile Line Hair Cards"
entry = repr((spec, "GBH Library - Essentials.blend"))
ops = {}
for key, result in [
    ("reload_library", bpy.ops.gbh.reload_library()),
    ("node_group_append", bpy.ops.gbh.node_group_append(nodename=entry)),
]:
    assert result == {"FINISHED"}
    ops[key] = list(result)
bpy.context.preferences.addons[
    "bl_ext.user_default.gbhtool"
].preferences.lib_add_to_active_object = True
pieces = []
evidence = []
for (region, cols), items in sorted(batch.items()):
    h = bpy.data.hair_curves.new(region)
    h.add_curves([len(line) for _, line in items])
    centers = [p for _, line in items for p in line]
    h.position_data.foreach_set("vector", np.asarray(centers, dtype="f").ravel())
    h.attributes.new("resolution", "INT", "CURVE").data.foreach_set(
        "value", np.ones(len(items), dtype="i")
    )
    if "curve_type" not in h.attributes:
        h.attributes.new("curve_type", "INT8", "CURVE").data.foreach_set(
            "value", np.ones(len(items), dtype="i")
        )
    radius = np.array(
        [
            max(0.14, 1 - 0.84 * (j / (len(line) - 1)) ** 3)
            for _, line in items
            for j in range(len(line))
        ],
        dtype="f",
    )
    h.attributes.new("radius", "FLOAT", "POINT").data.foreach_set("value", radius)
    ob = bpy.data.objects.new(f"GBH • {region} • {cols}", h)
    collection.objects.link(ob)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    s.hair_object = ob
    addmod(ob, pre)
    result = bpy.ops.gbh.node_group_add_to_object(nodename=entry)
    assert result == {"FINISHED"}
    m = ob.modifiers[spec]
    m["Input_13"] = cols - 1
    m["Input_11"] = 1.0
    m["Input_12"] = 0.15
    ob.update_tag()
    raw = evaluate(ob)
    assert len(raw.vertices) == len(centers) * cols, (
        region,
        len(raw.vertices),
        len(centers) * cols,
    )
    axes = []
    angles = []
    scales = []
    rest_width = []
    tip_width = []
    uv = []
    for start, line in items:
        for j, p in enumerate(line):
            a = len(axes) * cols
            d = start + j * cols
            sweep = raw.vertices[a + cols - 1].co - raw.vertices[a].co
            target = original.vertices[d + cols - 1].co - original.vertices[d].co
            rotation = (
                sweep.rotation_difference(target)
                if target.length > 0.00001
                else sweep.rotation_difference(Vector((1, 0, 0)))
            )
            axes.append(rotation.axis[:])
            angles.append(rotation.angle)
            scales.append(max(target.length, 0.00003) / max(sweep.length, 0.000001))
            uv.extend([uvs[d + k] for k in range(cols)])
            if j == len(line) // 2:
                rest_width.append(target.length * 1000)
            if j == len(line) - 1:
                tip_width.append(target.length * 1000)
    for key, typ, values in [
        ("roll_axis", "FLOAT_VECTOR", axes),
        ("roll_angle", "FLOAT", angles),
        ("section_scale", "FLOAT", scales),
    ]:
        h.attributes.new(key, typ, "POINT").data.foreach_set(
            "vector" if typ == "FLOAT_VECTOR" else "value",
            np.array(values, dtype="f").ravel(),
        )
    h.position_data.foreach_set(
        "vector", np.asarray([swept(p) for p in centers], dtype="f").ravel()
    )
    addmod(ob, post)
    ob.update_tag()
    baked = evaluate(ob)
    bpy.data.meshes.remove(raw)
    # Preserve the swept profile. Point-domain corrections move only edges touching skin.
    start_pos = [v.co.copy() for v in baked.vertices]
    for attempt in range(60):
        collisions = overlapping_vertices(baked)
        if not collisions:
            break
        for idx in collisions:
            baked.vertices[idx].co = nudge(baked.vertices[idx].co)
    if overlapping_vertices(baked):
        raise RuntimeError("Giao da ở nhóm " + region)
    offsets = [v.co - p for v, p in zip(baked.vertices, start_pos)]
    corrected = sum(delta.length > 0.000001 for delta in offsets)
    if corrected:
        # Sample a persistent rest correction by GBH vertex index after the sweep.
        correction_mesh = bpy.data.meshes.new("Skin clearance " + ob.name)
        correction_mesh.from_pydata(offsets, [], [])
        correction = bpy.data.objects.new("Clearance " + ob.name, correction_mesh)
        correction.hide_render = True
        collection.objects.link(correction)
        fitg, gin, gout = gn("Style04 · dégagement " + ob.name)
        info = fitg.nodes.new("GeometryNodeObjectInfo")
        info.inputs["Object"].default_value = correction
        sample = fitg.nodes.new("GeometryNodeSampleIndex")
        sample.data_type = "FLOAT_VECTOR"
        sample.domain = "POINT"
        socket(fitg, info.outputs["Geometry"], sample.inputs["Geometry"])
        socket(
            fitg,
            fitg.nodes.new("GeometryNodeInputPosition").outputs[0],
            sample.inputs["Value"],
        )
        socket(
            fitg,
            fitg.nodes.new("GeometryNodeInputIndex").outputs[0],
            sample.inputs["Index"],
        )
        shift = fitg.nodes.new("GeometryNodeSetPosition")
        socket(fitg, gin.outputs[0], shift.inputs["Geometry"])
        socket(fitg, sample.outputs["Value"], shift.inputs["Offset"])
        socket(fitg, shift.outputs[0], gout.inputs[0])
        addmod(ob, fitg)
        bpy.data.meshes.remove(baked)
        baked = evaluate(ob)
        assert not overlapping_vertices(baked)
    batch_id = len(pieces) + 1
    ob["style04Batch"] = batch_id
    for key, values in [
        ("style04_batch", np.full(len(baked.vertices), batch_id, dtype="i")),
        ("style04_index", np.arange(len(baked.vertices), dtype="i")),
    ]:
        baked.attributes.new(key, "INT", "POINT").data.foreach_set("value", values)
    assert len(baked.polygons) == sum((len(l) - 1) * (cols - 1) for _, l in items)
    layer = baked.uv_layers.new(name="UVMap")
    for l in baked.loops:
        layer.data[l.index].uv = uv[l.vertex_index]
    for p in baked.polygons:
        p.use_smooth = True
    baked.materials.clear()
    baked.materials.append(original.materials[0])
    obj = bpy.data.objects.new(ob.name + " • baked", baked)
    s.collection.objects.link(obj)
    pieces.append(obj)
    evidence.append(
        dict(
            region=region,
            curves=len(items),
            modifiers=[m.node_group.name for m in ob.modifiers],
            operator=list(result),
            clearanceVertices=corrected,
            maximumClearanceMm=max(d.length for d in offsets) * 1000,
            gbhQuads=len(baked.polygons),
            medianMidWidthMm=float(np.median(rest_width)),
            medianTipWidthMm=float(np.median(tip_width)),
        )
    )
# Preserve the short lining only. It fills the interior behind the GBH layers.
import bmesh

bm = bmesh.new()
bm.from_mesh(original)
bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm, geom=list(bm.verts)[:last], context="VERTS")
bm.to_mesh(original)
bm.free()
for v in original.vertices:
    v.co = swept(v.co)
for attempt in range(60):
    collisions = overlapping_vertices(original)
    if not collisions:
        break
    for i in collisions:
        original.vertices[i].co = nudge(original.vertices[i].co)
assert not overlapping_vertices(original)
# Transform the accent guides and their existing GBH punch-out together.
accent = bpy.data.objects["GBH • Finishing fibres"].data
for p in accent.position_data:
    p.vector = swept(p.vector)
for v in bpy.data.objects["Style04_Fine_Fibres"].data.vertices:
    v.co = swept(v.co)
bpy.ops.object.select_all(action="DESELECT")
for p in pieces:
    p.select_set(True)
card.select_set(True)
bpy.context.view_layer.objects.active = card
bpy.ops.object.join()
g = card.vertex_groups["J_Bip_C_Head"]
g.add(list(range(len(card.data.vertices))), 1, "REPLACE")
collection.hide_render = True
collection.hide_viewport = True
s.hair_object = None
for text in list(bpy.data.texts):
    if "Cập nhật card" in text.name:
        bpy.data.texts.remove(text)
(r / "review/gbh-regions.json").write_text(
    json.dumps(
        {"operators": ops, "regions": evidence, "nativeLiningTriangles": 5320}, indent=2
    )
)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(
    filepath=str(r / "out/Vita-Style04-Golden-Hair-V12.blend"), compress=True
)
