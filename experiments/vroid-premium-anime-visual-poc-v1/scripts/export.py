"""Export only the actor. VRM uses its native MToon material definitions."""

import bpy, pathlib

root = pathlib.Path(__file__).resolve().parents[1]
prefix = "Vita-Premium-Anime-V1-B"
rig = bpy.data.objects["Armature"]
bpy.ops.object.select_all(action="DESELECT")
for obj in [rig] + [bpy.data.objects[n] for n in ["Face", "Body", "Hair001"]]:
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig
assert "FINISHED" in bpy.ops.export_scene.gltf(
    filepath=str(root / "out" / f"{prefix}.glb"),
    use_selection=True,
    export_morph=True,
    export_skins=True,
    export_tangents=True,
    export_animations=False,
    export_all_influences=True,
)
for name in ["Face", "Body", "Hair001"]:
    for slot in bpy.data.objects[name].material_slots:
        slot.material = bpy.data.materials[slot.material["vrm_source"]]
meta = rig.data.vrm_addon_extension.vrm0.meta
meta.texture = bpy.data.images.load(str(root / "review/B-front.png"))
path = root / "work/export-B.vrm"
assert "FINISHED" in bpy.ops.export_scene.vrm(
    filepath=str(path),
    armature_object_name=rig.name,
    export_only_selections=True,
    export_invisibles=False,
    use_addon_preferences=False,
)
path.replace(root / "out" / f"{prefix}.vrm")
