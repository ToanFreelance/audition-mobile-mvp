import bpy, os, sys, pathlib, json, struct, hashlib, math
import numpy as np
from mathutils import Vector, Quaternion
from mathutils.bvhtree import BVHTree

r = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(r / "scripts"))
from identity import fingerprint

stem = "Vita-Style04-Golden-Hair-V12"


def sha(b):
    return hashlib.sha256(b).hexdigest()


def snap():
    face = bpy.data.objects["Face"]
    rig = bpy.data.objects["Armature"]
    s = fingerprint(face, rig)
    s["uv"] = sha(
        np.array(
            [l.uv[:] for l in face.data.uv_layers.active.data], dtype="<f4"
        ).tobytes()
    )

    def matdata(m):
        nt = m.node_tree
        nodes = []
        for n in nt.nodes:
            inputs = []
            for k in n.inputs:
                v = getattr(k, "default_value", None)
                if hasattr(v, "__len__") and not isinstance(v, str):
                    v = list(v)
                if isinstance(v, (type(None), str, int, float, list)):
                    inputs.append((k.name, v))
            im = getattr(n, "image", None)
            nodes.append(
                (
                    n.name,
                    n.type,
                    inputs,
                    sha(bytes(im.packed_file.data)) if im and im.packed_file else None,
                )
            )
        return [
            m.name,
            nodes,
            [
                (l.from_node.name, l.from_socket.name, l.to_node.name, l.to_socket.name)
                for l in nt.links
            ],
        ]

    s["faceMaterials"] = sha(
        json.dumps([matdata(m) for m in face.data.materials], sort_keys=True).encode()
    )
    return s


base = pathlib.Path(os.environ["V11_BLEND"])
bpy.ops.wm.open_mainfile(filepath=str(base))
ref = snap()
bpy.ops.wm.open_mainfile(filepath=str(r / "out" / (stem + ".blend")))
assert ref == snap()
(r / "review/face-lock.json").write_text(json.dumps(ref, indent=2))
rig = bpy.data.objects["Armature"]
bone = rig.pose.bones["J_Bip_C_Head"]


def vpos(o):
    ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return np.array([ev.matrix_world @ v.co for v in ev.data.vertices])


pieces = [bpy.data.objects[n] for n in ["Style04_Cards", "Style04_Fine_Fibres"]]
before = [vpos(o) for o in pieces]
m0 = bone.matrix.copy()
bone.rotation_mode = "QUATERNION"
bone.rotation_quaternion = Quaternion(Vector((0.2, 0.6, 0.4)), 0.31)
bpy.context.view_layer.update()
delta = rig.matrix_world @ bone.matrix @ m0.inverted() @ rig.matrix_world.inverted()
errors = []
for ob, p in zip(pieces, before):
    predicted = p @ np.array(delta.to_3x3()).T + np.array(delta.translation)
    actual = vpos(ob)
    errors.append(float(np.max(np.linalg.norm(actual - predicted, axis=1)) * 1000))
assert max(errors) < 0.001
bone.rotation_quaternion.identity()
bpy.context.view_layer.update()


def bvh(o, filter):
    return BVHTree.FromPolygons(
        [o.matrix_world @ v.co for v in o.data.vertices],
        [p.vertices[:] for p in o.data.polygons if filter(p)],
    )


face = bpy.data.objects["Face"]
skin = bvh(face, lambda p: "Face_00_SKIN" in face.data.materials[p.material_index].name)
scalp = bvh(bpy.data.objects["Scalp"], lambda p: True)
fit = {o.name: len(skin.overlap(bvh(o, lambda p: True))) for o in pieces}
roots = [
    scalp.find_nearest(o.matrix_world @ c.points[0].position)[3] * 1000
    for o in bpy.data.objects
    if o.type == "CURVES"
    for c in o.data.curves
]
g = r / "out" / (stem + ".glb")
raw = g.read_bytes()
doc = json.loads(raw[20 : 20 + struct.unpack_from("<I", raw, 12)[0]])
n = next(
    n
    for n in doc["nodes"]
    if n.get("extras", {}).get("cosmeticId") == "hair-style04-lavender-bob"
)
prim = doc["meshes"][n["mesh"]]["primitives"]
assert len(prim) == 1 and "TEXCOORD_0" in prim[0]["attributes"]
report = {
    "baselineSha256": sha(base.read_bytes()),
    "faceLockExact": True,
    "headFollowMaxErrorMm": errors,
    "faceSkinTrianglePairIntersections": fit,
    "rootsMmMinMedianMax": np.percentile(roots, [0, 50, 100]).tolist(),
    "guideRoots": len(roots),
    "hairTriangles": doc["accessors"][prim[0]["indices"]]["count"] // 3,
    "primitives": len(prim),
    "assetTriangles": sum(
        doc["accessors"][p["indices"]]["count"] // 3
        for m in doc["meshes"]
        for p in m["primitives"]
    ),
    "fileMaterials": len(doc["materials"]),
    "hairMaterial": doc["materials"][prim[0]["material"]],
    "morphs": len(ref["keys"]) - 1,
    "humanBones": len(ref["humanoid"]),
    "springs": len(ref["springs"]),
}
bpy.ops.wm.read_homefile(use_empty=True)
assert bpy.ops.import_scene.gltf(filepath=str(g)) == {"FINISHED"}
ob = bpy.data.objects["Hair_Style04"]
f = bpy.data.objects["Face"]
assert (
    any(m.type == "ARMATURE" for m in ob.modifiers)
    and f.data.shape_keys
    and len(f.data.shape_keys.key_blocks) == 42
)
report["freshGlbImport"] = True
(r / "review/validation.json").write_text(json.dumps(report, indent=2))
