"""Generic evidence-first video analysis. No Moonlight frames, BPM or crop constants.

Command-row disappearance proposes events, not engine timestamps or accepted
motion semantics. Owner review is mandatory; EOF intervals are never complete.
"""
import argparse, hashlib, json, os, re, shutil, subprocess
from collections import Counter
from pathlib import Path
import cv2
import numpy as np


def write_json(path, value):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, indent=2) + '\n'); temp.replace(path)


def decode(source):
    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(source)], timeout=30))
    s = next(x for x in info['streams'] if x['codec_type'] == 'video')
    n, d = s['avg_frame_rate'].split('/'); fps = float(n) / float(d)
    duration = float(info['format']['duration'])
    if not 1 <= fps <= 120 or not 0 < duration <= 120 or max(s['width'], s['height']) > 4096:
        raise ValueError('VIDEO_LIMIT: up to 120s, 4096 pixels and 120 fps')
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(source), '-vf', 'scale=480:360,fps=30', '-an', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-threads', '2', '-'], capture_output=True, timeout=120, check=True)
    frames = np.frombuffer(p.stdout, np.uint8).reshape(-1, 360, 480, 3)
    if not 2 <= len(frames) <= 3600: raise ValueError('DECODE_FAILED_OR_TOO_LONG')
    return frames, dict(filename=Path(source).name, sha256=hashlib.sha256(Path(source).read_bytes()).hexdigest(),
                       width=s['width'], height=s['height'], fps=fps, duration=duration,
                       analysisFps=30, analysisFrames=len(frames), timestampConvention='zero-based half-open on 30 Hz decoded timeline')


def command_events(frames):
    circles=[]; rows=Counter()
    for im in frames:
        gray=cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
        contours,_=cv2.findContours((gray>160).astype('uint8'), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        points=[]
        for c in contours:
            x,y,w,h=cv2.boundingRect(c)
            if 6<=w<=19 and 6<=h<=19 and .7<w/h<1.4 and .4<cv2.contourArea(c)/(w*h)<.92:
                points.append((x+w/2,y+h/2))
        circles.append(points)
        for y in set(round(p[1]) for p in points):
            xs=sorted(p[0] for p in points if abs(p[1]-y)<3)
            unique=[]
            for x in xs:
                if not unique or x-unique[-1]>5: unique.append(x)
            if len(unique)>=5 and sum(8<dx<26 for dx in np.diff(unique))>=4: rows[y]+=1
    if not rows: return [], dict(row=None, counts=[], warning='COMMAND_ROW_NOT_FOUND')
    y=rows.most_common(1)[0][0]
    counts=[len({round(x/6) for x,yy in p if abs(yy-y)<3}) for p in circles]
    active=np.array(counts)>=4; events=[]
    for f in range(5,len(frames)-2):
        if sum(active[f-5:f])>=3 and not active[f:f+3].any() and (not events or f-events[-1]>15): events.append(f)
    return events, dict(row=y, counts=counts, method='repeated aligned command circles -> observed row disappearance', uncertaintyFrames=1)


def lanes(frames):
    from rtmlib import YOLOX
    from moonlight_pose import model
    detector=YOLOX(onnx_model=os.environ['MOTION_DETECTOR'], model_input_size=(640,640), backend='onnxruntime', device='cpu')
    pose=model(os.environ['MOTION_POSE_MODEL']); groups=[]
    for f in np.linspace(0,min(45,len(frames)-1),5,dtype=int):
        for box in detector(frames[f]):
            x1,y1,x2,y2=map(float,box[:4])
            if y2-y1<55: continue
            center=(x1+x2)/2; group=next((g for g in groups if abs(np.mean([b[0]+b[2] for b in g])/2-center)<22),None)
            if group is None: groups.append([[x1,y1,x2,y2]])
            else: group.append([x1,y1,x2,y2])
    result=[]
    for group in sorted([g for g in groups if len(g)>=2],key=lambda g:np.mean([b[0] for b in g])):
        box=np.median(group,axis=0); xy,sc=pose(frames[0],bboxes=[box.tolist()]); conf=np.clip((sc[0]-1.2)/4,0,1)
        result.append(dict(id=f'lane-{len(result)+1}',box=box.tolist(),trackingConfidence=float(conf[:17].mean()),warning='Initial detector confidence only; dancer identity must be reviewed'))
    return result


def finish_evidence(frames,a,b):
    """Optional banner OCR is a suggestion only, never a Finish classification."""
    if not shutil.which('tesseract'):return []
    hits=[]
    for f in sorted({min(a+delta,b-1) for delta in [6,21,45]}):
        im=cv2.resize(frames[f],None,fx=2,fy=2)
        try:
            p=subprocess.run(['tesseract','stdin','stdout','--psm','11'],input=cv2.imencode('.png',im)[1].tobytes(),capture_output=True,timeout=8,check=True)
            if re.search(r'\bfinish\b',p.stdout.decode(errors='replace'),re.I):hits.append(f)
        except (subprocess.SubprocessError,OSError):pass
    return hits


def analyze(source, out):
    out=Path(out); out.mkdir(parents=True,exist_ok=True); frames,meta=decode(source)
    events,signal=command_events(frames); dancers=lanes(frames); proposed=max(dancers,key=lambda x:x['trackingConfidence'])['id'] if dancers else None
    motions=[]; bounds=[0]+events+[len(frames)]
    for i,(a,b) in enumerate(zip(bounds,bounds[1:])):
        mid=f'candidate-{i+1:03}'; both=a in events and b in events
        thumb=frames[(a+b-1)//2].copy()
        for lane in dancers:
            x,y,xx,yy=np.rint(lane['box']).astype(int); cv2.rectangle(thumb,(x,y),(xx,yy),(30,220,90),1);cv2.putText(thumb,lane['id'],(x,y-3),0,.35,(20,255,100),1)
        cv2.imwrite(str(out/(mid+'.jpg')),thumb)
        evidence=np.hstack([frames[f] for f in [max(a-1,0),a,min(a+1,len(frames)-1),b-1,min(b,len(frames)-1)]])
        cv2.imwrite(str(out/(mid+'-boundary.jpg')),evidence)
        proposal='unknown'; finish_frames=finish_evidence(frames,a,b);warnings=['AUTO_BOUNDARY_REQUIRES_VISUAL_REVIEW','MONOCULAR_DEPTH_UNVERIFIED']
        if not both: warnings.append('INCOMPLETE_BOUNDARY')
        motions.append(dict(sourceMotionId=mid,type=proposal,suggestedType='finish' if finish_frames else 'unknown',finishOcrFrames=finish_frames,include=False,reviewed=False,startFrame=a,endFrame=b,
            start=a/30,end=b/30,duration=(b-a)/30,bothBoundariesObserved=both,boundaryConfidence=.7 if both else .1,
            selectedDancer=proposed,trackingConfidence=next((l['trackingConfidence'] for l in dancers if l['id']==proposed),0),
            warnings=warnings,evidenceNote='',thumbnail=mid+'.jpg',boundaryImage=mid+'-boundary.jpg'))
    result=dict(schemaVersion=1,source=meta,events=events,signal=signal,lanes=dancers,motions=motions,
        warnings=['Normal / Finish never forced automatically. Stylized FINISH OCR is not reliable; review banner and both judgements.',
                  'No events means no extractable candidates; never infer missing EOF endings.'])
    write_json(out/'analysis.json',result); return result


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--source',required=True);ap.add_argument('--out',required=True)
    a=ap.parse_args();analyze(a.source,a.out)
