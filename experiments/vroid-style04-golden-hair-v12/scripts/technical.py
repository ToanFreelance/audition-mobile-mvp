"""Kiểm tra chỉnh guide thật và chụp các đường tâm, mesh đất sét trong cảnh tạm."""

import bpy, json, math
from pathlib import Path
from mathutils import Vector
from statistics import median

r = Path(__file__).resolve().parents[1] / "review"
s = bpy.context.scene
coll = bpy.data.collections["STYLE04 • GBH live regions"]
coll.hide_viewport = False
obj = next(o for o in coll.objects if "Fringe" in o.name)
proxy = bpy.data.objects.new("Đọc mesh GBH", bpy.data.meshes.new("inspection"))
s.collection.objects.link(proxy)
group = bpy.data.node_groups.new("Đọc đầu ra", "GeometryNodeTree")
group.interface.new_socket(
    name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry"
)
info = group.nodes.new("GeometryNodeObjectInfo")
info.inputs["Object"].default_value = obj
group.links.new(info.outputs["Geometry"], group.nodes.new("NodeGroupOutput").inputs[0])
proxy.modifiers.new("Đọc đầu ra", "NODES").node_group = group


def coords():
    obj.data.update_tag()
    obj.update_tag()
    bpy.context.view_layer.update()
    ev = proxy.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return [v.co.copy() for v in ev.data.vertices]


p = obj.data.curves[0].points[len(obj.data.curves[0].points) // 2]
old = p.position.copy()
a = coords()
p.position = old + Vector((0.001, 0, 0))
b = coords()
p.position = old
c = coords()
motion = [(y - x).length * 1000 for x, y in zip(a, b)]
restore = max((z - x).length * 1000 for x, z in zip(a, c))
assert max(motion) > 0.9 and restore < 0.001
(r / "guide-edit-test.json").write_text(
    json.dumps(
        dict(
            guide=obj.name,
            requestedMm=1,
            maximumOutputMotionMm=max(motion),
            modifiedVertices=sum(k > 0.0001 for k in motion),
            restoredMaxErrorMm=restore,
            evaluatedVertices=len(a),
        ),
        indent=2,
    )
)
bpy.data.objects.remove(proxy, do_unlink=True)
coll.hide_viewport = True
s.cycles.samples = 32
s.render.resolution_percentage = 100
s.render.resolution_x = 640
s.render.resolution_y = 740
for o in s.objects:
    if o.type == "MESH":
        o.hide_render = o.name not in ["Style04_Cards", "Style04_Fine_Fibres"]
    if o.type == "LIGHT":
        o.data.color = (1, 1, 1)
        o.data.energy = {"Key": 19, "Fill": 11, "Rim": 14}.get(o.name.split(" ·")[0], 9)


def shoot(file, angle=0):
    a = math.radians(angle)
    cam = s.camera
    cam.location = (3 * math.sin(a), -3 * math.cos(a), 1.552)
    cam.rotation_euler = (
        (Vector((0, 0, 1.54)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    )
    cam.data.ortho_scale = 0.445
    s.render.filepath = str(r / (file + ".png"))
    bpy.ops.render.render(write_still=True)


mat = bpy.data.objects["Style04_Cards"].data.materials[0]
bs = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
for l in list(bs.inputs["Base Color"].links):
    mat.node_tree.links.remove(l)
bs.inputs["Base Color"].default_value = (0.35, 0.32, 0.30, 1)
bs.inputs["Roughness"].default_value = 0.78
shoot("clay-front")
shoot("clay-side", -90)
for o in s.objects:
    if o.type == "MESH":
        o.hide_render = True
colors = {
    "Back": (0.32, 0.13, 0.48),
    "Crown": (0.66, 0.37, 0.72),
    "Sides": (1, 0.51, 0.30),
    "Fringe": (0.13, 0.78, 0.78),
    "Finishing": (0.81, 0.72, 0.65),
}
for o in [g for g in coll.objects if g.type == "CURVES"] + [
    bpy.data.objects["GBH • Finishing fibres"]
]:
    color = next(v for k, v in colors.items() if k in o.name)
    h = o.data
    cu = bpy.data.curves.new(o.name + " inspection", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.00027
    cu.bevel_resolution = 1
    for strand in h.curves:
        spl = cu.splines.new("POLY")
        spl.points.add(len(strand.points) - 1)
        for pt, src in zip(spl.points, strand.points):
            pt.co = (*src.position, 1)
    mesh = bpy.data.objects.new(o.name + " guide", cu)
    s.collection.objects.link(mesh)
    m = bpy.data.materials.new(o.name + " technique")
    m.diffuse_color = (*color, 1)
    cu.materials.append(m)
shoot("guide-view")
