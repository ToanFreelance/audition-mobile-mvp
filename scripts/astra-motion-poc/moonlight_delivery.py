"""Audit evidence and validated artifact packaging; never implies visual acceptance."""
import argparse, hashlib, json, subprocess, zipfile
from pathlib import Path

import cv2
import numpy as np

from moonlight_qa import comparison_frame
from moonlight_source import decode


def read(path):
    return json.loads(Path(path).read_text())


def write(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def runs(frames):
    """Consecutive source frames represented as zero-based half-open intervals."""
    result = []
    for f in frames:
        if result and f == result[-1][1]:
            result[-1][1] += 1
        else:
            result.append([int(f), int(f) + 1])
    return result


def evidence(root, sources, renders, before=None):
    man = read(root / 'motion-source/source-manifest.json')
    technical = read(root / 'qa/technical-qa.json')
    frames = {k: decode(Path(sources) / v['file'])[0]
              for k, v in man['sources'].items()}
    report = []
    for i, motion in enumerate(man['motions']):
        mid = motion['id']
        a, b = motion['source_frame_range']
        if not all((Path(renders) / sex / mid / f'{b-a-1:04}.png').exists()
                   for sex in ['Nam', 'Nu']):
            continue
        target = np.load(root / 'targets' / (mid + '-targets.npz'))
        pa, pb = target['production_slice']
        low = {}
        for name, j in [('left_elbow', 7), ('right_elbow', 8),
                        ('left_wrist', 9), ('right_wrist', 10),
                        ('left_knee', 13), ('right_knee', 14),
                        ('left_ankle', 15), ('right_ankle', 16)]:
            low[name] = runs((np.where(target['wholebody_confidence'][pa:pb, j] < .35)[0] + a).tolist())
        angles = [m['animations'][i]['worst_angular_step'] for m in technical['models']]
        solve = np.load(root / 'models/Nam_Astra_Moonlight_POC_V2-diagnostics' / (mid + '.solve.npz'))
        root_step = a + int(np.linalg.norm(np.diff(solve['root'][pa:pb], axis=0), axis=1).argmax())
        center = root_step if i in [3, 4, 7] else angles[0]['source_frame_pair'][0]
        selected = list(range(max(a, center-1), min(b, center+3)))
        x, y, w, h = motion['crop_region']
        rows = []
        for f in selected:
            images = [cv2.imread(str(Path(renders) / sex / mid / f'{f-a:04}.png'))
                      for sex in ['Nam', 'Nu']]
            if any(im is None for im in images):
                raise ValueError(f'Incomplete actual render for {mid}:{f}')
            rows.append(comparison_frame(frames[motion['source_key']][f, y:y+h, x:x+w],
                                         *images, motion, f-a))
        cv2.imwrite(str(root / 'qa' / (mid + '-risk-review.jpg')), np.vstack(rows))
        report.append(dict(id=mid, risk_review_source_frames=selected,
                           risk_selection='maximum root step' if i in [3, 4, 7] else 'maximum male angular step',
                           maximum_root_step_source_pair=[root_step, root_step+1],
                           worst_angular_steps_nam_nu=angles,
                           low_confidence_threshold=.35,
                           confidence_definition='Heuristic RTMW/reprojection weight, not calibrated probability',
                           low_confidence_source_frame_ranges=low))
    write(root / 'qa/occlusion-and-risk-review.json', report)
    if before:
        rows = []
        for sex in ['Nam', 'Nu']:
            images = [cv2.imread(str(Path(base) / sex / 'moonlight-space-003/0050.png'))
                      for base in [before, renders]]
            if any(im is None for im in images):
                raise ValueError('Missing actual before/after GLB render')
            row = np.full((616, 1536, 3), 24, np.uint8)
            row[40:] = np.hstack(images)
            for i, label in enumerate(['INITIAL V2', 'FINAL V2']):
                cv2.putText(row, f'{sex} | {label} | A340', (i*768+20, 28),
                            0, .65, (240, 240, 240), 1, cv2.LINE_AA)
            rows.append(row)
        cv2.imwrite(str(root / 'qa/Moonlight_V2_Waist_Before_After.jpg'), np.vstack(rows))


def package(root, out, repo, renders):
    man = read(root / 'motion-source/source-manifest.json')
    qa = read(root / 'qa/technical-qa.json')
    videos = read(root / 'qa/video-qa.json')
    review = read(root / 'qa/visual-review.json')
    assert man['identity'] == 'MOONLIGHT_CONFIRMED'
    assert len(man['motions']) == 8 == len(review['motions'])
    assert all(m['both_boundaries_observed'] and m['complete'] for m in man['motions'])
    assert all(m['structural_pass'] for m in qa['models'])
    assert all(v['decode'] == 'PASS' for v in videos)
    by_video = {v['file']: v for v in videos}
    for m in man['motions']:
        count = m['source_frame_range'][1] - m['source_frame_range'][0]
        for prefix, suffix in [('motion-source/', '.mp4'), ('qa/', '-source-male-female.mp4')]:
            assert int(by_video[prefix + m['id'] + suffix]['nb_frames']) == count
    assert int(by_video['qa/Moonlight_V2_Combined_Review.mp4']['nb_frames']) == 811
    render_reports = []
    for m in qa['models']:
        path = root / 'models' / m['file']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == m['sha256']
        sex = m['file'].split('_')[0]
        identity = read(Path(renders) / sex / 'render-input.json')
        assert identity['glb_sha256'] == m['sha256']
        reports = []
        for motion in man['motions']:
            a, b = motion['source_frame_range']
            record = read(Path(renders) / sex / ('render-' + motion['id'] + '.json'))
            assert record['identity'] == identity and record['fps'] == 30
            assert record['clips'][motion['id']]['local_frames'] == list(range(b-a))
            assert record['clips'][motion['id']]['source_frames'] == list(range(a,b))
            assert all((Path(renders) / sex / motion['id'] / f'{f:04}.png').exists()
                       for f in range(b-a))
            reports.append(record)
        render_reports.append(dict(sex=sex, identity=identity, frames=811, reports=reports))
    write(root / 'qa/render-qa.json', render_reports)
    commit = subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD'], text=True).strip()
    result = dict(schema_version=2, source=man, technical=qa, visual=review,
                  occlusion=read(root / 'qa/occlusion-and-risk-review.json'),
                  reconstruction=read(root / 'targets/reconstruction.json'),
                  videos=videos, actual_glb_renders=render_reports,
                  dependencies=read(root / 'dependency-manifest.json'),
                  reproduction_code_commit=commit,
                  overall_status='OFFLINE_PIPELINE_COMPLETE__VISUAL_ACCEPTANCE_NOT_PASSED',
                  owner_visual_acceptance='PENDING', production_accepted=False)
    write(root / 'qa/Moonlight_V2_Final_QA.json', result)
    # Exclude transient checkpoint notes and obsolete V1-style aggregate NPZ.
    # Final per-motion solve diagnostics remain included.
    files = [p for p in sorted(root.rglob('*')) if p.is_file()
             and 'render' not in p.relative_to(root).parts
             and p.name not in ['CHECKPOINT.txt', 'SHA256SUMS.json']
             and not (p.parent == root / 'models' and p.name.endswith('.solve.npz'))]
    write(root / 'SHA256SUMS.json', {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
                                    for p in files})
    out = Path(out)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=3) as z:
        for p in files + [root / 'SHA256SUMS.json']:
            z.write(p, p.relative_to(root))
    with zipfile.ZipFile(out) as z:
        assert z.testzip() is None
    print(json.dumps(dict(file=str(out), bytes=out.stat().st_size,
                          entries=len(files)+1, zip_crc='PASS',
                          sha256=hashlib.sha256(out.read_bytes()).hexdigest())))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('mode', choices=['evidence', 'package'])
    ap.add_argument('--artifacts', required=True)
    ap.add_argument('--sources')
    ap.add_argument('--renders')
    ap.add_argument('--before')
    ap.add_argument('--out')
    ap.add_argument('--repo')
    args = ap.parse_args()
    root = Path(args.artifacts)
    if args.mode == 'evidence':
        evidence(root, args.sources, args.renders, args.before)
    else:
        package(root, args.out, args.repo, args.renders)
