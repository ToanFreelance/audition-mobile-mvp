"""Validate and package source-only curation. No writes to application assets."""
import argparse
from collections import Counter
import csv
import hashlib
import html
import json
from pathlib import Path
import re
import shutil
import subprocess
import zipfile

import numpy as np
from PIL import Image
from acquire import PIN, parse_bvh
from curate_v2 import blob_hash, bounds, safe_output, write_json
from preview import draw_pose
from review_decisions_v2 import RETAINED_STATUSES, STYLES, POCS

FIELDS = ['id','sourceId','title','origin','stylePrimary','styleSecondary','status','retained',
          'energy','duration','fps','partnerDependency','floorWork','acrobaticRisk','travelClass',
          'retargetRisk','modeHints','roleHints','visualStatus','notes','duplicateOf','duplicateRelation',
          'choreographyGroup','rejectionReason','licenseStatus','sha256','gitBlobSha1','file',
          'contactSheet','previewVideo']


def csv_row(m, fields=FIELDS):
    return {f: ';'.join(str(x) for x in m.get(f, [])) if isinstance(m.get(f), list)
            else m.get(f) for f in fields}


def validate(motions):
    assert len({m['id'] for m in motions}) == len(motions), 'Duplicate catalog id'
    retained_hashes = set()
    for m in motions:
        assert m['stylePrimary'] in STYLES
        assert m['status'] in RETAINED_STATUSES | {'EXPLORE','REJECT'}
        assert m['retained'] == (m['status'] in RETAINED_STATUSES)
        assert m['partnerDependency'] in {'NONE','OPTIONAL','REQUIRED'}
        assert m['duplicateRelation'] in {'EXACT_DUPLICATE','NEAR_DUPLICATE','SAME_CHOREOGRAPHY_VARIANT','UNIQUE'}
        assert m['reviewScope']['ownerAccepted'] is False, 'Never auto-accept production'
        assert m['notes'] and m['visualStatus'] != 'PRODUCTION_ACCEPTED'
        if m['partnerDependency'] == 'REQUIRED':
            assert 'normal' not in m['roleHints'], 'Partner choreography cannot be solo Normal'
        if m['status'] == 'REJECT': assert m['rejectionReason']
        if m['retained']:
            assert m['energy'] in {'LOW','MEDIUM','HIGH','CLIMAX'}
            assert m['floorWork'] in {'STANDING','LOW','KNEELING','HAND_SUPPORTED','INVERTED','FLOOR_SPIN'}
            assert m['retargetRisk'] in {'LOW','LOW_MED','MED','MED_HIGH','HIGH','VERY_HIGH'}
            assert not m['duplicateOf'], 'Do not retain exact/probable near duplicate'
            assert m['sha256'] not in retained_hashes
            retained_hashes.add(m['sha256'])
        assert np.isfinite(m['duration']) and m['duration'] > 0 and m['fps'] > 0


def page(motions, title):
    cards = []
    for m in motions:
        esc = html.escape
        media = (f'<video controls playsinline preload="none" poster="{m["contactSheet"]}" src="{m["previewVideo"]}"></video>'
                 if m.get('previewVideo') else f'<img loading="lazy" src="{m["contactSheet"]}">')
        cards.append(f'<article data-style="{m["stylePrimary"]}"><h2>{esc(m["id"])} — {esc(m["title"])}</h2>{media}'
            f'<p>{m["stylePrimary"]} · {m["status"]} · {m["energy"]} · {m["duration"]:.2f}s</p>'
            f'<p>Partner: {m["partnerDependency"]} | Floor: {m["floorWork"]} | Risk: {m["retargetRisk"]} | Travel: {m["travelClass"]}</p>'
            f'<p>{esc(m["notes"])}</p><p>{esc("; ".join(m["warnings"]))}</p>'
            f'<a href="{m["contactSheet"]}">16 keyposes</a> · <a href="{m["file"]}" download>Raw BVH</a></article>')
    options = ''.join(f'<option>{s}</option>' for s in STYLES)
    return ('<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        f'<title>{html.escape(title)}</title><style>body{{background:#101827;color:#e5edf7;font:16px system-ui;margin:24px}}'
        'main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,430px),1fr));gap:20px}'
        'article{background:#202c40;padding:18px;border-radius:12px}h2{font-size:20px}video,img{width:100%}'
        'a{color:#8bd8ff}select{padding:10px;margin:12px}p{line-height:1.5}[hidden]{display:none}</style>'
        f'<h1>{html.escape(title)}</h1><p>SOURCE ONLY — skeleton FK, chưa retarget/duyệt production. Raw BVH giữ nguyên; sample T-pose đầu không có trong preview. '
        'Preview 30 fps, source timing giữ nguyên, không ép thời lượng gameplay. Contact review không thay thế full-speed/target QA.</p>'
        '<nav><a href="index.html">Retained</a> · <a href="explore.html">Explore</a> · <a href="rejected.html">Rejected</a> · '
        '<a href="catalog.json">Catalog JSON</a> · <a href="catalog.csv">CSV</a> · <a href="README.md">Report</a></nav>'
        f'<label>Style <select id="style"><option value="all">all</option>{options}</select></label><main>'+''.join(cards)+'</main>'
        '<script>document.getElementById("style").onchange=e=>document.querySelectorAll("article").forEach(a=>a.hidden=e.target.value!=="all"&&a.dataset.style!==e.target.value)</script></html>')


def publish(out, repo):
    out = safe_output(out)
    tests=subprocess.run(['python','-m','unittest','discover','-s',str(repo/'scripts/animation-library'),
                          '-p','test_*.py'],capture_output=True,text=True,check=True)
    test_log=tests.stdout+tests.stderr
    (out/'unit-tests.txt').write_text(test_log)
    test_count=int(re.search(r'Ran (\d+) tests',test_log)[1])
    inventory = json.loads((out/'inventory.json').read_text())['motions']
    decisions = {d['id']: d for d in json.loads((out/'curation-decisions.json').read_text())}
    assert set(decisions) == {m['id'] for m in inventory}
    motions = [{**m, **decisions[m['id']]} for m in inventory]
    validate(motions)
    hashes = {m['path']:m['sha'] for m in json.loads((out/'provenance/pinned-tree.json').read_text())['tree'] if m['type']=='blob'}
    for m in motions:
        data = (out/m['file']).read_bytes()
        assert hashlib.sha256(data).hexdigest() == m['sha256']
        assert blob_hash(data) == hashes[m['sourcePath']] == m['gitBlobSha1']
        assert (out/m['contactSheet']).is_file()
        if m['status'] != 'REJECT' or m['sourceId'] == '120_15':
            m['previewVideo'] = f'videos/{m["id"]}.mp4'
            path = out/m['previewVideo']
            probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]))
            stream = probe['streams'][0]
            assert stream['width']==640 and stream['height']==480 and int(stream['nb_frames'])>0
            assert abs(float(probe['format']['duration'])-m['duration']) < .07
            subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(path),'-f','null','-'],check=True)
            m['previewSampleRate']=30
            m['previewFullTake']=True
    keep = [m for m in motions if m['retained']]
    summary = dict(inspectedTakes=len(motions), byteUniqueTakes=len({m['sha256'] for m in motions}),
        existingV1=sum(m['origin']=='V1' for m in motions), newV2=sum(m['origin']=='V2_NEW' for m in motions),
        retainedTakes=len(keep), retainedByteUnique=len({m['sha256'] for m in keep}),
        retainedNewV2=sum(m['origin']=='V2_NEW' for m in keep),
        conservativeChoreographyGroups=len({m['choreographyGroup'] for m in keep}),
        groupCaution='Editorial grouping, not a proof of semantic uniqueness. Paired roles and known variants count once.',
        retainedCounts={f:dict(Counter(m[f] for m in keep)) for f in ('stylePrimary','status','energy','partnerDependency','floorWork','retargetRisk','travelClass')},
        allStatusCounts=dict(Counter(m['status'] for m in motions)),
        rejectionReasons=dict(Counter(m['rejectionReason'] for m in motions if m['status']=='REJECT')),
        finishRoleCandidates=sum('finish' in m['roleHints'] for m in keep),
        exactDuplicates=[dict(id=m['id'],duplicateOf=m['duplicateOf']) for m in motions if m['duplicateRelation']=='EXACT_DUPLICATE'],
        probableNearDuplicates=[dict(id=m['id'],duplicateOf=m['duplicateOf']) for m in motions if m['duplicateRelation']=='NEAR_DUPLICATE'])
    catalog = dict(schemaVersion=2, sourcePin=PIN, sourceOnly=True, runtimeMapping=None,
        constraints=dict(noRetarget=True, frozenMoonlightUnchanged=True, noGameplayChanges=True),
        reviewLimits='Keypose/silhouette curation; not all MP4s watched realtime. No textured-target or owner production acceptance.',
        summary=summary, motions=motions)
    write_json(out/'catalog.json', catalog)
    with (out/'catalog.csv').open('w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=FIELDS); writer.writeheader(); writer.writerows(csv_row(m) for m in motions)
    write_json(out/'style-summary.json', summary)
    for name, rows in [('retained', keep), ('rejected', [m for m in motions if m['status']=='REJECT']),
                       ('new-v2-candidates', [m for m in motions if m['origin']=='V2_NEW'])]:
        write_json(out/f'{name}.json', rows)
    for filename, title, rows in [('index.html','CMU V2 — Retained source candidates',keep),
        ('explore.html','CMU V2 — Explore, not retained',[m for m in motions if m['status']=='EXPLORE']),
        ('rejected.html','CMU V2 — Rejected sources and evidence',[m for m in motions if m['status']=='REJECT'])]:
        (out/filename).write_text(page(rows,title))
    overview=Image.new('RGB',(1440,1440),(22,27,38)); byid={m['sourceId']:m for m in motions}
    for i,(category,ids,reason) in enumerate(POCS):
        m=byid[ids[0]]; nodes,v,pos,dt=parse_bvh(out/m['file']); p=pos[1:]
        overview.paste(draw_pose(p[len(p)//2],nodes,bounds(p),f'{ids[0]} | {category} | SOURCE',(480,360)),(i%3*480,i//3*360))
    overview.save(out/'Retarget_POC_Overview.jpg',quality=92)
    shutil.copy2(repo/'docs/ANIMATION_LIBRARY_CURATION_V2.md',out/'README.md')
    scripts=out/'scripts'; scripts.mkdir(exist_ok=True)
    for p in (repo/'scripts/animation-library').glob('*.py'): shutil.copy2(p,scripts/p.name)
    # HTML local-link validation: no broken download/preview references.
    links=0
    for p in out.glob('*.html'):
        for link in re.findall(r'(?:href|src)="([^"]+)"',p.read_text()):
            assert (out/link).is_file(), f'Broken link: {p.name} -> {link}'
            links+=1
    for p in out.rglob('*.json'): json.loads(p.read_text())
    validation=dict(unitTestsPassed=test_count, sourceParseFinite=len(motions), pinnedBlobVerified=len(motions), sha256Verified=len(motions),
        sourceReferenceSampleExcluded=True, rawDataEdited=False, catalogSchema='PASS',
        videosFullDecodeChecked=sum('previewVideo' in m for m in motions), videoResolution=[640,480],
        videoPreviewFps=30, previewTimingErrorMaxSeconds=.07, htmlLinksChecked=links,
        contactSheets=len({m['contactSheet'] for m in motions}),
        visualReview='SOURCE_KEYPOSES_ONLY_NOT_ALL_VIDEOS_REALTIME_NOT_TARGET_ACCEPTANCE',
        noApplicationCodeChanged=True, applicationBuild='NOT_RUN_NO_APPLICATION_CHANGES')
    write_json(out/'validation.json',validation)
    checksums={str(p.relative_to(out)):hashlib.sha256(p.read_bytes()).hexdigest()
               for p in sorted(out.rglob('*')) if p.is_file() and p.suffix!='.zip' and p.name!='SHA256SUMS.json'}
    write_json(out/'SHA256SUMS.json',checksums)
    target=out/'Audition_Animation_Library_Curation_V2.zip'
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for relative in [*checksums,'SHA256SUMS.json']: z.write(out/relative,relative)
    with zipfile.ZipFile(target) as z: assert z.testzip() is None
    print(json.dumps(summary,indent=2)); print('ZIP CRC PASS',target,target.stat().st_size,flush=True)


if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('--out',type=Path,required=True); ap.add_argument('--repo',type=Path,required=True)
    a=ap.parse_args(); publish(a.out,a.repo)
