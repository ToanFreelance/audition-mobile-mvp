#!/usr/bin/env python3
"""V1.9: source-video 2D landmark tracking and measurable M3 reprojection.

This is NOT exact 3D motion capture. Missing/occluded joints are never fabricated.
Requires Python 3.11, mediapipe 0.10.21, opencv-python and numpy for 'track'.
'compare' and tests require only cv2 and numpy.
"""
from __future__ import annotations
import argparse
import csv
import json
from pathlib import Path
import cv2
import numpy as np

SEGMENTS={"F03":(25.60,33.23),"M03":(82.20,88.63)}
JOINTS={"left_shoulder":11,"right_shoulder":12,"left_elbow":13,"right_elbow":14,
        "left_wrist":15,"right_wrist":16,"left_hip":23,"right_hip":24,
        "left_knee":25,"right_knee":26,"left_ankle":27,"right_ankle":28}
ANCHORS=("left_shoulder","right_shoulder","left_hip","right_hip")
BONES=[("left_shoulder","right_shoulder"),("left_shoulder","left_elbow"),
("right_shoulder","right_elbow"),("left_elbow","left_wrist"),
("right_elbow","right_wrist"),("left_shoulder","left_hip"),
("right_shoulder","right_hip"),("left_hip","right_hip"),
("left_hip","left_knee"),("right_hip","right_knee"),
("left_knee","left_ankle"),("right_knee","right_ankle")]

def store(path, payload):
    path=Path(path)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(payload,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")

def render_pose(image,joints,color,label=""):
    for a,b in BONES:
        if a in joints and b in joints:
            p,q=joints[a],joints[b]
            cv2.line(image,(round(p[0]),round(p[1])),(round(q[0]),round(q[1])),color,2,cv2.LINE_AA)
    for p in joints.values():
        cv2.circle(image,(round(p[0]),round(p[1])),3,color,-1,cv2.LINE_AA)
    if label:
        cv2.putText(image,label,(10,24),cv2.FONT_HERSHEY_SIMPLEX,.55,(255,255,255),2,cv2.LINE_AA)

def video_writer(path, fps, size):
    path.parent.mkdir(parents=True,exist_ok=True)
    writer=cv2.VideoWriter(str(path),cv2.VideoWriter_fourcc(*"mp4v"),fps,size)
    if not writer.isOpened():
        raise RuntimeError("Cannot write video "+str(path))
    return writer

def track(args):
    import mediapipe as mp
    capture=cv2.VideoCapture(str(args.video))
    if not capture.isOpened(): raise FileNotFoundError(args.video)
    fps=float(capture.get(cv2.CAP_PROP_FPS))
    w=int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    h=int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    roi=tuple(map(int,args.roi.split(",")))
    if len(roi)!=4: raise ValueError("ROI must be x,y,width,height")
    x,y,cw,ch=roi
    if x<0 or y<0 or cw<80 or ch<80 or x+cw>w or y+ch>h:
        raise ValueError("Invalid or out-of-bounds crop")
    start,end=SEGMENTS[args.clip]
    first,last=round(start*fps),round(end*fps)
    capture.set(cv2.CAP_PROP_POS_FRAMES,first)
    out=None
    if args.overlay: out=video_writer(args.overlay,fps,(w,h))
    frames=[]
    # The previous V1.7 pipeline used MediaPipe Solutions (0.10.21).
    # Newer universal Python wheels expose the Tasks PoseLandmarker API.
    # Both return the same 33 landmark indices; do not substitute manual keys.
    if hasattr(mp,"solutions"):
        detector=mp.solutions.pose.Pose(model_complexity=2,smooth_landmarks=False,
            min_detection_confidence=.45,min_tracking_confidence=.45)
        def detect(rgb,frame_index):
            result=detector.process(rgb)
            return result.pose_landmarks.landmark if result.pose_landmarks else []
        backend="mediapipe.solutions.pose"
    else:
        if not args.model or not args.model.is_file():
            raise ValueError("This MediaPipe version requires --model pose_landmarker_full.task")
        vision=mp.tasks.vision
        detector=vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(args.model)),
            running_mode=vision.RunningMode.VIDEO,num_poses=1,
            min_pose_detection_confidence=.45,min_tracking_confidence=.45))
        def detect(rgb,frame_index):
            image=mp.Image(image_format=mp.ImageFormat.SRGB,data=np.ascontiguousarray(rgb))
            result=detector.detect_for_video(image,round(frame_index*1000/fps))
            return result.pose_landmarks[0] if result.pose_landmarks else []
        backend="mediapipe.tasks.pose_landmarker"
    try:
        with detector:
            for ix in range(first,last+1):
                ok,frame=capture.read()
                if not ok: raise ValueError("Source video ended before frame "+str(ix))
                rgb=cv2.cvtColor(frame[y:y+ch,x:x+cw],cv2.COLOR_BGR2RGB)
                landmarks=detect(rgb,ix-first)
                joints={}
                for name,index in JOINTS.items():
                    if index>=len(landmarks): continue
                    p=landmarks[index]
                    if p.visibility>=args.confidence and np.isfinite([p.x,p.y]).all():
                        joints[name]=[round(x+p.x*cw,4),round(y+p.y*ch,4),round(p.visibility,4)]
                sample={"frame":ix,"time":round((ix-first)/fps,6),"joints":joints}
                frames.append(sample)
                if out:
                    render_pose(frame,joints,(0,255,255),
                         f"SOURCE {args.clip} {sample['time']:.2f}s visible {len(joints)}/12")
                    out.write(frame)
    finally:
        capture.release()
        if out: out.release()
    result={"schema":"m3-v19-2d","clip":args.clip,"kind":"source","fps":fps,
      "width":w,"height":h,"source_start":start,"crop":list(roi),
      "confidence_threshold":args.confidence,"backend":backend,"frames":frames}
    store(args.output,result)
    print(json.dumps({"clip":args.clip,"frames":len(frames),
      "coverage":{name:round(sum(name in f["joints"] for f in frames)/len(frames),3)
      for name in JOINTS}},indent=2))

def pt(frame,name,threshold):
    value=frame.get("joints",{}).get(name)
    if not value or len(value)<3 or value[2]<threshold: return None
    value=np.asarray(value[:2],dtype=float)
    return value if np.isfinite(value).all() else None

def describe(a):
    if not a: return {"n":0,"mean":None,"p50":None,"p95":None,"max":None}
    a=np.asarray(a,dtype=float)
    return {"n":len(a),"mean":float(a.mean()),"p50":float(np.percentile(a,50)),
      "p95":float(np.percentile(a,95)),"max":float(a.max())}

def compare(source,target,confidence=.6):
    if source.get("schema")!="m3-v19-2d" or target.get("schema")!="m3-v19-2d":
        raise ValueError("Unrecognized 2D landmark format")
    if source["clip"]!=target["clip"] or abs(source["fps"]-target["fps"])>1e-5:
        raise ValueError("Source and rendered clip/fps mismatch")
    a,b=source["frames"],target["frames"]
    if len(a)!=len(b): raise ValueError("Clip frame counts differ")
    for s,t in zip(a,b):
        if abs(s["time"]-t["time"])>.5/source["fps"]:
            raise ValueError("Clip timestamps are not aligned")
    ref=[]; moved=[]
    for s,t in list(zip(a,b))[:30]:
        for name in ANCHORS:
            sp,tp=pt(s,name,confidence),pt(t,name,confidence)
            if sp is not None and tp is not None:
                ref.append(sp); moved.append(tp)
    if len(ref)<12: raise ValueError("Insufficient source/tracked shoulders and hips")
    source_array,target_array=np.array(ref),np.array(moved)
    source_center,target_center=source_array.mean(axis=0),target_array.mean(axis=0)
    s,t=source_array-source_center,target_array-target_center
    u,_,vt=np.linalg.svd(t.T @ s)
    rotation=u@np.diag([1,np.linalg.det(u@vt)])@vt
    scale=float(np.sum((t@rotation)*s)/np.sum(t*t))
    if not 0.01<scale<100: raise ValueError("Invalid fixed camera calibration")
    translation=source_center-(target_center@rotation)*scale
    # The same transform applies to every frame, NEVER fit each frame independently.
    torso=[]
    for frame in a:
        points=[pt(frame,n,confidence) for n in ANCHORS]
        if all(p is not None for p in points):
            ls,rs,lh,rh=points
            torso.append(float(np.linalg.norm((ls+rs)/2-(lh+rh)/2)))
    if not torso: raise ValueError("No visible source torso")
    divisor=float(np.median(torso))
    if divisor<4: raise ValueError("Source torso too small")
    errors={name:[] for name in JOINTS}
    velocities={name:[] for name in JOINTS}
    prev={}
    per_frame=[]
    for s,t in zip(a,b):
        aligned={}
        measures={}
        for name in JOINTS:
            sp,tp=pt(s,name,confidence),pt(t,name,confidence)
            if sp is None or tp is None:
                prev.pop(name,None)
                continue
            p=tp@rotation*scale+translation
            dist=float(np.linalg.norm(sp-p))
            errors[name].append(dist)
            aligned[name]=[float(p[0]),float(p[1]),1.0]
            measures[name]=dist
            if name in prev:
                old_time,old_s,old_p=prev[name]
                dt=s["time"]-old_time
                if 0<dt<=1.5/source["fps"]:
                    velocities[name].append(float(np.linalg.norm((sp-old_s-p+old_p)/dt)))
            prev[name]=(s["time"],sp,p)
        per_frame.append({"frame":s["frame"],"time":s["time"],
                          "error_px":measures,"m3_aligned":aligned})
    values=[v for row in errors.values() for v in row]
    report={"schema":"m3-v19-metrics","status":"2D_REPROJECTION_ONLY",
      "clip":source["clip"],"frames":len(a),
      "camera_calibration":{"mode":"one_fixed_similarity_fit_first_30_frames",
       "scale":scale,"rotation":rotation.tolist(),"translation":translation.tolist()},
      "source_torso_px":divisor,
      "coverage":{name:round(len(v)/len(a),3) for name,v in errors.items()},
      "error_px":describe(values),"error_torso_normalized":describe([v/divisor for v in values]),
      "per_joint_px":{name:describe(v) for name,v in errors.items()},
      "velocity_error_px_per_sec":{name:describe(v) for name,v in velocities.items()},
      "limitations":["This score measures observable 2D pose only, not 3D fidelity",
        "Single-camera depth and occluded joints are ambiguous",
        "Source anime and M3 bone pivot locations are not anatomically identical",
        "No per-frame camera re-registration is permitted",
        "Clothing, fingers and hair are not assessed by these 12 joints"]}
    return report,per_frame

def score(args):
    source=json.loads(args.source.read_text())
    target=json.loads(args.target.read_text())
    report,frames=compare(source,target,args.confidence)
    store(args.output,report)
    if args.csv:
        args.csv.parent.mkdir(parents=True,exist_ok=True)
        with args.csv.open("w",newline="",encoding="utf-8") as out:
            writer=csv.writer(out)
            writer.writerow(["frame","time_s","joint","error_px","error_torso_normalized"])
            for row in frames:
                for name,value in row["error_px"].items():
                    writer.writerow([row["frame"],row["time"],name,round(value,6),
                                     round(value/report["source_torso_px"],6)])
    if args.overlay:
        cap=cv2.VideoCapture(str(args.video)) if args.video else None
        if cap and not cap.isOpened(): raise FileNotFoundError(args.video)
        out=video_writer(args.overlay,source["fps"],(source["width"],source["height"]))
        if cap: cap.set(cv2.CAP_PROP_POS_FRAMES,source["frames"][0]["frame"])
        try:
            for ref,frame in zip(source["frames"],frames):
                if cap:
                    ok,image=cap.read()
                    if not ok: raise ValueError("Truncated original video")
                else: image=np.zeros((source["height"],source["width"],3),np.uint8)
                render_pose(image,ref["joints"],(0,240,255),
                         f"{source['clip']} {ref['time']:.2f}s source yellow / M3 blue")
                render_pose(image,frame["m3_aligned"],(255,155,30))
                out.write(image)
        finally:
            if cap: cap.release()
            out.release()
    print(json.dumps({"clip":report["clip"],"error_px":report["error_px"],
                      "coverage":report["coverage"]},indent=2))

def main():
    cli=argparse.ArgumentParser(description=__doc__)
    sub=cli.add_subparsers(dest="mode",required=True)
    a=sub.add_parser("track")
    a.add_argument("--video",type=Path,required=True)
    a.add_argument("--clip",choices=SEGMENTS,required=True)
    a.add_argument("--roi",default="300,110,315,375")
    a.add_argument("--model",type=Path,help="MediaPipe Tasks pose_landmarker_full.task (newer versions)")
    a.add_argument("--confidence",type=float,default=.6)
    a.add_argument("--output",type=Path,required=True)
    a.add_argument("--overlay",type=Path)
    a.set_defaults(run=track)
    a=sub.add_parser("compare")
    a.add_argument("--source",type=Path,required=True)
    a.add_argument("--target",type=Path,required=True)
    a.add_argument("--output",type=Path,required=True)
    a.add_argument("--csv",type=Path)
    a.add_argument("--overlay",type=Path)
    a.add_argument("--video",type=Path)
    a.add_argument("--confidence",type=float,default=.6)
    a.set_defaults(run=score)
    args=cli.parse_args()
    if not 0<args.confidence<=1: cli.error("Invalid confidence")
    args.run(args)

if __name__=="__main__":
    main()
