"""Gate Vita skin-only cho OpenSew; không save/export mesh hoặc tạo garment.

Chạy bằng Blender 5.2.4 -b --factory-startup --disable-autoexec
--python-exit-code 2 --python scripts/inspect-vita-opensew.py --
--vita-blend /private/Vita-Premium-Cute-V11.blend --output /private/audit.json
--opensew-root /tools/opensew-2-86b432238464d88e3d2c5e1cf3fbf693f1e51722
"""
import argparse
from collections import Counter, defaultdict
from contextlib import contextmanager
import hashlib
import json
import math
from pathlib import Path
import sys
import traceback

import bmesh
import bpy
from mathutils import Vector

SOURCE_SHA = '138a5b8321bd333e409340be321e483bdef6f2e6bebe5758bc8af6d4d75fed52'
OPENSEW_COMMIT = '86b432238464d88e3d2c5e1cf3fbf693f1e51722'
AVATAR_SHA = '8c11f49ca6fb8d9a2f55fdcf71d5dc388ababca2c6b4429a679ea7f9e5e2da37'
CHAINS = {
    **{f'{key}_{side.lower()}': (f'J_Bip_{side}_{start}', f'J_Bip_{side}_{end}')
       for side in ('L', 'R')
       for key, start, end in (('arm', 'UpperArm', 'LowerArm'),
                               ('farm', 'LowerArm', 'Hand'),
                               ('thigh', 'UpperLeg', 'LowerLeg'),
                               ('calf', 'LowerLeg', 'Foot'))},
}


@contextmanager
def vroid_aliases(avatar):
    """Chỉ mở rộng lookup/mask trong process; luôn phục hồi module gốc."""
    names = ('BONE_TABLE', 'LIMB_CHAINS', 'LIMB_GROUPS', 'EXCLUDE_TORSO')
    saved = {name: getattr(avatar, name) for name in names}
    aliases = {'neck': ('j_bip_c_neck',),
               'chest': ('j_bip_c_chest', 'j_bip_c_upperchest'),
               'waist': ('j_bip_c_spine',), 'hip': ('j_bip_c_hips',)}
    try:
        avatar.BONE_TABLE = {k: [*aliases.get(k, ()), *v] for k, v in saved['BONE_TABLE'].items()}
        avatar.LIMB_CHAINS = {
            k: ([a.lower(), *saved['LIMB_CHAINS'][k][0]],
                [b.lower(), *saved['LIMB_CHAINS'][k][1]]) for k, (a, b) in CHAINS.items()}
        avatar.LIMB_GROUPS = {
            k: (a.lower(), *saved['LIMB_GROUPS'][k]) for k, (a, _) in CHAINS.items()}
        avatar.EXCLUDE_TORSO = (*saved['EXCLUDE_TORSO'], 'lowerarm', 'little', 'j_adj_')
        avatar._CACHE.clear()
        avatar._BVH.clear()
        yield
    finally:
        for name, value in saved.items():
            setattr(avatar, name, value)
        avatar._CACHE.clear()
        avatar._BVH.clear()


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def fingerprint(body, arm):
    data = {
        'world': [list(r) for r in body.matrix_world],
        'co_weights': [[list(v.co), [(g.group, g.weight) for g in v.groups]] for v in body.data.vertices],
        'faces': [(list(p.vertices), p.material_index) for p in body.data.polygons],
        'rig_world': [list(r) for r in arm.matrix_world],
        'bones': [(b.name, [list(r) for r in b.matrix_local],
                   [list(r) for r in arm.pose.bones[b.name].matrix_basis]) for b in arm.data.bones],
    }
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def duplicate_skin(body, arm):
    scene = bpy.data.scenes.new('Vita_OpenSew_Disposable')
    scene.unit_settings.system = bpy.context.scene.unit_settings.system
    scene.unit_settings.scale_length = bpy.context.scene.unit_settings.scale_length
    rig = arm.copy()
    rig.data = arm.data.copy()
    scene.collection.objects.link(rig)
    rig.parent = None
    rig.matrix_world = arm.matrix_world.copy()
    skin = body.copy()
    skin.data = body.data.copy()
    scene.collection.objects.link(skin)
    skin.parent = rig if body.parent == arm else None
    skin.matrix_world = body.matrix_world.copy()
    for mod in list(skin.modifiers):
        if mod.type == 'ARMATURE':
            mod.object = rig
        else:
            skin.modifiers.remove(mod)  # Chỉ bản sao: đo mặt da rest gốc, không chạy GN presentation.
    slots = {i for i, mat in enumerate(body.data.materials)
             if mat and mat.name.endswith('_Body_00_SKIN')}
    assert len(slots) == 1, 'Không xác định duy nhất material Body_00_SKIN'
    bm = bmesh.new()
    try:
        bm.from_mesh(skin.data)
        bm.verts.ensure_lookup_table()
        ids = bm.verts.layers.int.new('audit_source_vertex')
        for v in bm.verts:
            v[ids] = v.index
        reject = [f for f in bm.faces if f.material_index not in slots]
        bmesh.ops.delete(bm, geom=reject, context='FACES')
        loose = [v for v in bm.verts if not v.link_faces]
        if loose:
            bmesh.ops.delete(bm, geom=loose, context='VERTS')
        bm.to_mesh(skin.data)
    finally:
        bm.free()
    skin.data.update()
    source_ids = skin.data.attributes['audit_source_vertex'].data
    for v in skin.data.vertices:
        original = body.data.vertices[source_ids[v.index].value]
        assert (v.co - original.co).length == 0, 'Thay đổi tọa độ source'
        assert {g.group: g.weight for g in v.groups} == {g.group: g.weight for g in original.groups}, 'Thay đổi weights'
    assert len(skin.data.polygons) == sum(p.material_index in slots for p in body.data.polygons)
    assert all(p.material_index in slots for p in skin.data.polygons)
    bpy.context.window.scene = scene
    for ob in (skin, rig):
        ob.hide_viewport = False
        ob.hide_render = False
        ob.hide_set(False)
    bpy.context.view_layer.update()
    return skin, rig, scene


def components(adjacency):
    unseen = set(adjacency)
    result = []
    while unseen:
        stack = [unseen.pop()]
        found = set(stack)
        while stack:
            for nxt in adjacency[stack.pop()]:
                if nxt in unseen:
                    unseen.remove(nxt)
                    found.add(nxt)
                    stack.append(nxt)
        result.append(found)
    return result


def section(coords, triangles, origin, normal, precision=1e-5, boundary_segments=()):
    """Cắt chính xác surface; không nội suy phần thiếu hoặc vá lỗ.

    Quantize 10 micromet để nhận seam trùng tọa độ, không weld mesh.
    """
    normal = normal.normalized()
    graph = defaultdict(set)
    points = {}
    for tri in triangles:
        vs = [coords[i] for i in tri]
        ds = [(v - origin).dot(normal) for v in vs]
        hits = []
        for i, j in ((0, 1), (1, 2), (2, 0)):
            if tuple(vs[i]) > tuple(vs[j]):
                i, j = j, i  # Cùng edge luôn được nội suy theo cùng chiều.
            if (ds[i] < 0) != (ds[j] < 0):
                hits.append(vs[i].lerp(vs[j], ds[i] / (ds[i] - ds[j])))
        if len(hits) != 2:
            continue
        keys = [tuple(round(x / precision) for x in p) for p in hits]
        if keys[0] == keys[1]:
            continue
        for key, point in zip(keys, hits):
            points[key] = point
        graph[keys[0]].add(keys[1])
        graph[keys[1]].add(keys[0])
    rings = []
    for comp in components(graph):
        centre = sum((points[k] for k in comp), Vector()) / len(comp)
        closed = all(len(graph[k]) == 2 for k in comp)
        crossing = 0
        for k in comp:
            for n in graph[k]:
                if k >= n:
                    continue
                a, b = points[k], points[n]
                if (a.y > origin.y) != (b.y > origin.y):
                    crossing += a.x + (origin.y - a.y) * (b.x - a.x) / (b.y - a.y) > origin.x
        ends = [points[k] for k in comp if len(graph[k]) == 1]
        distances = []
        for point in ends:
            if boundary_segments:
                distances.append(min((point - a.lerp(b, max(0.0, min(1.0, (point - a).dot(b - a)
                                          / max(1e-20, (b - a).length_squared))))).length
                                     for a, b in boundary_segments))
        rings.append({
            'nodes': len(comp), 'closed': closed,
            'contains_axis_xy': closed and bool(crossing % 2),
            'endpoints': sum(len(graph[k]) == 1 for k in comp),
            'branch_nodes': sum(len(graph[k]) > 2 for k in comp),
            'endpoints_on_mesh_boundary': sum(d <= 2e-6 for d in distances),
            'max_endpoint_boundary_distance_m': max(distances, default=None),
            'distance_to_axis': (centre - origin).length,
            'perimeter': sum((points[k] - points[n]).length for k in comp for n in graph[k]) / 2,
        })
    rings.sort(key=lambda r: r['distance_to_axis'])
    return {'origin': list(origin), 'normal': list(normal), 'components': rings,
            'nearest_closed': bool(rings and rings[0]['closed'])}


def inspect_neck_band(skin, rig):
    """Quét shaft Neck.head → Head.head; không dùng offset Z hay vòng cổ cố định."""
    skin.data.calc_loop_triangles()
    co = [skin.matrix_world @ v.co for v in skin.data.vertices]
    triangles = [tuple(t.vertices) for t in skin.data.loop_triangles]
    base = rig.matrix_world @ rig.pose.bones['J_Bip_C_Neck'].head
    head = rig.matrix_world @ rig.pose.bones['J_Bip_C_Head'].head
    assert head.z > base.z, 'Neck/Head không xác định được shaft theo Z'
    edge_counts = Counter()
    edge_positions = {}
    for face in skin.data.polygons:
        vs = list(face.vertices)
        for a, b in zip(vs, vs[1:] + vs[:1]):
            key = tuple(sorted(tuple(round(x / 1e-6) for x in co[i]) for i in (a, b)))
            if key[0] != key[1]:
                edge_counts[key] += 1
                edge_positions[key] = (co[a], co[b])
    boundary = [edge_positions[k] for k, n in edge_counts.items() if n == 1]
    events = sorted({base.z, head.z, *(v.z for edge in boundary for v in edge if base.z < v.z < head.z)})
    # Giữa hai boundary-vertex event, giao tuyến với boundary không đổi topology.
    zs = sorted({*(base.z + (head.z - base.z) * i / 65 for i in range(1, 65)),
                 *((a + b) / 2 for a, b in zip(events, events[1:]))})
    probes = []
    for z in zs:
        origin = base.lerp(head, (z - base.z) / (head.z - base.z))
        origin.z = z
        by_precision = []
        for precision in (1e-6, 1e-5, 1e-4):
            cut = section(co, triangles, origin, Vector((0, 0, 1)), precision, boundary)
            by_precision.append({'precision_m': precision, 'components': cut['components']})
        valid = all(len(p['components']) == 1 and p['components'][0]['closed']
                    and p['components'][0]['contains_axis_xy'] for p in by_precision)
        perimeters = [p['components'][0]['perimeter'] for p in by_precision if p['components']]
        if valid:
            valid = (max(perimeters) - min(perimeters)) / min(perimeters) <= 1e-4
        probes.append({'z_m': z, 'valid': valid, 'precision_checks': by_precision,
                       'perimeter_m': by_precision[1]['components'][0]['perimeter']
                       if valid else None})
    bands, current = [], []
    for i, probe in enumerate(probes):
        if probe['valid']:
            current.append(i)
        elif current:
            bands.append(current)
            current = []
    if current:
        bands.append(current)
    # Cần hai mặt cắt lân cận kín để không chọn sát mép hở hay đầu shaft.
    candidates = []
    for band in bands:
        for pos in range(1, len(band) - 1):
            idx = band[pos]
            around = [probes[band[j]]['perimeter_m'] for j in (pos - 1, pos, pos + 1)]
            if max(abs(v - around[1]) / around[1] for v in around) <= 0.10:
                candidates.append(idx)
    selected = min(candidates, key=lambda i: (probes[i]['perimeter_m'], probes[i]['z_m'])) if candidates else None
    return {'anatomical_base': list(base), 'anatomical_head': list(head),
            'boundary_event_z_m': events, 'probes': probes,
            'closed_bands': [{'z_min_m': probes[b[0]]['z_m'], 'z_max_m': probes[b[-1]]['z_m'],
                              'probe_count': len(b)} for b in bands],
            'selected_index': selected, 'valid_band_exists': selected is not None}


@contextmanager
def closed_neck_measurement(avatar, skin, rig, audit):
    """Override dùng chung cho measurement/drafting trong scope Vita rest-copy.

    Consumer như library._draft_top gọi cùng avatar.neck_girth(m). Không đổi
    profile torso hoặc upstream file; chu vi luôn lấy lại từ giao tuyến thật.
    """
    assert audit['valid_band_exists'], 'BLOCKED: không có dải contour cổ kín'
    selected = audit['probes'][audit['selected_index']]
    base, head = Vector(audit['anatomical_base']), Vector(audit['anatomical_head'])
    origin = base.lerp(head, (selected['z_m'] - base.z) / (head.z - base.z))
    origin.z = selected['z_m']
    original = avatar.neck_girth

    def measured_neck(m):
        if m.get('key', [None])[0] != skin.name or m.get('armature') != rig.name:
            return original(m)
        skin.data.calc_loop_triangles()
        co = [skin.matrix_world @ v.co for v in skin.data.vertices]
        triangles = [tuple(t.vertices) for t in skin.data.loop_triangles]
        cut = section(co, triangles, origin, Vector((0, 0, 1)))
        assert len(cut['components']) == 1, 'BLOCKED: contour cổ không duy nhất'
        ring = cut['components'][0]
        assert ring['closed'] and ring['contains_axis_xy'], 'BLOCKED: contour cổ hở/lệch trục'
        return ring['perimeter']

    try:
        avatar.neck_girth = measured_neck
        yield
    finally:
        avatar.neck_girth = original


def audit_surface(skin, rig):
    skin.data.calc_loop_triangles()
    co = [skin.matrix_world @ v.co for v in skin.data.vertices]
    triangles = [tuple(t.vertices) for t in skin.data.loop_triangles]
    keys = [tuple(round(x / 1e-6) for x in p) for p in co]
    incidence = Counter()
    for poly in skin.data.polygons:
        vs = list(poly.vertices)
        for a, b in zip(vs, vs[1:] + vs[:1]):
            if keys[a] != keys[b]:
                incidence[tuple(sorted((keys[a], keys[b])))] += 1
    boundary = defaultdict(set)
    for (a, b), n in incidence.items():
        if n == 1:
            boundary[a].add(b)
            boundary[b].add(a)
    bounds = []
    for comp in components(boundary):
        centre = Vector(tuple(sum(k[i] * 1e-6 for k in comp) / len(comp) for i in range(3)))
        closest = min(rig.pose.bones, key=lambda b: (rig.matrix_world @ b.head - centre).length)
        bounds.append({'nodes': len(comp), 'nearest_bone': closest.name,
                       'min': [min(k[i] * 1e-6 for k in comp) for i in range(3)],
                       'max': [max(k[i] * 1e-6 for k in comp) for i in range(3)]})
    head = lambda name: rig.matrix_world @ rig.pose.bones[name].head
    hips, neck = head('J_Bip_C_Hips'), head('J_Bip_C_Neck')
    bottom = max(head('J_Bip_L_UpperLeg').z, head('J_Bip_R_UpperLeg').z) + 0.03
    top = min(head('J_Bip_L_UpperArm').z, head('J_Bip_R_UpperArm').z) - 0.05
    probes = {}
    z = bottom
    while z <= top:
        centre = hips.lerp(neck, (z - hips.z) / (neck.z - hips.z))
        centre.z = z
        probes[f'torso_z_{z:.4f}'] = section(co, triangles, centre, Vector((0, 0, 1)))
        z += 0.01
    neck_centre = neck.lerp(head('J_Bip_C_Head'), 0.25)
    probes['neck'] = section(co, triangles, neck_centre, Vector((0, 0, 1)))
    for key, (start, end) in CHAINS.items():
        a, b = head(start), head(end)
        for t in (0.25, 0.5, 0.75):
            probes[f'{key}_{t}'] = section(co, triangles, a.lerp(b, t), b - a)
    failed = [k for k, p in probes.items() if not p['nearest_closed']]
    return {
        'vertices': len(co), 'faces': len(skin.data.polygons),
        'world_min': [min(p[i] for p in co) for i in range(3)],
        'world_max': [max(p[i] for p in co) for i in range(3)],
        'world_matrix': [list(r) for r in skin.matrix_world],
        'scale': list(skin.scale), 'bones': len(rig.data.bones),
        'boundary_components': bounds,
        'geometric_nonmanifold_edges': sum(n > 2 for n in incidence.values()),
        'sections': probes, 'failed_sections': failed,
        'suitable': not failed,
    }


def measurement_gate(root, skin, rig, scene):
    assert digest(root / 'clothing_design/avatar.py') == AVATAR_SHA, 'Sai avatar.py của OpenSew đã chốt'
    sys.path.insert(0, str(root.resolve()))
    import clothing_design
    from clothing_design import avatar, library
    clothing_design.register()
    result = {'opensew_commit': OPENSEW_COMMIT, 'avatar_sha256': AVATAR_SHA,
              'historical_session_4b': {'height_m': 1.6752533846884035,
                                      'chest_m': 0.5743586739968768,
                                      'waist_m': 0.6154010916127314,
                                      'hip_m': 0.9424391833797118,
                                      'neck_m': 0.22458795209517923,
                                      'limb_chains': 0, 'figure_auto': 'MAN'}}
    original_tables = {k: getattr(avatar, k) for k in ('BONE_TABLE', 'LIMB_CHAINS', 'LIMB_GROUPS', 'EXCLUDE_TORSO')}
    original_neck = avatar.neck_girth
    try:
        scene.cd.avatar = skin
        scene.cd.facing = avatar.auto_facing(bpy.context, skin)
        result['neck_contours'] = inspect_neck_band(skin, rig)
        with vroid_aliases(avatar), closed_neck_measurement(avatar, skin, rig, result['neck_contours']):
            resolved = {k: [avatar._find_bone(rig, candidates).name for candidates in pair]
                        for k, pair in avatar.LIMB_CHAINS.items()}
            assert all(tuple(resolved[k]) == CHAINS[k] for k in CHAINS), 'Chain map sai bone hoặc bên'
            points, dominant = avatar.sample_body(skin, bpy.context.evaluated_depsgraph_get())
            kept = [i for i, d in enumerate(dominant) if not any(k in d for k in avatar.EXCLUDE_TORSO)]
            expected_excluded = lambda d: any(x in d for x in (
                'upperarm', 'lowerarm', 'hand', 'thumb', 'index', 'middle', 'ring', 'little', 'head', 'j_adj_'))
            leaks = sum(expected_excluded(dominant[i]) for i in kept)
            result['mapping'] = resolved
            _, side_axis = avatar.basis(scene.cd.facing)
            centre = rig.matrix_world @ rig.pose.bones['J_Bip_C_Hips'].head
            side_positions = {s: ((rig.matrix_world @ rig.pose.bones[f'J_Bip_{s}_UpperArm'].head) - centre).dot(side_axis)
                              for s in ('L', 'R')}
            result['left_right_positions_m'] = side_positions
            assert side_positions['L'] > 0 and side_positions['R'] < 0, 'L/R không khớp orientation'
            result['mask'] = {'samples': len(points), 'torso_kept': len(kept),
                              'arm_head_finger_leaks': leaks,
                              'excluded_by_group': dict(Counter(d for d in dominant if expected_excluded(d)))}
            assert len(kept) >= 200 and leaks == 0, 'Torso mask fallback hoặc lọt arm/head/finger'
            selected = {k: sum(any(x in d for x in avatar.LIMB_GROUPS[k]) for d in dominant) for k in CHAINS}
            result['limb_sample_counts'] = selected
            assert all(n >= 20 for n in selected.values()), 'Limb sampling rơi vào fallback toàn body'
            measurements = []
            for _ in range(2):  # Hai lần cold-cache trong cùng một validation pass.
                avatar._CACHE.clear()
                avatar._BVH.clear()
                m = avatar.measure(bpy.context, skin, force=True)
                assert m is not None and set(m['limbs']) == set(CHAINS), 'Không đủ 8 measured limb profiles'
                for k, (a, b) in CHAINS.items():
                    true_length = ((rig.matrix_world @ rig.pose.bones[b].head)
                                   - (rig.matrix_world @ rig.pose.bones[a].head)).length
                    assert abs(m['limbs'][k]['len'] - true_length) < 1e-6
                    assert all(math.isfinite(r) and r > 0 for r in m['limbs'][k]['rad'])
                measurements.append({
                    'height_m': m['height'],
                    **{k + '_m': avatar.girth_at(m, avatar.z_of(m, k)) for k in ('chest', 'waist', 'hip')},
                    'neck_m': avatar.neck_girth(m),
                    'landmarks': dict(m['landmarks']),
                    'limb_lengths_m': {k: v['len'] for k, v in m['limbs'].items()},
                    'figure_auto_non_authoritative': m['figure_auto'], 'facing': m['facing'],
                })
            result['runs'] = measurements
            result['legacy_invalid_neck_m'] = original_neck(m)
            baseline = {'height_m': 1.6394608579576015, 'chest_m': 0.6733023326608331,
                        'waist_m': 0.5094704383869392, 'hip_m': 0.715987810760658}
            result['torso_regression_delta_m'] = {k: measurements[0][k] - v for k, v in baseline.items()}
            assert all(abs(v) <= 1e-9 for v in result['torso_regression_delta_m'].values()), 'Hồi quy torso so với 4B.1'
            result['drafting_accessor_m'] = library.avatar.neck_girth(m)
            assert library.avatar is avatar and abs(result['drafting_accessor_m'] - measurements[0]['neck_m']) <= 1e-9
            flat = lambda d: [d[k] for k in ('height_m', 'chest_m', 'waist_m', 'hip_m', 'neck_m')] + list(d['limb_lengths_m'].values())
            result['repeat_max_delta_m'] = max(abs(a - b) for a, b in zip(flat(measurements[0]), flat(measurements[1])))
            assert result['repeat_max_delta_m'] <= 1e-9, 'Measurement không lặp lại ổn định'
            assert all(math.isfinite(x) and x > 0 for x in flat(measurements[0])), 'Số đo không hữu hạn/dương'
            co = [skin.matrix_world @ v.co for v in skin.data.vertices]
            assert abs(m['height'] - (max(p.z for p in co) - min(p.z for p in co))) < 1e-5
            lm = m['landmarks']
            assert lm['hip'] < lm['waist'] < lm['chest'] < lm['shoulder'] < lm['neck'], 'Thứ tự landmark bất nhất'
            skin.data.calc_loop_triangles()
            triangles = [tuple(t.vertices) for t in skin.data.loop_triangles]
            zs = {k: avatar.z_of(m, k) for k in ('chest', 'waist', 'hip')}
            audit = result['neck_contours']
            idx = audit['selected_index']
            zs['neck'] = audit['probes'][idx]['z_m']
            neighbors = [audit['probes'][i] for i in (idx - 1, idx, idx + 1)]
            assert all(p['valid'] for p in neighbors), 'Contour cổ lân cận không kín'
            result['neck_adjacent_max_relative_delta'] = max(abs(p['perimeter_m'] - measurements[0]['neck_m'])
                                                            / measurements[0]['neck_m'] for p in neighbors)
            assert result['neck_adjacent_max_relative_delta'] <= 0.10, 'Vòng cổ lân cận không nhất quán'
            result['section_crosscheck'] = {}
            for key, z in zs.items():
                sliced = section(co, triangles, avatar.center_at(m, z), Vector((0, 0, 1)))
                sampled = measurements[0][key + '_m']
                direct = sliced['components'][0]['perimeter'] if sliced['components'] else 0.0
                delta = abs(sampled - direct) / direct if direct else math.inf
                result['section_crosscheck'][key] = {
                    'z_m': z, 'closed': sliced['nearest_closed'], 'direct_skin_perimeter_m': direct,
                    'opensew_m': sampled, 'relative_difference': delta,
                    'sample_ring_complete': avatar.slice_ok(m, z, min_cover=0.90),
                }
            bad = [k for k, v in result['section_crosscheck'].items()
                   if not v['closed'] or not v['sample_ring_complete'] or v['relative_difference'] > 0.10]
            result['invalid_sections'] = bad
            # Sai lệch tối đa 10% cho profile 96 bin/16 sector so với đường cắt thật.
            # Không đổi số đo/landmark để làm phép kiểm tra đạt.
            result['valid'] = not bad
    except Exception as error:
        result.update(valid=False, error=f'{type(error).__name__}: {error}', traceback=traceback.format_exc())
    finally:
        result['lookup_tables_restored'] = all(getattr(avatar, k) is value for k, value in original_tables.items())
        result['neck_override_restored'] = avatar.neck_girth is original_neck
        clothing_design.unregister()
    if not result['lookup_tables_restored'] or not result['neck_override_restored']:
        result.update(valid=False, error='Lookup tables không được restore')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vita-blend', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--opensew-root', type=Path, help='Bỏ qua để chỉ kiểm tra Task A')
    parser.add_argument('--neck-inspection-only', action='store_true', help='Chỉ kiểm tra contour giải phẫu cổ')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    assert bpy.app.version[:3] == (5, 2, 4), 'Chỉ dùng toolchain Blender 5.2.4 đã chốt'
    assert args.vita_blend.resolve() != args.output.resolve(), 'Output không được ghi đè source'
    assert args.output.suffix.lower() == '.json', 'Chỉ ghi metadata JSON, không xuất mesh'
    assert digest(args.vita_blend) == SOURCE_SHA, 'Sai source Vita được duyệt'
    bpy.ops.wm.open_mainfile(filepath=str(args.vita_blend), load_ui=False, use_scripts=False)
    body = bpy.data.objects['Vita_Suit']
    arm = next(m.object for m in body.modifiers if m.type == 'ARMATURE')
    before = fingerprint(body, arm)
    result = {'blender': bpy.app.version_string, 'source_sha256': SOURCE_SHA,
              'units': {'system': bpy.context.scene.unit_settings.system,
                        'scale_length': bpy.context.scene.unit_settings.scale_length},
              'source_materials': {m.name: sum(p.material_index == i for p in body.data.polygons)
                                   for i, m in enumerate(body.data.materials)},
              'source_modifiers': [{'name': m.name, 'type': m.type} for m in body.modifiers]}
    skin, rig, scene = duplicate_skin(body, arm)
    result['skin'] = audit_surface(skin, rig)
    if args.neck_inspection_only:
        result['neck_contours'] = inspect_neck_band(skin, rig)
    result['stopped_after'] = 'A'
    result['verdict'] = 'PARTIAL' if result['skin']['suitable'] else 'BLOCKED'
    if args.neck_inspection_only and not result['neck_contours']['valid_band_exists']:
        result['verdict'] = 'BLOCKED'
    if result['skin']['suitable'] and args.opensew_root and not args.neck_inspection_only:
        result['measurement'] = measurement_gate(args.opensew_root, skin, rig, scene)
        result['stopped_after'] = 'C'
        result['verdict'] = 'PASS' if result['measurement']['valid'] else 'BLOCKED'
    result['source_unchanged'] = fingerprint(body, arm) == before and digest(args.vita_blend) == SOURCE_SHA
    assert result['source_unchanged'], 'Source đã thay đổi'
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print('VITA_SKIN_GATE=' + json.dumps({k: v for k, v in result['skin'].items() if k != 'sections'}), flush=True)
    print('VERDICT=' + result['verdict'], flush=True)
    if 'neck_contours' in result:
        print('NECK_INSPECTION=' + json.dumps({k: v for k, v in result['neck_contours'].items()
                                             if k != 'probes'}), flush=True)
    if 'measurement' in result:
        print('VITA_MEASUREMENT_GATE=' + json.dumps(result['measurement']), flush=True)
    if not result['skin']['suitable']:
        raise RuntimeError('BLOCKED: contour SKIN không kín; không chạy adapter/measurement')
    if result['verdict'] == 'BLOCKED':
        raise RuntimeError('BLOCKED: số đo chưa qua cross-check; không tạo garment')


if __name__ == '__main__':
    main()
