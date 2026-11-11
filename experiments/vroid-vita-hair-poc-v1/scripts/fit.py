"""Measure the editable guide roots and mesh/skin intersections in rest pose."""

import bpy, json, pathlib, numpy as np
from mathutils.bvhtree import BVHTree

root = pathlib.Path(__file__).resolve().parents[1]


def bvh(o, faces):
    return BVHTree.FromPolygons([o.matrix_world @ v.co for v in o.data.vertices], faces)


body = bpy.data.objects["Body"]
face = bpy.data.objects["Face"]


def pick(o, tag):
    return [
        f.vertices[:]
        for f in o.data.polygons
        if tag in o.data.materials[f.material_index].name
    ]


scalp = bvh(body, pick(body, "HairBack"))
skin = bvh(face, pick(face, "Face_00_SKIN"))
roots = []
for ob in bpy.data.collections["GROOM • Editable GBH sources"].objects:
    for c in ob.data.curves:
        pos = ob.matrix_world @ c.points[0].position
        roots.append(scalp.find_nearest(pos)[3] * 1000)
result = {
    "root_count": len(roots),
    "root_clearance_mm": dict(
        zip(("min", "median", "max"), map(float, np.percentile(roots, [0, 50, 100])))
    ),
    "intersections": {},
}
for ob in bpy.data.collections["STYLE 04 • Export meshes"].objects:
    surf = bvh(ob, [p.vertices[:] for p in ob.data.polygons])
    overlap = skin.overlap(surf)
    result["intersections"][ob.name] = len(overlap)
    if overlap:
        # Record positions of the hair polygons that contact the visible facial skin, including ears.
        p = np.array([ob.matrix_world @ ob.data.polygons[i].center for _, i in overlap])
        result.setdefault("intersection_aabbs", {})[ob.name] = [
            p.min(0).tolist(),
            p.max(0).tolist(),
        ]
(root / "review/fit.json").write_text(json.dumps(result, indent=2))
