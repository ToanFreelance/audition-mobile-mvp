"""Load the exchange GLB in an empty scene, then link only the saved studio."""

import bpy, pathlib
from mathutils import Vector

root = pathlib.Path(__file__).resolve().parents[1]
base = "Vita-Style04-Hair-POC-V1"
bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root / "out" / f"{base}.glb"))
with bpy.data.libraries.load(str(root / "out" / f"{base}.blend"), link=False) as (
    source,
    target,
):
    target.collections = ["STUDIO • Review cameras and lights"]
    target.worlds = ["Soft slate studio"]
scene = bpy.context.scene
scene.collection.children.link(target.collections[0])
scene.world = target.worlds[0]
scene.camera = bpy.data.objects["Portrait camera"]
scene.render.engine = "CYCLES"
scene.cycles.samples = 96
scene.cycles.use_denoising = False
scene.cycles.transparent_max_bounces = 14
scene.view_settings.view_transform = "Khronos PBR Neutral"
scene.render.resolution_x = 720
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.filepath = str(root / "review/10-fresh-glb-front.png")
bpy.ops.render.render(write_still=True)
