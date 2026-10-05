"""Measured V2/V2.1 comparison, with fixed V2 contact masks and honest limits."""
import argparse,json
from pathlib import Path
import cv2,numpy as np
from glb_io import GLB
from sole_constraints import SoleGeometry
from moonlight_qa import panel
from motion_analyze import write_json


def channels(g,name):
    anim=next(a for a in g.doc['animations'] if a['name']==name);rot={};tr={}
    for ch in anim['channels']:
        values=g.accessor(anim['samplers'][ch['sampler']]['output'])
        (rot if ch['target']['path']=='rotation' else tr)[ch['target']['node']]=values
    return rot,tr


def metrics(before,after):
    before=Path(before);after=Path(after);rows=[]
    man=json.loads((before/'motion-source/source-manifest.json').read_text())
    qa=[json.loads((r/'qa/technical-qa.json').read_text()) for r in [before,after]]
    for sex in ['Nam','Nu']:
        g=GLB(before/'models'/f'{sex}_Astra_Moonlight_POC_V2.glb');sole=SoleGeometry(g)
        for m in man['motions']:
            mid=m['id'];diags=[np.load(r/'models'/f'{sex}_Astra_Moonlight_POC_V2-diagnostics'/(mid+'.solve.npz')) for r in [before,after]]
            targets=[np.load(r/'targets'/(mid+'-targets.npz')) for r in [before,after]]
            a,b=targets[0]['production_slice'];assert np.array_equal(targets[1]['production_slice'],[a,b])
            fixed=diags[0]['contacts'][a:b];mask=fixed[:-1]&fixed[1:];rot,tr=channels(g,mid)
            oldsole=min(sole.minimum(g.fk({j:v[f] for j,v in rot.items()},{j:v[f] for j,v in tr.items()})) for f in range(b-a))
            newsole=float((diags[1]['sole_min_y_before']+diags[1]['sole_lift'])[a:b].min())
            values=[]
            for k,(d,t) in enumerate(zip(diags,targets)):
                feet=d['solved_feet'][a:b];speed=np.linalg.norm(np.diff(feet[:,:,[0,2]],axis=0)*30,axis=2)[mask]
                model=next(x for x in qa[k]['models'] if x['file'].startswith(sex+'_'));anim=next(x for x in model['animations'] if x['name']==mid)
                knees=[g.doc['skins'][0]['joints'].index(g.names['mixamorig:'+side+'Leg']) for side in ['Left','Right']]
                depthacc=np.diff(t['points'][a:b,[13,14,15,16],2],n=2,axis=0)*900
                values.append(dict(sole_min_y_m=[oldsole,newsole][k],fixed_v2_stance_xz_p95_mps=float(np.percentile(speed,95)) if len(speed) else None,
                    fixed_stance_samples=int(mask.sum()),ankle_vertical_excursion_m=np.ptp(feet[:,:,1],axis=0).tolist(),root_vertical_excursion_m=float(np.ptp(d['root'][a:b,1])),
                    ending_knee_y_m=d['joint_positions'][b-1,knees,1].tolist(),hand_elbow_depth_acceleration_rms=float(np.sqrt(np.mean(depthacc**2))),
                    angular_max_deg=anim['angular_step_degrees_max'],angular_p99_deg=anim['angular_step_degrees_p99']))
            rows.append(dict(motion=mid,sex=sex,before=values[0],after=values[1]))
            print(sex,mid,'sole',round(oldsole,4),'->',round(newsole,4),'slide',values[0]['fixed_v2_stance_xz_p95_mps'],'->',values[1]['fixed_v2_stance_xz_p95_mps'],flush=True)
    result=dict(schemaVersion=1,rows=rows,limitations=[
        'Sole: original Foot/Toe-influenced vertices, every production frame; same rest mesh and bind.',
        'Sliding: ankle XZ speed at a fixed baseline V2 inferred contact mask, not measured ground-truth contact.',
        'Depth acceleration reduction measures smoothness, not accuracy of monocular depth.',
        'Ankle vertical excursion does not separate pelvis bounce from intentional leg lift.',
        'Angular 18 degree cap is a constraint, not proof of source fidelity. No visual acceptance implied.'])
    write_json(after/'qa/V21-before-after.json',result)


def sheets(before,after):
    before=Path(before);after=Path(after)
    for num in ['003','004','005','008']:
        mid='moonlight-space-'+num;cap=cv2.VideoCapture(str(before/'qa'/(mid+'-source-male-female.mp4')));tiles=[]
        for f in [0,25,50,60,75,100]:
            cap.set(cv2.CAP_PROP_POS_FRAMES,f);ok,old=cap.read()
            if not ok:raise ValueError('MISSING_BASELINE_VIDEO_FRAME')
            newer=[cv2.imread(str(after/'render'/sex/mid/f'{f:04}.png')) for sex in ['Nam','Nu']]
            if any(im is None for im in newer):raise ValueError('MISSING_REAL_V21_RENDER')
            row=np.full((620,3840,3),24,np.uint8)
            panels=[old[40:616,:768],old[40:616,768:1536],newer[0],old[40:616,1536:2304],newer[1]]
            for i,(label,im) in enumerate(zip(['SOURCE','NAM V2','NAM V2.1','NU V2','NU V2.1'],panels)):
                row[40:616,i*768:(i+1)*768]=panel(im);cv2.putText(row,f'{label} | {mid} f{f}',(i*768+8,25),0,.58,(245,245,245),1,cv2.LINE_AA)
            tiles.append(row)
        cap.release();cv2.imwrite(str(after/'qa'/(mid+'-V2-vs-V21.jpg')),np.vstack(tiles))


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--before',required=True);ap.add_argument('--after',required=True);ap.add_argument('--mode',choices=['metrics','sheets','all'],default='all');a=ap.parse_args()
    if a.mode in ['metrics','all']:metrics(a.before,a.after)
    if a.mode in ['sheets','all']:sheets(a.before,a.after)
