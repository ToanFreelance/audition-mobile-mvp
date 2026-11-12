"""V1.3. Các guide chủ động định nghĩa flow, bề rộng và taper trước bước GBH."""

from pathlib import Path
import bpy, math, json, random
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root = Path(__file__).resolve().parents[1]
rng = random.Random(130413)
s = bpy.context.scene
stage = "checkpoint"
stem = "Vita-Style04-Groom-V13"
item = "hair-style04-lavender-bob-v13"
rig = bpy.data.objects["Armature"]
scalp = bpy.data.objects["Scalp"]
skin_obj = bpy.data.objects["Face"]
scalp_bvh = BVHTree.FromPolygons(
    [v.co for v in scalp.data.vertices], [p.vertices[:] for p in scalp.data.polygons]
)
skin_bvh = BVHTree.FromPolygons(
    [v.co for v in skin_obj.data.vertices],
    [
        p.vertices[:]
        for p in skin_obj.data.polygons
        if "Face_00_SKIN" in skin_obj.data.materials[p.material_index].name
    ],
)
for ob in bpy.data.objects:
    if (
        ob.get("cosmeticSlot") == "HairSlot"
        or ob.name.startswith("Style04_")
        or ob.name == "Ribbon_Champagne"
    ):
        ob.hide_render = True
        ob.hide_set(True)
for c in list(bpy.data.collections):
    if "GBH" in c.name or "Guides" in c.name:
        c.hide_render = True
        c.hide_viewport = True
collection = bpy.data.collections.new("STYLE04 V13 • Native Hair Curves")
s.collection.children.link(collection)
mesh_collection = bpy.data.collections.new("STYLE04 V13 • Export mesh")
s.collection.children.link(mesh_collection)


def catmull(points, t):
    a = t * (len(points) - 1)
    i = min(int(a), len(points) - 2)
    u = a - i
    p, q, r, v = [
        points[min(max(j, 0), len(points) - 1)] for j in (i - 1, i, i + 1, i + 2)
    ]
    return 0.5 * (
        2 * q
        + (-p + r) * u
        + (2 * p - 5 * q + 4 * r - v) * u * u
        + (-p + 3 * q - 3 * r + v) * u**3
    )


def root_on_scalp(x, y):
    hit = scalp_bvh.ray_cast(Vector((x, y, 1.80)), Vector((0, 0, -1)), 0.3)[0]
    if hit is None:
        raise ValueError(("Scalp root missing", x, y))
    return hit + Vector((0, 0, 0.0005))


def clear_face(p):
    if 1.435 < p.z < 1.638:
        center = Vector((0, 0.004, p.z))
        ray = (p - center).normalized()
        hit = skin_bvh.ray_cast(center + ray * 0.24, -ray, 0.24)[0]
        if hit and (hit - center).length + 0.006 > (p - center).length:
            return hit + ray * 0.006
    return p


regions = {
    name: []
    for name in ["Fringe", "Crown", "LeftSide", "RightSide", "Back", "Secondary"]
}


def add(region, controls, width, layer=0):
    controls = [Vector(v) for v in controls]
    controls[0] = root_on_scalp(controls[0].x, controls[0].y)
    seg = 30 if region in ["LeftSide", "RightSide", "Back"] else 26
    pts = [clear_face(catmull(controls, j / seg)) for j in range(seg + 1)]
    regions[region].append(
        dict(
            points=pts,
            width=width,
            tile=rng.randrange(8),
            phase=rng.uniform(0, 6.28),
            layer=layer,
        )
    )


# Unequal locks cross gently in a soft off-centre fringe, with visibly individual tips.
xs = sorted(rng.uniform(-0.085, 0.088) for _ in range(38))
for i, x in enumerate(xs):
    edge = abs(x) / 0.09
    tip_z = 1.562 + 0.010 * math.sin(i * 2.23) - 0.024 * max(0, edge - 0.68) / 0.32
    sweep = 0.013 * math.sin(i * 0.43) + 0.005 * (1 - edge)
    add(
        "Fringe",
        [
            (x * 0.12, -0.020 + (0.008 * math.sin(i * 1.7)), 1.678),
            (x * 0.52 - 0.004, -0.071, 1.693 + 0.004 * math.sin(i)),
            (
                x * 0.95 + 0.012 * math.sin(i * 0.36),
                -0.109,
                1.651 + 0.004 * math.sin(i * 0.7),
            ),
            (
                x + sweep + 0.007 * math.sin(i * 0.36),
                -0.123,
                1.600 + rng.uniform(-0.005, 0.005),
            ),
            (x + sweep * 0.35, -0.115, tip_z),
        ],
        rng.uniform(0.0042, 0.0066),
    )
# Finer offset fringe layers sit above the base tips, never parallel copies.
for i in range(20):
    x = -0.084 + i * 0.0097 + rng.uniform(-0.004, 0.004)
    add(
        "Fringe",
        [
            (x * 0.22, -0.030, 1.679),
            (x * 0.6 - 0.004, -0.076, 1.694),
            (x + 0.007 * math.sin(i), -0.115, 1.636),
            (x + 0.012 * math.sin(i * 1.1), -0.123, 1.594),
            (x + 0.009 * math.sin(i * 1.1), -0.118, 1.562 + rng.uniform(-0.015, 0.021)),
        ],
        rng.uniform(0.0017, 0.0032),
        1,
    )


def side_guides(side, region, count=47):
    # Each layer has a separate endpoint, depth and curvature around temple/ear.
    for i in range(count):
        az = 0.77 + (i / count) * 1.47 + rng.uniform(-0.05, 0.05)
        front = max(0, 1 - (az - 0.77) / 1.47)
        layer = i % 3
        x0 = side * (0.001 + 0.018 * (1 - front))
        y0 = 0.015 + 0.048 * (1 - front)
        end = 1.422 + 0.013 * math.sin(i * 1.71) + 0.008 * layer
        xend = side * (0.093 + 0.018 * (1 - front) + rng.uniform(-0.008, 0.007))
        yend = -0.055 * front + 0.061 * (1 - front)
        midx = side * (0.118 + 0.006 * math.sin(az) + 0.002 * layer)
        midy = -0.085 * front + 0.061 * (1 - front)
        add(
            region,
            [
                (x0, y0, 1.679),
                (
                    side * (0.067 + 0.020 * (1 - front)),
                    y0 - 0.012,
                    1.692 + 0.003 * layer,
                ),
                (midx, midy, 1.618 + 0.004 * math.sin(i)),
                (
                    midx + side * 0.009 * math.sin(i * 0.71 + 0.7),
                    midy - 0.003,
                    1.511 + 0.012 * math.sin(i * 0.67),
                ),
                (
                    side * (abs(xend) + 0.013 + 0.004 * math.sin(i * 0.8)),
                    yend - 0.014,
                    1.468 + 0.009 * math.sin(i * 0.9),
                ),
                (xend, yend, end),
            ],
            rng.uniform(0.0054, 0.0087) if layer == 0 else rng.uniform(0.0025, 0.0060),
            layer,
        )
    # Short cheek-level overlaps end above the main hem.
    for i in range(9):
        f = i / 8
        add(
            region,
            [
                (side * 0.01, -0.018 + f * 0.04, 1.68),
                (side * (0.068 + f * 0.026), -0.058 + f * 0.04, 1.688),
                (side * (0.101 + f * 0.016), -0.105 + f * 0.055, 1.61),
                (side * (0.100 + f * 0.024), -0.09 + f * 0.06, 1.49),
                (
                    side * (0.081 + f * 0.033),
                    -0.065 + f * 0.06,
                    1.451 + rng.uniform(-0.012, 0.025),
                ),
            ],
            rng.uniform(0.0024, 0.0047),
            2,
        )


side_guides(-1, "LeftSide")
# Local crown transition fills the roots without a closed interior shell.
for i in range(65):
    a = -(0.14 + i / 64 * 2.9)
    ztip = 1.55 + rng.uniform(-0.020, 0.055)
    add(
        "Crown",
        [
            (
                -0.008 + 0.010 * math.sin(i * 1.8),
                0.007 + 0.041 * math.sin(i * 1.3),
                1.678,
            ),
            (
                0.068 * math.sin(a),
                0.008 - 0.067 * math.cos(a),
                1.704 + rng.uniform(-0.004, 0.004),
            ),
            (0.119 * math.sin(a), 0.009 - 0.120 * math.cos(a), 1.654),
            (
                0.122 * math.sin(a + 0.04 * math.sin(i)),
                0.010 - 0.125 * math.cos(a),
                ztip,
            ),
        ],
        rng.uniform(0.0055, 0.0090),
        i % 2,
    )

# Fine real geometry only on selected fringe/temple edges.
for source_region in ["Fringe", "LeftSide"]:
    for i, src in enumerate(regions[source_region]):
        if i % 5:
            continue
        pts = [p.copy() for p in src["points"]]
        for j, p in enumerate(pts):
            t = j / (len(pts) - 1)
            p.x += 0.0023 * math.sin(t * 5 + i) * t
            p.y -= 0.0012 * t
            p.z -= 0.004 * t**4
        regions["Secondary"].append(
            dict(
                points=pts,
                width=rng.uniform(0.00035, 0.00065),
                tile=src["tile"],
                phase=src["phase"],
                layer=2,
            )
        )

for i in range(48):
    a = -0.10 - i / 47 * 2.95
    add(
        "Crown",
        [
            (
                -0.014 + 0.013 * math.sin(i * 1.8),
                -0.031 + 0.046 * math.sin(i * 0.63),
                1.678,
            ),
            (
                0.074 * math.sin(a),
                0.004 - 0.073 * math.cos(a),
                1.696 + 0.002 * math.sin(i),
            ),
            (0.118 * math.sin(a), 0.007 - 0.118 * math.cos(a), 1.639),
            (
                0.120 * math.sin(a),
                0.009 - 0.119 * math.cos(a),
                1.582 + rng.uniform(-0.016, 0.023),
            ),
        ],
        rng.uniform(0.005, 0.008),
        0,
    )


def gn(name):
    g = bpy.data.node_groups.new(name, "GeometryNodeTree")
    for direction in ["INPUT", "OUTPUT"]:
        g.interface.new_socket(
            name="Geometry", in_out=direction, socket_type="NodeSocketGeometry"
        )
    return g, g.nodes.new("NodeGroupInput"), g.nodes.new("NodeGroupOutput")


def link(g, a, b):
    g.links.new(a, b)


def attr(g, name, typ):
    n = g.nodes.new("GeometryNodeInputNamedAttribute")
    n.data_type = typ
    n.inputs["Name"].default_value = name
    return n.outputs["Attribute"]


def attach(obj, g):
    m = obj.modifiers.new(g.name, "NODES")
    m.node_group = g
    return m


capture, ci, co = gn("V13 · Guide center")
n = capture.nodes.new("GeometryNodeStoreNamedAttribute")
n.data_type = "FLOAT_VECTOR"
n.domain = "POINT"
n.inputs["Name"].default_value = "guide_center"
link(capture, ci.outputs[0], n.inputs["Geometry"])
link(
    capture,
    capture.nodes.new("GeometryNodeInputPosition").outputs[0],
    n.inputs["Value"],
)
link(capture, n.outputs[0], co.inputs[0])
orient, oi, oo = gn("V13 · Strand orientation · no width scaling")
p = orient.nodes.new("GeometryNodeInputPosition")
sub = orient.nodes.new("ShaderNodeVectorMath")
sub.operation = "SUBTRACT"
link(orient, p.outputs[0], sub.inputs[0])
link(orient, attr(orient, "guide_center", "FLOAT_VECTOR"), sub.inputs[1])
rotate = orient.nodes.new("ShaderNodeVectorRotate")
rotate.rotation_type = "AXIS_ANGLE"
link(orient, sub.outputs[0], rotate.inputs["Vector"])
link(orient, attr(orient, "roll_axis", "FLOAT_VECTOR"), rotate.inputs["Axis"])
link(orient, attr(orient, "roll_angle", "FLOAT"), rotate.inputs["Angle"])
addvec = orient.nodes.new("ShaderNodeVectorMath")
addvec.operation = "ADD"
link(orient, rotate.outputs[0], addvec.inputs[0])
link(orient, attr(orient, "guide_center", "FLOAT_VECTOR"), addvec.inputs[1])
setp = orient.nodes.new("GeometryNodeSetPosition")
link(orient, oi.outputs[0], setp.inputs["Geometry"])
link(orient, addvec.outputs[0], setp.inputs["Position"])
link(orient, setp.outputs[0], oo.inputs[0])


def evaluate(obj):
    data = bpy.data.meshes.new("GBH component probe")
    proxy = bpy.data.objects.new("GBH component probe", data)
    s.collection.objects.link(proxy)
    group, inp, out = gn("Temporary GBH mesh reader")
    info = group.nodes.new("GeometryNodeObjectInfo")
    info.inputs["Object"].default_value = obj
    link(group, info.outputs["Geometry"], out.inputs[0])
    attach(proxy, group)
    obj.data.update_tag()
    obj.update_tag()
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    outmesh = bpy.data.meshes.new_from_object(proxy.evaluated_get(deps), depsgraph=deps)
    bpy.data.objects.remove(proxy, do_unlink=True)
    bpy.data.meshes.remove(data)
    bpy.data.node_groups.remove(group)
    return outmesh


mat = bpy.data.materials.new("Style04 V13 · Soft lilac")
mat.use_nodes = True
bs = mat.node_tree.nodes["Principled BSDF"]
bs.inputs["Roughness"].default_value = 0.61
bs.inputs["Specular IOR Level"].default_value = 0.20
tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(str(root / "review/Style04-V13-silk.png"))
tex.image.pack()
mat.node_tree.links.new(tex.outputs["Color"], bs.inputs["Base Color"])
mask = mat.node_tree.nodes.new("ShaderNodeMath")
mask.operation = "GREATER_THAN"
mask.inputs[1].default_value = 0.42
mat.node_tree.links.new(tex.outputs["Alpha"], mask.inputs[0])
mat.node_tree.links.new(mask.outputs[0], bs.inputs["Alpha"])
mat.use_backface_culling = False
spec = "GBH Profile Line Hair Cards"
entry = repr((spec, "GBH Library - Essentials.blend"))
oplog = {}
for key, result in [
    ("gbh.reload_library", bpy.ops.gbh.reload_library()),
    ("gbh.node_group_append", bpy.ops.gbh.node_group_append(nodename=entry)),
]:
    assert result == {"FINISHED"}
    oplog[key] = list(result)
    print(key, sorted(result))
bpy.context.preferences.addons[
    "bl_ext.user_default.gbhtool"
].preferences.lib_add_to_active_object = True
report = []
for region, locks in regions.items():
    h = bpy.data.hair_curves.new("V13 " + region)
    if locks:
        h.add_curves([len(lock["points"]) for lock in locks])
    obj = bpy.data.objects.new("Groom13_" + region, h)
    collection.objects.link(obj)
    obj["groomRegion"] = region
    h.surface = scalp
    h.surface_uv_map = scalp.data.uv_layers.active.name
    if not locks:
        continue
    pts = [p for lock in locks for p in lock["points"]]
    h.position_data.foreach_set("vector", np.asarray(pts, dtype="f").ravel())
    for key, typ, values in [
        ("resolution", "INT", np.ones(len(locks), dtype="i")),
        ("curve_type", "INT8", np.ones(len(locks), dtype="i")),
    ]:
        if key not in h.attributes:
            h.attributes.new(key, typ, "CURVE").data.foreach_set("value", values)
    radii = []
    for lock in locks:
        for j in range(len(lock["points"])):
            t = j / (len(lock["points"]) - 1)
            taper = (0.88 + 0.12 * math.sin(min(1, t / 0.44) * math.pi / 2) ** 0.7) * (
                1 - 0.97 * max(0, (t - 0.76) / 0.24) ** 0.95
            )
            radii.append(
                lock["width"]
                / 0.01
                * taper
                * (1 + 0.05 * math.sin(t * 5 + lock["phase"]))
            )
    h.attributes.new("radius", "FLOAT", "POINT").data.foreach_set(
        "value", np.asarray(radii, dtype="f")
    )
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    s.hair_object = obj
    attach(obj, capture)
    result = bpy.ops.gbh.node_group_add_to_object(nodename=entry)
    assert result == {"FINISHED"}
    print("gbh.node_group_add_to_object", region, sorted(result))
    mod = obj.modifiers[spec]
    mod["Input_11"] = 1.0
    mod["Input_13"] = 2
    mod["Input_12"] = 0.018
    obj.update_tag()
    raw = evaluate(obj)
    cols = 3
    assert len(raw.vertices) == len(pts) * cols
    axis = []
    angle = []
    for lock in locks:
        line = lock["points"]
        for j, center in enumerate(line):
            idx = len(axis) * cols
            across = raw.vertices[idx + 2].co - raw.vertices[idx].co
            tangent = line[min(j + 1, len(line) - 1)] - line[max(j - 1, 0)]
            outward = Vector(
                (center.x, center.y - 0.006, max(0, center.z - 1.57) * 1.6)
            ).normalized()
            wanted = tangent.cross(outward).normalized()
            if wanted.length < 0.1:
                wanted = Vector((1, 0, 0))
            rotation = across.rotation_difference(wanted)
            axis.append(rotation.axis[:])
            angle.append(rotation.angle)
    for key, typ, values in [
        ("roll_axis", "FLOAT_VECTOR", axis),
        ("roll_angle", "FLOAT", angle),
    ]:
        h.attributes.new(key, typ, "POINT").data.foreach_set(
            "vector" if typ == "FLOAT_VECTOR" else "value",
            np.asarray(values, dtype="f").ravel(),
        )
    bpy.data.meshes.remove(raw)
    attach(obj, orient)
    baked = evaluate(obj)
    uv = []
    for lock in locks:
        for j in range(len(lock["points"])):
            t = j / (len(lock["points"]) - 1)
            uv.extend(
                [((lock["tile"] + (k / 2) * 0.96 + 0.02) / 8, 1 - t) for k in range(3)]
            )
    layer = baked.uv_layers.new(name="UVMap")
    for l in baked.loops:
        layer.data[l.index].uv = uv[l.vertex_index]
    baked.materials.append(mat)
    for poly in baked.polygons:
        poly.use_smooth = True
    output = bpy.data.objects.new("Hair13_" + region, baked)
    mesh_collection.objects.link(output)
    output["cosmeticSlot"] = "HairSlot"
    output["cosmeticId"] = item
    output["sourceGroom"] = obj.name
    output.parent = rig
    group = output.vertex_groups.new(name="J_Bip_C_Head")
    group.add(list(range(len(baked.vertices))), 1, "REPLACE")
    m = output.modifiers.new("Vita Head", "ARMATURE")
    m.object = rig
    widths = []
    tips = []
    idx = 0
    for lock in locks:
        n = len(lock["points"])
        for sample, bucket in [(n // 2, widths), (n - 1, tips)]:
            a = (idx + sample) * cols
            bucket.append(
                (baked.vertices[a + 2].co - baked.vertices[a].co).length * 1000
            )
        idx += n
    baked.calc_loop_triangles()
    report.append(
        dict(
            region=region,
            curves=len(locks),
            vertices=len(baked.vertices),
            triangles=len(baked.loop_triangles),
            widthMm={
                "min": min(widths),
                "median": float(np.median(widths)),
                "max": max(widths),
            },
            tipWidthMm={"median": float(np.median(tips)), "max": max(tips)},
            nodes=[m.node_group.name for m in obj.modifiers],
            operator=list(result),
        )
    )
collection.hide_viewport = True
collection.hide_render = True
s.hair_object = None
s["Style04V13Stage"] = stage
(root / "review" / ("groom-" + stage + ".json")).write_text(
    json.dumps(
        {
            "stage": stage,
            "operators": oplog,
            "profile": spec,
            "profileWidthCm": 1.0,
            "regions": report,
        },
        indent=2,
    )
)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(
    filepath=str(root / "out" / (stem + ".blend")), compress=True
)
