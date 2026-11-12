"""Nhập GLB mới vào cảnh trống, so mesh xuất với các đỉnh của groom đã chốt."""

import bpy, json
from pathlib import Path
from mathutils.kdtree import KDTree

r = Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(r / "out/Vita-Style04-Groom-V13.blend"))
expected = [
    o.matrix_world @ v.co
    for o in bpy.data.collections["STYLE04 V13 • Export mesh"].objects
    for v in o.data.vertices
]
tree = KDTree(len(expected))
for i, p in enumerate(expected):
    tree.insert(p, i)
tree.balance()
triangles = sum(
    len(o.data.loop_triangles)
    for o in bpy.data.collections["STYLE04 V13 • Export mesh"].objects
)
bpy.ops.wm.read_homefile(use_empty=True)
result = bpy.ops.import_scene.gltf(filepath=str(r / "out/Vita-Style04-Groom-V13.glb"))
assert result == {"FINISHED"}
hair = bpy.data.objects["Hair_Style04_V13"]
coords = [hair.matrix_world @ v.co for v in hair.data.vertices]
reverse = KDTree(len(coords))
for i, p in enumerate(coords):
    reverse.insert(p, i)
reverse.balance()
error = (
    max(max(tree.find(p)[2] for p in coords), max(reverse.find(p)[2] for p in expected))
    * 1000
)
hair.data.calc_loop_triangles()
morphs = [
    o
    for o in bpy.data.objects
    if o.type == "MESH"
    and o.data.shape_keys
    and len(o.data.shape_keys.key_blocks) == 42
]
assert error < 0.001 and morphs
assert any(m.type == "ARMATURE" for m in hair.modifiers)
report = {
    "freshImport": True,
    "exportedToBakedMaxErrorMm": error,
    "hairVertices": len(coords),
    "hairTriangles": len(hair.data.loop_triangles),
    "faceMorphTargets": len(morphs[0].data.shape_keys.key_blocks) - 1,
    "hairMaterialCount": len(hair.data.materials),
    "hairUVValid": bool(hair.data.uv_layers.active),
    "stage": "checkpoint",
}
(r / "review/reimport.json").write_text(json.dumps(report, indent=2))
print(report)
