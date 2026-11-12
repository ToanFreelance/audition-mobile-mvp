"""Check the original, A, B, B's rollback mesh, and a fresh VRM import."""

import bpy, numpy as np, pathlib, json, hashlib, sys
from mathutils.kdtree import KDTree

root = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "scripts"))
from refine import deform

prefix = "Vita-Premium-Anime-V1"


def hash_array(x):
    return hashlib.sha256(np.asarray(x).tobytes()).hexdigest()


def coords(points):
    a = np.empty(len(points) * 3, dtype="f")
    points.foreach_get("co", a)
    return a.reshape(-1, 3)


def meshdata(name):
    o = bpy.data.objects[name]
    m = o.data
    return dict(
        position=coords(m.vertices),
        topology=hash_array(np.array([x.vertex_index for x in m.loops], dtype="<u4")),
        uv=hash_array(
            np.array([x.uv[:] for x in m.uv_layers.active.data], dtype="<f4")
        ),
        weights=hash_array(
            repr(
                [
                    [(o.vertex_groups[g.group].name, g.weight) for g in v.groups]
                    for v in m.vertices
                ]
            ).encode()
        ),
    )


def snapshot():
    rig = bpy.data.objects["Armature"]
    v = rig.data.vrm_addon_extension.vrm0
    f = bpy.data.objects["Face"]
    return dict(
        meshes={n: meshdata(n) for n in ("Face", "Body", "Hair001")},
        keys={k.name: coords(k.data) for k in f.data.shape_keys.key_blocks},
        humanoid={
            b.bone: b.node.bone_name for b in v.humanoid.human_bones if b.node.bone_name
        },
        bones={
            b.name: (
                b.parent.name if b.parent else "",
                list(b.head_local),
                list(b.tail_local),
            )
            for b in rig.data.bones
        },
        binds={
            g.name: [(x.index, x.weight) for x in g.binds]
            for g in v.blend_shape_master.blend_shape_groups
        },
        springs=len(v.secondary_animation.bone_groups),
    )


def poses():
    out = {}
    ob = bpy.data.objects["Face"]
    ks = ob.data.shape_keys.key_blocks
    for n in ["Neutral", "Joy", "Blink", "A", "Surprised"]:
        for k in ks:
            k.value = 0
        group = next(
            g
            for g in bpy.data.objects[
                "Armature"
            ].data.vrm_addon_extension.vrm0.blend_shape_master.blend_shape_groups
            if g.name == n
        )
        for bind in group.binds:
            ks[bind.index].value = bind.weight
        bpy.context.view_layer.update()
        ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
        p = coords(ev.data.vertices)
        out[n] = (
            p @ np.array(ev.matrix_world)[:3, :3].T + np.array(ev.matrix_world)[:3, 3]
        )
    return out


def distance(a, b):
    tree = KDTree(len(b))
    for i, p in enumerate(b):
        tree.insert(p, i)
    tree.balance()
    return max(tree.find(p)[2] for p in a)


def span():
    ob = bpy.data.objects["Face"]
    result = {}
    for token in ("EyeWhite", "EyeIris", "FaceMouth"):
        ids = {
            i
            for p in ob.data.polygons
            if token in ob.data.materials[p.material_index].name
            for i in p.vertices
        }
        a = coords(ob.data.vertices)[list(ids)]
        a = a[a[:, 0] > 0] if token != "FaceMouth" else a
        result[token] = np.ptp(a, axis=0).tolist()
    return result


bpy.ops.wm.open_mainfile(filepath=str(root / "work/native.blend"))
original = snapshot()
bpy.ops.wm.open_mainfile(filepath=str(root / "out" / f"{prefix}-A.blend"))
a = snapshot()
asp = span()
bpy.ops.wm.open_mainfile(filepath=str(root / "out" / f"{prefix}-B.blend"))
b = snapshot()
bsp = span()
for n in a["meshes"]:
    for x in ["uv", "weights", "topology"]:
        assert original["meshes"][n][x] == a["meshes"][n][x] == b["meshes"][n][x], (
            n,
            x,
        )
    assert np.array_equal(original["meshes"][n]["position"], a["meshes"][n]["position"])
    if n != "Face":
        assert np.array_equal(a["meshes"][n]["position"], b["meshes"][n]["position"])
for k in ["humanoid", "bones", "binds", "springs"]:
    assert original[k] == a[k] == b[k], k
for k in a["keys"]:
    assert np.array_equal(original["keys"][k], a["keys"][k]), k
delta = {}
for k, ap in a["keys"].items():
    source = np.column_stack((ap[:, 0], ap[:, 2], -ap[:, 1])).astype(float)
    expected = deform(source)
    transformed = np.column_stack((expected[:, 0], -expected[:, 2], expected[:, 1]))
    delta[k] = float(np.linalg.norm(b["keys"][k] - transformed, axis=1).max())
assert max(delta.values()) < 2e-6, max(delta.values())
ob = bpy.data.objects["Face"]
refined = ob.data
ob.data = bpy.data.meshes["Vita Face · A · original proportions"]
reverted = snapshot()
assert all(np.array_equal(ap, reverted["keys"][k]) for k, ap in a["keys"].items())
ob.data = refined
bp = poses()
bpy.ops.wm.read_homefile(use_empty=True)
assert "FINISHED" in bpy.ops.import_scene.vrm(
    filepath=str(root / "out" / f"{prefix}-B.vrm")
)
rt = snapshot()
rp = poses()
assert (
    b["binds"] == rt["binds"]
    and b["humanoid"] == rt["humanoid"]
    and b["springs"] == rt["springs"]
)
assert set(b["bones"]) == set(rt["bones"])
assert set(rt["keys"]) == set(b["keys"])
checks = {}
for key in rp:
    error = max(distance(rp[key], bp[key]), distance(bp[key], rp[key]))
    assert error < 0.0001, (key, error)
    checks[key] = dict(
        max_surface_error_mm=error * 1000,
        max_motion_mm=float(
            np.linalg.norm(bp[key] - bp["Neutral"], axis=1).max() * 1000
        ),
    )
metadata = dict(
    face_vertices=len(a["keys"]["Basis"]),
    keys=len(a["keys"]) - 1,
    expressions=len(b["binds"]),
    humanoid=len(b["humanoid"]),
    bones=len(b["bones"]),
    springs=b["springs"],
    A_all_meshes_equal_original=True,
    body_and_hair_positions_equal=True,
    UV_topology_skinning_equal=True,
    all_shape_fields_max_error_mm=max(delta.values()) * 1000,
    B_rollback_all_keys_exact=True,
    expression_roundtrip=checks,
    eye_white_width_change_pct=100 * (bsp["EyeWhite"][0] / asp["EyeWhite"][0] - 1),
    eye_white_height_change_pct=100 * (bsp["EyeWhite"][2] / asp["EyeWhite"][2] - 1),
    iris_height_change_pct=100 * (bsp["EyeIris"][2] / asp["EyeIris"][2] - 1),
    mouth_interior_width_change_pct=100
    * (bsp["FaceMouth"][0] / asp["FaceMouth"][0] - 1),
    max_base_shift_mm=float(
        np.linalg.norm(b["keys"]["Basis"] - a["keys"]["Basis"], axis=1).max() * 1000
    ),
)
(root / "review/rig-geometry.json").write_text(json.dumps(metadata, indent=2))
print(metadata)
