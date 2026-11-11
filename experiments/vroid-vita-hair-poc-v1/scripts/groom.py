"""Run on work/imported.blend after importing the original through VRM Add-on."""

import math, random, json, pathlib
import bpy, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from math import sin, cos, pi

root = pathlib.Path(__file__).resolve().parents[1]
out = root / "out"
rnd = random.Random(7404)
scene = bpy.context.scene
rig = bpy.data.objects["Armature"]
face = bpy.data.objects["Face"]
body = bpy.data.objects["Body"]
old = bpy.data.objects["Hair001"]


def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


def move(obj, c):
    for a in list(obj.users_collection):
        a.objects.unlink(obj)
    c.objects.link(obj)


def active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def bind(obj):
    g = obj.vertex_groups.new(name="J_Bip_C_Head")
    g.add(list(range(len(obj.data.vertices))), 1, "REPLACE")
    obj.parent = rig
    mod = obj.modifiers.new("Vita • Head", "ARMATURE")
    mod.object = rig


def smooth(x):
    x = max(0, min(1, x))
    return x * x * (3 - 2 * x)


ref = collection("REFERENCE • Vita original hair")
live = collection("STYLE 04 • Export meshes")
guides = collection("GROOM • Editable GBH sources")
move(old, ref)
ref.hide_render = True
ref.hide_viewport = True
tex = bpy.data.images.load(str(root / "work/lavender-fibres.png"))
tex.pack()
cardmat = bpy.data.materials.new("Style 04 • Lavender silk | directional RGBA")
cardmat.use_nodes = True
bs = cardmat.node_tree.nodes.get("Principled BSDF")
bs.inputs["Roughness"].default_value = 0.46
for socket in bs.inputs:
    if socket.name in (
        "Anisotropic",
        "Anisotropic IOR Level",
        "Anisotropic IOR Level (Deprecated)",
    ):
        socket.default_value = 0.30
img = cardmat.node_tree.nodes.new("ShaderNodeTexImage")
img.image = tex
for outkey, inkey in [("Color", "Base Color"), ("Alpha", "Alpha")]:
    cardmat.node_tree.links.new(img.outputs[outkey], bs.inputs[inkey])
cardmat.use_backface_culling = False
vertices = []
faces = []
uv = []
fibres = []
card_count = 0
# Scalp fit measured on HairBack and Face. Longitude zero looks forward.
scalp_polys = [
    f.vertices[:]
    for f in body.data.polygons
    if "HairBack" in body.data.materials[f.material_index].name
]
scalp = BVHTree.FromPolygons(
    [body.matrix_world @ v.co for v in body.data.vertices], scalp_polys
)


def strand(a, t, end, lift, phase, sweep, delta=0):
    side = 1 if a >= 0 else -1
    # The crown opens along a short fore/aft part rather than a single pole.
    angle = (
        a
        + side * (0.22 * sin(pi * t) - 0.105 * smooth((t - 0.64) / 0.36))
        + sweep * t * t
        + 0.044 * sin(phase + t * 6) * t * t
    )
    ztop = 1.689 + lift * 0.48
    base = 1.571
    length = (ztop - base) * pi / 2 + max(0, base - end)
    if end > base:
        phi_end = math.acos(min(1, (end - base) / (ztop - base)))
        phi = phi_end * t
        skirt = 0
    else:
        d = length * t
        phi = min(pi / 2, d / (ztop - base))
        skirt = max(0, d - (ztop - base) * pi / 2)
    r = sin(phi)
    tail = skirt / max(0.001, base - end)
    curl = smooth((tail - 0.50) / 0.5)
    radius = (
        (0.1125 + lift) * r
        + (0.005 + 0.003 * sin(a * 4 + phase * 0.18)) * sin(tail * pi)
        - 0.018 * curl
    )
    depth = (0.1155 + lift) * r + 0.0035 * sin(tail * pi) - 0.012 * curl
    part = (1 - r) ** 2
    x = sin(angle) * radius - 0.009 * part + side * 0.0013 * part
    y = 0.008 - cos(angle) * depth - 0.035 * cos(a) * part
    z = base + (ztop - base) * cos(phi) - skirt
    x += delta * sin(angle)
    y -= delta * cos(angle)
    if t < 0.235:
        contact, _, _, _ = scalp.ray_cast((x, y, 1.8), (0, 0, -1), 0.20)
        if contact:
            z += (contact.z + 0.00035 - z) * (1 - smooth(t / 0.235))
    return (x, y, z)


def lower(a, phase, layer):
    angle = abs(a)
    # A short, broken fringe transitions to long cheek-framing curtain pieces.
    asym = 0.07 if a > 0 else -0.025
    trans = smooth((angle - (0.57 + asym)) / 0.55)
    fringe = 1.535 + 0.020 * (0.5 + 0.5 * sin(a * 11 + 0.85)) + 0.009 * sin(a * 25 - 1)
    long = 1.397 + 0.012 * cos(a * 3.3) + 0.007 * sin(a * 7.5 + phase * 0.22)
    return (
        fringe * (1 - trans) + long * trans + layer * 0.009 + rnd.uniform(-0.008, 0.008)
    )


for layer, count in enumerate((59, 78, 54)):
    for i in range(count):
        a = -pi + (i + 0.37 * layer + rnd.uniform(-0.21, 0.21)) * 2 * pi / count
        if a > pi:
            a -= 2 * pi
        phase = rnd.uniform(0, 2 * pi)
        end = lower(a, phase, layer)
        lift = 0.0008 + layer * 0.0038 + rnd.uniform(0, 0.0023)
        sweep = 0.032 * sin(2 * a + 0.4) + rnd.uniform(-0.07, 0.07)
        if abs(a) < 1.1:
            sweep += 0.115 * cos(a * 2.1)
        half = pi / count * rnd.uniform(1.25, 1.62)
        if layer == 0 and abs(a) < 0.85:
            end += 0.018
        if layer == 2 and abs(a) < 0.72:
            half *= 0.80
        seg = 34
        cross = 5
        start = len(vertices)
        tile = rnd.randrange(8)

        def sample(t, k, above=0):
            w = 1 - 0.38 * smooth((t - 0.65) / 0.35)
            rad = 0.0018 * (1 - k * k) * sin(pi * t) ** 0.6 + above
            return strand(
                a + half * k * w,
                t,
                end + 0.004 * k * sin(phase),
                lift,
                phase,
                sweep,
                rad,
            )

        for j in range(seg + 1):
            t = j / seg
            for l in range(cross + 1):
                s = l / cross
                vertices.append(sample(t, 2 * s - 1))
                uv.append(((tile + 0.008 + 0.984 * s) / 8, 1 - t))
            if j:
                for l in range(cross):
                    n = start + (j - 1) * (cross + 1) + l
                    faces.append((n, n + cross + 1, n + cross + 2, n + 1))
        # Fine, independently traced contour and surface fibres.
        for _ in range(4 if layer != 1 else 6):
            k = rnd.uniform(-1.05, 1.05)
            off = rnd.uniform(0.00025, 0.0010)
            shift = rnd.uniform(-0.19, 0.19)
            last = rnd.uniform(0.86, 1)
            pts = [
                sample(
                    t * last,
                    k + shift * sin(pi * t) + 0.05 * sin(phase + t * 6) * t,
                    off,
                )
                for t in np.linspace(0, 1, 29)
            ]
            fibres.append(pts)
        card_count += 1
# Independently swept temple layers. Broad at the temple, open around the cheek,
# turning forward again at the neck. Angular offsets keep their roots on the dome.
for side in (-1, 1):
    for i in range(14):
        band = i / 13
        phase = rnd.uniform(0, 2 * pi)
        endpoint = 1.399 + 0.044 * band + 0.006 * sin(phase)
        lift = 0.009 + 0.004 * sin(pi * band) + 0.002 * rnd.random()
        half = 0.038 + 0.024 * (1 - band)

        def curtain(t, k, above=0):
            a = (
                0.94
                + 0.28 * band
                - 0.29 * sin(t * pi)
                + 0.17 * sin(2.1 * pi * t + 0.15) * t
                + 0.055 * side
            )
            w = 1 - 0.57 * smooth((t - 0.61) / 0.39)
            return strand(
                side * (a + k * half * w),
                t,
                endpoint + 0.004 * k,
                lift,
                phase,
                -0.065 * side,
                above + 0.0012 * (1 - k * k),
            )

        start = len(vertices)
        tile = rnd.randrange(8)
        for j in range(35):
            t = j / 34
            for l in range(6):
                vertices.append(curtain(t, l / 2.5 - 1))
                uv.append(((tile + 0.008 + 0.984 * l / 5) / 8, 1 - t))
            if j:
                for l in range(5):
                    n = start + (j - 1) * 6 + l
                    q = (n, n + 6, n + 7, n + 1)
                    faces.append(q if side > 0 else tuple(reversed(q)))
        for _ in range(6):
            k = rnd.uniform(-1.08, 1.08)
            offset = rnd.uniform(0.0003, 0.0009)
            length = rnd.uniform(0.91, 1)
            fibres.append(
                [
                    curtain(t * length, k + 0.09 * sin(t * 5 + phase), offset)
                    for t in np.linspace(0, 1, 29)
                ]
            )
        card_count += 1
mesh = bpy.data.meshes.new("Layered fan cards")
mesh.from_pydata(vertices, [], faces)
mesh.update()
cards = bpy.data.objects.new("Style04 • Layered silk cards", mesh)
live.objects.link(cards)
cards.data.materials.append(cardmat)
uvlayer = mesh.uv_layers.new(name="UVMap")
uvlayer.data.foreach_set(
    "uv", np.array([uv[l.vertex_index] for l in mesh.loops], dtype="f").ravel()
)
for p in mesh.polygons:
    p.use_smooth = True
bind(cards)
# Create editable native hair sets and execute GBH on actual groom geometry.
bpy.ops.gbh.reload_library()
name = "GBH Profile Polygon Hair Cards"
spec = repr((name, "GBH Library - Essentials.blend"))
bpy.ops.gbh.node_group_append(nodename=spec)
bpy.context.preferences.addons[
    "bl_ext.user_default.gbhtool"
].preferences.lib_add_to_active_object = True
logs = []
fiber_meshes = []
for idx, linear in enumerate(
    [(0.23, 0.134, 0.253), (0.38, 0.227, 0.387), (0.49, 0.325, 0.49)]
):
    chunk = fibres[idx::3]
    h = bpy.data.hair_curves.new("Style04 • strand guides " + str(idx + 1))
    h.add_curves([len(p) for p in chunk])
    h.position_data.foreach_set("vector", np.asarray(chunk, dtype="f").ravel())
    resolution = h.attributes.new("resolution", "INT", "CURVE")
    resolution.data.foreach_set("value", np.full(len(chunk), 2, dtype="i"))
    rad = h.attributes.new("radius", "FLOAT", "POINT")
    rad.data.foreach_set(
        "value", np.tile(np.linspace(0.85, 0.17, len(chunk[0]), dtype="f"), len(chunk))
    )
    ob = bpy.data.objects.new(h.name, h)
    guides.objects.link(ob)
    active(ob)
    scene.hair_object = ob
    result = bpy.ops.gbh.node_group_add_to_object(nodename=spec)
    m = ob.modifiers[name]
    m["Input_11"] = 0.032
    m["Input_12"] = 3
    m["Output_7_attribute_name"] = "UVMap"
    ob.update_tag()
    bpy.context.view_layer.update()
    conversion = bpy.ops.gbh.convert_hair(convert_to="MESH")
    outob = bpy.context.active_object
    geo = outob.data
    assert outob.type == "MESH" and len(geo.polygons) > 0
    outob.name = "Style04 • GBH filaments " + str(idx + 1)
    move(outob, live)
    fiber_meshes.append(outob)
    # Map the known 3-sided GBH cross section along the guide.
    if not geo.uv_layers:
        existing = geo.attributes.get("UVMap")
        if existing:
            existing.name = "GBH raw UV"
        uvmap = geo.uv_layers.new(name="UVMap")
        for l in geo.loops:
            vi = l.vertex_index
            uvmap.data[l.index].uv = (
                (vi % 3) / 2,
                ((vi // 3) % len(chunk[0])) / (len(chunk[0]) - 1),
            )
    mat = bpy.data.materials.new("Style04 • fibre " + str(idx + 1))
    mat.diffuse_color = (*linear, 1)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*linear, 1)
    p.inputs["Roughness"].default_value = 0.43
    geo.materials.clear()
    geo.materials.append(mat)
    for f in geo.polygons:
        f.use_smooth = True
    bind(outob)
    logs.append(
        dict(
            operator="gbh.node_group_add_to_object",
            result=list(result),
            convert_hair_mesh=list(conversion),
            group=name,
            guides=len(chunk),
            points=len(h.points),
            mesh_vertices=len(geo.vertices),
            mesh_faces=len(geo.polygons),
            width=m["Input_11"],
            resolution=m["Input_12"],
        )
    )
guides.hide_render = True
guides.hide_viewport = True
scene.hair_object = None


def aim(o, point):
    o.rotation_euler = (Vector(point) - o.location).to_track_quat("-Z", "Y").to_euler()


studio = collection("STUDIO • Review cameras and lights")


def area(name, loc, power, size, color):
    light = bpy.data.lights.new(name, "AREA")
    light.energy = power
    light.shape = "DISK"
    light.size = size
    light.color = color
    o = bpy.data.objects.new(name, light)
    studio.objects.link(o)
    o.location = loc
    aim(o, (0, 0, 1.54))


area("Key softbox", (-0.58, -0.72, 2.22), 19, 0.65, (1, 0.91, 0.87))
area("Fill softbox", (0.50, -0.42, 1.74), 9, 0.60, (0.87, 0.89, 1))
area("Rim softbox", (0.24, 0.51, 2.07), 22, 0.48, (0.95, 0.85, 1))
camdata = bpy.data.cameras.new("Portrait orthographic")
camdata.type = "ORTHO"
camdata.ortho_scale = 0.413
cam = bpy.data.objects.new("Portrait camera", camdata)
studio.objects.link(cam)
cam.location = (0, -1.05, 1.545)
aim(cam, (0, 0, 1.535))
scene.camera = cam
scene.world = bpy.data.worlds.new("Soft slate studio")
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value = (0.19, 0.19, 0.26, 1)
bg.inputs["Strength"].default_value = 0.65
scene.render.engine = "CYCLES"
scene.cycles.samples = 96
scene.cycles.use_denoising = False
scene.cycles.transparent_max_bounces = 14
scene.view_settings.view_transform = "Khronos PBR Neutral"
scene.render.resolution_x = 720
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == "VIEW_3D":
            area.spaces.active.region_3d.view_perspective = "CAMERA"
            area.spaces.active.overlay.show_overlays = False
active(cards)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(
    filepath=str(out / "Vita-Style04-Hair-POC-V1.blend"), compress=True
)
active(cards)
for o in [face, body, rig, *fiber_meshes]:
    o.select_set(True)
print(
    "EXPORT",
    bpy.ops.export_scene.gltf(
        filepath=str(out / "Vita-Style04-Hair-POC-V1.glb"),
        use_selection=True,
        export_yup=True,
        export_morph=True,
        export_skins=True,
        export_all_influences=True,
        export_rest_position_armature=True,
    ),
)
(root / "review/groom.json").write_text(
    json.dumps(
        dict(
            cards=card_count,
            card_vertices=len(mesh.vertices),
            card_quads=len(mesh.polygons),
            gbh=logs,
        ),
        indent=2,
    )
)
