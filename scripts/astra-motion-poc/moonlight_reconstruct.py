"""RTMW -> learned temporal MotionBERT prior -> weighted reprojection/length fit.

Monocular depth is inferred, not metric ground truth. Uncertain observations retain
their low confidence; fitting does not promote them to trusted measurements.
"""
import argparse, hashlib, json, sys
from functools import partial
from pathlib import Path
import cv2
import numpy as np
from scipy.ndimage import gaussian_filter1d, median_filter
import torch
from torch import nn
from temporal_targets import smooth
from moonlight_source import decode

HEDGES=[(0,1),(1,2),(2,3),(0,4),(4,5),(5,6),(0,7),(7,8),(8,9),(9,10),(8,11),(11,12),(12,13),(8,14),(14,15),(15,16)]
FLIP=[0,4,5,6,1,2,3,7,8,9,10,14,15,16,11,12,13]

def camera_registration(frames):
    mask=np.zeros(frames.shape[1:3],np.uint8);mask[35:120,10:420]=255;mask[292:329,100:370]=255
    transforms=[np.eye(3)];ratios=[1.];prev=cv2.cvtColor(frames[0],cv2.COLOR_BGR2GRAY)
    for im in frames[1:]:
        cur=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY);p=cv2.goodFeaturesToTrack(prev,180,.01,7,mask=mask);step=np.eye(3);ratio=0.
        if p is not None:
            q,st,_=cv2.calcOpticalFlowPyrLK(prev,cur,p,None,winSize=(19,19),maxLevel=2);ok=st.ravel()>0
            if ok.sum()>=8:
                a,inside=cv2.estimateAffinePartial2D(p[ok],q[ok],method=cv2.RANSAC,ransacReprojThreshold=1.5)
                if a is not None:
                    ratio=float(inside.mean())
                    if ratio>.6 and .97<np.linalg.det(a[:,:2])<1.03 and np.linalg.norm(a[:,2])<8:step[:2]=a
        transforms.append(step@transforms[-1]);ratios.append(ratio);prev=cur
    return np.array(transforms),np.array(ratios)

def robust_observations(xy,weights):
    weights=np.nan_to_num(weights).copy();med=median_filter(xy,size=(5,1,1),mode='nearest');res=np.linalg.norm(xy-med,axis=2)
    weights[(res>10)&(weights<.8)]=0;weights[weights<.12]=0
    # Whole-body auxiliaries may be unsupported. Keep zero confidence, interpolate
    # finite observations solely to allow the array adapter; do not invent a pose.
    support=(weights>0).sum(axis=0)>=3;out=np.zeros_like(xy)
    out[:,support]=smooth(xy[:,support],weights[:,support],2)
    for j in np.where(~support)[0]:
        for c in range(2):
            valid=np.isfinite(xy[:,j,c]);out[:,j,c]=np.interp(np.arange(len(xy)),np.where(valid)[0],xy[valid,j,c]) if valid.any() else 0
    res=np.linalg.norm(out-xy,axis=2);weights*=np.minimum(1,8/np.maximum(res,1e-4))**2
    out[:,support]=smooth(xy[:,support],weights[:,support],2)
    weights[:,~support]=0;return out,weights

def h36m(xy,w):
    x=np.zeros((len(xy),17,2));c=np.zeros((len(xy),17))
    for h,j in {1:12,2:14,3:16,4:11,5:13,6:15,9:0,11:5,12:7,13:9,14:6,15:8,16:10}.items():x[:,h]=xy[:,j];c[:,h]=w[:,j]
    for h,j in [(0,[11,12]),(8,[5,6]),(10,[1,2])]:x[:,h]=xy[:,j].mean(1);c[:,h]=w[:,j].mean(1)
    x[:,7]=(x[:,0]+x[:,8])/2;c[:,7]=(c[:,0]+c[:,8])/2;x[:,10]+=.6*(x[:,10]-x[:,9])
    return x,c

def load_model(repo,checkpoint):
    sys.path.insert(0,str(Path(repo).resolve()));from lib.model.DSTformer import DSTformer
    m=DSTformer(dim_feat=256,dim_rep=512,depth=5,num_heads=8,mlp_ratio=4,maxlen=243,num_joints=17,norm_layer=partial(nn.LayerNorm,eps=1e-6))
    state=torch.load(checkpoint,map_location='cpu',weights_only=True)['model_pos'];m.load_state_dict({k.removeprefix('module.'):v for k,v in state.items()},strict=True)
    return m.eval()

def fit(m,xy,w,mpp):
    center=np.median(xy[:,0],axis=0);span=max(np.ptp(xy[w>.3],axis=0).max(),60);inp=np.concatenate([(xy-center)/(span/2),w[...,None]],axis=2).astype('float32')
    with torch.no_grad():
        pred=m(torch.from_numpy(inp)[None])[0].numpy();flip=inp[:,FLIP].copy();flip[:,:,0]*=-1
        pf=m(torch.from_numpy(flip)[None])[0].numpy()[:,FLIP];pf[:,:,0]*=-1;pred=(pred+pf)/2
    pred-=pred[:,[0]];obs=(xy-xy[:,[0]])*mpp
    scale=float((pred[:,:,:2]*obs*w[...,None]).sum()/max((pred[:,:,:2]**2*w[...,None]).sum(),1e-8));pred*=scale
    init=pred.copy();init[:,:,:2]=.8*obs+.2*init[:,:,:2]
    aa=np.array([a for a,b in HEDGES]);bb=np.array([b for a,b in HEDGES]);length=np.median(np.linalg.norm(pred[:,bb]-pred[:,aa],axis=2),axis=0)
    for a,b in [(0,3),(1,4),(2,5),(10,13),(11,14),(12,15)]:length[[a,b]]=length[[a,b]].mean()
    x=torch.tensor(init,dtype=torch.float32,requires_grad=True);prior=torch.tensor(pred,dtype=torch.float32);o=torch.tensor(obs,dtype=torch.float32);ww=torch.tensor(w,dtype=torch.float32);ll=torch.tensor(length,dtype=torch.float32)
    opt=torch.optim.Adam([x],lr=.004)
    for _ in range(160):
        repro=((x[:,:,:2]-o)**2*ww[...,None]).mean();depth=((x[:,:,2]-prior[:,:,2])**2).mean()
        lengths=((torch.linalg.vector_norm(x[:,bb]-x[:,aa],dim=2)-ll)**2).mean();acc=((x[2:]-2*x[1:-1]+x[:-2])**2).mean()
        loss=30*repro+1.2*depth+30*lengths+3*acc+20*(x[:,0]**2).mean();opt.zero_grad();loss.backward();opt.step()
    xyz=x.detach().numpy();xyz-=xyz[:,[0]];rms=float(np.sqrt(((xyz[:,:,:2]-obs)**2*w[...,None]).sum()/max(2*w.sum(),1)))
    return xyz*np.array([1,-1,-1]),pred*np.array([1,-1,-1]),rms

def reconstruct(sources,pose,manifest,model_repo,checkpoint,out):
    torch.set_num_threads(4);torch.set_num_interop_threads(1);model=load_model(model_repo,checkpoint);out=Path(out);out.mkdir(parents=True,exist_ok=True)
    man=json.loads(Path(manifest).read_text());cams={};report=[]
    for key in ['A','B']:
        frames,_=decode(Path(sources)/man['sources'][key]['file']);cams[key]=camera_registration(frames)
        np.savez_compressed(out/f'{key}-camera.npz',transforms=cams[key][0],inlier_ratio=cams[key][1])
    for motion in man['motions']:
        key=motion['source_key'];lo,hi=motion['working_frame_range'];a,b=motion['source_frame_range'];raw=np.load(Path(pose)/motion['pose_track'])
        xy,conf=robust_observations(raw['xy'][lo:hi],raw['confidence'][lo:hi]);cam=cams[key][0][lo:hi]
        xycam=np.einsum('nij,nkj->nki',np.linalg.inv(cam),np.concatenate([xy,np.ones((*xy.shape[:2],1))],axis=2))[:,:,:2]
        hx,hw=h36m(xycam,conf);height=np.percentile(np.max(xycam[:,[15,16],1],axis=1)-xycam[:,0,1],75);mpp=1.5/max(height,60)
        xyz,prior,rms=fit(model,hx,hw,mpp);n=len(xy);points=np.zeros((n,33,3));uv=np.zeros((n,33,2));cw=np.zeros((n,33))
        hm={9:0,11:11,14:12,12:13,15:14,13:15,16:16,4:23,1:24,5:25,2:26,6:27,3:28}
        for h,j in hm.items():points[:,j]=xyz[:,h]
        cm={0:0,1:2,2:5,3:7,4:8,5:11,6:12,7:13,8:14,9:15,10:16,11:23,12:24,13:25,14:26,15:27,16:28,19:29,22:30,17:31,20:32,108:17,129:18,96:19,117:20,92:21,113:22}
        for c,j in cm.items():uv[:,j]=xycam[:,c]/[480,360];cw[:,j]=conf[:,c]
        for j in [2,5,7,8,17,18,19,20,21,22,29,30,31,32]:
            base=27 if j in [29,31] else 28 if j in [30,32] else 15 if j in [17,19,21] else 16 if j in [18,20,22] else 0
            delta=(uv[:,j]-uv[:,base])*[480,360]*mpp*[1,-1];points[:,j]=points[:,base];points[:,j,:2]+=delta
        rootxy=(hx[:,0]-np.median(hx[:,0],axis=0))*mpp*[1,-1]
        footy=xycam[:,[15,16],1];ground=np.percentile(footy,80);rise=np.maximum(0,ground-footy.max(1)-3)*mpp
        pelvisrise=np.maximum(0,rootxy[:,1]-np.percentile(rootxy[:,1],35)-.015)
        ankle=xy[:,[15,16]];hud=((ankle[:,:,0]>110)&(ankle[:,:,0]<330)&(ankle[:,:,1]>230)&(ankle[:,:,1]<256)).any(1)
        trust=(conf[:,[15,16]].min(1)>.45)&~hud;air=gaussian_filter1d(np.minimum(np.minimum(rise,pelvisrise),.16)*trust,1)
        np.savez_compressed(out/(motion['id']+'-targets.npz'),points=points,image=uv,confidence=cw,fps=30,source_frames=np.arange(lo,hi),rootxy=rootxy,airborne_height=air,wholebody_xy=xy,wholebody_confidence=conf,h36m_3d=xyz,motionbert_prior=prior,camera_compensated_xy=xycam,production_slice=[a-lo,b-lo],crop=[0,0,480,360])
        sl=slice(a-lo,b-lo);entry=dict(id=motion['id'],reprojection_weighted_rms_approx_m=rms,metres_per_pixel_assumption=mpp,pelvis_y_range=float(np.ptp(rootxy[sl,1])),airborne_height_max=float(air[sl].max()),body_low_confidence_fraction=float((conf[sl,:17]<.35).mean()),
          low_confidence_source_frames={name:(np.where(conf[sl,j]<.35)[0]+a).tolist() for name,j in [('left_wrist',9),('right_wrist',10),('left_elbow',7),('right_elbow',8),('left_ankle',15),('right_ankle',16)]},camera_inlier_median=float(np.median(cams[key][1][lo:hi])))
        report.append(entry);print(json.dumps(entry),flush=True)
    result=dict(backend='RTMW x-l wholebody + MotionBERT lite H36M temporal prior + weighted reprojection, bone length and acceleration optimization',checkpoint_sha256=hashlib.sha256(Path(checkpoint).read_bytes()).hexdigest(),motions=report,
        limitations=['Monocular depth is inferred and not metrically validated.','Nominal source body scale is 1.50 m; target uses its own bone lengths.','Head and palm extra points have only observed XY plus parent depth; fingers are not reconstructed.','Low confidence remains flagged after temporal interpolation.','Camera registration is a background affine approximation.'])
    (out/'reconstruction.json').write_text(json.dumps(result,indent=2)+'\n')

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    for name in ['sources','pose','manifest','model-repo','checkpoint','out']:ap.add_argument('--'+name,required=True)
    a=ap.parse_args();reconstruct(**vars(a))
