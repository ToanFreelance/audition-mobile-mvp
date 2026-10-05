"""Full-frame encoding, technical diagnostics and downloadable ZIP."""
import sys,json,subprocess,hashlib,zipfile
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation as R
from PIL import Image,ImageDraw,ImageFont
from glb_io import GLB
root=Path(sys.argv[1]).resolve();out=root/'mixamo-finish';font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';qa=json.loads((out/'Finish_Mixamo_QA.json').read_text());n=qa['composition']['samples']
def run(cmd):subprocess.run(cmd,check=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def encode(folder,name,count,label):
    paths=sorted((out/folder).glob('*.png'));assert [p.name for p in paths]==[f'{i:04}.png' for i in range(count)],(folder,len(paths),count)
    assert (out/folder/'render-complete.json').exists()
    vf=f"pad=iw:ih+48:0:48:color=0x141820,drawtext=fontfile={font}:text='{label}':fontcolor=white:fontsize=23:x=16:y=12"
    run(['ffmpeg','-v','error','-y','-framerate','30','-i',str(out/folder/'%04d.png'),'-vf',vf,'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(out/name)])
for folder,name,count,label in [('swipes-render','Mixamo_Swipes_Source.mp4',91,'SWIPES - imported skeleton - 30 fps'),('flair-render','Mixamo_Flair_Source.mp4',31,'FLAIR - imported skeleton - 30 fps'),('composite-render','Mixamo_Composite_Source.mp4',n,'COMPOSITE SOURCE - skeleton'),('male-render','Nam_Mixamo_Finish_QA.mp4',n,'MALE - real textured Meshy'),('female-render','Nu_Mixamo_Finish_QA.mp4',n,'FEMALE - real textured Meshy')]:encode(folder,name,count,label)
run(['ffmpeg','-v','error','-y','-i',str(out/'Mixamo_Composite_Source.mp4'),'-i',str(out/'Nam_Mixamo_Finish_QA.mp4'),'-i',str(out/'Nu_Mixamo_Finish_QA.mp4'),'-filter_complex','[0:v][1:v][2:v]hstack=inputs=3[v]','-map','[v]','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'Finish_Mixamo_Source_Male_Female_QA.mp4')])
frames=[0,60,74,79,83,87,98,110];sheet=Image.new('RGB',(1440,520*len(frames)),(20,24,32));draw=ImageDraw.Draw(sheet);fnt=ImageFont.truetype(font,22)
for row,f in enumerate(frames):
    for col,(folder,label) in enumerate([('composite-render','SOURCE skeleton'),('male-render','MALE'),('female-render','FEMALE')]):
        sheet.paste(Image.open(out/folder/f'{f:04}.png').resize((480,480)),(col*480,row*520+40));draw.text((col*480+12,row*520+8),f'{label} | f{f} | {f/30:.3f}s',fill='white',font=fnt)
sheet.save(out/'Finish_Mixamo_contact_sheet.jpg',quality=94)
qa['source_inspection']=json.loads((out/'source-inspection.json').read_text())
for source in qa['source_inspection']:source['sha256']=sha(root/'upload'/source['file'])
qa['runtime_input_sha256']={sex:sha(root/'mixamo-inputs/rigs'/f'{sex}_co_ban_MESHY_TEXTURED_RIG_v1.glb') for sex in ['Nam','Nu']}
qa['source_skeletons_identical']=True;qa['visual_status']='WARNING_CANDIDATE_OWNER_REVIEW_REQUIRED'
qa['warnings']=['No upright recovery exists in supplied Flair; ends on floor.','Eight-frame transition interpolates differing support patterns; weight transfer/contact need owner review.','Palm/finger contact and horizontal support locking remain approximate; no claim of zero skating.','Large angular steps remain. Structural PASS is not production acceptance.','Source previews show original FBX joints; no source mesh was supplied.']
qa['visual_review_scope']='Keyposes and dense transition frames; full MP4 supplied for owner playback acceptance.'
qa['validation']=dict(blender_source_import=True,blender_final_glb_render_all_frames=True,runtime_modified=False,normal_clips_modified=False,browser_e2e='NOT_RUN_OFFLINE_ASSET_TASK')
for sex,m in zip(['Nam','Nu'],qa['models']):
    g=GLB(out/f'{sex}_Mixamo_Finish_MVP_v1.glb');anim=g.doc['animations'][-1];rotations={};translations={};angles=[]
    for ch in anim['channels']:
        v=g.accessor(anim['samplers'][ch['sampler']]['output']);node=ch['target']['node']
        if ch['target']['path']=='rotation':
            rotations[node]=v;rr=R.from_quat(v);angles.append(np.rad2deg((rr[:-1].inv()*rr[1:]).magnitude()))
        else:translations[node]=v
    rr=next(iter(translations.values()));m['root_max_step_m']=float(np.linalg.norm(np.diff(rr,axis=0),axis=1).max());m['transition_angular_max_degrees']=float(np.array(angles)[:,79:89].max());m['hand_floor_proxy']={};hands=[]
    for side in ['Left','Right']:
        j=g.names['mixamorig:'+side+'Hand'];pts=np.array([g.fk({k:v[f] for k,v in rotations.items()},{k:v[f] for k,v in translations.items()})[j][:3,3] for f in range(n)]);hands.append(pts);low=pts[:,1]<.13;speed=np.linalg.norm(np.diff(pts[:,[0,2]],axis=0),axis=1)*30;mask=low[1:]&low[:-1]
        m['hand_floor_proxy'][side]=dict(wrist_height_min=float(pts[:,1].min()),near_floor_intervals=int(mask.sum()),horizontal_speed_p95=float(np.percentile(speed[mask],95)) if mask.any() else None,caution='Wrist-height proxy, not palm support or skating ground truth')
    np.savez_compressed(out/(sex+'-solve.npz'),root=rr,final_hand_positions=np.stack(hands,axis=1),sample_rate=30)
videos=[]
for p in sorted(out.glob('*.mp4')):
    run(['ffmpeg','-v','error','-i',str(p),'-f','null','-']);info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(p)]))['streams'][0]
    videos.append(dict(file=p.name,frames=int(info['nb_frames']),width=info['width'],height=info['height'],fps=info['avg_frame_rate'],duration=info['duration'],full_decode_pass=True))
qa['videos']=videos;(out/'Finish_Mixamo_QA.json').write_text(json.dumps(qa,indent=2))
files=[p for p in out.iterdir() if p.suffix in ['.glb','.mp4','.json','.jpg','.npz'] and p.name!='SHA256SUMS.json']
(out/'SHA256SUMS.json').write_text(json.dumps({p.name:sha(p) for p in files},indent=2));files.append(out/'SHA256SUMS.json')
with zipfile.ZipFile(out/'Finish_Mixamo_MVP_v1.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in files:z.write(p,p.name)
    for p in (root/'audition-mobile-mvp/scripts/astra-motion-poc').glob('mixamo_*.py'):z.write(p,'scripts/'+p.name)
    for name in ['glb_io.py','solve_target.py','validate_glb.py','test_mixamo_finish.py']:z.write(root/'audition-mobile-mvp/scripts/astra-motion-poc'/name,'scripts/'+name)
    for name in ['Breakdance Swipes.fbx','Flair 2.fbx']:z.write(root/'upload'/name,'source/'+name)
    z.write(root/'audition-mobile-mvp/docs/MIXAMO_FINISH_MVP_V1.md','README.md')
with zipfile.ZipFile(out/'Finish_Mixamo_MVP_v1.zip') as z:assert z.testzip() is None
print(json.dumps(dict(zip_crc_pass=True,videos=videos),indent=2))
