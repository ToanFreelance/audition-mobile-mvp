import bpy, pathlib, os
from mathutils import Vector

root = pathlib.Path(__file__).resolve().parents[1]
variant = os.environ["VITA_VARIANT"]
scene = bpy.context.scene
cam = scene.camera
cam.location = (0, -3, 1.576)
cam.rotation_euler = (
    (Vector((0, 0, 1.56)) - cam.location).to_track_quat("-Z", "Y").to_euler()
)
cam.data.ortho_scale = 0.334
scene.render.resolution_x = 420
scene.render.resolution_y = 460
scene.render.filepath = str(root / "review" / f"{variant}-expr-Neutral.png")
bpy.ops.render.render(write_still=True)
