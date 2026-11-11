#!/usr/bin/env python3
"""Deterministic Blender headless hair-sculpt smoke test for Audition Mobile MVP.

Test-only original procedural anime bust. Does NOT touch production characters.
Requires Blender with bundled glTF import/export. Tested by GitHub Actions.
"""
import bpy
import json
import math
import os
import sys
from pathlib import Path
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out = Path(argv[0]).resolve() if argv else Path("artifacts/blender-hair-demo").resolve()
out.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for mat in list(bpy.data.materials):
    bpy.data.materials.remove(mat)

def material(name, color, roughness=0.6):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1.0)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return m

skin = material("soft-peach-skin", (0.88, 0.61, 0.50))
hair = material("midnight-violet-hair", (0.16, 0.10, 0.35), 0.42)
hair_lit = material("violet-hair-highlights", (0.32, 0.22, 0.55), 0.46)
shirt = material("cool-lilac-outfit", (0.20, 0.27, 0.50))
white = material("anime-eye-whites", (0.92, 0.93, 0.99))
iris = material("anime-teal-irises", (0.03, 0.37, 0.42))
lip = material("rose-lips", (0.61, 0.29, 0.37))
hair_objs = []

def ellipsoid(name, loc, scale, mat, seg=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj

# A neutral anime demo bust: no existing game character is changed.
ellipsoid("MODEL_torso", (0, 0, 0.68), (0.92, 0.50, 0.75), shirt)
ellipsoid("MODEL_neck", (0, 0, 1.33), (0.22, 0.21, 0.32), skin)
ellipsoid("MODEL_head", (0, 0, 2.12), (0.77, 0.66, 0.93), skin, 48, 32)
for s in (-1, 1):
    ellipsoid("MODEL_ear_" + str(s), (s*0.75, 0, 2.12), (0.13, 0.12, 0.24), skin)
    ellipsoid("MODEL_eye_white_" + str(s), (s*0.32, -0.593, 2.23), (0.18, 0.07, 0.13), white)
    ellipsoid("MODEL_iris_" + str(s), (s*0.32, -0.658, 2.23), (0.085, 0.035, 0.104), iris)
ellipsoid("MODEL_nose", (0, -0.661, 1.99), (0.072, 0.086, 0.10), skin)
ellipsoid("MODEL_mouth", (0, -0.635, 1.79), (0.18, 0.026, 0.034), lip)

def make_mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    hair_objs.append(obj)
    return obj

# Sculptable scalp cap mesh (hair is explicitly separate from head).
verts, faces = [], []
sectors = 48
rings = 15
for r in range(rings):
    phi = 0.016 + (r / (rings - 1)) * 1.54
    for j in range(sectors):
        theta = 2*math.pi*j/sectors
        verts.append((0.835*math.sin(phi)*math.cos(theta),
                      0.718*math.sin(phi)*math.sin(theta),
                      2.19 + 1.00*math.cos(phi)))
for r in range(rings - 1):
    for j in range(sectors):
        a = r*sectors+j
        b = r*sectors+(j+1)%sectors
        faces.append((a, b, b+sectors, a+sectors))
faces.append(tuple(reversed(tuple(range(sectors)))))
make_mesh("HAIR_scalp_cap", verts, faces, hair)

def tube_lock(name, start, end, width, mat, bend=0.0, puff=0.0):
    vertices, quads = [], []
    sections = 14
    sides = 8
    for i in range(sections + 1):
        t = i / sections
        cx = start[0]*(1-t) + end[0]*t + bend*math.sin(math.pi*t)
        cy = start[1]*(1-t) + end[1]*t - puff*math.sin(math.pi*t)
        cz = start[2]*(1-t) + end[2]*t
        rad = width * (0.24 + 0.76*(1-t)**0.66)
        for j in range(sides):
            a = 2*math.pi*j/sides
            vertices.append((cx + rad*math.cos(a), cy + 0.68*rad*math.sin(a), cz))
    for i in range(sections):
        for j in range(sides):
            v0 = i*sides + j
            v1 = i*sides + (j+1)%sides
            quads.append((v0, v1, v1+sides, v0+sides))
    quads.extend([tuple(reversed(tuple(range(sides)))),
                  tuple(sections*sides+j for j in range(sides))])
    return make_mesh(name, vertices, quads, mat)

# Swept bangs and face-framing strands. The AFTER state edits these SAME meshes.
for i in range(11):
    x = (i-5)*0.132
    tube_lock("HAIR_bang_%02d" % i, (x*0.92, -0.48, 2.90-0.15*abs(x)),
              (x+0.060, -0.76, 2.04+0.13*abs(x)), 0.092,
              hair_lit if i%4==0 else hair, bend=-0.04*math.copysign(1, x or 1), puff=0.11)
for s, label in ((-1,"L"), (1,"R")):
    tube_lock("HAIR_face_frame_" + label, (s*0.67, -0.35, 2.76),
              (s*0.72, -0.44, 1.39), 0.19, hair_lit, bend=s*0.06, puff=0.09)
for i in range(9):
    x=(i-4)*0.18
    tube_lock("HAIR_back_%02d" % i, (x*0.9,0.45,2.85-0.12*abs(x)),
              (x*1.22,0.43,1.06+0.13*abs(x)), 0.155,
              hair if i%3 else hair_lit, bend=0.035, puff=-0.07)

# Studio setup; kept OUT of exported GLB.
bg = material("preview-floor", (0.115, 0.14, 0.21))
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-0.08))
floor = bpy.context.object
floor.name = "PREVIEW_floor"
floor.data.materials.append(bg)
world = bpy.context.scene.world
world.color = (0.26, 0.26, 0.26)
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.18, 0.23, 0.33, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6

def area_light(name, loc, energy, color, size):
    bpy.ops.object.light_add(type="AREA", location=loc)
    o = bpy.context.object
    o.name = name
    o.data.energy = energy
    o.data.color = color
    o.data.shape = "DISK"
    o.data.size = size
    return o

area_light("PREVIEW_key", (2.5,-3.5,5.0), 650, (1,0.90,0.81), 4.0)
area_light("PREVIEW_fill", (-3,-2.5,3.8), 550, (0.70,0.80,1.0), 4.0)
area_light("PREVIEW_rim", (1.2,2.4,4.3), 820, (0.72,0.67,1.0), 3.0)

bpy.ops.object.camera_add(location=(0,-7,2.1))
cam = bpy.context.object
cam.name = "PREVIEW_camera"
cam.data.type = "ORTHO"
cam.data.ortho_scale = 4.05
bpy.context.scene.camera = cam
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 12
scene.render.resolution_x = 400
scene.render.resolution_y = 480
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "AgX"
bpy.context.preferences.filepaths.save_version = 0

def render_views(phase):
    for name, pos in {
        "front": (0,-7,2.18),
        "threequarter": (4.6,-5.9,2.30),
        "side": (7,-0.1,2.18),
    }.items():
        cam.location = pos
        direction = Vector((0,0,1.95)) - cam.location
        cam.rotation_euler = direction.to_track_quat("-Z","Y").to_euler()
        scene.render.filepath = str(out / (phase + "_" + name + ".png"))
        bpy.ops.render.render(write_still=True)

def export_glb(phase):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in scene.objects:
        if obj.type == "MESH" and (obj.name.startswith("MODEL_") or obj.name.startswith("HAIR_")):
            obj.select_set(True)
    bpy.context.view_layer.objects.active = hair_objs[0]
    dst = out / (phase + ".glb")
    bpy.ops.export_scene.gltf(filepath=str(dst), export_format="GLB",
                              use_selection=True, export_animations=False)
    return dst

def snapshot():
    return {o.name: [tuple(v.co) for v in o.data.vertices] for o in hair_objs}

before_geometry = snapshot()
render_views("before")
before_glb = export_glb("before")

# Real NON-DESTRUCTIVE-TO-BODY vertex sculpt: crown inflation and face-framing.
changed, max_delta = 0, 0.0
for obj in hair_objs:
    for v in obj.data.vertices:
        original = v.co.copy()
        x,y,z = original
        if obj.name == "HAIR_scalp_cap":
            weight = max(0.0, min(1.0, (z-2.62)/0.52))
            radial = math.exp(-((x/0.68)**2+(y/0.62)**2))
            v.co.z += 0.17 * weight * radial
        elif obj.name.startswith("HAIR_bang_"):
            progress = max(0.0, min(1.0, (2.86-z)/0.81))
            side = 1.0 if x>=0 else -1.0
            v.co.x += side * 0.085 * progress
            v.co.y -= 0.042 * math.sin(math.pi*progress)
            v.co.z += 0.060 * (1-progress)
        elif obj.name.startswith("HAIR_face_frame_"):
            progress = max(0.0, min(1.0, (2.75-z)/1.37))
            v.co.x -= (1.0 if x >= 0 else -1.0) * 0.15 * progress
            v.co.y -= 0.045*progress
        else:
            progress = max(0.0, min(1.0, (2.84-z)/1.79))
            v.co.x *= 1.0 + 0.06*progress
        d = (v.co-original).length
        if d > 1e-6:
            changed += 1
            max_delta = max(max_delta, d)
    obj.data.update()

after_geometry = snapshot()
assert changed > 100, "Hair sculpt did not alter enough mesh vertices"
assert max_delta > 0.05, "Hair sculpt change was too small"
assert all(before_geometry[n] != after_geometry[n] for n in before_geometry), "A hair object did not change"

render_views("after")
after_glb = export_glb("after")
bpy.ops.wm.save_as_mainfile(filepath=str(out/"hair_sculpt_after.blend"))

def imported_stats(glb_path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    meshes = [x for x in bpy.context.scene.objects if x.type == "MESH"]
    return {
        "meshes": len(meshes),
        "hair_meshes": sum(x.name.startswith("HAIR_") for x in meshes),
        "vertices": sum(len(x.data.vertices) for x in meshes),
        "materials": len({m.name for x in meshes for m in x.data.materials if m}),
        "filesize_bytes": glb_path.stat().st_size,
    }

stats_before = imported_stats(before_glb)
stats_after = imported_stats(after_glb)
assert stats_before["hair_meshes"] >= 15, stats_before
assert stats_after["hair_meshes"] == stats_before["hair_meshes"]
assert stats_before["meshes"] == stats_after["meshes"]
assert stats_before["vertices"] == stats_after["vertices"]
assert stats_before["materials"] == stats_after["materials"]

report = {
    "status": "PASS",
    "test": "Blender headless real hair vertex sculpt (procedural original anime bust)",
    "blender_version": bpy.app.version_string,
    "source_model": "procedural-demo-anime-bust; no Vita or production asset modified",
    "before": stats_before,
    "after": stats_after,
    "hair_objects": len(hair_objs),
    "changed_hair_vertices": changed,
    "maximum_vertex_displacement_m": round(max_delta, 6),
    "views": ["front","side","threequarter"],
    "rig_preservation": "NOT TESTED - procedural demo has no armature",
    "vrm_preservation": "NOT TESTED",
    "note": "Same hair meshes edited in place. Camera/lights/floor excluded from GLB.",
}
with (out/"report.json").open("w", encoding="utf8") as f:
    json.dump(report, f, indent=2, ensure_ascii=False)
print("AUDITION_BLENDER_HAIR_DEMO_RESULT:",json.dumps(report))
