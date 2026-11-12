"""Ảnh kiểm định trực tiếp của bản groom đang mở."""

import bpy, math, os
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
s = bpy.context.scene
quick = os.getenv("QUALITY") == "draft"
dest = root / ("work" if quick else "review")
dest.mkdir(exist_ok=True)
s.render.engine = "CYCLES"
s.cycles.samples = 16 if quick else 64
s.cycles.use_denoising = False
s.cycles.transparent_max_bounces = 20
s.render.resolution_percentage = 100
for o in s.objects:
    if o.type == "LIGHT":
        o.data.color = (1, 1, 1)
        o.data.energy = {"Key": 19, "Fill": 11, "Rim": 14}.get(o.name.split(" ·")[0], 9)


def render(name, angle=0, scale=0.445, z=1.54, size=(640, 740)):
    c = s.camera
    a = math.radians(angle)
    c.location = (3 * math.sin(a), -3 * math.cos(a), z + 0.012)
    c.rotation_euler = (
        (Vector((0, 0, z)) - c.location).to_track_quat("-Z", "Y").to_euler()
    )
    c.data.ortho_scale = scale
    s.render.resolution_x, s.render.resolution_y = (360, 420) if quick else size
    s.render.filepath = str(dest / (name + ".png"))
    bpy.ops.render.render(write_still=True)


render("v13-front")
render("v13-left35", -35)
if quick:
    quit()
render("v13-fringe", -5, 0.215, 1.595, (800, 670))
render("v13-side-detail", -35, 0.25, 1.535, (700, 780))
if s["Style04V13Stage"] == "complete":
    render("v13-right35", -35)
    render("v13-side", -90)
    render("v13-back", 180)
for o in s.objects:
    if o.type == "MESH" and not o.name.startswith("Hair13_"):
        o.hide_render = True
render("v13-hair-front")
render("v13-hair-side", 90)
mat = bpy.data.materials["Style04 V13 · Soft lilac"]
p = mat.node_tree.nodes["Principled BSDF"]
for l in list(p.inputs["Base Color"].links):
    mat.node_tree.links.remove(l)
p.inputs["Base Color"].default_value = (0.38, 0.36, 0.34, 1)
p.inputs["Roughness"].default_value = 0.8
render("v13-clay-front")
render("v13-clay-side", 90)
