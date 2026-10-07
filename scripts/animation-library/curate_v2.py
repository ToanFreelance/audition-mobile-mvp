"""Offline CMU V2 acquisition/review. Reuses V1 FK, renderer and body audit.

Raw source is immutable. Output must be outside the repository and V1 folder.
No target rig, retarget, gameplay mapping or production acceptance here.
"""
import argparse
import concurrent.futures
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image
from acquire import BASE, PIN, fetch, parse_bvh
from preview import draw_pose
from quality_audit import audit

EXTRA = '''85_01 85_02 85_06 85_07 85_15
87_01 87_03 87_04 87_05
88_01 88_02 88_05 88_06 88_07 88_08 88_10
89_03 89_04 89_05
90_02 90_08 90_09 90_11 90_14 90_19 90_29 90_32 90_33
111_02 111_04 111_16 111_37 120_03 120_04 120_15 120_21
141_16 141_22 142_20 142_21 143_31'''.split()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def blob_hash(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def safe_output(out, v1=None):
    out = out.resolve()
    repo = Path(__file__).resolve().parents[2]
    assert out != repo and repo not in out.parents, 'Generated assets must stay outside Git'
    if v1:
        v1 = v1.resolve()
        assert out != v1 and v1 not in out.parents, 'Do not alter V1 output'
    out.mkdir(parents=True, exist_ok=True)
    return out


def read_index(text):
    result = {}
    context = ''
    for line in text.splitlines():
        if line.startswith('Subject #'):
            context = line
        m = re.match(r'(\d+_\d+)\s+(.+)', line)
        if m:
            result[m[1]] = (m[2], context)
    return result


def bounds(pos):
    p = np.stack([.9*pos[:, :, 0]+.436*pos[:, :, 2],
                  pos[:, :, 1]-.22*(-.436*pos[:, :, 0]+.9*pos[:, :, 2])], axis=2)
    lo, hi = p.min(axis=(0, 1)), p.max(axis=(0, 1))
    assert np.all(hi > lo)
    return lo, hi


def signature(nodes, pos):
    """Proposal only: root-relative, height-normalized, initial-heading aligned.

    64 time samples, no DTW, not invariant to choreography phase or speed.
    Must never automatically reject or count choreography as unique.
    """
    names = ['Hips', 'Spine', 'Spine1', 'Neck', 'Head', 'LeftArm', 'LeftForeArm',
             'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg',
             'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot']
    lookup = {n['name']: i for i, n in enumerate(nodes)}
    use = [lookup[n] for n in names if n in lookup]
    height = float(np.ptp(pos[0, :, 1]))
    p = pos[1:].copy()
    p -= p[:, :1]
    hip = p[0, lookup['LeftUpLeg']] - p[0, lookup['RightUpLeg']]
    angle = math.atan2(hip[2], hip[0])
    c, s = math.cos(angle), math.sin(angle)
    x, z = p[:, :, 0].copy(), p[:, :, 2].copy()
    p[:, :, 0], p[:, :, 2] = c*x+s*z, -s*x+c*z
    return p[np.linspace(0, len(p)-1, 64, dtype=int)][:, use] / height


def measure(source_id, origin, out, index, hashes, v1_rows):
    path = f'data/{int(source_id.split("_")[0]):03}/{source_id}.bvh'
    target = out / 'raw/CMU' / f'{source_id}.bvh'
    data = fetch(path, target).read_bytes()
    assert blob_hash(data) == hashes[path], f'Pinned Git blob mismatch: {source_id}'
    sha = hashlib.sha256(data).hexdigest()
    if source_id in v1_rows:
        assert sha == v1_rows[source_id]['sha256'], f'V1 changed: {source_id}'
    nodes, values, pos, dt = parse_bvh(target)
    height = float(np.ptp(pos[0, :, 1]))
    travel = float(np.linalg.norm(np.ptp(pos[1:, 0][:, [0, 2]], axis=0)) / height)
    angular = audit(nodes, values)
    body = [i for i, n in enumerate(nodes) if not any(w in n['name'].lower() for w in ('finger', 'thumb', 'index'))]
    step = np.linalg.norm(np.diff(pos[1:, body], axis=0), axis=2) / height
    t, j = np.unravel_index(np.argmax(step), step.shape)
    row = dict(id='cmu-'+source_id, sourceId=source_id, title=index[source_id][0],
               subjectContext=index[source_id][1], origin=origin,
               source='CMU / cgspeed / una-dinosauria', sourcePin=PIN,
               sourcePath=path, sourceUrl=BASE+path, file=str(target.relative_to(out)),
               sha256=sha, gitBlobSha1=hashes[path], bytes=len(data),
               frames=len(values), fps=1/dt, frameTime=dt,
               duration=(len(values)-2)*dt, firstChoreographySample=1,
               joints=sum(bool(n['channels']) for n in nodes), hierarchy=nodes,
               sourceUnits='UNVERIFIED_RAW_BVH_UNITS',
               rootRangeSourceUnits=np.ptp(pos[1:, 0], axis=0).tolist(),
               rootEnvelopeBodyHeights=travel,
               travelClass='LOCAL' if travel < .75 else 'MODERATE' if travel < 2 else 'LARGE',
               bodyAngular=angular,
               bodyPositionStep=dict(maxBodyHeights=float(step[t, j]),
                    p99BodyHeights=float(np.percentile(step, 99)), joint=nodes[body[j]]['name'],
                    rawSamplePair=[int(t)+1, int(t)+2]),
               structuralStatus='PASS',
               licenseStatus='CONVERTER_DISTRIBUTED_CMU_USAGE_EVIDENCE_NOT_NEW_LEGAL_CLEARANCE')
    return row


def reviews(out, motions):
    review = out / 'review'
    review.mkdir(exist_ok=True)
    unique, sigs = [], {}
    seen = {}
    for m in motions:
        if m['sha256'] in seen:
            m['exactDuplicateOf'] = seen[m['sha256']]['id']
            m['contactSheet'] = seen[m['sha256']]['contactSheet']
            continue
        seen[m['sha256']] = m
        nodes, v, pos, dt = parse_bvh(out/m['file'])
        sigs[m['id']] = signature(nodes, pos)
        p = pos[1:]
        b = bounds(p)
        sheet = Image.new('RGB', (1280, 960))
        for i, f in enumerate(np.linspace(0, len(p)-1, 16, dtype=int)):
            sheet.paste(draw_pose(p[f], nodes, b, f'{m["sourceId"]} SOURCE | {f*dt:.2f}s', (320, 240)),
                        (i % 4*320, i//4*240))
        m['contactSheet'] = f'review/{m["id"]}-contact.jpg'
        sheet.save(out/m['contactSheet'], quality=90)
        strip = Image.new('RGB', (1440, 230))
        for i, f in enumerate(np.linspace(0, len(p)-1, 6, dtype=int)):
            strip.paste(draw_pose(p[f], nodes, b, f'{m["sourceId"]} | {f*dt:.1f}s', (240, 230)), (i*240, 0))
        unique.append((m, strip))
    for start in range(0, len(unique), 6):
        page = Image.new('RGB', (1440, 1380), (22, 27, 38))
        for i, (_, strip) in enumerate(unique[start:start+6]):
            page.paste(strip, (0, i*230))
        page.save(review/f'batch-{start//6+1:02}.jpg', quality=90)
    pairs = []
    ids = list(sigs)
    for i, a in enumerate(ids):
        for b in ids[i+1:]:
            if sigs[a].shape == sigs[b].shape:
                pairs.append(dict(a=a, b=b, rms=float(np.sqrt(np.mean((sigs[a]-sigs[b])**2)))))
    write_json(out/'similarity-proposals.json', dict(
        warning='Numerical proposals only; no automatic curation. No DTW; phase/speed sensitive.',
        pairs=sorted(pairs, key=lambda p: p['rms'])[:100]))


def prepare(v1, out, tree):
    out = safe_output(out, v1)
    old = json.loads((v1/'catalog.json').read_text())
    old_rows = {m['source_id']: m for m in old['motions']}
    tree_data = json.loads(tree.read_text())
    assert tree_data['sha'] == PIN and not tree_data.get('truncated'), 'Require complete pinned tree'
    hashes = {r['path']: r['sha'] for r in tree_data['tree'] if r['type'] == 'blob'}
    shutil.copytree(v1/'raw', out/'raw', dirs_exist_ok=True)
    shutil.copytree(v1/'provenance', out/'provenance', dirs_exist_ok=True)
    shutil.copy2(tree, out/'provenance/pinned-tree.json')
    index = read_index((out/'provenance/cmu-index.txt').read_text())
    ids = list(old_rows) + [i for i in EXTRA if i not in old_rows]
    def run(i):
        row = measure(i, 'V1' if i in old_rows else 'V2_NEW', out, index, hashes, old_rows)
        print('validated', i, flush=True)
        return row
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        motions = list(pool.map(run, ids))
    reviews(out, motions)
    write_json(out/'inventory.json', dict(sourcePin=PIN, motions=motions))
    print('Prepared', len(motions), 'takes', len({m['sha256'] for m in motions}), 'byte unique', flush=True)


def video(out, m):
    target = out/'videos'/f'{m["id"]}.mp4'
    target.parent.mkdir(exist_ok=True)
    if target.exists():
        check=subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(target), '-f', 'null', '-'],capture_output=True)
        if check.returncode == 0:
            return
        # Preserve a failed generated cache outside the package; raw BVH is untouched.
        failed=out.parent/(out.name+'-failed-preview-cache')
        failed.mkdir(exist_ok=True)
        target.rename(failed/target.name)
        print('rebuild invalid preview', m['sourceId'], flush=True)
    temporary=target.with_suffix('.partial.mp4')
    nodes, v, pos, dt = parse_bvh(out/m['file'])
    p = pos[1:]
    b = bounds(p)
    fps = 30
    count = int(math.floor((len(p)-1)*dt*fps))+1
    process = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
        '-s', '640x480', '-r', str(fps), '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-threads', '1',
        '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(temporary)], stdin=subprocess.PIPE)
    try:
        for f in range(count):
            idx = min(len(p)-1, int(round(f/fps/dt)))
            process.stdin.write(draw_pose(p[idx], nodes, b,
                f'{m["id"]} | SOURCE ONLY | {f/fps:.2f}s').tobytes())
    finally:
        process.stdin.close()
    assert process.wait() == 0
    subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(temporary), '-f', 'null', '-'], check=True)
    with temporary.open('rb') as f:
        os.fsync(f.fileno())
    temporary.replace(target)
    print('video', m['sourceId'], flush=True)


def diagnostics(out, motions):
    rows = []
    ids = '60_01 61_05 85_04 85_14 90_30 89_03 120_15'.split()
    for m in motions:
        if m['sourceId'] not in ids:
            continue
        nodes, v, p, dt = parse_bvh(out/m['file'])
        raw = m['bodyPositionStep']['rawSamplePair'][0] if m['sourceId']=='120_15' else m['bodyAngular']['worst']['raw_sample_pair'][0]
        b = bounds(p[1:])
        strip = Image.new('RGB', (1440, 230))
        for i, f in enumerate(range(max(1, raw-2), max(1, raw-2)+6)):
            f = min(f, len(p)-1)
            strip.paste(draw_pose(p[f], nodes, b, f'{m["sourceId"]} raw {f}', (240, 230)), (i*240, 0))
        rows.append(strip)
    for start in range(0, len(rows), 4):
        page = Image.new('RGB', (1440, 920), (22, 27, 38))
        for i, strip in enumerate(rows[start:start+4]):
            page.paste(strip, (0, i*230))
        page.save(out/'review'/f'angular-neighborhood-{start//4+1}.jpg', quality=92)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('action', choices=['prepare', 'videos', 'diagnostics'])
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--v1', type=Path)
    ap.add_argument('--tree', type=Path)
    ap.add_argument('--ids', nargs='*')
    a = ap.parse_args()
    if a.action == 'prepare':
        prepare(a.v1, a.out, a.tree)
    else:
        out = safe_output(a.out)
        motions = json.loads((out/'inventory.json').read_text())['motions']
        if a.action == 'diagnostics':
            diagnostics(out, motions)
        else:
            decisions = json.loads((out/'curation-decisions.json').read_text())
            ids = a.ids or [m['sourceId'] for m in decisions if m['status'] != 'REJECT']+['120_15']
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                list(pool.map(lambda m: video(out, m), [m for m in motions if m['sourceId'] in ids]))


if __name__ == '__main__':
    main()
