"""Disable the legacy body/clothing outline hull over transparent shoulder areas."""

import bpy, pathlib

root = pathlib.Path(__file__).resolve().parents[1]
bpy.context.preferences.filepaths.save_version = 0
for o in [bpy.data.objects["Body"], bpy.data.objects["Hair001"]]:
    for studio in o.data.materials:
        native = bpy.data.materials[studio["vrm_source"]]
        m = native.vrm_addon_extension.mtoon1.extensions.vrmc_materials_mtoon
        m.outline_width_mode = "none"
        m.outline_width_factor = 0
        if "Tops_01_CLOTH" in native.name:
            native.vrm_addon_extension.mtoon1.alpha_mode = "BLEND"
            m.transparent_with_z_write = False
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath, compress=True)
