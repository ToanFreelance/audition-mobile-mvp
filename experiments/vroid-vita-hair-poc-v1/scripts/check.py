"""Compare imported Vita to the authoring scene and exercise both deliverable formats."""

import bpy, pathlib, json, struct, hashlib, math, numpy as np
from mathutils import Vector

root = pathlib.Path(__file__).resolve().parents[1]
base = "Vita-Style04-Hair-POC-V1"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def geom(o):
    mesh = o.data
    data = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
    mesh.vertices.foreach_get("co", data)
    return dict(
        vertices=len(mesh.vertices),
        faces=len(mesh.polygons),
        positions=digest(data.tobytes()),
        topology=digest(
            np.array([l.vertex_index for l in mesh.loops], dtype="<i4").tobytes()
        ),
        shapes={
            k.name: digest(np.array([p.co[:] for p in k.data], dtype="<f4").tobytes())
            for k in mesh.shape_keys.key_blocks
        }
        if mesh.shape_keys
        else {},
        weights=digest(
            repr(
                [
                    [(o.vertex_groups[g.group].name, g.weight) for g in v.groups]
                    for v in mesh.vertices
                ]
            ).encode()
        ),
        materials=[m.name for m in mesh.materials],
        uvs={
            uv.name: digest(np.array([l.uv[:] for l in uv.data], dtype="<f4").tobytes())
            for uv in mesh.uv_layers
        },
    )


def state():
    rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    ext = rig.data.vrm_addon_extension.vrm0
    return dict(
        meshes={name: geom(bpy.data.objects[name]) for name in ["Face", "Body"]},
        bones={
            b.name: [
                b.parent.name if b.parent else None,
                list(b.head_local),
                list(b.tail_local),
            ]
            for b in rig.data.bones
        },
        bindings=[
            (g.name, [(b.mesh.mesh_object_name, b.index, b.weight) for b in g.binds])
            for g in ext.blend_shape_master.blend_shape_groups
        ],
        humanoid={b.bone: b.node.bone_name for b in ext.humanoid.human_bones},
        spring_groups=len(ext.secondary_animation.bone_groups),
    )


bpy.ops.wm.open_mainfile(filepath=str(root / "work/imported.blend"))
before = state()
bpy.ops.wm.open_mainfile(filepath=str(root / "out" / f"{base}.blend"))
after = state()
assert before == after


def hair_pose():
    rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    hair = [
        o
        for o in bpy.context.scene.objects
        if o.type == "MESH" and o.name.startswith("Style04")
    ]
    head = rig.pose.bones["J_Bip_C_Head"]

    def samples():
        dg = bpy.context.evaluated_depsgraph_get()
        return {
            o.name: [
                o.matrix_world @ o.evaluated_get(dg).data.vertices[i].co
                for i in range(
                    0, len(o.data.vertices), max(1, len(o.data.vertices) // 41)
                )
            ]
            for o in hair
        }

    initial = samples()
    m0 = rig.matrix_world @ head.matrix
    head.rotation_mode = "XYZ"
    head.rotation_euler.z += math.radians(17)
    bpy.context.view_layer.update()
    final = samples()
    delta = (rig.matrix_world @ head.matrix) @ m0.inverted()
    error = max(
        ((delta @ p) - f).length for k in initial for p, f in zip(initial[k], final[k])
    )
    head.rotation_euler.z -= math.radians(17)
    bpy.context.view_layer.update()
    return dict(
        objects=len(hair),
        points=sum(map(len, initial.values())),
        max_error_metres=error,
    )


p1 = hair_pose()
assert p1["max_error_metres"] < 1e-5 and p1["objects"] == 4
rig = bpy.data.objects["Armature"]
bpy.ops.object.select_all(action="DESELECT")
for o in [
    rig,
    bpy.data.objects["Face"],
    bpy.data.objects["Body"],
    *bpy.data.collections["STYLE 04 • Export meshes"].objects,
]:
    o.select_set(True)
bpy.context.view_layer.objects.active = rig
try:
    vstatus = list(
        bpy.ops.export_scene.vrm(
            filepath=str(root / "out" / f"{base}.vrm"),
            armature_object_name=rig.name,
            export_only_selections=True,
            export_invisibles=False,
            use_addon_preferences=False,
        )
    )
except Exception as e:
    vstatus = [str(e)]


def gltf(path):
    f = open(path, "rb")
    magic, ver, length = struct.unpack("<4sII", f.read(12))
    n, tag = struct.unpack("<I4s", f.read(8))
    assert magic == b"glTF" and length == path.stat().st_size and ver == 2
    return json.loads(f.read(n))


g = gltf(root / "out" / f"{base}.glb")
bpy.ops.wm.read_homefile(use_empty=True)
print(
    "GLB IMPORT", bpy.ops.import_scene.gltf(filepath=str(root / "out" / f"{base}.glb"))
)
p2 = hair_pose()
assert p2["max_error_metres"] < 1e-5 and p2["objects"] == 4
fresh = [o for o in bpy.context.scene.objects if o.type == "MESH"]
rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")


def texcheck(o):
    assert all(np.isfinite([l.uv[:] for l in uv.data]).all() for uv in o.data.uv_layers)
    return dict(
        vertices=len(o.data.vertices),
        uv_layers=len(o.data.uv_layers),
        materials=[m.name for m in o.data.materials],
        triangles=sum(len(p.vertices) - 2 for p in o.data.polygons),
        shapes=[k.name for k in o.data.shape_keys.key_blocks]
        if o.data.shape_keys
        else [],
    )


result = dict(
    authoring_face_body_rig_equal=True,
    source_face=after["meshes"]["Face"],
    source_body=after["meshes"]["Body"],
    bones=len(after["bones"]),
    humanoid=len(after["humanoid"]),
    bindings=after["bindings"],
    spring_groups=after["spring_groups"],
    authoring_pose=p1,
    glb_pose=p2,
    glb_meshes={o.name: texcheck(o) for o in fresh},
    glb_bones=len(rig.data.bones),
    glb_extensions=g.get("extensionsUsed"),
    glb_packed_images=len(g["images"]),
    glb_all_images_embedded=all("bufferView" in i for i in g["images"]),
    vrm_export=vstatus,
)
assert set(after["meshes"]["Face"]["shapes"]) == set(
    next(d["shapes"] for d in result["glb_meshes"].values() if d["shapes"])
)
if "FINISHED" in vstatus:
    v = gltf(root / "out" / f"{base}.vrm")["extensions"]["VRM"]
    result["vrm_extensions"] = {
        k: len(v[s][t])
        for k, s, t in [
            ("humanoid", "humanoid", "humanBones"),
            ("expressions", "blendShapeMaster", "blendShapeGroups"),
            ("springs", "secondaryAnimation", "boneGroups"),
        ]
    }
    bpy.ops.wm.read_homefile(use_empty=True)
    print(
        "VRM ROUNDTRIP",
        bpy.ops.import_scene.vrm(filepath=str(root / "out" / f"{base}.vrm")),
    )
    rt = state()
    result["vrm_roundtrip"] = dict(
        bones=len(rt["bones"]),
        morphs=len(rt["meshes"]["Face"]["shapes"]) - 1,
        bindings=rt["bindings"] == after["bindings"],
        humanoid=rt["humanoid"] == after["humanoid"],
        spring_groups=rt["spring_groups"],
    )
(root / "review/validation.json").write_text(
    json.dumps(result, indent=2, ensure_ascii=False)
)
