"""Build editable A/B scenes and render matched portrait, poses, and expressions."""

import bpy, math, os, pathlib, json, sys
from mathutils import Vector, Quaternion

root = pathlib.Path(__file__).resolve().parents[1]
prefix = "Vita-Premium-Anime-V1"
variant = os.environ["VITA_VARIANT"]
scene = bpy.context.scene
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
path = {
    "original": root / "work/Vita-Original.vrm",
    "A": root / "work/polished.vrm",
    "B": root / "work/refined.vrm",
}[variant]
assert "FINISHED" in bpy.ops.import_scene.vrm(filepath=str(path))
scene = bpy.context.scene
face = bpy.data.objects["Face"]
rig = bpy.data.objects["Armature"]
meshes = [bpy.data.objects[n] for n in ["Face", "Body", "Hair001"]]


def material_for_cycles(mat):
    ext = mat.vrm_addon_extension.mtoon1
    pbr = ext.pbr_metallic_roughness
    im = pbr.base_color_texture.index.source
    if not im:
        return
    new = bpy.data.materials.new("Studio · " + mat.name)
    new.use_nodes = True
    new["vrm_source"] = mat.name
    mat.use_fake_user = True
    tree = new.node_tree
    shader = tree.nodes.get("Principled BSDF")
    hair = "HAIR" in mat.name
    skin = "SKIN" in mat.name
    eye = "EyeIris" in mat.name
    shader.inputs["Roughness"].default_value = (
        0.43 if hair else 0.72 if skin else 0.30 if eye else 0.58
    )
    shader.inputs["Specular IOR Level"].default_value = (
        0.27 if hair else 0.15 if skin else 0.26
    )
    shader.inputs["Emission Strength"].default_value = (
        0.17 if skin else 0.13 if hair else 0.36 if eye else 0.19
    )
    tex = tree.nodes.new("ShaderNodeTexImage")
    tex.image = im
    for inlet in ["Base Color", "Emission Color"]:
        tree.links.new(tex.outputs["Color"], shader.inputs[inlet])
    if ext.alpha_mode != "OPAQUE":
        tree.links.new(tex.outputs["Alpha"], shader.inputs["Alpha"])
    normal = ext.normal_texture.index.source
    if normal and ("_nml" in normal.name or "_nrm" in normal.name):
        nt = tree.nodes.new("ShaderNodeTexImage")
        nt.image = normal
        nm = tree.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = 0.22 if hair else 0.12
        tree.links.new(nt.outputs["Color"], nm.inputs["Color"])
        tree.links.new(nm.outputs["Normal"], shader.inputs["Normal"])
    return new


if variant != "original":
    remap = {
        m: material_for_cycles(m) for m in {m for o in meshes for m in o.data.materials}
    }
    for obj in meshes:
        for slot in obj.material_slots:
            slot.material = remap[slot.material]


def aim(o, pt):
    o.rotation_euler = (Vector(pt) - o.location).to_track_quat("-Z", "Y").to_euler()


def area(name, loc, power, size, color):
    d = bpy.data.lights.new(name, "AREA")
    d.energy = power
    d.shape = "DISK"
    d.size = size
    d.color = color
    o = bpy.data.objects.new(name, d)
    scene.collection.objects.link(o)
    o.location = loc
    aim(o, (0, 0, 1.52))
    return o


key = area("Key · large softbox", (-0.62, -0.88, 2.32), 21, 0.78, (1, 0.93, 0.89))
fill = area("Fill · frontal", (0.64, -0.56, 1.76), 9, 0.72, (0.88, 0.93, 1))
rim = area("Rim · soft lilac", (0.27, 0.53, 2.10), 18, 0.61, (0.90, 0.82, 1))
scene.world = bpy.data.worlds.new("Neutral portrait studio")
scene.world.use_nodes = True
nt = scene.world.node_tree
bg = nt.nodes.get("Background")
bg.inputs["Color"].default_value = (0.42, 0.40, 0.44, 1)
bg.inputs["Strength"].default_value = 0.65
cam_bg = nt.nodes.new("ShaderNodeBackground")
cam_bg.inputs["Color"].default_value = (0.092, 0.081, 0.118, 1)
mix = nt.nodes.new("ShaderNodeMixShader")
ray = nt.nodes.new("ShaderNodeLightPath")
for out, inn in [
    (ray.outputs["Is Camera Ray"], mix.inputs[0]),
    (bg.outputs[0], mix.inputs[1]),
    (cam_bg.outputs[0], mix.inputs[2]),
    (mix.outputs[0], nt.nodes.get("World Output").inputs[0]),
]:
    nt.links.new(out, inn)
cd = bpy.data.cameras.new("Portrait orthographic")
cd.type = "ORTHO"
cam = bpy.data.objects.new("Portrait", cd)
scene.collection.objects.link(cam)
scene.camera = cam
scene.render.engine = "CYCLES"
scene.cycles.samples = 48
scene.cycles.use_denoising = False
scene.cycles.transparent_max_bounces = 12
scene.view_settings.view_transform = "Khronos PBR Neutral"
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"


def camera(angle=0, height=1.54, scale=0.425, size=(640, 740)):
    scene.render.resolution_x, scene.render.resolution_y = size
    a = math.radians(angle)
    cam.location = (math.sin(a) * 3, -math.cos(a) * 3, height + 0.016)
    aim(cam, (0, 0, height))
    cd.ortho_scale = scale


def expression(preset):
    for k in face.data.shape_keys.key_blocks:
        k.value = 0
    grouped = rig.data.vrm_addon_extension.vrm0.blend_shape_master.blend_shape_groups
    group = next(g for g in grouped if g.name == preset)
    for b in group.binds:
        face.data.shape_keys.key_blocks[b.index].value = b.weight
    bpy.context.view_layer.update()


def render(suffix, **kw):
    camera(**kw)
    scene.render.filepath = str(root / "review" / f"{variant}-{suffix}.png")
    bpy.ops.render.render(write_still=True)


camera()
expression("Neutral")
scene.render.filepath = "//portrait.png"
for scr in bpy.data.screens:
    for a in scr.areas:
        if a.type == "VIEW_3D":
            a.spaces.active.region_3d.view_perspective = "CAMERA"
            a.spaces.active.overlay.show_overlays = False
if variant == "original":
    bpy.ops.wm.save_as_mainfile(filepath=str(root / "work/native.blend"), compress=True)
else:
    source_mats = sorted({m["vrm_source"] for o in meshes for m in o.data.materials})
    with bpy.data.libraries.load(str(root / "work/native.blend")) as (s, t):
        t.materials = list(source_mats)
    for name, mat in zip(source_mats, t.materials):
        mat.name = "Native backup · " + name
        mat.use_fake_user = True
    if variant == "B":
        polished = face.data.name
        with bpy.data.libraries.load(str(root / "out" / f"{prefix}-A.blend")) as (s, t):
            t.meshes = [polished]
        backup = t.meshes[0]
        backup.name = "Vita Face · A · original proportions"
        backup.use_fake_user = True
        for i, mat in enumerate(face.data.materials):
            backup.materials[i] = mat
        face.data.name = "Vita Face · B · refined proportions"
        face.data.use_fake_user = True
    info = bpy.data.texts.new("Đọc trước · Hoàn tác")
    info.write(
        "Đổi mesh trong Object Data của Face để chuyển A/B trong tệp B. Cả hai mesh giữ đủ shape key và cùng slot vật liệu. Vật liệu gốc nằm trong nhóm tên Native backup · … và có thể chọn theo từng slot. Tóc Hair001 vẫn là tóc Vita. Ánh sáng studio dùng vật liệu Studio riêng cho da, tóc, vải. VRM giữ MToon. Ảnh full-body dùng pose tạm thời."
    )
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(
        filepath=str(root / "out" / f"{prefix}-{variant}.blend"), compress=True
    )
render("front")
if variant != "original":
    render("left35", angle=35)
    for preset in ["Joy", "Blink", "A", "Surprised"]:
        expression(preset)
        render("expr-" + preset, size=(420, 460), scale=0.334, height=1.56)
    expression("Neutral")
if variant == "B":
    render("profile", angle=-90)
    old = [(l.data.energy, l.data.color[:]) for l in (key, fill, rim)]
    for l, power in zip((key, fill, rim), (15, 15, 0)):
        l.data.energy = power
        l.data.color = (1, 1, 1)
    render("neutral-light", angle=0)
    for l, (power, color) in zip((key, fill, rim), old):
        l.data.energy = power
        l.data.color = color

    def pose_world(name, axis, angle):
        b = rig.pose.bones[name]
        orient = (rig.matrix_world @ b.bone.matrix_local).to_quaternion()
        b.rotation_mode = "QUATERNION"
        b.rotation_quaternion = Quaternion(
            orient.inverted() @ Vector(axis), math.radians(angle)
        )

    for s, sign in [("L", 1), ("R", -1)]:
        pose_world("J_Bip_" + s + "_UpperArm", (0, 1, 0), sign * 63)
        pose_world("J_Bip_" + s + "_LowerArm", (0, 1, 0), sign * 9)
    bpy.context.view_layer.update()
    render("full-body", angle=8, height=0.86, scale=1.91, size=(600, 990))
    render("mobile-portrait", angle=12, height=1.36, scale=0.87, size=(390, 844))
