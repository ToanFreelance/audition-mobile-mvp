"""Đo trực tiếp đầu ra GBH, chỉnh guide, head-follow và khóa mặt/áo."""

import bpy, json, os, sys, hashlib, tomllib
import numpy as np
from pathlib import Path
from mathutils import Vector, Quaternion
from mathutils.bvhtree import BVHTree

r = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(r / "scripts"))
from rebake import evaluated_mesh
from lock import snap

base = Path(os.environ["V11_BLEND"])
bpy.ops.wm.open_mainfile(filepath=str(base))
baseline = snap()
bpy.ops.wm.open_mainfile(filepath=str(r / "out/Vita-Style04-Groom-V13.blend"))
assert snap() == baseline
(r / "review/face-lock.json").write_text(json.dumps(baseline, indent=2))
scene = bpy.context.scene
coll = bpy.data.collections["STYLE04 V13 • Native Hair Curves"]
coll.hide_viewport = False
entries = []
total = 0
for guide in coll.objects:
    if not len(guide.data.curves):
        entries.append(
            {
                "region": guide["groomRegion"],
                "curves": 0,
                "status": "Chưa triển khai sau cổng mỹ thuật FAIL",
            }
        )
        continue
    out = bpy.data.objects["Hair13_" + guide["groomRegion"]]
    live = evaluated_mesh(guide)
    assert len(live.vertices) == len(out.data.vertices)
    error = (
        max((a.co - b.co).length for a, b in zip(live.vertices, out.data.vertices))
        * 1000
    )
    assert error < 0.00001, (guide.name, error)
    widths = []
    near_tips = []
    tips = []
    roots = []
    for c in guide.data.curves:
        for j, bucket in [
            (len(c.points) // 2, widths),
            (int((len(c.points) - 1) * 0.9), near_tips),
            (len(c.points) - 1, tips),
            (0, roots),
        ]:
            i = c.points[j].index * 3
            bucket.append((live.vertices[i + 2].co - live.vertices[i].co).length * 1000)

    def dist(a):
        return dict(
            zip(
                ["min", "p10", "median", "p90", "max"],
                [float(x) for x in np.percentile(a, [0, 10, 50, 90, 100])],
            )
        )

    live.calc_loop_triangles()
    total += len(live.loop_triangles)
    entries.append(
        {
            "region": guide["groomRegion"],
            "curves": len(guide.data.curves),
            "triangles": len(live.loop_triangles),
            "liveToBakedMaxErrorMm": error,
            "midWidthMm": dist(widths),
            "rootWidthMm": dist(roots),
            "nearTipWidthMm": dist(near_tips),
            "tipWidthMm": dist(tips),
            "nativeType": guide.type,
            "surface": guide.data.surface.name if guide.data.surface else None,
            "modifiers": [m.node_group.name for m in guide.modifiers],
        }
    )
    bpy.data.meshes.remove(live)
guide = bpy.data.objects["Groom13_Fringe"]
point = guide.data.curves[7].points[15]
saved = point.position.copy()
a = evaluated_mesh(guide)
coords = [v.co.copy() for v in a.vertices]
bpy.data.meshes.remove(a)
point.position = saved + Vector((0.001, 0, 0))
b = evaluated_mesh(guide)
motion = max((p - v.co).length for p, v in zip(coords, b.vertices)) * 1000
bpy.data.meshes.remove(b)
point.position = saved
c = evaluated_mesh(guide)
restore = max((p - v.co).length for p, v in zip(coords, c.vertices)) * 1000
bpy.data.meshes.remove(c)
assert motion > 0.9 and restore < 0.00001
coll.hide_viewport = True
rig = bpy.data.objects["Armature"]
bone = rig.pose.bones["J_Bip_C_Head"]
pieces = list(bpy.data.collections["STYLE04 V13 • Export mesh"].objects)


def pos(o):
    bpy.context.view_layer.update()
    ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return np.asarray([ev.matrix_world @ v.co for v in ev.data.vertices])


before = [pos(o) for o in pieces]
m0 = bone.matrix.copy()
bone.rotation_mode = "QUATERNION"
bone.rotation_quaternion = Quaternion(Vector((0.2, 0.6, 0.4)), 0.31)
bpy.context.view_layer.update()
delta = rig.matrix_world @ bone.matrix @ m0.inverted() @ rig.matrix_world.inverted()
errs = []
for o, p in zip(pieces, before):
    predicted = p @ np.array(delta.to_3x3()).T + np.array(delta.translation)
    errs.append(float(np.linalg.norm(pos(o) - predicted, axis=1).max() * 1000))
assert max(errs) < 0.001
bone.rotation_quaternion.identity()
bpy.context.view_layer.update()
face = bpy.data.objects["Face"]
skin = BVHTree.FromPolygons(
    [v.co for v in face.data.vertices],
    [
        p.vertices[:]
        for p in face.data.polygons
        if "Face_00_SKIN" in face.data.materials[p.material_index].name
    ],
)
intersections = {}
for o in pieces:
    tree = BVHTree.FromPolygons(
        [v.co for v in o.data.vertices], [p.vertices[:] for p in o.data.polygons]
    )
    intersections[o.name] = len(tree.overlap(skin))
environment = {"blender": bpy.app.version_string, "addons": {}, "hairTriangles": total}
for name in ["gbhtool", "vrm"]:
    p = (
        Path.home()
        / ".config/blender/4.3/extensions/user_default"
        / name
        / "blender_manifest.toml"
    )
    manifest = tomllib.loads(p.read_text())
    environment["addons"][name] = {
        k: manifest[k] for k in ["version", "blender_version_min", "license"]
    }
report = {
    "baselineSha256": hashlib.sha256(base.read_bytes()).hexdigest(),
    "faceLockExact": True,
    "morphs": len(baseline["keys"]) - 1,
    "regions": entries,
    "hairTriangles": total,
    "guideEdit": {"requestMm": 1, "maximumMotionMm": motion, "restoreErrorMm": restore},
    "headFollowMaxErrorMm": max(errs),
    "skinTrianglePairIntersections": intersections,
    "stage": "checkpoint",
    "artisticGate": "FAIL",
    "notStarted": ["RightSide", "Back"],
}
(r / "review/validation.json").write_text(json.dumps(report, indent=2))
(r / "review/environment.json").write_text(json.dumps(environment, indent=2))
print(
    json.dumps(
        {
            "headFollowMm": max(errs),
            "hairTriangles": total,
            "collisions": intersections,
            "guideMoveMm": motion,
        }
    )
)
