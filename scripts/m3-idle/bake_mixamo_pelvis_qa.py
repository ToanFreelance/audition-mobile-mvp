#!/usr/bin/env python3
"""Reproducible, QA-only shared-contact translation for Bored on native M3 rigs.
Inputs are owner-supplied animation-only Mixamo FBX and rig body VRMs. Do NOT ship
those source files or copy them to public GitHub. Output ONLY 2D hip offsets.
"""
import argparse, base64, json, sys
from pathlib import Path
import numpy as np
from scipy.ndimage import gaussian_filter1d
from mixamo_retarget_pilot import parse_animation, parse_vrm, retarget, validation

CAP = .024 # meters max; 2.4 cm
STRENGTH=.85
SMOOTH_SIGMA=4 # frames
TAPER_FRAMES=12 # 400ms
SOURCE_FPS=30
CONTACT_ELEVATION=.028


def analyze(rig_path, fbx_path, family):
    source,names,count=parse_animation(fbx_path)
    target=parse_vrm(rig_path)
    motion,world,hips=retarget(source,names,count,target,'bored',str(fbx_path),family)
    positions,_,problems=validation(motion,world,hips,target)
    if problems: raise ValueError(problems)
    if count != 321: raise ValueError('Unexpected Bored FBX length: '+str(count))
    feet=np.stack([positions['foot.L'][1],positions['foot.R'][1]])
    xz=feet[:,:,[0,2]]
    common=gaussian_filter1d(xz.mean(axis=0)-xz[:,0,:].mean(axis=0),SMOOTH_SIGMA,axis=0)
    envelope=np.clip(np.minimum(np.arange(count),np.arange(count)[::-1])/TAPER_FRAMES,0,1)[:,None]
    correction=-STRENGTH*common*envelope
    magnitude=np.maximum(np.linalg.norm(correction,axis=1,keepdims=True),1e-12)
    correction*=np.minimum(1,CAP/magnitude)
    correction[0]=0;correction[-1]=0
    quantized=np.round(correction*10000).astype('<i2') # 0.1mm precision
    reconstructed=quantized.astype(float)/10000
    near=(feet[:,:,1]-np.percentile(feet[:,:,1],5,axis=1)[:,None]) < CONTACT_ELEVATION
    old=np.linalg.norm(np.diff(xz,axis=1),axis=2)
    new=np.linalg.norm(np.diff(xz+reconstructed[None,:,:],axis=1),axis=2)
    old_path=(old*near[:,:-1]).sum(axis=1)
    new_path=(new*near[:,:-1]).sum(axis=1)
    metrics={
        'rig':family, 'clip':'bored','frames':count,'sourceFps':SOURCE_FPS,
        'beforeNearFloorPathCm':[round(float(v*100),2) for v in old_path],
        'afterNearFloorPathCm':[round(float(v*100),2) for v in new_path],
        'reductionPct':[round(float((1-new_path[i]/old_path[i])*100),1) for i in range(2)],
        'maxOffsetCm':round(float(np.linalg.norm(reconstructed,axis=1).max()*100),2),
        'maxOffsetStepMm':round(float(np.linalg.norm(np.diff(reconstructed,axis=0),axis=1).max()*1000),2),
        'firstOffset':reconstructed[0].tolist(),'lastOffset':reconstructed[-1].tolist(),
        'rotationsModified':False,'pelvisYModified':False,'footIK':False,
        'limitations':'Ankle-joint FK proxy, not actual sole mesh contacts; no crossfade timing assertions here.',
    }
    assert metrics['maxOffsetCm']<=2.401
    assert all(val>25 for val in metrics['reductionPct'])
    assert metrics['maxOffsetStepMm'] < 3.5
    return base64.b64encode(quantized.tobytes()).decode('ascii'),metrics

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--fbx',required=True);p.add_argument('--female-vrm',required=True);p.add_argument('--male-vrm',required=True);p.add_argument('--output',required=True)
    a=p.parse_args();
    female,fm=analyze(a.female_vrm,a.fbx,'drophunter');male,mm=analyze(a.male_vrm,a.fbx,'neurohacker')
    source='''/** QA-only, baked 2D pelvis displacement correction for Mixamo Bored.\n * Computed from owner-provided FBX on M3 rig, not authored limb rotations.\n * Data are signed little-endian int16 X/Z offsets in 0.1mm units at 30 FPS.\n * This is NOT a replacement for manual visual QA or a stepping animation.\n */\n\nexport type StabilizationRig = "drophunter" | "neurohacker";\nexport const BORED_PELVIS_FRAMES = 321;\nexport const BORED_PELVIS_CAP_METERS = 0.024;\nconst PACKED: Record<StabilizationRig, string> = {\n  drophunter: "'''+female+'''",\n  neurohacker: "'''+male+'''",\n};\n\nconst cache = new Map<StabilizationRig, Int16Array>();\nfunction curve(rig: StabilizationRig): Int16Array {\n  const cached=cache.get(rig);\n  if (cached) return cached;\n  const encoded=atob(PACKED[rig]);\n  if (encoded.length !== BORED_PELVIS_FRAMES * 2 * 2) throw new Error("Corrupt pelvis correction");\n  const view=new DataView(new ArrayBuffer(encoded.length));\n  for (let i=0;i<encoded.length;i++) view.setUint8(i,encoded.charCodeAt(i));\n  const data=new Int16Array(BORED_PELVIS_FRAMES*2);\n  for (let i=0;i<data.length;i++) data[i]=view.getInt16(i*2,true);\n  cache.set(rig,data);\n  return data;\n}\n\n/** Only adjust hip translation X/Z of Bored, after source retarget, before creating its clip. */\nexport function applyBoredPelvisCorrection(\n  rig: StabilizationRig, gesture: string, positions: Float32Array, frames: number,\n): boolean {\n  if (gesture !== "bored") return false;\n  if (frames !== BORED_PELVIS_FRAMES || positions.length !== frames*3)\n    throw new Error("Unexpected Bored animation sample count");\n  const data=curve(rig);\n  for (let frame=0;frame<frames;frame++) {\n    positions[frame*3]+=data[frame*2]/10000;\n    positions[frame*3+2]+=data[frame*2+1]/10000;\n  }\n  return true;\n}\n\nexport function getBoredPelvisOffset(rig: StabilizationRig, frame: number): readonly [number,number] {\n  if (!Number.isInteger(frame) || frame<0 || frame>=BORED_PELVIS_FRAMES) throw new RangeError("Invalid frame");\n  const d=curve(rig);\n  return [d[frame*2]/10000,d[frame*2+1]/10000];\n}\n'''
    Path(a.output).write_text(source)
    Path(a.output).with_suffix('.metrics.json').write_text(json.dumps([fm,mm],indent=2))
    print(json.dumps([fm,mm],indent=2))