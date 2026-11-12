import bpy, os, math, pathlib
from mathutils import Vector

r = pathlib.Path(__file__).resolve().parents[1]
s = bpy.context.scene
cam = s.camera
quick = os.getenv("QUALITY") == "draft"
s.cycles.samples = 12 if quick else 48
s.cycles.use_denoising = False
s.cycles.transparent_max_bounces = 20
for o in s.objects:
    if o.type == "LIGHT":
        o.data.color = (1, 1, 1)
        o.data.energy = {"Key": 19, "Fill": 11, "Rim": 14}.get(o.name.split(" ·")[0], 9)


def render(name, angle=0, scale=0.445, z=1.54, size=(640, 740)):
    a = math.radians(angle)
    cam.location = (3 * math.sin(a), -3 * math.cos(a), z + 0.012)
    cam.rotation_euler = (
        (Vector((0, 0, z)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    )
    cam.data.ortho_scale = scale
    s.render.resolution_x, s.render.resolution_y = size
    s.render.resolution_percentage = 55 if quick else 100
    s.render.filepath = str(
        pathlib.Path(
            os.getenv("VITA_RENDER_DIR", str(r / ("work" if quick else "review")))
        )
        / (name + ".png")
    )
    bpy.ops.render.render(write_still=True)


new = [bpy.data.objects[n] for n in ["Style04_Cards", "Style04_Fine_Fibres"]]
old = bpy.data.objects["Hair_Bob"]
render("style04-front")
render("style04-left35", 35)
if quick:
    quit()
render("style04-right35", -35)
render("style04-side", -90)
render("style04-back", 180)
render("fringe-detail", -5, 0.206, 1.569, (780, 630))
for o in new:
    o.hide_render = True
old.hide_render = False
old.hide_set(False)
render("v11-front")
old.hide_render = True
for o in new:
    o.hide_render = False
for o in s.objects:
    if o.type == "MESH" and o not in new:
        o.hide_render = True
render("hair-front")
render("hair-side", -90)
