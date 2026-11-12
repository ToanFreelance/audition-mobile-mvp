"""Dựng các món trên cảnh A đang mở. Các tọa độ thiết kế tính bằng mét trong tư thế nghỉ."""

import bpy, bmesh, math, pathlib, json, hashlib
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree
from math import sin, cos, pi

R = pathlib.Path(__file__).resolve().parents[1]
OUT = R / "out"
QA = R / "review"
STEM = "Vita-Premium-Cute-V11"
scene = bpy.context.scene
rig = bpy.data.objects["Armature"]
face = bpy.data.objects["Face"]
body = bpy.data.objects["Body"]
hair = bpy.data.objects["Hair001"]
import sys

sys.path.insert(0, str(R / "scripts"))
from identity import fingerprint

before = fingerprint(face, rig)


def tag(o, slot, item):
    o["cosmeticSlot"] = slot
    o["cosmeticId"] = item
    return o


tag(face, "CharacterBase", "vita-a")


def subset(src, name, accept, slot, item):
    o = src.copy()
    o.data = src.data.copy()
    scene.collection.objects.link(o)
    o.name = name
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not accept(f)], context="FACES")
    bm.to_mesh(o.data)
    bm.free()
    # Retain just the used material slots, preserving UV and skinning.
    for i in reversed(range(len(o.data.materials))):
        if all(f.material_index != i for f in o.data.polygons):
            o.data.materials.pop(index=i)
    return tag(o, slot, item)


cap = subset(body, "Scalp", lambda f: f.material_index == 3, "CharacterBase", "vita-a")
vitasuit = subset(
    body,
    "Vita_Suit",
    lambda f: f.material_index in (0, 1, 2),
    "OutfitSlot",
    "vita-stage",
)


def visible_skin(f):
    if f.material_index != 0:
        return False
    p = body.matrix_world @ f.calc_center_median()
    return (p.z > 1.36 and abs(p.x) < 0.105) or abs(p.x) > 0.518 or p.z < 0.805


skin = subset(body, "Street_Skin", visible_skin, "OutfitSlot", "lilac-club")
primary = subset(
    hair, "Hair_Bob", lambda f: f.material_index != 2, "HairSlot", "lilac-bob"
)
alt = subset(hair, "Hair_Lob", lambda f: f.material_index != 2, "HairSlot", "swept-lob")
for v in alt.data.vertices:
    p = alt.matrix_world @ v.co
    w = max(0, min(1, (1.64 - p.z) / 0.19))
    fringe = max(0, min(1, (-p.y - 0.055) / 0.045)) * max(0, 1 - abs(p.x) / 0.082)
    p.z -= 0.110 * w * w * (1 - fringe)
    p.x += 0.021 * w * fringe + 0.013 * w * (1 - fringe) * sin((p.z - 1.4) * 23)
    p.y += 0.014 * w * (1 - fringe)
    v.co = alt.matrix_world.inverted() @ p


# Flat colors converted from sRGB to scene linear for both exports.
def mat(name, h, rough=0.66, metal=0):
    c = [int(h[k : k + 2], 16) / 255 for k in (0, 2, 4)]
    c = [((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c] + [1]
    m = bpy.data.materials.new(name)
    m.diffuse_color = c
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = c
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m


lilac = mat("01 · Satin lilas", "ad8ed4", 0.46)
ivory = mat("02 · Ivoire", "fbf1e7")
plum = mat("03 · Prune", "55405f")
rib = mat("04 · Maille mauve", "836695")
gold = mat("05 · Champagne", "e7c693", 0.35, 0.32)
rose = mat("06 · Rose poudre", "e5abc5")
rubber = mat("07 · Semelle", "dfcede")
nude = mat("08 · Peau A corps", "f2c4b3", 0.75)
skin.data.materials[0] = nude
palette = [lilac, ivory, plum, rib, gold, rose, rubber, nude]


# Mesh builder: independent surfaces share a small indexed fabric palette.
class Pattern:
    def __init__(self):
        self.v = []
        self.f = []
        self.mi = []
        self.bones = []

    def point(self, p, b=None):
        self.v.append(tuple(p))
        self.bones.append(b)
        return len(self.v) - 1

    def face(self, vs, m):
        self.f.append(vs)
        self.mi.append(palette.index(m))

    def rings(self, rings, m, closed=True, caps=False, bone=None):
        ids = [[self.point(p, bone) for p in row] for row in rings]
        n = len(ids[0])
        for j in range(len(ids) - 1):
            for i in range(n if closed else n - 1):
                k = (i + 1) % n
                self.face(
                    (ids[j][i], ids[j][k], ids[j + 1][k], ids[j + 1][i]),
                    m(j, i) if callable(m) else m,
                )
        if caps:
            self.face(list(reversed(ids[0])), m)
            self.face(ids[-1], m)

    def tube(self, pts, r, m, bone=None, n=8):
        pts = list(map(Vector, pts))
        rows = []
        for i, p in enumerate(pts):
            t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            a = t.cross(
                Vector((0, 1, 0)) if abs(t.y) < 0.85 else Vector((0, 0, 1))
            ).normalized()
            b = t.cross(a)
            rows.append(
                [
                    p + r * (a * cos(2 * pi * k / n) + b * sin(2 * pi * k / n))
                    for k in range(n)
                ]
            )
        self.rings(rows, m, bone=bone)

    def finish(self, name, slot, item):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.v, [], self.f)
        mesh.update()
        o = bpy.data.objects.new(name, mesh)
        scene.collection.objects.link(o)
        for m in palette:
            mesh.materials.append(m)
        groups = {}
        for i, (p, bone) in enumerate(zip(self.v, self.bones)):
            if bone == "skirt":
                x, y, z = p
                bend = max(0, min(1, (1.01 - z) / 0.23)) * 0.61
                left = 0.5 + 0.5 * math.tanh(x / 0.086)
                weights = [
                    ("J_Bip_C_Hips", 1 - bend),
                    ("J_Bip_L_UpperLeg", bend * left),
                    ("J_Bip_R_UpperLeg", bend * (1 - left)),
                ]
            elif bone:
                weights = [(bone, 1)]
            else:
                vals = {}
                for _, j, d in tree.find_n(Vector(p), 5):
                    for g in body.data.vertices[j].groups:
                        key = body.vertex_groups[g.group].name
                        vals[key] = vals.get(key, 0) + g.weight / (0.002 + d) ** 3
                weights = sorted(vals.items(), key=lambda q: -q[1])[:4]
            total = sum(w for b, w in weights)
            for b, w in weights:
                if b not in groups:
                    groups[b] = o.vertex_groups.new(name=b)
                groups[b].add([i], w / total, "REPLACE")
        for f, m in zip(mesh.polygons, self.mi):
            f.material_index = m
            f.use_smooth = True
        for i in reversed(range(len(palette))):
            if i not in self.mi:
                mesh.materials.pop(index=i)
        mod = o.modifiers.new("Vita rig", "ARMATURE")
        mod.object = rig
        o.parent = rig
        return tag(o, slot, item)


ids = {v for f in body.data.polygons if f.material_index == 0 for v in f.vertices}
tree = KDTree(len(ids))
for i in ids:
    tree.insert(body.matrix_world @ body.data.vertices[i].co, i)
tree.balance()


def ellipse(z, rx, ry, cy=0, n=64, start=0, end=2 * pi, open_=False):
    return [
        (rx * sin(t), cy - ry * cos(t), z)
        for t in np.linspace(start, end, n, endpoint=open_)
    ]


wear = Pattern()
wear.rings(
    [
        ellipse(*r)
        for r in [
            (1.031, 0.109, 0.094, -0.011),
            (1.056, 0.101, 0.081, -0.026),
            (1.08, 0.095, 0.079, -0.034),
            (1.105, 0.094, 0.077, -0.038),
        ]
    ],
    nude,
)
# Cropped undershirt, open-front bomber with shaped neckline, paired binding and hem.
inner = [
    (1.09, 0.102, 0.083, -0.046),
    (1.12, 0.099, 0.086, -0.047),
    (1.22, 0.117, 0.099, -0.038),
    (1.29, 0.126, 0.091, -0.028),
    (1.34, 0.12, 0.069, -0.008),
    (1.375, 0.068, 0.056, 0),
]
wear.rings([ellipse(*r) for r in inner], ivory)
wear.rings(
    [ellipse(1.088, 0.103, 0.085, -0.046), ellipse(1.102, 0.104, 0.087, -0.046)], rib
)
jacket = [
    (1.108, 0.116, 0.102, -0.037, 0.58),
    (1.13, 0.124, 0.108, -0.037, 0.56),
    (1.17, 0.132, 0.112, -0.037, 0.53),
    (1.24, 0.142, 0.115, -0.029, 0.51),
    (1.30, 0.155, 0.108, -0.027, 0.48),
    (1.355, 0.153, 0.081, -0.002, 0.50),
    (1.391, 0.09, 0.065, 0.005, 0.63),
    (1.404, 0.061, 0.048, 0.006, 0.78),
]
rows = [ellipse(z, x, y, c, 60, a, 2 * pi - a, True) for z, x, y, c, a in jacket]
wear.rings(rows, lambda j, i: rib if j == 0 or j == 6 else lilac, False)
for side in [0, -1]:
    wear.tube([r[side] for r in rows], 0.0026, gold)


# Pleated tennis skirt, waist rib, twin contrast hem stripes. Canted box pleats.
def pleat(z, x, y, a):
    pts = []
    for k in range(22):
        for j, dr in [(0, 0), (0.17, 1), (0.72, 1), (0.85, -0.7)]:
            t = 2 * pi * (k + j) / 22 + (1.03 - z) * 0.32
            pts.append(
                (
                    (x + a * dr) * sin(t),
                    0.002 - (y + a * dr) * cos(t),
                    z + 0.0015 * cos(t * 3),
                )
            )
    return pts


levels = [
    (0.78, 0.192, 0.135, 0.012),
    (0.787, 0.191, 0.134, 0.012),
    (0.795, 0.19, 0.134, 0.012),
    (0.806, 0.189, 0.133, 0.011),
    (0.817, 0.188, 0.132, 0.011),
    (0.93, 0.158, 0.108, 0.008),
    (1.006, 0.13, 0.096, 0.002),
    (1.025, 0.122, 0.106, 0),
    (1.044, 0.117, 0.111, 0),
]
skirt_first = len(wear.v)
wear.rings(
    [pleat(*r) for r in levels],
    lambda j, i: (
        ivory if j in [0, 3] else (lilac if j == 2 else (rib if j >= 6 else plum))
    ),
)
skirt_end = len(wear.v)
# A continuous bilateral gradient avoids a rigid break at centre-front during a leg lift.
for i in range(skirt_first, skirt_end):
    wear.bones[i] = "skirt"
# Embroidered CLUB wordmark, following the curved chest of the jersey.
letters = [
    [(1, 1), (0, 1), (0, 0), (1, 0)],
    [(0, 1), (0, 0), (1, 0)],
    [(0, 1), (0, 0.18), (0.22, 0), (0.8, 0), (1, 0.18), (1, 1)],
    [
        (0, 0),
        (0, 1),
        (0.76, 1),
        (1, 0.8),
        (0.7, 0.53),
        (0, 0.53),
        (0.77, 0.53),
        (1, 0.28),
        (0.77, 0),
        (0, 0),
    ],
]
for k, points in enumerate(letters):
    stitch = []
    for u, v in points:
        x = (k - 1.75) * 0.014 + u * 0.009
        z = 1.263 + v * 0.013
        y = -0.034 - 0.099 * math.sqrt(1 - (x / 0.122) ** 2) - 0.001
        stitch.append((x, y, z))
    wear.tube(stitch, 0.0014, rib, n=6)
# Sleeves follow actual shoulders and forearms, with varsity bands and ribbed cuffs.
for s in (-1, 1):
    stations = [
        (0.073, 1.348, 0.043, 0.042),
        (0.102, 1.35, 0.061, 0.055),
        (0.147, 1.35, 0.073, 0.066),
        (0.21, 1.342, 0.064, 0.059),
        (0.245, 1.339, 0.061, 0.057),
        (0.253, 1.339, 0.061, 0.057),
        (0.267, 1.338, 0.06, 0.056),
        (0.276, 1.337, 0.06, 0.056),
        (0.33, 1.338, 0.056, 0.055),
        (0.408, 1.338, 0.052, 0.051),
        (0.483, 1.339, 0.047, 0.048),
        (0.505, 1.339, 0.039, 0.041),
        (0.537, 1.338, 0.034, 0.034),
    ]
    sleeve = []
    for x, z, ry, rz in stations:
        sleeve.append(
            [
                (s * x, -0.006 + ry * cos(t), z + rz * sin(t))
                for t in np.arange(32) * 2 * pi / 32
            ]
        )
    wear.rings(
        sleeve, lambda j, i: rib if j == 11 else (lilac if j in [4, 6] else ivory)
    )
    for ix in (2, 8):
        wear.tube([sleeve[j][ix] for j in range(1, 11)], 0.0017, lilac)
# Contrasting angled welt pockets and paired snap buttons on the open jacket.
for side in (-1, 1):
    line = [
        (side * 0.074, -0.126, 1.151),
        (side * 0.091, -0.117, 1.164),
        (side * 0.105, -0.107, 1.18),
    ]
    wear.tube(line, 0.004, rib)
    wear.tube([(x, y - 0.002, z + 0.002) for x, y, z in line], 0.0016, ivory)
    for z in [1.15, 1.215, 1.275]:
        x = side * 0.063
        wear.tube([(x, -0.137, z), (x, -0.141, z)], 0.0028, gold)


# Sewn four-point stars on the left breast plus a smaller companion.
def patch(x, y, z, w, h, m):
    c = wear.point((x, y - 0.002, z))
    points = []
    for i in range(8):
        t = 2 * pi * i / 8
        r = 0.29 if i % 2 else 1
        points.append(
            wear.point(
                (x + w * r * sin(t), y + 0.37 * w * r * sin(t), z + h * r * cos(t))
            )
        )
    for i in range(8):
        wear.face([c, points[i], points[(i + 1) % 8]], m)


patch(0.078, -0.125, 1.288, 0.016, 0.022, ivory)
patch(0.097, -0.118, 1.308, 0.007, 0.009, gold)
# Ankle socks and contoured platform sneakers in layered rubber and two-tone leather.
for s, side in [(1, "L"), (-1, "R")]:
    foot = "J_Bip_" + side + "_Foot"
    leg = "J_Bip_" + side + "_LowerLeg"
    x = 0.046 * s

    def shoe(z, rx, ry, cy, n=36):
        return [
            (x + rx * sin(t) * (1.04 + 0.11 * cos(t)), cy - ry * cos(t), z)
            for t in np.arange(n) * 2 * pi / n
        ]

    wear.rings(
        [
            shoe(*v)
            for v in [
                (0.113, 0.039, 0.043, 0.035),
                (0.174, 0.035, 0.043, 0.035),
                (0.2, 0.035, 0.04, 0.035),
                (0.207, 0.035, 0.04, 0.035),
                (0.222, 0.035, 0.04, 0.035),
            ]
        ],
        lambda j, i: lilac if j == 2 else ivory,
        bone=leg,
    )
    soles = [
        (0.015, 0.045, 0.111, -0.018),
        (0.021, 0.05, 0.115, -0.018),
        (0.035, 0.05, 0.116, -0.018),
        (0.042, 0.049, 0.115, -0.018),
        (0.052, 0.048, 0.113, -0.018),
    ]
    wear.face([wear.point(p, foot) for p in reversed(shoe(*soles[0]))], rubber)
    wear.rings(
        [shoe(*v) for v in soles],
        lambda j, i: rubber if j == 0 else (lilac if j == 2 else ivory),
        bone=foot,
    )
    wear.rings(
        [
            shoe(*v)
            for v in [
                soles[-1],
                (0.07, 0.048, 0.108, -0.013),
                (0.094, 0.045, 0.088, 0.003),
                (0.12, 0.043, 0.061, 0.022),
                (0.146, 0.039, 0.05, 0.028),
            ]
        ],
        lambda j, i: (
            rib
            if j == 3
            else (lilac if j == 1 and (4 < i < 14 or 22 < i < 32) else ivory)
        ),
        bone=foot,
    )
    for j in range(4):
        y = -0.087 + 0.011 * j
        z = 0.086 + 0.009 * j
        wear.tube(
            [
                (x - 0.022, y, z),
                (x, y - 0.006, z + 0.004),
                (x + 0.022, y + 0.005, z + 0.001),
            ],
            0.0026,
            lilac,
            foot,
        )
    wear.tube(
        [(x, 0.071, 0.116), (x, 0.08, 0.15), (x, 0.066, 0.157)], 0.004, rose, foot
    )
shorts = subset(
    body,
    "Street_Dance_Shorts",
    lambda f: (
        f.material_index == 0
        and 0.758 < (body.matrix_world @ f.calc_center_median()).z < 0.987
    ),
    "OutfitSlot",
    "lilac-club",
)
for v in shorts.data.vertices:
    v.co += v.normal * 0.0025
shorts.data.materials[0] = plum
outfit = wear.finish("Street_Bomber_Pleats_Sneakers", "OutfitSlot", "lilac-club")
# Pleated satin bow. Curved loops, separate tails and knot.
bow = Pattern()
head = "J_Bip_C_Head"
center = np.array([0.09, -0.069, 1.658])
for s in [-1, 1]:
    rows = []
    for u in np.linspace(0, 1, 12):
        row = []
        for a in np.arange(16) * 2 * pi / 16:
            row.append(
                center
                + [
                    s * 0.039 * u,
                    -0.005 * sin(pi * u) - (0.002 + 0.005 * u) * cos(a),
                    0.009 * u + (0.003 + 0.015 * sin(u * pi * 0.68)) * sin(a),
                ]
            )
        rows.append(row)
    bow.rings(rows, rose, bone=head)
    bow.tube([r[4] for r in rows], 0.0011, gold, head)
    bow.rings(
        [
            [
                center
                + [
                    s * (0.006 + u * 0.021) + d,
                    -0.003 - u * 0.002,
                    -0.005 - u * 0.039 + (abs(d) * 0.4 if u == 1 else 0),
                ]
                for d in [-0.005, 0.005]
            ]
            for u in np.linspace(0, 1, 8)
        ],
        rose,
        False,
        bone=head,
    )
bow.tube([center + [0, 0, -0.006], center + [0, 0, 0.006]], 0.006, gold, head, 12)
acc = bow.finish("Ribbon_Champagne", "HeadAccessorySlot", "rose-bow")
for o in (body, hair):
    bpy.data.objects.remove(o, do_unlink=True)
for o in (vitasuit, alt):
    o.hide_render = True
    o.hide_set(True)
assert before == fingerprint(face, rig)
(QA / "face-lock.json").write_text(json.dumps(before, indent=2))
# Frame the complete wardrobe in the editable rest pose when the file opens.
cam = scene.camera
cam.location = (0, -3, 0.881)
cam.rotation_euler = (
    (Vector((0, 0, 0.865)) - cam.location).to_track_quat("-Z", "Y").to_euler()
)
cam.data.ortho_scale = 2.02
scene.render.resolution_x = 740
scene.render.resolution_y = 870
info = bpy.data.texts.new("V1.1 · Trang phục")
info.write(
    "Mặc định dùng Hair_Bob, Street_Skin, Street_Dance_Shorts, Street_Bomber_Pleats_Sneakers và Ribbon_Champagne. Đổi sang Vita_Suit bằng cách ẩn cả ba mesh Street. Đổi tóc bằng Hair_Bob / Hair_Lob. Đồng bộ biểu tượng con mắt và máy ảnh trong Outliner. Face, Scalp và Armature dùng chung. Các thuộc tính cosmeticSlot và cosmeticId xác định món."
)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / (STEM + ".blend")), compress=True)
