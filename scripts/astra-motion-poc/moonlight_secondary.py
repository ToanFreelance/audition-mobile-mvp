"""Same-source MediaPipe Heavy baseline; never used to drive V2 reconstruction."""
import argparse,json
from pathlib import Path
import cv2,numpy as np,mediapipe as mp
from moonlight_source import decode

def run(sources,manifest,model,out):
    out=Path(out);out.mkdir(parents=True,exist_ok=True);man=json.loads(Path(manifest).read_text());frames={k:decode(Path(sources)/v['file'])[0] for k,v in man['sources'].items()};reports=[]
    for m in man['motions']:
        lo,hi=m['working_frame_range'];a,b=m['source_frame_range'];crop=m['crop_region'];x,y,w,h=crop;raw=np.full((hi-lo,33,5),np.nan,np.float32)
        options=mp.tasks.vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(model)),running_mode=mp.tasks.vision.RunningMode.VIDEO,num_poses=1,min_pose_detection_confidence=.5,min_pose_presence_confidence=.5,min_tracking_confidence=.5)
        with mp.tasks.vision.PoseLandmarker.create_from_options(options) as landmarker:
            for i in range(lo,hi):
                im=frames[m['source_key']][i,y:y+h,x:x+w];im=cv2.resize(im,(w*2,h*2));im=cv2.cvtColor(im,cv2.COLOR_BGR2RGB)
                r=landmarker.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB,data=im),round((i-lo)*1000/30))
                if r.pose_landmarks:
                    raw[i-lo]=[[q.x*w+x,q.y*h+y,q.z,q.visibility,q.presence] for q in r.pose_landmarks[0]]
        np.savez_compressed(out/(m['id']+'-mediapipe.npz'),image=raw,source_frames=np.arange(lo,hi),fps=30)
        prod=raw[a-lo:b-lo];valid=np.isfinite(prod[:,0,0]);wrist=prod[:,[15,16],3]
        item=dict(id=m['id'],detected=int(valid.sum()),total=b-a,missing_source_frames=(np.where(~valid)[0]+a).tolist(),wrist_visibility_mean=float(np.nanmean(wrist)) if np.isfinite(wrist).any() else None)
        reports.append(item);print(json.dumps(item),flush=True)
    (out/'comparison-baseline.json').write_text(json.dumps(dict(backend='MediaPipe Heavy 0.10.21, secondary same-source baseline only',motions=reports),indent=2)+'\n')

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    for n in ['sources','manifest','model','out']:ap.add_argument('--'+n,required=True)
    run(**vars(ap.parse_args()))
