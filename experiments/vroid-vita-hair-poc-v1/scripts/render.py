import bpy, os, pathlib, math
from mathutils import Vector

root = pathlib.Path(__file__).resolve().parents[1]
scene = bpy.context.scene
cam = scene.camera
scene.cycles.use_denoising = False


def camera(yaw, scale=0.413, z=1.535):
    a = math.radians(yaw)
    cam.location = (math.sin(a), -math.cos(a), z + 0.012)
    cam.rotation_euler = (
        (Vector((0, 0, z)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    )
    cam.data.ortho_scale = scale


def render(name, angle, scale=0.413, z=1.535):
    camera(angle, scale, z)
    scene.render.filepath = str(root / "review" / f"{name}.png")
    bpy.ops.render.render(write_still=True)


mode = os.getenv("VITA_MODE", "all")
if mode == "draft":
    scene.render.resolution_percentage = 57
    scene.cycles.samples = 4
    render("draft", 0)
    render("draft-left", 35)
else:
    ref = bpy.data.collections["REFERENCE • Vita original hair"]
    live = bpy.data.collections["STYLE 04 • Export meshes"]
    if mode in ("all", "original"):
        ref.hide_render = False
        live.hide_render = True
        render("01-original-front", 0)
        render("02-original-left35", 35)
        ref.hide_render = True
        live.hide_render = False
    if mode in ("all", "modified"):
        render("03-style04-front", 0)
        render("04-style04-left35", 35)
        render("05-style04-right-profile", -90)
        render("08-fringe-detail", 0, 0.239, 1.602)
    if mode in ("all", "hair"):
        bpy.data.objects["Face"].hide_render = bpy.data.objects["Body"].hide_render = (
            True
        )
        render("06-hair-front", 0, 0.345, 1.55)
        render("07-hair-side", -90, 0.345, 1.55)
        # Isolate the same, editable GBH node output. Distinct tones identify three guide groups.
        live.hide_render = True
        g = bpy.data.collections["GROOM • Editable GBH sources"]
        g.hide_render = False
        render("09-gbh-guides", 35, 0.345, 1.55)
