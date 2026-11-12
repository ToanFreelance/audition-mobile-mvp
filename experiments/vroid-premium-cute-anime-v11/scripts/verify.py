"""Mở lại hai cảnh từ ổ đĩa, thử pose, sau đó import hai bản trao đổi vào cảnh rỗng."""

import bpy, pathlib, os, sys, json, math, hashlib, struct, io
from mathutils import Vector, Quaternion

r = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(r / "scripts"))
from identity import fingerprint


def state():
    return fingerprint(bpy.data.objects["Face"], bpy.data.objects["Armature"])


src = pathlib.Path(os.environ["VITA_A"])
bpy.ops.wm.open_mainfile(filepath=str(src))
baseline = state()
stem = "Vita-Premium-Cute-V11"
bpy.ops.wm.open_mainfile(filepath=str(r / "out" / (stem + ".blend")))
assert baseline == state()
rig = bpy.data.objects["Armature"]
graph = bpy.context.evaluated_depsgraph_get()


def positions(o):
    ev = o.evaluated_get(graph)
    return [ev.matrix_world @ v.co for v in ev.data.vertices]


def moved(name, bone, idxs):
    o = bpy.data.objects[name]
    a = positions(o)
    b = rig.pose.bones[bone]
    b.rotation_mode = "QUATERNION"
    initial = b.rotation_quaternion.copy()
    anchor = rig.matrix_world @ b.head
    b.rotation_quaternion @= Quaternion(Vector((0, 1, 0)), 0.27)
    bpy.context.view_layer.update()
    end = positions(o)
    b.rotation_quaternion = initial
    bpy.context.view_layer.update()
    return {
        "motion_mm": max((a[i] - end[i]).length for i in idxs) * 1000,
        "radial_error_mm": max(
            abs((a[i] - anchor).length - (end[i] - anchor).length) for i in idxs
        )
        * 1000,
    }


stats = {}
for o in bpy.context.scene.objects:
    if o.type != "MESH":
        continue
    o.data.calc_loop_triangles()
    assert any(m.type == "ARMATURE" and m.object == rig for m in o.modifiers)
    assert min(sum(g.weight for g in v.groups) for v in o.data.vertices) > 0.99
    stats[o.name] = {
        "triangles": len(o.data.loop_triangles),
        "slot": o["cosmeticSlot"],
        "id": o["cosmeticId"],
        "default": not o.hide_render,
    }
motions = {}
for n in ["Ribbon_Champagne", "Hair_Bob", "Hair_Lob"]:
    motions[n] = moved(n, "J_Bip_C_Head", range(len(bpy.data.objects[n].data.vertices)))
    assert motions[n]["motion_mm"] > 1 and motions[n]["radial_error_mm"] < 0.01
for n in ["Street_Bomber_Pleats_Sneakers", "Street_Dance_Shorts"]:
    motions[n] = moved(
        n, "J_Bip_L_UpperLeg", range(len(bpy.data.objects[n].data.vertices))
    )
    assert motions[n]["motion_mm"] > 5
qa = {
    "source_sha256": hashlib.sha256(src.read_bytes()).hexdigest(),
    "face_exact": True,
    "shape_arrays": len(baseline["keys"]),
    "springs": len(baseline["springs"]),
    "humanoid": len(baseline["humanoid"]),
    "expression_groups": len(baseline["expressions"]),
    "rig_bones": len(rig.data.bones),
    "meshes": stats,
    "pose_tests": motions,
    "imports": {},
}
for ext in ["glb", "vrm"]:
    bpy.ops.wm.read_homefile(use_empty=True)
    path = r / "out" / (stem + "." + ext)
    op = bpy.ops.import_scene.gltf if ext == "glb" else bpy.ops.import_scene.vrm
    assert op(filepath=str(path)) == {"FINISHED"}
    raw = path.read_bytes()
    document = json.loads(raw[20 : 20 + struct.unpack_from("<I", raw, 12)[0]])
    nodes = [n for n in document["nodes"] if "mesh" in n]
    assert len(nodes) == 7 and all("skin" in n for n in nodes)
    expected = {n["name"] for n in nodes}
    meshes = [
        o for o in bpy.context.scene.objects if o.type == "MESH" and o.name in expected
    ]
    morphs = max(
        (len(o.data.shape_keys.key_blocks) - 1 if o.data.shape_keys else 0)
        for o in meshes
    )
    assert morphs == 41 and len(meshes) >= 7
    print(
        "Import binding",
        ext,
        [
            (o.name, o.parent_type, o.parent_bone, [md.type for md in o.modifiers])
            for o in meshes
        ],
        flush=True,
    )
    assert all(any(md.type == "ARMATURE" for md in o.modifiers) for o in meshes)
    record = {"meshes": len(meshes), "morphs": morphs, "skinned": True}
    if ext == "vrm":
        arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
        v = arm.data.vrm_addon_extension.vrm0
        mapping = {
            b.bone: b.node.bone_name for b in v.humanoid.human_bones if b.node.bone_name
        }
        assert mapping == baseline["humanoid"]
        groups = {
            g.name: [(b.index, b.weight) for b in g.binds]
            for g in v.blend_shape_master.blend_shape_groups
        }
        assert groups == {
            k: [(b, w) for _, b, w in a] for k, a in baseline["expressions"].items()
        }
        assert len(v.secondary_animation.bone_groups) == len(baseline["springs"])
        record.update(
            bindings_exact=True,
            humanoid_exact=True,
            spring_groups=len(v.secondary_animation.bone_groups),
        )
    qa["imports"][ext] = record
(r / "review/validation.json").write_text(json.dumps(qa, indent=2))
