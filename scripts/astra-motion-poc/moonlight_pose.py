"""RTMW whole-body top-down observations, with a bounded single-lane tracker.

Raw SimCC peaks are retained. Weights are a heuristic, NOT calibrated probabilities.
"""
import argparse, json, time
from pathlib import Path
import cv2
import numpy as np
import onnxruntime as ort
from rtmlib import RTMPose
from moonlight_source import decode

EDGES=[(5,6),(5,7),(7,9),(6,8),(8,10),(5,11),(6,12),(11,12),(11,13),(13,15),(12,14),(14,16),(0,5),(0,6),(15,17),(16,20)]

def model(path):
    p=RTMPose.__new__(RTMPose);opts=ort.SessionOptions();opts.intra_op_num_threads=4;opts.inter_op_num_threads=1
    p.session=ort.InferenceSession(str(path),sess_options=opts,providers=['CPUExecutionProvider'])
    p.model_input_size=(288,384);p.mean=np.array([123.675,116.28,103.53]);p.std=np.array([58.395,57.12,57.375])
    p.backend='onnxruntime';p.device='cpu';p.to_openpose=False;return p

def overlay(im,xy,confidence):
    im=cv2.resize(im,(960,720));p=xy*2
    for a,b in EDGES:
        if np.isfinite(p[[a,b]]).all():cv2.line(im,tuple(p[a].astype(int)),tuple(p[b].astype(int)),(255,180,30),2,cv2.LINE_AA)
    for j in range(23):
        if np.isfinite(p[j]).all():cv2.circle(im,tuple(p[j].astype(int)),4,(60,255,80) if confidence[j]>.45 else (0,80,255),-1)
    return im

def run(source,out,model_path,first=False):
    out=Path(out);out.parent.mkdir(parents=True,exist_ok=True);frames,fps=decode(source);p=model(model_path);n=len(frames)
    xy=np.full((n,133,2),np.nan,np.float32);peaks=np.full((n,133),np.nan,np.float32);boxes=np.full((n,4),np.nan,np.float32)
    cx=85. if first else 184.;start=616 if first else 0;t=time.time()
    for i in range(start,n):
        box=[cx-36,132,cx+36,276] if first else [cx-55,112,cx+55,276]
        points,scores=p(frames[i],bboxes=[box]);xy[i]=points[0];peaks[i]=scores[0];boxes[i]=box
        weights=np.clip((scores[0]-1.2)/4,0,1);jj=np.array([5,6,11,12]);good=weights[jj]>.42
        if good.sum()>=3:
            aim=points[0,jj[good],0].mean();cx+=np.clip(aim-cx,-2,2)*.4;cx=float(np.clip(cx,45 if first else 155,110 if first else 225))
        if i%60==0:print(out.name,i,round(time.time()-t,1),flush=True)
    conf=np.clip((peaks-1.2)/4,0,1)
    np.savez_compressed(out,xy=xy,confidence=conf,raw_simcc_peaks=peaks,boxes=boxes,fps=fps)
    diag=out.parent/(out.stem+'-diagnostics');diag.mkdir(exist_ok=True)
    indices=[620,650,680,700,720,730] if first else [100,200,300,360,450,550,650,700,720]
    for i in indices:cv2.imwrite(str(diag/f'{i:04}.jpg'),overlay(frames[i],xy[i],conf[i]))
    report=dict(backend='RTMW x-l 384x288, rtmlib 0.0.13, ONNX CPU',source=Path(source).name,frames=n,processed_frame_range=[start,n],lane='first' if first else 'third',weight_mapping='clip((raw SimCC peak - 1.2)/4,0,1); heuristic, not probability',seconds=time.time()-t)
    out.with_suffix('.json').write_text(json.dumps(report,indent=2)+'\n')

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--source',required=True);ap.add_argument('--out',required=True);ap.add_argument('--model',required=True);ap.add_argument('--first',action='store_true');a=ap.parse_args();run(a.source,a.out,a.model,a.first)
