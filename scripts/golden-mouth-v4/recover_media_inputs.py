"""Read-only recovery of render buffers from the frozen nine-preset checkpoint.

No authoring, smoothing, pose blending or checkpoint save is performed here.
The saved absolute shape-key coordinates must match the committed controls.
"""
import hashlib
import json
from pathlib import Path
import shutil
import sys

import bpy
import numpy as np


source, controls, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
expected_sha = '153b589728fe54dea3f5088f2cf637541fc29b41fb42afdde743658c2cd35e79'
source_sha = hashlib.sha256(source.read_bytes()).hexdigest()
assert source_sha == expected_sha, source_sha
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
head = bpy.data.objects['node_0']
mesh = head.data
backup = bpy.data.objects['V4_Original_Head_Uncut']
n = len(mesh.vertices)
assert n == len(backup.data.vertices) == 292645


def coordinates(key):
    points = np.empty((n, 3), np.float32)
    key.data.foreach_get('co', points.ravel())
    return points


locked = np.load(controls)
styles = json.loads(locked['catalog'].tobytes())
assert styles == json.loads(head['V4_catalog'])
basis = coordinates(backup.data.shape_keys.key_blocks['Basis'])
m01 = coordinates(backup.data.shape_keys.key_blocks['M01_Natural_V33'])
poses = np.stack([coordinates(mesh.shape_keys.key_blocks[s['key']]) for s in styles])
expected = np.repeat(m01[None], 9, axis=0)
expected[:, locked['indices']] = locked['positions']
assert np.array_equal(poses, expected)
assert np.array_equal(poses[0], m01)
for key in backup.data.shape_keys.key_blocks:
    assert np.array_equal(coordinates(mesh.shape_keys.key_blocks[key.name]), coordinates(key)), key.name

source_faces = np.array([p.vertices[:] for p in backup.data.polygons])
assert len(source_faces) == 499762
keep = np.ones(len(source_faces), bool)
keep[locked['removed']] = False
source_ids = np.flatnonzero(keep)
faces = np.array([p.vertices[:] for p in mesh.polygons])
assert len(faces) == 499207 and np.array_equal(faces, source_faces[keep])
uv = np.empty((len(mesh.loops), 2), np.float32)
mesh.uv_layers.active.data.foreach_get('uv', uv.ravel())
source_uv = np.empty((len(backup.data.loops), 2), np.float32)
backup.data.uv_layers.active.data.foreach_get('uv', source_uv.ravel())
assert np.array_equal(uv, source_uv.reshape(-1, 3, 2)[keep].reshape(-1, 2))
_, groups = np.unique(basis, axis=0, return_inverse=True)
np.savez_compressed(output / 'poses.npz', basis=basis, poses=poses, faces=faces,
                    duplicates=np.array([], np.int64), upper=locked['upper'], lower=locked['lower'],
                    groups=groups, source_faces=source_faces, uv=uv, sourceFaceIds=source_ids,
                    removedFoldFaceIds=locked['removed'])
(output / 'catalog.json').write_bytes(locked['catalog'].tobytes())
(output / 'topology.json').write_bytes(locked['topology'].tobytes())

# Reproduce the source M01 evaluated corner normals, as in build_blend.py.
# A temporary visible copy avoids evaluation of the hidden reference collection.
base_normals = np.empty((len(backup.data.loops), 3), np.float32)
backup.data.corner_normals.foreach_get('vector', base_normals.ravel())
probe = backup.copy()
probe.data = backup.data.copy()
probe.name = 'V4_ReadOnly_NormalProbe'
bpy.context.scene.collection.objects.link(probe)
probe.hide_viewport = False
probe.hide_render = True
probe.hide_set(False)
for key in probe.data.shape_keys.key_blocks:
    key.value = float(key.name == 'M01_Natural_V33')
probe.update_tag()
bpy.context.view_layer.update()
evaluated = probe.evaluated_get(bpy.context.evaluated_depsgraph_get())
evaluated_mesh = evaluated.to_mesh()
evaluated_points = np.empty_like(m01)
evaluated_mesh.vertices.foreach_get('co', evaluated_points.ravel())
normal_probe_error = float(np.abs(evaluated_points - m01).max())
assert normal_probe_error < 1e-7, normal_probe_error
m01_normals = np.empty_like(base_normals)
evaluated_mesh.corner_normals.foreach_get('vector', m01_normals.ravel())
evaluated.to_mesh_clear()
bpy.data.objects.remove(probe, do_unlink=True)
np.savez_compressed(output / 'shading.npz',
                    baseLoopNormals=base_normals.reshape(-1, 3, 3)[keep].reshape(-1, 3),
                    m01LoopNormals=m01_normals.reshape(-1, 3, 3)[keep].reshape(-1, 3), groups=groups)

parts = {}
for name in ['V4_Cavity', 'V4_UpperTeeth', 'V4_Gum', 'V4_Tongue']:
    part = bpy.data.objects[name]
    assert part.parent == head
    points = []
    for style in styles:
        p = np.empty((len(part.data.vertices), 3), np.float32)
        part.data.shape_keys.key_blocks[style['code']].data.foreach_get('co', p.ravel())
        points.append(p)
    parts[name] = np.stack(points)
    parts[name + '_faces'] = np.array([p.vertices[:] for p in part.data.polygons])
np.savez_compressed(output / 'interior.npz', **parts)
destination = output / 'Golden-Mouth-V4.blend'
if destination.resolve() != source.resolve():
    shutil.copyfile(source, destination)
assert hashlib.sha256(destination.read_bytes()).hexdigest() == expected_sha
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected_sha
report = {
    'blender': bpy.app.version_string,
    'sourceBlendSha256': source_sha,
    'controlsSha256': hashlib.sha256(controls.read_bytes()).hexdigest(),
    'readOnlyCheckpointRecovery': True,
    'allNineKeyCoordinatesBitExactWithFrozenControls': True,
    'BasisAndHistoricalKeysExactWithOriginalBackup': True,
    'retainedFacesAndUVExactWithOriginalBackup': True,
    'M01Exact': True,
    'vertices': n,
    'triangles': len(faces),
    'normalProbeEvaluatedMaxFloatError': normal_probe_error,
    'headModifiers': [m.name for m in head.modifiers],
    'protectedUpperFaceVertices': int((basis[:, 1] >= .378).sum()),
    'protectedUpperFaceMaxDisplacement': float(np.abs(poses[:, basis[:, 1] >= .378] - basis[None, basis[:, 1] >= .378]).max()),
}
assert report['protectedUpperFaceMaxDisplacement'] == 0
(output / 'media-recovery.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
