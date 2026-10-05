"""Job adapter around V2 primitives; heavy work runs only in Python worker.

No automatic cache fallback. Cache reuse requires exact source/range/lane/rig
and artifact hashes, and is explicitly labelled V2 (not a V2.1 solve).
"""
import argparse, hashlib, json, os, shutil, subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import cv2
import numpy as np
from scipy.ndimage import gaussian_filter1d
from motion_analyze import decode, write_json
from glb_io import GLB
from moonlight_bake import bake
from moonlight_pose import model, overlay
from moonlight_qa import writer, comparison_frame
from refine_v21 import refine
from validate_glb import inspect


def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def track(frames, box, out):
    out=Path(out);out.mkdir(parents=True,exist_ok=True);p=model(os.environ['MOTION_POSE_MODEL'])
    box=np.array(box,float);cx=(box[0]+box[2])/2;origin=cx;last=None;prev=None;xy=[];scores=[];boxes=[];rejected=[];tiles=[]
    width=max(box[2]-box[0],50)*.62
    for f,im in enumerate(frames):
        gray=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY);pred=last
        if last is not None and prev is not None:
            mask=np.zeros_like(gray);x,y=np.rint(last).astype(int);mask[max(0,y-13):min(360,y+13),max(0,x-12):min(480,x+12)]=255
            pp=cv2.goodFeaturesToTrack(prev,30,.01,2,mask=mask)
            if pp is not None:
                qq,st,_=cv2.calcOpticalFlowPyrLK(prev,gray,pp,None,winSize=(15,15),maxLevel=2)
                delta=(qq-pp).reshape(-1,2)[st.ravel()>0]
                if len(delta)>=3 and np.linalg.norm(np.median(delta,axis=0))<9: pred=last+np.median(delta,axis=0)
            cx=float(np.clip(pred[0],origin-85,origin+85))
        roi=[max(0,cx-width),max(0,box[1]-25),min(479,cx+width),min(359,box[3]+25)]
        pts,peak=p(im,bboxes=[roi]);pts=pts[0];peak=peak[0];conf=np.clip((peak-1.2)/4,0,1)
        distance=0 if pred is None else np.linalg.norm(pts[0]-pred)
        if distance>22:
            conf[:]=0;rejected.append(f);last=pred
        else: last=pts[0].copy() if pred is None else .8*pts[0]+.2*pred
        outside=(pts[:,0]<0)|(pts[:,0]>=480)|(pts[:,1]<0)|(pts[:,1]>=360);conf[outside]=0
        pts=np.clip(pts,[0,0],[479,359]);xy.append(pts);scores.append(conf);boxes.append(roi);prev=gray
        if f%30==0: tiles.append(overlay(im,pts,conf));print('RTMW frame',f,flush=True)
    xy=np.array(xy);scores=np.array(scores)
    np.savez_compressed(out/'rtmw.npz',xy=xy,confidence=scores,boxes=boxes,fps=30)
    cv2.imwrite(str(out/'pose-every30.jpg'),np.vstack(tiles))
    write_json(out/'tracking.json',dict(identityRejectedFrames=rejected,lowConfidenceFraction=float((scores[:,:17]<.35).mean()),
        warning='Bounded optical flow is not an identity guarantee during inversion/overlap; inspect overlay.'))
    return xy,scores


def reconstruct(xy,confidence,production,out):
    import torch
    from moonlight_reconstruct import robust_observations,h36m,fit,load_model
    torch.set_num_threads(2)
    p=Path(os.environ['MOTIONBERT_CHECKPOINT'])
    if sha(p)!='9811155371db4ca5d20f31a36a232d41012e12e1333882888a564d741861148f': raise ValueError('MOTIONBERT_CHECKPOINT_MISMATCH')
    m=load_model(os.environ['MOTIONBERT_REPO'],p);xy,c=robust_observations(xy,confidence)
    # The V2 unconstrained second-difference fit can overshoot long gaps. Use
    # bounded temporal interpolation only where observations are untrusted;
    # retain low confidence, and report these intervals (not recovered truth).
    for j in range(xy.shape[1]):
        good=c[:,j]>.35
        if good.sum()>=3:
            for axis in range(2):
                fill=np.interp(np.arange(len(xy)),np.where(good)[0],xy[good,j,axis])
                xy[~good,j,axis]=fill[~good]
                xy[:,j,axis]=np.clip(xy[:,j,axis],xy[good,j,axis].min()-3,xy[good,j,axis].max()+3)
    xy=np.clip(xy,[0,0],[479,359]);hx,hw=h36m(xy,c)
    heights=xy[:,[15,16],1].max(1)-xy[:,0,1];good=(heights>60)&(c[:,[0,15,16]].min(1)>.35)
    if good.sum()<3: raise ValueError('NO_UPRIGHT_SCALE_OBSERVATION')
    mpp=1.5/np.percentile(heights[good],85);n=len(xy);xyz=np.zeros((n,17,3));prior=xyz.copy();weight=np.zeros(n);errors=[]
    for a in range(0,n,160):
        b=min(n,a+220)
        if b-a<3:break
        solved,pr,rms=fit(m,hx[a:b],hw[a:b],mpp);blend=np.minimum(np.minimum(np.arange(b-a)+1,np.arange(b-a)[::-1]+1),20)
        xyz[a:b]+=solved*blend[:,None,None];prior[a:b]+=pr*blend[:,None,None];weight[a:b]+=blend;errors.append(rms)
    xyz/=weight[:,None,None];prior/=weight[:,None,None]
    points=np.zeros((n,33,3));uv=np.zeros((n,33,2));cw=np.zeros((n,33))
    for h,j in {9:0,11:11,14:12,12:13,15:14,13:15,16:16,4:23,1:24,5:25,2:26,6:27,3:28}.items():points[:,j]=xyz[:,h]
    cm={0:0,1:2,2:5,3:7,4:8,5:11,6:12,7:13,8:14,9:15,10:16,11:23,12:24,13:25,14:26,15:27,16:28,19:29,22:30,17:31,20:32,108:17,129:18,96:19,117:20,92:21,113:22}
    for cc,j in cm.items():uv[:,j]=xy[:,cc]/[480,360];cw[:,j]=c[:,cc]
    for j in [2,5,7,8,17,18,19,20,21,22,29,30,31,32]:
        base=27 if j in [29,31] else 28 if j in [30,32] else 15 if j in [17,19,21] else 16 if j in [18,20,22] else 0
        points[:,j]=points[:,base];points[:,j,:2]+=(uv[:,j]-uv[:,base])*[480,360]*mpp*[1,-1]
    rootxy=(hx[:,0]-np.median(hx[:,0],axis=0))*mpp*[1,-1]
    root_travel=float(np.ptp(rootxy[:,0]))
    if root_travel>4:raise ValueError('TRACKING_IDENTITY_NUMERIC_RUNAWAY')
    footy=xy[:,[15,16],1];rise=np.maximum(0,np.percentile(footy,80)-footy.max(1)-3)*mpp
    pelvisrise=np.maximum(0,rootxy[:,1]-np.percentile(rootxy[:,1],35)-.015)
    air=gaussian_filter1d(np.minimum(np.minimum(rise,pelvisrise),.25)*(c[:,[15,16]].min(1)>.45),1)
    np.savez_compressed(out,points=points,image=uv,confidence=cw,fps=30,rootxy=rootxy,airborne_height=air,
        wholebody_xy=xy,wholebody_confidence=c,production_slice=production,h36m_3d=xyz,motionbert_prior=prior)
    # A standing/feet-supported IK cannot faithfully solve sustained hand-supported inversion.
    inverted=(xy[:,[5,6],1].mean(1)>xy[:,[11,12],1].mean(1)+8)&(c[:,[5,6,11,12]].min(1)>.45)
    return dict(lowConfidenceFraction=float((c[:,:17]<.35).mean()),invertedFrames=int(inverted.sum()),
        trackingRootTravelFail=root_travel>2,observedPelvisTravelApproxMetres=root_travel,
        lowConfidenceIntervals={str(j):np.where(c[:,j]<.35)[0].tolist() for j in [7,8,9,10,13,14,15,16]},
        reprojectionRmsApproxMetres=float(np.mean(errors)),metresPerPixelAssumption=float(mpp),metricDepthValidated=False)


def cache_extract(req,motions,rigs,out):
    cache=Path(os.environ['MOTION_VERIFIED_CACHE']);man=json.loads((cache/'motion-source/source-manifest.json').read_text());hashes=json.loads((cache/'SHA256SUMS.json').read_text())
    def verified(rel):
        p=cache/rel
        if not p.is_file() or sha(p)!=hashes.get(rel):raise ValueError('CACHE_ARTIFACT_HASH_MISMATCH: '+rel)
        return p
    source_hash=sha(req['source']);mapping=[]
    for m in motions:
        old=next((x for x in man['motions'] if man['sources'][x['source_key']]['sha256']==source_hash and x['source_frame_range']==[m['startFrame'],m['endFrame']]),None)
        if m['type']!='normal' or not old or m['selectedDancer']!=('lane-1' if old['id'].endswith('008') else 'lane-3'):
            raise ValueError('VERIFIED_CACHE_MISS: exact normal source, range and dancer required; no fallback')
        mapping.append((m,old))
        for rel,dest in [('motion-source/'+old['id']+'.mp4','motion-source/'+m['id']+'.mp4'),('qa/'+old['id']+'-source-male-female.mp4','qa/'+m['id']+'-source-male-female.mp4')]:
            target=out/dest;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(verified(rel),target)
    for sex,rig in rigs.items():
        original=GLB(rig);cached=GLB(verified('models/'+sex+'_Astra_Moonlight_POC_V2.glb'))
        if cached.bin[:len(original.bin)]!=original.bin or cached.doc['nodes']!=original.doc['nodes']:raise ValueError('CACHE_RIG_MISMATCH')
        for m,old in mapping:
            anim=next(x for x in cached.doc['animations'] if x['name']==old['id']);rot={};hips=None;trans=None;times=None
            for ch in anim['channels']:
                s=anim['samplers'][ch['sampler']];times=cached.accessor(s['input']).ravel();values=cached.accessor(s['output']);node=ch['target']['node']
                if ch['target']['path']=='rotation':rot[node]=values
                elif ch['target']['path']=='translation':hips=node;trans=values
                else:raise ValueError('CACHE_UNSUPPORTED_CHANNEL')
            original.append_animation(m['id'],times,rot,hips,trans,{**anim['extras'],'sourceMotionId':m['sourceMotionId'],'motion_type':'normal','provenance':'verified-v2-cache','v21':False})
        original.write(out/'models'/f'{sex}_Astra_Motion.glb')


def quality_flags(m,models,reconstruction=None):
    warnings=['OWNER_VISUAL_REVIEW_REQUIRED','HAND_ELBOW_DEPTH_UNVERIFIED'];fail=False
    for qa in models:
        if not qa['structural_pass']:fail=True;warnings.append('STRUCTURAL_FAIL')
        a=next(x for x in qa['animations'] if x['name']==m['id'])
        if a['angular_warning']:warnings.append('ANGULAR_JERK')
        if (a.get('inferred_stance_xz_speed_p95_mps') or 0)>.3:warnings.append('FOOT_SKATING')
        if a['sampled_skinning_min_y_m']<-.01:warnings.append('MESH_GROUND_PENETRATION')
        if max(a['root_xyz_range'][0],a['root_xyz_range'][2])>1.25:fail=True;warnings.append('EXCESSIVE_LANE_TRAVEL')
    if reconstruction:
        if reconstruction['lowConfidenceFraction']>.25:warnings.append('LOW_CONFIDENCE')
        if reconstruction['lowConfidenceFraction']>.5 or reconstruction.get('trackingRootTravelFail'):
            fail=True;warnings.append('TRACKING_IDENTITY_FAIL_DIAGNOSTIC_ONLY')
        if reconstruction['invertedFrames']>8:fail=True;warnings.append('HAND_SUPPORTED_INVERSION_NOT_SOLVED')
    return dict(sourceMotionId=m['sourceMotionId'],variantId=m['id'],type=m['type'],qaStatus='FAIL' if fail else 'WARNING',warnings=sorted(set(warnings)),visualAccepted=False)


def render_outputs(out):
    rigs=['Nam','Nu']
    def render(sex):
        with (out/f'{sex}-render.log').open('w') as log:
            subprocess.run([os.environ['MOTION_BLENDER'],'-b','-t','4','--python-exit-code','1','-P',str(Path(__file__).with_name('render_blender.py')),'--','--v2','--threads','4','--glb',str(out/'models'/f'{sex}_Astra_Motion.glb'),'--manifest',str(out/'motion-source/source-manifest.json'),'--out',str(out/'render'/sex)],stdout=log,stderr=subprocess.STDOUT,check=True,timeout=7200)
    with ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(render,rigs))

def compare_outputs(out,frames,man):
    rigs=['Nam','Nu'];(out/'qa').mkdir(exist_ok=True)
    combined=writer(out/'qa/Combined_Review.mp4',2304,648)
    for m in man['motions']:
        a,b=m['source_frame_range'];x,y,w,h=m['crop_region'];proc=writer(out/'qa'/(m['id']+'-source-male-female.mp4'),2304,648);tiles=[]
        for f in range(b-a):
            ims=[cv2.imread(str(out/'render'/sex/m['id']/f'{f:04}.png')) for sex in rigs]
            if any(im is None for im in ims):raise ValueError('MISSING_REAL_RENDER')
            row=comparison_frame(frames[a+f,y:y+h,x:x+w],*ims,m,f);proc.stdin.write(row.tobytes());combined.stdin.write(row.tobytes())
            if f in np.linspace(0,b-a-1,8,dtype=int):tiles.append(row)
        proc.stdin.close();assert proc.wait()==0;cv2.imwrite(str(out/'qa'/(m['id']+'-keyposes.jpg')),np.vstack(tiles))
    combined.stdin.close();assert combined.wait()==0

def finish_outputs(req,motions,rigs,out,mode,rec):
    models=[inspect(rig,out/'models'/f'{sex}_Astra_Motion.glb') for sex,rig in rigs.items()]
    for q in models:
        if {x['name'] for x in q['animations']}!={m['id'] for m in motions}:raise ValueError('CLIP_SET_MISMATCH')
    for q,(sex,_) in zip(models,rigs.items()):
        for anim in q['animations']:
            diag=out/'models'/f'{sex}_Astra_Motion-diagnostics'/(anim['name']+'.solve.npz')
            target=out/'targets'/(anim['name']+'-targets.npz')
            if diag.exists() and target.exists():
                d=np.load(diag);a,b=np.load(target)['production_slice'];feet=d['solved_feet'][a:b];c=d['contacts'][a:b]
                speed=np.linalg.norm(np.diff(feet[:,:,[0,2]],axis=0)*30,axis=2);stance=speed[c[:-1]&c[1:]]
                anim['inferred_stance_xz_speed_p95_mps']=float(np.percentile(stance,95)) if len(stance) else None
                anim['sole_min_y_m']=float((d['sole_min_y_before']+d['sole_lift'])[a:b].min())
    results=[quality_flags(m,models,rec.get(m['id'])) for m in motions]
    qa=dict(schemaVersion=1,models=models,motions=results,provenance='verified V2 cache; NOT a V2.1 reconstruction' if mode=='verified-cache' else 'RTMW + temporal MotionBERT/reprojection + V2.1 target-owned IK',ownerVisualAcceptance='PENDING',productionAccepted=False)
    write_json(out/'qa/technical-qa.json',qa)
    metadata=dict(schemaVersion=1,sourceSha256=sha(req['source']),sourceFilename=Path(req['source']).name,mode=mode,motions=[{**m,**r, 'sourceRange':dict(startFrame=m['startFrame'],endFrame=m['endFrame'],fps=30)} for m,r in zip(motions,results)],gameplayIntegration=False)
    write_json(out/'Metadata.json',metadata)
    import zipfile
    with zipfile.ZipFile(out/'QA.zip','w',zipfile.ZIP_DEFLATED) as z:
        for p in sorted((out/'qa').rglob('*')):
            if p.is_file():z.write(p,p.relative_to(out))
    with zipfile.ZipFile(out/'Artifacts.zip','w',zipfile.ZIP_DEFLATED) as z:
        for folder in ['models','qa','motion-source','targets','pose']:
            for p in sorted((out/folder).rglob('*')):
                if p.is_file():z.write(p,p.relative_to(out))
        z.write(out/'Metadata.json','Metadata.json')
    with zipfile.ZipFile(out/'Artifacts.zip') as z:assert z.testzip() is None
    files=[str(p.relative_to(out)) for p in out.rglob('*') if p.is_file() and (p.suffix in ['.mp4','.glb','.json','.zip','.jpg']) and 'render' not in p.parts and '-diagnostics' not in str(p)]
    result=dict(motions=results,files=sorted(files),provenance=qa['provenance']);write_json(out/'result.json',result);write_json(out/'progress.json',dict(stage='completed',percent=100));return result


def run(req,out):
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    def progress(stage,percent):write_json(out/'progress.json',dict(stage=stage,percent=percent))
    motions=[];counts={}
    for x in req['motions']:
        if not x.get('include'):continue
        if x['type'] not in ['normal','finish'] or not x.get('reviewed') or not x.get('bothBoundariesObserved'):raise ValueError('REVIEW_REQUIRED')
        counts[x['type']]=counts.get(x['type'],0)+1;mid=('finish-special' if x['type']=='finish' else 'normal-space')+f'-{counts[x["type"]]:03}'
        motions.append({**x,'id':mid})
    if not motions:raise ValueError('NO_SELECTED_MOTIONS')
    rigs={'Nam':os.environ['MOTION_MALE_RIG'],'Nu':os.environ['MOTION_FEMALE_RIG']};rec={}
    for d in ['models','motion-source','targets','qa']: (out/d).mkdir(exist_ok=True)
    mode=req.get('mode','pipeline')
    progress('prepare',5)
    if mode=='verified-cache':cache_extract(req,motions,rigs,out)
    elif mode=='pipeline':
        frames,source_meta=decode(req['source']);man=dict(motions=[])
        for k,m in enumerate(motions):
            a,b=m['startFrame'],m['endFrame'];lo=max(0,a-18);hi=min(len(frames),b+18)
            if not 0<a<b<len(frames):raise ValueError('INCOMPLETE_BOUNDARY')
            lane=next(x for x in req['lanes'] if x['id']==m['selectedDancer']);box=lane['box']
            progress('RTMW '+m['id'],10+int(20*k/len(motions)))
            xy,conf=track(frames[lo:hi],box,out/'pose'/m['id'])
            target=out/'targets'/(m['id']+'-targets.npz');rec[m['id']]=reconstruct(xy,conf,[a-lo,b-lo],target)
            refine(target,target)
            # Full observed bounding envelope, padded. No hands/feet cropped by a fixed Moonlight ROI.
            valid=xy[(conf>.35)];mins=np.maximum(np.floor(valid.min(0)-18),[0,0]).astype(int);maxs=np.minimum(np.ceil(valid.max(0)+18),[480,360]).astype(int)
            mins=np.minimum(mins,np.maximum(np.floor(np.array(box[:2])-25),[0,0]).astype(int));maxs=np.maximum(maxs,np.minimum(np.ceil(np.array(box[2:])+25),[480,360]).astype(int))
            x,y=mins;w,h=maxs-mins;w=max(2,w//2*2);h=max(2,h//2*2)
            proc=writer(out/'motion-source'/(m['id']+'.mp4'),w,h)
            for im in frames[a:b]:proc.stdin.write(np.ascontiguousarray(im[y:y+h,x:x+w]).tobytes())
            proc.stdin.close();assert proc.wait()==0
            man['motions'].append(dict(id=m['id'],sourceMotionId=m['sourceMotionId'],type=m['type'],complete=True,source_clip=source_meta['filename'],source_key='uploaded',
                source_frame_range=[a,b],source_timestamp_range=[a/30,b/30],duration_seconds=(b-a)/30,working_frame_range=[lo,hi],production_within_working_frames=[a-lo,b-lo],
                selected_dancer=m['selectedDancer'],crop_region=[int(x),int(y),int(w),int(h)],boundary_evidence=m.get('evidenceNote'),confidence=m['boundaryConfidence']))
        man['source']=source_meta;write_json(out/'motion-source/source-manifest.json',man);write_json(out/'targets/reconstruction.json',rec)
        progress('independent target IK',45)
        for sex,rig in rigs.items():bake(rig,out/'targets',out/'motion-source/source-manifest.json',out/'models'/f'{sex}_Astra_Motion.glb',v21=True)
        progress('Blender real-mesh QA',65)
        render_outputs(out)
        compare_outputs(out,frames,man)
    else:raise ValueError('UNKNOWN_EXTRACTION_MODE')
    progress('technical QA',90)
    return finish_outputs(req,motions,rigs,out,mode,rec)


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--request',required=True);ap.add_argument('--out',required=True);a=ap.parse_args()
    run(json.loads(Path(a.request).read_text()),Path(a.out).resolve())
