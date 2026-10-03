"""Honest 2D/3D diagnostic videos; not substitutes for actual-mesh visual QA."""
import argparse,json
from pathlib import Path
import cv2,numpy as np
from moonlight_source import decode
from moonlight_qa import writer

# Diagnostic topology only: do not import heavyweight inference backends when
# reviewing saved NPZ tracks after a workspace/dependency reset.
EDGES=[(5,6),(5,7),(7,9),(6,8),(8,10),(5,11),(6,12),(11,12),(11,13),(13,15),(12,14),(14,16),(0,5),(0,6),(15,17),(16,20)]
HEDGES=[(0,1),(1,2),(2,3),(0,4),(4,5),(5,6),(0,7),(7,8),(8,9),(9,10),(8,11),(11,12),(12,13),(8,14),(14,15),(15,16)]

def crop_panel(frame,crop,xy=None,confidence=None,mp=False):
    x,y,w,h=crop;im=cv2.resize(frame[y:y+h,x:x+w],(384,576));scale=np.array([384/w,576/h])
    if xy is None:return im
    points=(xy-[x,y])*scale;edges=[(11,12),(11,13),(13,15),(12,14),(14,16),(11,23),(12,24),(23,24),(23,25),(25,27),(24,26),(26,28)] if mp else EDGES
    for a,b in edges:
        if np.isfinite(points[[a,b]]).all():cv2.line(im,tuple(points[a].astype(int)),tuple(points[b].astype(int)),(230,160,60),2,cv2.LINE_AA)
    for j in sorted(set(j for e in edges for j in e)):
        if np.isfinite(points[j]).all():cv2.circle(im,tuple(points[j].astype(int)),4,(50,240,70) if confidence[j]>.35 else (0,80,255),-1)
    if not np.isfinite(points).any():cv2.putText(im,'MISSING',(60,280),0,1,(0,0,255),3)
    return im

def skeleton(points,side=False):
    out=np.full((576,384,3),30,np.uint8);xy=points[:,[2,1]] if side else points[:,:2];p=xy*[210,-210]+[192,300]
    for a,b in HEDGES:cv2.line(out,tuple(p[a].astype(int)),tuple(p[b].astype(int)),(170,220,230),3,cv2.LINE_AA)
    for j,v in enumerate(p):cv2.circle(out,tuple(v.astype(int)),4,(255,120,50) if j in [1,2,3,14,15,16] else (50,210,120),-1)
    return out

def run(sources,artifacts):
    root=Path(artifacts);out=root/'qa';out.mkdir(exist_ok=True);man=json.loads((root/'motion-source/source-manifest.json').read_text());frames={k:decode(Path(sources)/v['file'])[0] for k,v in man['sources'].items()};cmp=[]
    video=writer(out/'Moonlight_V2_Pose_Diagnostics.mp4',1536,640)
    try:
        for m in man['motions']:
            raw=np.load(root/'pose'/m['pose_track']);target=np.load(root/'targets'/(m['id']+'-targets.npz'));lo,hi=m['working_frame_range'];a,b=m['source_frame_range'];mp=np.load(root/'secondary'/(m['id']+'-mediapipe.npz'))['image']
            for f in range(a,b):
                frame=frames[m['source_key']][f];local=f-lo;im=np.full((640,1536,3),24,np.uint8)
                panels=[crop_panel(frame,m['crop_region']),crop_panel(frame,m['crop_region'],raw['xy'][f],raw['confidence'][f]),skeleton(target['h36m_3d'][local]),skeleton(target['h36m_3d'][local],True)]
                im[32:608]=np.hstack(panels)
                for i,label in enumerate(['SOURCE','RTMW observations','Temporal 3D front','Temporal 3D side']):cv2.putText(im,label,(384*i+10,22),0,.5,(255,255,255),1,cv2.LINE_AA)
                cv2.putText(im,f"{m['id']} | {m['source_key']}:{f} | red = low confidence | monocular depth unvalidated",(10,630),0,.65,(240,240,240),1,cv2.LINE_AA);video.stdin.write(im.tobytes())
            selected=[int(z) for z in np.linspace(a,b-1,5)]
            if m['id'].endswith('003'):selected=[315,340,360,365,390]
            if m['id'].endswith('008'):selected=[640,665,690,715,720]
            tiles=[]
            for f in selected:
                frame=frames[m['source_key']][f];obs=mp[f-lo];row=np.hstack([crop_panel(frame,m['crop_region']),crop_panel(frame,m['crop_region'],raw['xy'][f],raw['confidence'][f]),crop_panel(frame,m['crop_region'],obs[:,:2],obs[:,3],True)])
                cv2.putText(row,f'{m["id"]} {f}: SOURCE | RTMW | MediaPipe',(8,24),0,.6,(0,255,255),2);tiles.append(row)
            cv2.imwrite(str(out/(m['id']+'-pose-backend-comparison.jpg')),np.vstack(tiles))
    finally:video.stdin.close();assert video.wait()==0

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--sources',required=True);ap.add_argument('--artifacts',required=True);run(**vars(ap.parse_args()))
