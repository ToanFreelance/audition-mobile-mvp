"""Reviewed Moonlight V2 source manifest, evidence and exact half-open crops.

Events were visually reviewed; HSV is corroborating evidence, not an auto-acceptor.
Never substitutes the V1 source coordinates or synthesizes EOF boundaries.
"""
import argparse, csv, hashlib, json, subprocess
from pathlib import Path
import cv2
import numpy as np

EVENTS = {'A': [86,188,290,391,492,746], 'B': [76,177,431,532,634,735]}
SOURCE_SHA256={'A':'e42a08c2d96501b1fd7a1d5494405fdd9ffd26736f9555bfbf870e0108f2c381',
               'B':'e9cc3f44c1375cfab9438893289fb1acc8dc3ba566f3efff94b3e94d2e754397'}
RANGES = [('A',86,188),('A',188,290),('A',290,391),('A',391,492),
          ('B',76,177),('B',431,532),('B',532,634),('B',634,735)]

def decode(path):
    cap=cv2.VideoCapture(str(path));fps=cap.get(cv2.CAP_PROP_FPS);frames=[]
    while True:
        ok,im=cap.read()
        if not ok:break
        frames.append(im)
    cap.release()
    return np.array(frames),fps

def sheet(frames,indices,path,crop=None,columns=5,size=(384,288)):
    tiles=[]
    for i in indices:
        im=frames[i].copy()
        if crop:
            x,y,w,h=crop;im=im[y:y+h,x:x+w]
        im=cv2.resize(im,size);cv2.rectangle(im,(0,0),(size[0],27),(20,20,20),-1)
        cv2.putText(im,f'frame {i} | {i/30:.3f}s',(8,20),0,.52,(255,255,255),1,cv2.LINE_AA);tiles.append(im)
    while len(tiles)%columns:tiles.append(np.zeros_like(tiles[0]))
    grid=np.vstack([np.hstack(tiles[i:i+columns]) for i in range(0,len(tiles),columns)])
    Path(path).parent.mkdir(parents=True,exist_ok=True);cv2.imwrite(str(path),grid)

def cut(source,out,a,b,crop=None):
    vf=f'trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS'
    if crop:vf+=',crop='+':'.join(str(x) for x in [crop[2],crop[3],crop[0],crop[1]])
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-vf',vf,'-an','-c:v','libx264','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],check=True)

def package(sources,out):
    out=Path(out);out.mkdir(parents=True,exist_ok=True);src=Path(sources);cache={};sources_meta={}
    for key in EVENTS:
        path=src/f'Moonlight_POC_V2_{key}.mp4'
        if hashlib.sha256(path.read_bytes()).hexdigest()!=SOURCE_SHA256[key]:raise ValueError('SOURCE_IDENTITY_UNVERIFIED: hash differs from the visually reviewed Moonlight package')
        frames,fps=decode(path);cache[key]=frames
        assert len(frames)==750 and frames.shape[1:3]==(360,480) and abs(fps-30)<1e-6
        sources_meta[key]=dict(file=path.name,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),frames=len(frames),fps=fps,width=480,height=360,usable_seconds=len(frames)/fps,full_source_offset_seconds=None)
        rows=[];prev=None
        for i,im in enumerate(frames):
            hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
            mag=cv2.inRange(hsv[160:230,205:345],(135,65,170),(176,255,255))
            green=cv2.inRange(hsv[140:218,205:345],(35,75,160),(90,255,255))
            cmd=cv2.cvtColor(im[220:258,110:330],cv2.COLOR_BGR2GRAY)
            rows.append([i,i/fps,int(np.count_nonzero(mag)),int(np.count_nonzero(green)),0 if prev is None else float(np.abs(cmd.astype(float)-prev).mean())]);prev=cmd
        with (out/f'{key}-frame-signals.csv').open('w') as f:
            w=csv.writer(f);w.writerow(['frame','seconds','magenta_pixels','green_pixels','command_absdiff']);w.writerows(rows)
        for a in range(0,750,120):sheet(frames,list(range(a,min(a+120,750),6)),out/f'{key}-scan-{a:03}.jpg')
        for edge in EVENTS[key]:sheet(frames,list(range(edge-2,min(edge+3,750))),out/f'{key}-boundary-{edge:03}.jpg',size=(480,360))
    motions=[]
    for i,(key,a,b) in enumerate(RANGES,1):
        mid=f'moonlight-space-{i:03}';first=i==8;crop=[24,96,138,194] if first else [112,96,150,194];lo=max(0,a-18);hi=min(750,b+18)
        if i==4:crop=[120,96,184,194]
        if i==5:crop=[144,96,146,194]
        m=dict(id=mid,source_clip=sources_meta[key]['file'],source_key=key,source_frame_range=[a,b],source_timestamp_range=[a/30,b/30],duration_seconds=(b-a)/30,
               working_frame_range=[lo,hi],working_timestamp_range=[lo/30,hi/30],production_within_working_frames=[a-lo,b-lo],complete=True,both_boundaries_observed=True,
               boundary_confidence='high; observed judgement + command reset',boundary_uncertainty_frames=1,judgement_evidence=[f'{key}-boundary-{a:03}.jpg',f'{key}-boundary-{b:03}.jpg'],
               selected_dancer='Destiny, far-left blonde NPC' if first else 'Isabel, third blonde NPC from left',crop_region=crop,
               pose_track='first-lane/B-first-rtmw.npz' if first else f'{key}-rtmw.npz',
               occlusion_notes='Self-occlusion, low-resolution hands; command HUD can cover shins. Last motion uses one fixed alternate dancer throughout.',visual_acceptance='PENDING')
        motions.append(m);path=src/m['source_clip']
        cut(path,out/f'{mid}.mp4',a,b,crop);cut(path,out/f'{mid}-solver-padding.mp4',lo,hi,crop)
        sheet(cache[key],np.linspace(a,b-1,5,dtype=int),out/f'{mid}-poses.jpg',crop=crop,size=(300,388))
    rejected=[]
    for key,a,b in [('A',492,746),('B',177,431)]:
        name=f'{key}-floor-motion';cut(src/sources_meta[key]['file'],out/f'{name}-rejected.mp4',a,b)
        sheet(cache[key],np.linspace(a,b-1,10,dtype=int),out/f'{name}-evidence.jpg')
        rejected.append(dict(source_key=key,source_frame_range=[a,b],both_boundaries_observed=True,reason='Inverted/floor dance and character overlap defeat reliable body tracking; excluded from animation pack.'))
    manifest=dict(schema_version=2,identity='MOONLIGHT_CONFIRMED',identity_evidence='Tropical boardwalk, three matching blonde NPCs, bottom-left Audition Spain Moonlight context; visually reviewed.',sources=sources_meta,fps=30,events=EVENTS,motions=motions,rejected_complete_intervals=rejected,
                  rejected_partial_intervals={'A':[[0,86],[746,750]],'B':[[0,76],[735,750]]},rejected_false_event=dict(source='B',frame=278,reason='READY overlay, not Space'),
                  timing='Measured source frames, half-open. No BPM duration forcing. Engine event latency is not observable.',owner_visual_acceptance='PENDING')
    (out/'source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');return manifest

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--sources',required=True);ap.add_argument('--out',required=True);a=ap.parse_args();package(a.sources,a.out)
