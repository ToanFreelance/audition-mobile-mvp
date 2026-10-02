"""Reviewed source ingest, per-frame HUD evidence, crops, and raw body observations."""
import argparse
import csv
import hashlib
import json
import subprocess
from pathlib import Path
import cv2
import numpy as np

EXPECTED_SHA = '2053019b214366a12f9c507e2ee2157c267db3ce7d693796f89e37a7b592568b'
CROP = [155, 170, 190, 235]
EDGES = [(11,12),(11,13),(13,15),(12,14),(14,16),(11,23),(12,24),(23,24),(23,25),(25,27),(24,26),(26,28),(27,31),(28,32),(0,11),(0,12)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', required=True)
    ap.add_argument('--model', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--input-scale', type=int, default=2)
    args = ap.parse_args()
    out = Path(args.out)
    for sub in ['motion-source', 'tracks', 'qa']:
        (out / sub).mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(Path(args.source).read_bytes()).hexdigest()
    if digest != EXPECTED_SHA:
        raise ValueError('This reviewed crop/ROI applies only to exact POC source. Review a new manifest first.')
    cap = cv2.VideoCapture(args.source)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frames, signals, boundaries = [], [], []
    while True:
        ok, im = cap.read()
        if not ok:
            break
        hsv = cv2.cvtColor(im[187:218, 204:303], cv2.COLOR_BGR2HSV)
        count = int(np.sum((hsv[:,:,0] >= 130) & (hsv[:,:,0] <= 175) & (hsv[:,:,1] > 120) & (hsv[:,:,2] > 160)))
        f = len(frames)
        signals.append([f, f/fps, count])
        if count >= 200 and (f == 0 or signals[-2][2] < 200) and (not boundaries or f-boundaries[-1] > 60):
            boundaries.append(f)
        frames.append(im)
    cap.release()
    assert len(frames) == 281 and fps == 30 and frames[0].shape[:2] == (512,910)
    assert boundaries == [4,138,273], boundaries
    with (out/'tracks/hud-frame-signals.csv').open('w') as f:
        w = csv.writer(f); w.writerow(['frame','seconds','magenta_pixels']); w.writerows(signals)
    motions = []
    for i, (start,end) in enumerate(zip(boundaries, boundaries[1:]+[len(frames)]),1):
        mid = f'audition-space-{i:03d}'
        lo, hi = max(0,start-6), min(len(frames),end+6)
        m = dict(id=mid, source_frame_range=[start,end], production_seconds=[start/fps,end/fps],
                 working_frame_range=[lo,hi], working_seconds=[lo/fps,hi/fps],
                 production_relative_to_working_seconds=[(start-lo)/fps,(end-lo)/fps],
                 observed_duration=(end-start)/fps, complete=i<3,
                 end_boundary_status='next_judgement' if i<3 else 'EOF_not_semantic_end',
                 confidence=dict(judgement_frame='high', animation_activation='medium', depth='low'),
                 start_pose_evidence=f'{mid}-boundary.jpg', selected_dancer='far-left striped brown top',
                 occlusions='Self-occlusion during turns; judgement near head; no guaranteed palm/finger depth.')
        motions.append(m)
        for suffix,a,b in [('',start,end),('-solver-padding',lo,hi)]:
            vf = f'trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS,crop=190:235:155:170:exact=1,pad=190:236:0:0'
            subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',args.source,'-vf',vf,'-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'motion-source'/f'{mid}{suffix}.mp4')],check=True)
        panels=[]
        for f in sorted(set([max(0,start-1),start,min(end-1,start+1),max(start,end-2),end-1])):
            im=cv2.resize(frames[f][170:405,155:345],(380,470))
            cv2.putText(im,f'frame {f} / {f/fps:.3f}s',(8,25),cv2.FONT_HERSHEY_SIMPLEX,.6,(0,255,255),2)
            panels.append(im)
        cv2.imwrite(str(out/'motion-source'/f'{mid}-boundary.jpg'),np.hstack(panels))
    manifest = dict(schema_version=1,source_filename=Path(args.source).name,source_sha256=digest,
                    fps=fps,frames=len(frames),width=910,height=512,usable_video_duration=len(frames)/fps,
                    crop_xywh=CROP, judgement_roi_xywh=[204,187,99,31],onset_frames=boundaries,
                    lane_inventory=dict(reference_frame=12,player_lane_x_approx=[250,350,450,550,650],
                        selected_lane=1,foreground_actor_x_approx=385,
                        notes='Five player lanes plus a foreground actor overlapping lanes 2/3. Lane 1 has least surrounding-actor/HUD interference.'),
                    source_context='Basketball court; NOT Spain Moonlight beach source',
                    full_source_offset_seconds=None, full_source_status='XZvLqpfM1eo unavailable: repeated transfer HTTP 502',
                    hud_bpm=107, observed_spacing_beats_at_hud_bpm=[(138-4)/30*107/60,(273-138)/30*107/60],
                    timing_note='About 8 HUD beats; playback speed unverified. Do not force 4-beat trim or alter runtime.',
                    boundary_note='Judgement onset is observed; animation event latency is not directly observable.',
                    production_complete=False,motions=motions)
    (out/'motion-source/source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'boundaries':boundaries,'source':manifest['source_context']}),flush=True)

    import mediapipe as mp
    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=args.model),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,num_poses=1,
        min_pose_detection_confidence=.5,min_pose_presence_confidence=.5,min_tracking_confidence=.5)
    raw = np.full((len(frames),33,5),np.nan)
    world = np.full((len(frames),33,3),np.nan)
    writer = cv2.VideoWriter(str(out/'tracks/raw-overlay.mp4'),cv2.VideoWriter_fourcc(*'mp4v'),fps,(380,470))
    with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
        for f, im in enumerate(frames):
            crop=im[170:405,155:345]
            rgb=cv2.cvtColor(cv2.resize(crop,(190*args.input_scale,235*args.input_scale),interpolation=cv2.INTER_CUBIC),cv2.COLOR_BGR2RGB)
            result=detector.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB,data=rgb),round(f*1000/fps))
            overlay=cv2.resize(crop,(380,470))
            if result.pose_landmarks:
                raw[f]=[[p.x,p.y,p.z,p.visibility,p.presence] for p in result.pose_landmarks[0]]
                world[f]=[[p.x,p.y,p.z] for p in result.pose_world_landmarks[0]]
                xy=(raw[f,:,:2]*[380,470]).astype(int)
                for a,b in EDGES:
                    cv2.line(overlay,tuple(xy[a]),tuple(xy[b]),(80,255,80),2)
                for p in xy:
                    cv2.circle(overlay,tuple(p),3,(0,80,255),-1)
            cv2.putText(overlay,f'raw frame {f}',(8,22),cv2.FONT_HERSHEY_SIMPLEX,.6,(0,255,255),2)
            writer.write(overlay)
            if f%30==0:
                print(f'Pose {f}/{len(frames)}',flush=True)
    writer.release()
    np.savez_compressed(out/'tracks/raw_pose.npz',image=raw,world=world,fps=fps,crop=CROP)
    summary=dict(model='MediaPipe Pose Landmarker Heavy VIDEO',input_scale=args.input_scale,model_sha256=hashlib.sha256(Path(args.model).read_bytes()).hexdigest(),
                 frames=len(frames),detected_frames=int(np.isfinite(world[:,0,0]).sum()),
                 mean_visibility=np.nanmean(raw[:,:,3],axis=0).tolist(),
                 raw_data_note='NaN is retained for missing observations, not written to animation.')
    (out/'tracks/pose-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(out/'tracks/raw-overlay.mp4'),'-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'qa/pose-2d-overlay.mp4')],check=True)


if __name__=='__main__':
    main()
