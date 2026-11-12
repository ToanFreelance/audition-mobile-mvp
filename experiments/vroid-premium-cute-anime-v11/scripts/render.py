"""Các cặp ảnh dùng chung ánh sáng trắng, ống kính và tư thế."""

import bpy, pathlib, math, os
from mathutils import Vector, Quaternion

r = pathlib.Path(__file__).resolve().parents[1]
s = bpy.context.scene
cam = s.camera
rig = bpy.data.objects["Armature"]
face = bpy.data.objects["Face"]
s.cycles.samples = 24
s.cycles.use_denoising = False
for l in s.objects:
    if l.type == "LIGHT":
        l.data.color = (1, 1, 1)
        l.data.energy = {"Key": 24, "Fill": 13, "Rim": 9}.get(l.name.split(" ·")[0], 10)
        l.rotation_euler = (
            (Vector((0, 0, 1.23)) - l.location).to_track_quat("-Z", "Y").to_euler()
        )
d = bpy.data.lights.new("Fill · corps", "AREA")
d.energy = 31
d.shape = "DISK"
d.size = 1.7
l = bpy.data.objects.new("Fill · corps", d)
s.collection.objects.link(l)
l.location = (0, -1.4, 1.2)
l.rotation_euler = (
    (Vector((0, 0, 0.82)) - l.location).to_track_quat("-Z", "Y").to_euler()
)


def joint(n, axis, angle):
    p = rig.pose.bones["J_Bip_" + n]
    q = (rig.matrix_world @ p.bone.matrix_local).to_quaternion()
    p.rotation_mode = "QUATERNION"
    p.rotation_quaternion = Quaternion(q.inverted() @ Vector(axis), math.radians(angle))


def arms():
    for side, sign in [("L", 1), ("R", -1)]:
        joint(side + "_UpperLeg", (0, 1, 0), -sign * 6)
        joint(side + "_UpperArm", (0, 1, 0), sign * 63)
        joint(side + "_LowerArm", (0, 1, 0), sign * 9)


def draw(name, yaw=0, h=0.865, scale=1.86, size=(540, 840)):
    a = math.radians(yaw)
    cam.location = (3 * math.sin(a), -3 * math.cos(a), h + 0.016)
    cam.rotation_euler = (
        (Vector((0, 0, h)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    )
    cam.data.ortho_scale = scale
    s.render.resolution_x, s.render.resolution_y = size
    s.render.filepath = str(r / "review" / (name + ".png"))
    bpy.ops.render.render(write_still=True)


arms()
if os.getenv("QUICK"):
    draw("draft", size=(330, 530))
    quit()
if "Street_Skin" not in bpy.data.objects:
    draw("A-full")
    draw("A-front", h=1.46, scale=0.68, size=(520, 620))
else:
    draw("casual-full")
    draw("casual-front", h=1.46, scale=0.68, size=(520, 620))
    draw("casual-left35", 35)
    draw("casual-profile", -90)
    draw("casual-back", 180)
    draw("mobile", 0, 0.87, 1.89, (390, 844))
    for k in ["Neutral", "Joy", "Blink"]:
        group = next(
            g
            for g in rig.data.vrm_addon_extension.vrm0.blend_shape_master.blend_shape_groups
            if g.name == k
        )
        for key in face.data.shape_keys.key_blocks:
            key.value = 0
        for b in group.binds:
            face.data.shape_keys.key_blocks[b.index].value = b.weight
        draw("expression-" + k, h=1.54, scale=0.42, size=(420, 460))
    for key in face.data.shape_keys.key_blocks:
        key.value = 0
    joint("L_UpperLeg", (1, 0, 0), -29)
    joint("L_LowerLeg", (1, 0, 0), 42)
    joint("R_UpperArm", (0, 1, 0), -28)
    joint("R_LowerArm", (0, 0, 1), 33)
    draw("step-knee", 22)
    joint("L_UpperLeg", (0, 1, 0), 24)
    joint("L_LowerLeg", (1, 0, 0), 8)
    joint("L_UpperArm", (0, 1, 0), -25)
    draw("step-reach", -20)
