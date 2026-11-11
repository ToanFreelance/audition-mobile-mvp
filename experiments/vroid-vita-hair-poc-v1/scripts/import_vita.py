import bpy, pathlib, numpy as np
from mathutils import Vector

root = pathlib.Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
print("IMPORT", bpy.ops.import_scene.vrm(filepath=str(root / "out/Vita-Original.vrm")))
for o in bpy.context.scene.objects:
    if o.type == "MESH":
        p = np.array([o.matrix_world @ v.co for v in o.data.vertices])
        print(
            "MESH",
            o.name,
            len(p),
            p.min(0),
            p.max(0),
            [m.name for m in o.data.materials],
        )
        for mat in o.data.materials:
            ids = {
                i
                for f in o.data.polygons
                if o.data.materials[f.material_index] == mat
                for i in f.vertices
            }
            if ids:
                q = p[list(ids)]
                print("REGION", mat.name, q.min(0), q.max(0))
                if "Face_00_SKIN" in mat.name or "HairBack" in mat.name:
                    for h in np.arange(q[:, 2].min(), q[:, 2].max(), 0.015):
                        s = q[np.abs(q[:, 2] - h) < 0.0075]
                        if len(s):
                            print("SLICE", round(h, 3), s.min(0)[:2], s.max(0)[:2])
    if o.type == "ARMATURE":
        print(
            "RIG",
            o.name,
            len(o.data.bones),
            [
                (b.name, list(o.matrix_world @ b.head_local))
                for b in o.data.bones
                if "Head" in b.name
            ],
        )
bpy.ops.wm.save_as_mainfile(filepath=str(root / "work/imported.blend"), compress=True)
