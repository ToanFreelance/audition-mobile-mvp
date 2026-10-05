"""Resume real-mesh QA from verified bake checkpoints, without rerunning mocap."""
import argparse,json,os
from pathlib import Path
import numpy as np
from motion_analyze import decode,write_json
from motion_extract import sha,render_outputs,compare_outputs,finish_outputs
from moonlight_qa import writer
from validate_glb import inspect
from glb_io import GLB


def resume(out,source,render=True):
    out=Path(out).resolve();req=json.loads((out/'request.json').read_text())
    man=json.loads((out/'motion-source/source-manifest.json').read_text())
    if sha(source)!=man['source']['sha256']:raise ValueError('RESUME_SOURCE_HASH_MISMATCH')
    req['source']=str(Path(source).resolve());rigs={'Nam':os.environ['MOTION_MALE_RIG'],'Nu':os.environ['MOTION_FEMALE_RIG']}
    motions=[]
    for m in man['motions']:
        original=next(x for x in req['motions'] if x['sourceMotionId']==m['sourceMotionId'])
        if [original['startFrame'],original['endFrame']]!=m['source_frame_range']:raise ValueError('RESUME_RANGE_MISMATCH')
        motions.append({**original,'id':m['id']})
    for sex,rig in rigs.items():
        qa=inspect(rig,out/'models'/f'{sex}_Astra_Motion.glb')
        if not qa['structural_pass'] or {a['name'] for a in qa['animations']}!={m['id'] for m in motions}:raise ValueError('RESUME_GLB_QA_FAIL')
        appended=[a for a in GLB(out/'models'/f'{sex}_Astra_Motion.glb').doc['animations'] if a['name'] in {m['id'] for m in motions}]
        for a in appended:
            m=next(m for m in motions if m['id']==a['name'])
            if a['extras']['source_frames_half_open']!=[m['startFrame'],m['endFrame']]:raise ValueError('RESUME_ANIMATION_RANGE_MISMATCH')
    frames,_=decode(source)
    for m in man['motions']:
        raw=np.load(out/'pose'/m['id']/'rtmw.npz');valid=raw['xy'][raw['confidence']>.35]
        lane=next(x for x in req['lanes'] if x['id']==m['selected_dancer']);box=np.array(lane['box'])
        mins=np.maximum(np.minimum(np.floor(valid.min(0)-18),np.floor(box[:2]-25)),[0,0]).astype(int)
        maxs=np.minimum(np.maximum(np.ceil(valid.max(0)+18),np.ceil(box[2:]+25)),[480,360]).astype(int)
        x,y=mins;w,h=(maxs-mins)//2*2;m['crop_region']=[int(x),int(y),int(w),int(h)]
        proc=writer(out/'motion-source'/(m['id']+'.mp4'),int(w),int(h));a,b=m['source_frame_range']
        for im in frames[a:b]:proc.stdin.write(np.ascontiguousarray(im[y:y+h,x:x+w]).tobytes())
        proc.stdin.close();assert proc.wait()==0
    write_json(out/'motion-source/source-manifest.json',man);write_json(out/'request.json',req)
    if render:render_outputs(out)
    compare_outputs(out,frames,man)
    rec=json.loads((out/'targets/reconstruction.json').read_text())
    result=finish_outputs(req,motions,rigs,out,'pipeline',rec)
    print(json.dumps(result['motions'],indent=2),flush=True)


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);ap.add_argument('--source',required=True);ap.add_argument('--skip-render',action='store_true')
    a=ap.parse_args();resume(a.out,a.source,not a.skip_render)
