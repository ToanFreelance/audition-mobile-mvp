"""Dựng ảnh so sánh V1.2 và đường dẫn Hair Curves của checkpoint."""

import bpy, math
from pathlib import Path
from mathutils import Vector

r = Path(__file__).resolve().parents[1]
s = bpy.context.scene
s.render.engine = "CYCLES"
s.cycles.samples = 64
s.cycles.use_denoising = False
s.cycles.transparent_max_bounces = 20
s.render.resolution_x = 640
s.render.resolution_y = 740
s.render.resolution_percentage = 100
for o in s.objects:
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
    s.render.filepath = str(r / "review" / (file + ".png"))
    bpy.ops.render.render(write_still=True)


if "STYLE04 V13 • Export mesh" not in bpy.data.collections:
    shoot("v12-front")
    shoot("v12-left35", -35)
else:
    for o in s.objects:
        if o.type == "MESH":
            o.hide_render = True
    colors = {
        "Fringe": (0.19, 0.72, 0.75),
        "Crown": (0.70, 0.38, 0.73),
        "LeftSide": (0.91, 0.48, 0.27),
        "Secondary": (0.75, 0.71, 0.60),
    }
    for obj in bpy.data.collections["STYLE04 V13 • Native Hair Curves"].objects:
        if not len(obj.data.curves):
            continue
        duplicate = obj.copy()
        duplicate.data = obj.data.copy()
        s.collection.objects.link(duplicate)
        duplicate.modifiers.clear()
        duplicate.hide_set(False)
        duplicate.hide_render = False
        # A thin circular profile displays the native centre lines.
        tree = bpy.data.node_groups.new("Guide visualization", "GeometryNodeTree")
        for side in ["INPUT", "OUTPUT"]:
            tree.interface.new_socket(
                name="Geometry", in_out=side, socket_type="NodeSocketGeometry"
            )
        ci = tree.nodes.new("NodeGroupInput")
        co = tree.nodes.new("NodeGroupOutput")
        circle = tree.nodes.new("GeometryNodeCurvePrimitiveCircle")
        circle.inputs["Resolution"].default_value = 4
        circle.inputs["Radius"].default_value = 0.00032
        setr = tree.nodes.new("GeometryNodeSetCurveRadius")
        setr.inputs["Radius"].default_value = 1.0
        tube = tree.nodes.new("GeometryNodeCurveToMesh")
        material = tree.nodes.new("GeometryNodeSetMaterial")
        m = bpy.data.materials.new("Guide " + obj["groomRegion"])
        m.diffuse_color = (*colors[obj["groomRegion"]], 1)
        material.inputs["Material"].default_value = m
        tree.links.new(ci.outputs[0], setr.inputs["Curve"])
        tree.links.new(setr.outputs[0], tube.inputs["Curve"])
        tree.links.new(circle.outputs[0], tube.inputs["Profile Curve"])
        tree.links.new(tube.outputs[0], material.inputs["Geometry"])
        tree.links.new(material.outputs[0], co.inputs[0])
        duplicate.modifiers.new("Native guide preview", "NODES").node_group = tree
    shoot("v13-guides", -35)
