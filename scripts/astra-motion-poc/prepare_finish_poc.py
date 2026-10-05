"""Hash-gated reviewed Finish recipe, deliberately separate from generic detection."""
import argparse,json
from pathlib import Path
import cv2,numpy as np
from motion_analyze import decode,write_json
from motion_extract import run


def prepare(source,analysis,out,execute=False):
    frames,meta=decode(source);out=Path(out);out.mkdir(parents=True,exist_ok=True)
    if meta['sha256']!='f0cbfd442c40fd5ad86ec623312791d2bcc7d2f548cb961e6d0ec1be70421fd4':raise ValueError('SOURCE_IDENTITY_FAIL')
    a=json.loads(Path(analysis).read_text())
    if 29 not in a['events'] or 283 not in a['events']:raise ValueError('EXPECTED_BOUNDARY_EVIDENCE_NOT_DETECTED')
    images=[]
    for f in [27,28,29,30,31,35,50,70,100,130,160,190,220,239,250,280,281,282,283,284]:
        im=frames[f].copy();cv2.putText(im,f'frame {f} | {f/30:.3f}s',(8,20),0,.5,(0,255,255),1);images.append(im)
    cv2.imwrite(str(out/'Finish-boundary-evidence.jpg'),np.vstack([np.hstack(images[i:i+4]) for i in range(0,len(images),4)]))
    selected=next(m for m in a['motions'] if m['startFrame']==29 and m['endFrame']==283)
    selected.update(type='finish',include=True,reviewed=True,selectedDancer='lane-1',boundaryConfidence=.95,
        evidenceNote='Moonlight tropical stage; command disappears at 29, magenta judgement; FINISH banner 35-75; next judgement 283. +/-1 frame. Body upright ~240 is not semantic end.',
        warnings=selected['warnings']+['FLOOR_INVERSION','NPC_OVERLAP','HAND_SUPPORT_SOLVER_UNSUPPORTED'])
    request=dict(schemaVersion=1,source=str(Path(source).resolve()),mode='pipeline',motions=[selected],lanes=a['lanes'])
    write_json(out/'request.json',request)
    write_json(out/'Finish-source-boundary.json',dict(source=meta,sourceFrameRange=[29,283],sourceSeconds=[29/30,283/30],fullSourceSeconds=[165+29/30,165+283/30],duration=254/30,
        fullSourceWindow=[165,185],complete=True,confidence=.95,uncertaintyFrames=1,selectedDancer='first blonde NPC / lane-1',sourceIdentity='MOONLIGHT_CONFIRMED',visualAccepted=False))
    if execute:run(request,out)


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--source',required=True);ap.add_argument('--analysis',required=True);ap.add_argument('--out',required=True);ap.add_argument('--execute',action='store_true')
    prepare(**vars(ap.parse_args()))
