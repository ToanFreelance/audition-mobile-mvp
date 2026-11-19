#!/usr/bin/env python3
"""Verify local Mixamo→M3 pilot clips. Zero third-party dependencies."""
import argparse, json, math
from pathlib import Path

REQUIRED = ('hips','spine','chest','upper_chest','neck','head',
    'shoulder.L','upper_arm.L','lower_arm.L','hand.L',
    'shoulder.R','upper_arm.R','lower_arm.R','hand.R',
    'upper_leg.L','lower_leg.L','foot.L','upper_leg.R','lower_leg.R','foot.R')

def validate(path):
    data=json.loads(Path(path).read_text())
    n=data['sourceFrameCount'];fps=data['fps'];errors=[]
    assert fps==30 and n>3
    assert data['lastFrame']==n-1
    assert data.get('motionOwner')=='mixamo-full-body'
    for k in REQUIRED:
        if k not in data['tracks']:errors.append('missing '+k)
    if 'hips.position' not in data['tracks']:errors.append('missing hips.position')
    max_delta=0
    for name,t in data['tracks'].items():
        values=t['values'];dims=3 if name=='hips.position' else 4
        if len(values)!=n*dims:errors.append(f'{name} key count wrong');continue
        if t['frames']!=list(range(n)):errors.append(f'{name} wrong frames')
        for v in values:
            if not math.isfinite(v):errors.append(f'{name} non-finite');break
        if dims==4:
            prev=None
            for i in range(0,len(values),4):
                q=values[i:i+4];norm=sum(x*x for x in q)
                if abs(norm-1)>1e-4:errors.append(f'{name} quaternion not unit at {i//4}')
                if prev is not None and sum(a*b for a,b in zip(q,prev))<0:errors.append(f'{name} quaternion discontinuity')
                prev=q
    return {'clip':data['id'],'frames':n,'seconds':round(n/fps,3),'tracks':len(data['tracks']),'errors':sorted(set(errors))}

def main():
    p=argparse.ArgumentParser();p.add_argument('files',nargs='+');args=p.parse_args()
    results=[validate(path) for path in args.files]
    for r in results:print(json.dumps(r))
    assert not any(r['errors'] for r in results),'Validation failed'

if __name__=='__main__':main()