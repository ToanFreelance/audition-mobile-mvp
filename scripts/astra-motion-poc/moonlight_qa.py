"""Synchronized full-frame QA videos and machine-readable V2 validation."""
import argparse,hashlib,json,subprocess
from pathlib import Path
import cv2,numpy as np
from validate_glb import inspect
from moonlight_source import decode

def writer(path,width,height):
    return subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s',f'{width}x{height}','-r','30','-i','-','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(path)],stdin=subprocess.PIPE)

def panel(im):
    h,w=im.shape[:2];scale=min(768/w,576/h);nw,nh=round(w*scale),round(h*scale)
    canvas=np.full((576,768,3),24,np.uint8);x=(768-nw)//2;y=(576-nh)//2;canvas[y:y+nh,x:x+nw]=cv2.resize(im,(nw,nh),interpolation=cv2.INTER_CUBIC);return canvas

def comparison_frame(source,male,female,m,local):
    out=np.full((648,2304,3),24,np.uint8);out[40:616]=np.hstack([panel(source),male,female])
    for i,label in enumerate(['SOURCE - '+m['selected_dancer'].split(',')[0],'NAM MESHY','NU MESHY']):cv2.putText(out,label,(i*768+16,27),0,.65,(240,240,240),1,cv2.LINE_AA)
    txt=f"{m['id']} | {m['source_key']} frame {m['source_frame_range'][0]+local} | {local/30:.3f}s | 30 fps | POC / owner review pending"
    cv2.putText(out,txt,(16,638),0,.59,(220,220,220),1,cv2.LINE_AA);return out

def visual(sources,artifacts,renders,only=None):
    root=Path(artifacts);out=root/'qa';out.mkdir(exist_ok=True);man=json.loads((root/'motion-source/source-manifest.json').read_text());src={k:decode(Path(sources)/v['file'])[0] for k,v in man['sources'].items()}
    combined=None if only else writer(out/'Moonlight_V2_Combined_Review.mp4',2304,648);overview=[];reports=[]
    try:
        for m in man['motions']:
            if only and m['id']!=only:continue
            a,b=m['source_frame_range'];x,y,w,h=m['crop_region'];dest=out/(m['id']+'-source-male-female.mp4');proc=writer(dest,2304,648);tiles=[];key=set(np.linspace(0,b-a-1,5,dtype=int).tolist())
            try:
                for f in range(b-a):
                    ims=[]
                    for sex in ['Nam','Nu']:
                        path=Path(renders)/sex/m['id']/f'{f:04}.png';im=cv2.imread(str(path))
                        if im is None or im.shape!=(576,768,3):raise ValueError(f'Missing/wrong actual render: {path}')
                        ims.append(im)
                    row=comparison_frame(src[m['source_key']][a+f,y:y+h,x:x+w],*ims,m,f)
                    proc.stdin.write(row.tobytes())
                    if combined:combined.stdin.write(row.tobytes())
                    if f in key:tiles.append(row)
            finally:
                proc.stdin.close();assert proc.wait()==0
            cv2.imwrite(str(out/(m['id']+'-keyposes.jpg')),np.vstack(tiles));overview.append(tiles[2]);reports.append(dict(id=m['id'],frames=b-a,fps=30,width=2304,height=648,file=dest.name))
    finally:
        if combined:combined.stdin.close();assert combined.wait()==0
    if not only:cv2.imwrite(str(out/'Moonlight_V2_Overview.jpg'),np.vstack(overview))
    (out/('render-video-'+(only or 'manifest')+'.json')).write_text(json.dumps(reports,indent=2)+'\n')

def technical(artifacts,male_source,female_source):
    root=Path(artifacts);man=json.loads((root/'motion-source/source-manifest.json').read_text());models=[]
    for sex,source in [('Nam',male_source),('Nu',female_source)]:
        path=root/'models'/f'{sex}_Astra_Moonlight_POC_V2.glb';report=inspect(source,path);diag=path.parent/(path.stem+'-diagnostics');metrics=[]
        for m in man['motions']:
            x=np.load(diag/(m['id']+'.solve.npz'));target=np.load(root/'targets'/(m['id']+'-targets.npz'));a,b=target['production_slice'];feet=x['solved_feet'][a:b];contact=x['contacts'][a:b];speed=np.linalg.norm(np.diff(feet,axis=0)*30,axis=2);stance=speed[contact[:-1]&contact[1:]]
            metrics.append(dict(id=m['id'],contact_frames=contact.sum(0).tolist(),root_xyz_range=np.ptp(x['root'][a:b],axis=0).tolist(),root_max_step_m=float(np.linalg.norm(np.diff(x['root'][a:b],axis=0),axis=1).max()),
                inferred_stance_ankle_speed_p95=float(np.percentile(stance,95)) if len(stance) else None,inferred_stance_ankle_speed_median=float(np.median(stance)) if len(stance) else None,ankle_min_y=feet[:,:,1].min(0).tolist(),post_filter_root_correction_max=np.abs(x['post_filter_root_correction'][a:b]).max(0).tolist(),
                contact_warning=bool(len(stance) and np.percentile(stance,95)>.3)))
        report['per_motion_contacts']=metrics;report['checks']['expected_eight_moonlight_clips']=len(report['animations'])==len(man['motions'])==8;report['structural_pass'] &= report['checks']['expected_eight_moonlight_clips'];models.append(report)
    result=dict(schema_version=2,source_identity=man['identity'],complete_motion_count=len(man['motions']),models=models,owner_visual_acceptance='PENDING',poc_pass=False,
                limitations=['Structural PASS does not establish choreography fidelity.','Contacts are inferred constraints, not independent foot-skating truth.','18 degree angular cap is a filter constraint, not a raw mocap accuracy score.','Eight source-complete candidates; two complete floor intervals rejected for pose failure.'])
    (root/'qa').mkdir(exist_ok=True);(root/'qa/technical-qa.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({m['file']:m['structural_pass'] for m in models}))

def videos(artifacts):
    root=Path(artifacts);reports=[]
    for p in sorted(root.rglob('*.mp4')):
        probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=width,height,r_frame_rate,nb_frames,duration','-of','json',str(p)]))['streams'][0]
        subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','null','-'],check=True,stdout=subprocess.DEVNULL)
        reports.append(dict(file=str(p.relative_to(root)),decode='PASS',**probe))
    (root/'qa/video-qa.json').write_text(json.dumps(reports,indent=2)+'\n');print('decoded',len(reports),'videos')

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('mode',choices=['visual','technical','videos']);ap.add_argument('--artifacts',required=True);ap.add_argument('--sources');ap.add_argument('--renders');ap.add_argument('--male-source');ap.add_argument('--female-source');ap.add_argument('--motion');a=ap.parse_args()
    if a.mode=='visual':visual(a.sources,a.artifacts,a.renders,a.motion)
    elif a.mode=='technical':technical(a.artifacts,a.male_source,a.female_source)
    else:videos(a.artifacts)
