"""Xuất nhân vật mặc định và bộ chứa các biến thể dùng trong phép thử đổi món."""

import bpy, pathlib, json

r = pathlib.Path(__file__).resolve().parents[1]
stem = "Vita-Premium-Cute-V11"
rig = bpy.data.objects["Armature"]
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]


def select(objects):
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for o in objects:
        o.hide_set(False)
        o.hide_render = False
        o.select_set(True)
    bpy.context.view_layer.objects.active = rig


default = [o for o in meshes if not o.hide_render]


def glb(objects, path):
    select(objects)
    assert bpy.ops.export_scene.gltf(
        filepath=str(path),
        use_selection=True,
        export_extras=True,
        export_skins=True,
        export_morph=True,
        export_tangents=True,
        export_animations=False,
        export_all_influences=True,
    ) == {"FINISHED"}


glb(meshes, r / "review/wardrobe.glb")
glb(default, r / "out" / (stem + ".glb"))
for o in default:
    for slot in o.material_slots:
        m = slot.material
        if "vrm_source" in m:
            slot.material = bpy.data.materials[m["vrm_source"]]
        elif not m.vrm_addon_extension.mtoon1.enabled:
            color = m.diffuse_color[:]
            mt = m.vrm_addon_extension.mtoon1
            mt.enabled = True
            mt.double_sided = True
            mt.pbr_metallic_roughness.base_color_factor = color
            mt.extensions.vrmc_materials_mtoon.shade_color_factor = tuple(
                c * 0.76 for c in color[:3]
            )
rig.data.vrm_addon_extension.vrm0.meta.title = "Vita Premium Cute V1.1"
rig.data.vrm_addon_extension.vrm0.meta.texture = bpy.data.images.load(
    str(r / "review/casual-front.png")
)
select(default)
bpy.context.view_layer.update()
print(
    "VRM selection",
    [(o.name, o.visible_get()) for o in bpy.context.selected_objects],
    flush=True,
)
assert bpy.ops.export_scene.vrm(
    filepath=str(r / "out" / (stem + ".vrm")),
    armature_object_name=rig.name,
    export_only_selections=True,
    export_invisibles=False,
    use_addon_preferences=False,
) == {"FINISHED"}
