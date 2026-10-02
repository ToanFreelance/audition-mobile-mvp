"""Frame-synchronous source/target comparison, no synthesized missing motion."""
import argparse
import json
import subprocess
from pathlib import Path
import cv2
import numpy as np


def panel(im,label):
    dest=np.full((510,384,3),28,dtype=np.uint8)
    h,w=im.shape[:2];scale=min(384/w,448/h);im=cv2.resize(im,(round(w*scale),round(h*scale)))
    y=46+(448-im.shape[0])//2;x=(384-im.shape[1])//2
    dest[y:y+im.shape[0],x:x+im.shape[1]]=im
    cv2.putText(dest,label,(12,30),cv2.FONT_HERSHEY_SIMPLEX,.64,(230,230,230),1,cv2.LINE_AA)
    return dest


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--source',required=True);ap.add_argument('--male',required=True)
    ap.add_argument('--female');ap.add_argument('--manifest',required=True);ap.add_argument('--out',required=True)
    ap.add_argument('--contact-only',action='store_true');args=ap.parse_args()
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    manifest=json.loads(Path(args.manifest).read_text());cap=cv2.VideoCapture(args.source);frames=[]
    while True:
        ok,im=cap.read()
        if not ok:break
        frames.append(im)
    cap.release();available=sorted(int(p.stem) for p in Path(args.male).glob('*.png'))
    if args.female:available=[f for f in available if (Path(args.female)/f'{f:04d}.png').exists()]
    def combined(f):
        pieces=[panel(frames[f][170:405,155:345],'SOURCE - FAR LEFT'),panel(cv2.imread(str(Path(args.male)/f'{f:04d}.png')),'MALE MESHY')]
        if args.female:pieces.append(panel(cv2.imread(str(Path(args.female)/f'{f:04d}.png')),'FEMALE MESHY'))
        row=np.hstack(pieces)
        cv2.putText(row,f'Source frame {f} / {f/30:.3f}s'+('   SPACE 003: INCOMPLETE SOURCE' if f>=273 else ''),(12,502),cv2.FONT_HERSHEY_SIMPLEX,.50,(0,200,255),1,cv2.LINE_AA)
        return row
    if not available:raise ValueError('No rendered frames')
    chosen=available if len(available)<=12 else [available[round(i)] for i in np.linspace(0,len(available)-1,12)]
    rows=[cv2.resize(combined(f),(768,round(510*768/(1152 if args.female else 768)))) for f in chosen]
    cv2.imwrite(str(out/'visual-contact.jpg'),np.vstack(rows))
    if args.contact_only:return
    assert available==list(range(4,281)), 'Final QA requires every production frame at 30fps'
    width=1152 if args.female else 768
    raw=out/'comparison-raw.mp4'
    wr=cv2.VideoWriter(str(raw),cv2.VideoWriter_fourcc(*'mp4v'),30,(width,510))
    for f in available:wr.write(combined(f))
    wr.release()
    final=out/'source-male-female.mp4'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(raw),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(final)],check=True)
    for motion in manifest['motions']:
        a,b=motion['source_frame_range'];name=motion['id']
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(final),'-vf',f'trim=start_frame={a-4}:end_frame={b-4},setpts=PTS-STARTPTS','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(out/f'{name}-qa.mp4')],check=True)
    print(json.dumps(dict(frames=len(available),fps=30,dimensions=[width,510],output=str(final))))


if __name__=='__main__':main()
