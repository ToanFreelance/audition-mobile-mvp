"""Một T-shirt native OpenSew; chỉ ghi artifact private do caller chỉ định.

blender -b --factory-startup --disable-autoexec --python-exit-code 2
--python scripts/vita-opensew-tshirt-gate.py -- --vita-blend /private/Vita.blend
--opensew-root /tools/opensew --output-dir /private/session-4b3
"""
import argparse
from collections import Counter, defaultdict
import importlib.util
import json
import math
from pathlib import Path
import sys
import time
import traceback

import bpy
from mathutils import Vector


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vita-blend', type=Path, required=True)
    parser.add_argument('--opensew-root', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    out = args.output_dir.resolve()
    out.mkdir(parents=True, exist_ok=True)
    assert out != args.vita_blend.resolve().parent, 'Output phải riêng source'
    spec = importlib.util.spec_from_file_location('vita_measurement', Path(__file__).with_name('inspect-vita-opensew.py'))
    adapter = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(adapter)
    assert bpy.app.version[:3] == (5, 2, 4)
    assert adapter.digest(args.vita_blend) == adapter.SOURCE_SHA
    assert adapter.digest(args.opensew_root / 'clothing_design/avatar.py') == adapter.AVATAR_SHA
    bpy.ops.wm.open_mainfile(filepath=str(args.vita_blend), load_ui=False, use_scripts=False)
    original_body = bpy.data.objects['Vita_Suit']
    original_rig = next(m.object for m in original_body.modifiers if m.type == 'ARMATURE')
    source_scene = bpy.context.scene
    source_before = adapter.fingerprint(original_body, original_rig)
    skin, rig, scene = adapter.duplicate_skin(original_body, original_rig)
    sys.path.insert(0, str(args.opensew_root.resolve()))
    import clothing_design
    from clothing_design import avatar, build, patterns, library
    clothing_design.register()
    report = {'blender': bpy.app.version_string, 'opensew_commit': adapter.OPENSEW_COMMIT,
              'DRAFT': 'NOT_RUN', 'SEW': 'NOT_RUN', 'SKINNING': 'NOT_RUN', 'VISUAL': 'NOT_RUN',
              'draft_calls': 0, 'sew_calls': 0, 'renders': []}

    def checkpoint():
        (out / 'qa.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print('CHECKPOINT=' + json.dumps(report), flush=True)

    try:
        scene.cd.avatar = skin
        scene.cd.facing = avatar.auto_facing(bpy.context, skin)
        scene.cd.figure = 'WOMAN'
        neck = adapter.inspect_neck_band(skin, rig)
        with adapter.vroid_aliases(avatar), adapter.closed_neck_measurement(avatar, skin, rig, neck):
            m = avatar.measure(bpy.context, skin, force=True)
            assert set(m['limbs']) == set(adapter.CHAINS)
            report['measurements_m'] = {'height': m['height'], 'neck': avatar.neck_girth(m),
                                       **{k: avatar.girth_at(m, avatar.z_of(m, k)) for k in ('chest', 'waist', 'hip')}}
            draft = library._draft_top(dict(m, figure='WOMAN'), fit=0.08)
            report['draft_parameters_m'] = draft
            report['draft_calls'] += 1
            assert bpy.ops.cd.add_garment(preset='TSHIRT') == {'FINISHED'}
            shirt = build.garment_object(bpy.context, create=False)
            panels = build.garment_pieces(bpy.context, shirt.cd.garment)
            seams = [s for s in scene.cd.seams if s.obj_a and s.obj_a in panels]
            failures = []
            assert len(panels) == 4 and len(seams) == 10
            dimensions = {}
            for panel in panels:
                dimensions[panel.name] = {'dimensions_m': list(panel.dimensions),
                                          'vertices': len(panel.data.vertices), 'faces': len(panel.data.polygons)}
                if not panel.data.polygons or any(p.area <= 1e-12 for p in panel.data.polygons):
                    failures.append('degenerate panel: ' + panel.name)
                if not all(math.isfinite(x) for v in panel.data.vertices for x in v.co):
                    failures.append('non-finite panel: ' + panel.name)
            connected = defaultdict(set)
            seam_data = []
            for s in seams:
                pair = []
                for ob, segment in ((s.obj_a, s.seg_a), (s.obj_b, s.seg_b)):
                    ids = patterns.segment_verts(ob, segment)
                    points = [ob.matrix_world @ ob.data.vertices[i].co for i in ids]
                    assert len(points) >= 2, 'Seam segment không hợp lệ'
                    pair.append(sum((b - a).length for a, b in zip(points, points[1:])))
                connected[s.obj_a.name].add(s.obj_b.name)
                connected[s.obj_b.name].add(s.obj_a.name)
                ok = abs(pair[0] - pair[1]) <= 0.04 * max(pair) + 0.5 * scene.cd.resolution
                seam_data.append({'name': s.name, 'lengths_m': pair, 'pass': ok})
                if not ok:
                    failures.append('seam length mismatch: ' + s.name)
            assert len(adapter.components(connected)) == 1, 'Panels không liên thông qua seam'
            if not (0 < draft['neck_half'] < draft['sh_x'] and draft['arm_d'] > 0 and draft['armhole'] > 0):
                failures.append('neckline/shoulder/armhole dimensions invalid')
            report['draft_geometry'] = {'panels': dimensions, 'seams': seam_data,
                                        'assembled_vertices': len(shirt.data.vertices),
                                        'assembled_faces': len(shirt.data.polygons),
                                        'assembled_dimensions_m': list(shirt.dimensions), 'failures': failures}
            report['DRAFT'] = 'FAIL' if failures else 'PASS'
            checkpoint()
            assert not failures, 'DRAFT BLOCKED: ' + '; '.join(failures)

            started = time.monotonic()
            report['sew_calls'] += 1
            assert bpy.ops.cd.sew() == {'FINISHED'}
            report['sew_seconds'] = time.monotonic() - started
            assert bpy.ops.cd.finalize() == {'FINISHED'}
            bones = {b.name for b in rig.data.bones}
            groups = {g.index for g in shirt.vertex_groups if g.name in bones}
            totals = [sum(g.weight for g in v.groups if g.group in groups) for v in shirt.data.vertices]
            binding = [mod for mod in shirt.modifiers if mod.type == 'ARMATURE' and mod.object == rig]
            report['weights'] = {'vertices': len(totals), 'weighted': sum(v > 1e-6 for v in totals),
                                 'sum_min': min(totals), 'sum_max': max(totals), 'bone_groups': len(groups)}
            report['SKINNING'] = 'PASS' if binding and all(abs(v - 1) < 1e-4 for v in totals) else 'FAIL'
            shirt.data.calc_loop_triangles()
            edges = Counter(tuple(sorted((a, b))) for p in shirt.data.polygons
                            for a, b in zip(list(p.vertices), list(p.vertices)[1:] + list(p.vertices)[:1]))
            dg = bpy.context.evaluated_depsgraph_get()
            ev = shirt.evaluated_get(dg)
            bvh = avatar.body_bvh(bpy.context)
            depths = []
            for v in ev.data.vertices:
                pos = ev.matrix_world @ v.co
                assert all(math.isfinite(x) for x in pos)
                loc, normal, _, _ = bvh.find_nearest(pos)
                depths.append(max(0.0, -(pos - loc).dot(normal)))
            report['topology'] = {'vertices': len(shirt.data.vertices), 'faces': len(shirt.data.polygons),
                                   'boundary_edges': sum(v == 1 for v in edges.values()),
                                   'nonmanifold_edges': sum(v > 2 for v in edges.values()),
                                   'loose_edges': len(build.loose_edges(shirt.data))}
            report['penetration'] = {'evaluated_vertices': len(depths), 'beyond_4mm': sum(d > 0.004 for d in depths),
                                      'fraction': sum(d > 0.004 for d in depths) / len(depths), 'max_depth_m': max(depths)}
            report['SEW'] = 'PASS' if report['penetration']['fraction'] < 0.02 and not report['topology']['nonmanifold_edges'] else 'FAIL'
            checkpoint()
            assert report['SEW'] == report['SKINNING'] == 'PASS', 'SEW/SKINNING BLOCKED'

            # Render scene chỉ chứa bản sao; clothing gốc bị loại theo scene membership.
            for name in ('Face', 'Scalp', 'Hair_Bob', 'Ribbon_Champagne', 'Street_Dance_Shorts'):
                original = source_scene.objects.get(name)
                if original is None:
                    continue
                ob = original.copy()
                scene.collection.objects.link(ob)
                ob.parent = rig if original.parent == original_rig else None
                ob.matrix_world = original.matrix_world.copy()
                for mod in ob.modifiers:
                    if mod.type == 'ARMATURE':
                        mod.object = rig
                ob.hide_render = False
                ob.hide_viewport = False
                ob.hide_set(False)
            for panel in panels:
                panel.hide_render = True
            mat = patterns.fabric_material('Vita_Original_Cotton', (0.14, 0.36, 0.60, 1))
            shirt.data.materials.clear()
            shirt.data.materials.append(mat)
            skin.hide_render = False
            scene.render.engine = 'CYCLES'
            scene.cycles.device = 'CPU'
            scene.cycles.samples = 24
            scene.render.resolution_x = 800
            scene.render.resolution_y = 1000
            scene.render.resolution_percentage = 100
            scene.world = bpy.data.worlds.new('Gate_Studio')
            scene.world.use_nodes = True
            scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.18, 0.18, 0.18, 1)
            target = Vector((0, 0, 1.30))
            for name, pos, power, size in [('Key', (2, -3, 4), 450, 4), ('Fill', (-3, -1, 2), 250, 3), ('Rim', (1, 3, 3), 450, 3)]:
                data = bpy.data.lights.new(name, 'AREA')
                data.energy, data.shape, data.size = power, 'DISK', size
                light = bpy.data.objects.new(name, data)
                scene.collection.objects.link(light)
                light.location = pos
                light.rotation_euler = (target - light.location).to_track_quat('-Z', 'Y').to_euler()
            camera = bpy.data.objects.new('Gate_Camera', bpy.data.cameras.new('Gate_Camera'))
            scene.collection.objects.link(camera)
            scene.camera = camera
            camera.data.type = 'ORTHO'
            camera.data.ortho_scale = 1.20
            for name, angle in [('front', 0), ('35-degree', 35), ('left', 90), ('back', 180)]:
                a = math.radians(angle)
                camera.location = target + Vector((3 * math.sin(a), -3 * math.cos(a), 0.08))
                camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
                scene.render.filepath = str(out / (name + '.png'))
                bpy.ops.render.render(write_still=True)
                report['renders'].append(name + '.png')
                checkpoint()
            report['VISUAL'] = 'PENDING_REVIEW'
    except Exception as error:
        report['error'] = str(error)
        report['traceback'] = traceback.format_exc()
        if report['DRAFT'] == 'NOT_RUN':
            report['DRAFT'] = 'FAIL'
        elif report['DRAFT'] == 'PASS' and report['SEW'] == 'NOT_RUN':
            report['SEW'] = 'FAIL'
    finally:
        report['source_unchanged'] = (adapter.fingerprint(original_body, original_rig) == source_before
                                      and adapter.digest(args.vita_blend) == adapter.SOURCE_SHA)
        assert report['source_unchanged']
        report['artifact'] = 'vita-tshirt-private.blend'
        bpy.ops.wm.save_as_mainfile(filepath=str(out / report['artifact']))
        checkpoint()
    if report.get('error'):
        raise RuntimeError(report['error'])


if __name__ == '__main__':
    main()
