"""Portable pose tracks, environment/input inspection, 3D diagnostic projections."""
import argparse
import gzip
import hashlib
import importlib.metadata
import json
import subprocess
from pathlib import Path
import cv2
import numpy as np
from glb_io import GLB
from extract_pose import EDGES


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);ap.add_argument('--rigs',nargs='+',required=True)
    args=ap.parse_args();out=Path(args.out);raw=np.load(out/'tracks/raw_pose.npz');target=np.load(out/'tracks/temporal_targets.npz')
    def safe(a):
        a=a.astype(object);a[~np.isfinite(a.astype(float))]=None;return a.tolist()
    for name,data in [('pose-2d-raw',dict(image_landmarks=safe(raw['image']),fields=['x','y','z','visibility','presence'],
                        missing_value=None,crop_xywh=raw['crop'].tolist(),fps=float(raw['fps']),landmark_indexing='MediaPipe Pose 33')),
                      ('pose-3d-temporal',dict(points=target['points'].tolist(),confidence=target['confidence'].tolist(),
                        coordinate_system='glTF Y up; metres approximate; hip centred',fps=float(target['fps']),landmark_indexing='MediaPipe Pose 33'))]:
        with gzip.open(out/'tracks'/f'{name}.json.gz','wt') as f:json.dump(data,f,allow_nan=False,separators=(',',':'))
    rigs=[]
    for path in args.rigs:
        g=GLB(path);rest=g.fk();skin=g.doc['skins'][0];joints=skin['joints']
        ibm=g.accessor(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
        rigs.append(dict(filename=Path(path).name,bytes=Path(path).stat().st_size,sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest(),
            joints=len(joints),animations=[a['name'] for a in g.doc.get('animations',[])],
            inverse_bind_max_error=max(float(np.max(np.abs(rest[j]@m-np.eye(4)))) for j,m in zip(joints,ibm)),
            joint_positions={g.doc['nodes'][j]['name']:rest[j][:3,3].tolist() for j in joints},
            use='clean-bind reference only' if 'TPOSE_v2' in str(path) else 'actual animated target'))
    env={p:importlib.metadata.version(p) for p in ['numpy','scipy','opencv-contrib-python','mediapipe','protobuf']}
    (out/'qa/input-environment-inspection.json').write_text(json.dumps(dict(rigs=rigs,python_libraries=env,blender='4.5.3 LTS CPU',
        high_confidence_crop_normalized_bounds=[np.nanmin(raw['image'][:,:,:2][raw['image'][:,:,3]>.5],axis=0).tolist(),
                                               np.nanmax(raw['image'][:,:,:2][raw['image'][:,:,3]>.5],axis=0).tolist()]),indent=2)+'\n')
    # Exact 3D point projections for depth QA; not an animation substitute.
    dest=out/'qa/pose-3d-projections-raw.mp4';wr=cv2.VideoWriter(str(dest),cv2.VideoWriter_fourcc(*'mp4v'),30,(960,540))
    for frame,p in enumerate(target['points']):
        im=np.full((540,960,3),25,np.uint8)
        for offset,axes,label in [(0,[0,1],'3D FRONT (X/Y)'),(480,[2,1],'3D SIDE (Z/Y)')]:
            xy=(p[:,axes]*[230,-230]+[offset+240,250]).astype(int)
            for a,b in EDGES:cv2.line(im,tuple(xy[a]),tuple(xy[b]),(100,220,130),2)
            for j in [11,13,15,23,25,27]:cv2.circle(im,tuple(xy[j]),4,(0,150,255),-1)
            cv2.putText(im,label,(offset+18,32),cv2.FONT_HERSHEY_SIMPLEX,.65,(235,235,235),1)
        cv2.putText(im,f'Frame {frame} | inferred depth, hip-centred | orange = anatomical left',(15,516),cv2.FONT_HERSHEY_SIMPLEX,.58,(0,210,255),1)
        wr.write(im)
    wr.release()
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(dest),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'qa/pose-3d-projections.mp4')],check=True)


if __name__=='__main__':main()
