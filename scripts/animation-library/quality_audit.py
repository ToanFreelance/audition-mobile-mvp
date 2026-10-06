"""Separate uncaptured finger channels from measured body angular warnings."""
import argparse,json
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation
from acquire import parse_bvh

def audit(nodes,values):
    all_steps=[];worst={'degrees':0};excluded=[]
    for n in nodes:
        if any(word in n['name'].lower() for word in ['finger','thumb']):
            excluded.append(n['name']);continue
        inds=[i for ch,i in zip(n['channels'],n['indices']) if ch.endswith('rotation')]
        axes=''.join(ch[0] for ch in n['channels'] if ch.endswith('rotation'))
        if not inds:continue
        r=Rotation.from_euler(axes,values[1:,inds],degrees=True)
        steps=np.rad2deg((r[:-1].inv()*r[1:]).magnitude());all_steps.extend(steps)
        if steps.max()>worst['degrees']:worst=dict(degrees=float(steps.max()),joint=n['name'],raw_sample_pair=[int(steps.argmax())+1,int(steps.argmax())+2])
    return dict(max_step_degrees=worst['degrees'],p99_step_degrees=float(np.percentile(all_steps,99)),worst=worst,excluded_uncaptured_joints=excluded,caution='Numerical source screening, not visual acceptance or foot-contact validation')

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);a=ap.parse_args();out=Path(a.out);c=json.loads((out/'catalog.json').read_text())
    for m in c['motions']:
        nodes,v,p,dt=parse_bvh(out/m['file']);m['body_angular_metrics']=audit(nodes,v)
        m['priority_for_visual_review']='LOWER_ANGULAR_RISK' if m['body_angular_metrics']['max_step_degrees']<=45 and m['body_angular_metrics']['p99_step_degrees']<=10 else 'SOURCE_CLEANUP_REVIEW'
        if m['source_id'] in ['05_02','60_01','85_08']:m['visual_status']='SOURCE_CONTACT_SHEET_INSPECTED_NOT_TARGET_ACCEPTED'
    c['quality_screening']={'lower_angular_risk_unique_takes':sum(m['priority_for_visual_review']=='LOWER_ANGULAR_RISK' and not m.get('duplicate_of') for m in c['motions']),'body_warning_unique_takes':sum(m['body_angular_metrics']['max_step_degrees']>30 and not m.get('duplicate_of') for m in c['motions']),'visual_mesh_acceptance':False,'reviewed_source_contact_sheets':['cmu-05_02','cmu-60_01','cmu-85_08'],'thresholds':{'max_step_degrees':45,'p99_step_degrees':10},'note':'Priority heuristic only; does not establish good choreography, floor support or target quality.'}
    (out/'catalog.json').write_text(json.dumps(c,indent=2));print(json.dumps(c['quality_screening'],indent=2))

if __name__=='__main__':main()
