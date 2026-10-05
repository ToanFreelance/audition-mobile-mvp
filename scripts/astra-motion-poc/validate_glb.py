"""Structural and numerical QA. Structural PASS never implies visual acceptance."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation as R
from glb_io import GLB


def inspect(original, animated):
    src=GLB(original); g=GLB(animated);rest=g.fk();d=g.doc
    checks={key:d.get(key)==src.doc.get(key) for key in ['nodes','skins','meshes','materials','textures','images','samplers','scenes','scene']}
    checks['original_bin_prefix_identical']=g.bin[:len(src.bin)]==src.bin
    checks['old_clips_identical']=d.get('animations',[])[:len(src.doc.get('animations',[]))]==src.doc.get('animations',[])
    for key in ['accessors','bufferViews']:
        checks['original_'+key+'_identical']=d[key][:len(src.doc[key])]==src.doc[key]
    checks['has_new_clips']=len(d.get('animations',[]))>len(src.doc.get('animations',[]))
    skin_reports=[]
    for si,skin in enumerate(d['skins']):
        joints=skin['joints'];ibm=g.accessor(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
        mesh_nodes=[i for i,n in enumerate(d['nodes']) if n.get('skin')==si]
        errors=[]
        for mn in mesh_nodes:
            errors.extend(float(np.max(np.abs(np.linalg.inv(rest[mn])@rest[j]@m-np.eye(4)))) for j,m in zip(joints,ibm))
        skin_reports.append(dict(joints=len(joints),inverse_bind_max_rest_error=max(errors),finite=bool(np.isfinite(ibm).all())))
    checks['valid_inverse_binds']=all(s['finite'] and s['inverse_bind_max_rest_error']<1e-5 for s in skin_reports)
    weight_error=0.;weight_finite=True;joint_indices=True;vertices=0
    for mesh in d['meshes']:
        for prim in mesh['primitives']:
            attrs=prim['attributes'];vertices+=d['accessors'][attrs['POSITION']]['count']
            w=g.accessor(attrs['WEIGHTS_0']);j=g.accessor(attrs['JOINTS_0'])
            weight_error=max(weight_error,float(np.max(np.abs(w.sum(axis=1)-1))))
            weight_finite &= bool(np.isfinite(w).all() and np.min(w)>=0)
            joint_indices &= bool(j.max()<len(d['skins'][0]['joints']))
    checks['valid_weights']=weight_finite and weight_error<1e-5 and joint_indices
    animations=[];all_angles=[]
    for anim in d.get('animations',[])[len(src.doc.get('animations',[])):]:
        finite=True;norm_error=0.;valid_nodes=True;no_scale=True;strict_times=True;durations=[];fps=[];angles=[]
        root_values=None;sample_rot={};sample_tr={};count=0;worst=dict(degrees=0)
        for ch in anim['channels']:
            target=ch['target'];node=target['node'];path=target['path'];sampler=anim['samplers'][ch['sampler']]
            t=g.accessor(sampler['input']).ravel();v=g.accessor(sampler['output']);count=len(t)
            finite &= bool(np.isfinite(t).all() and np.isfinite(v).all())
            valid_nodes &= 0<=node<len(d['nodes'])
            strict_times &= bool(np.all(np.diff(t)>0) and len(t)==len(v))
            no_scale &= path!='scale';durations.append(float(t[-1]-t[0]));fps.append(float(1/np.median(np.diff(t))))
            if path=='rotation':
                norm_error=max(norm_error,float(np.max(np.abs(np.linalg.norm(v,axis=1)-1))))
                step=np.rad2deg((R.from_quat(v[:-1]).inv()*R.from_quat(v[1:])).magnitude())
                angles.extend(step.tolist());sample_rot[node]=v
                if step.max()>worst['degrees']:
                    at=int(step.argmax())
                    worst=dict(degrees=float(step[at]),bone=d['nodes'][node].get('name',str(node)),
                               source_frame_pair=[anim['extras']['source_frames_half_open'][0]+at,anim['extras']['source_frames_half_open'][0]+at+1])
            elif path=='translation':root_values=v;sample_tr[node]=v
        # Sample actual skinning over the entire clip; preserve original geometry untouched.
        sample_vertices=[]
        for mesh in d['meshes']:
            for prim in mesh['primitives']:
                attrs=prim['attributes'];positions=g.accessor(attrs['POSITION'])
                ii=np.linspace(0,len(positions)-1,min(1024,len(positions)),dtype=int)
                sample_vertices.append((positions[ii],g.accessor(attrs['JOINTS_0'])[ii],g.accessor(attrs['WEIGHTS_0'])[ii]))
        skin=d['skins'][0];ibm=g.accessor(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
        bounds=[];deform_finite=True;max_extent=0.
        for f in range(count):
            world=g.fk({j:q[f] for j,q in sample_rot.items()},{j:v[f] for j,v in sample_tr.items()})
            matrices=np.array([world[j]@m for j,m in zip(skin['joints'],ibm)])
            for positions,joints,weights in sample_vertices:
                h=np.c_[positions,np.ones(len(positions))]
                v=np.einsum('nkij,nj,nk->ni',matrices[joints],h,weights)[:,:3]
                deform_finite &= bool(np.isfinite(v).all())
                max_extent=max(max_extent,float(np.ptp(v,axis=0).max()))
                bounds.append([v.min(axis=0).tolist(),v.max(axis=0).tolist()])
        report=dict(name=anim['name'],duration_seconds=max(durations),sample_rate=round(float(np.median(fps)),4),samples=count,
                    channels=len(anim['channels']),finite=finite,valid_target_nodes=valid_nodes,strict_times=strict_times,
                    quaternion_max_norm_error=norm_error,no_scale_animation=no_scale,
                    root_xyz_range=None if root_values is None else np.ptp(root_values,axis=0).tolist(),
                    angular_step_degrees_max=max(angles),angular_step_degrees_p99=float(np.percentile(angles,99)),
                    angular_warning=max(angles)>15,
                    angular_warning_threshold_degrees=15,
                    worst_angular_step=worst,sampled_skinning_finite=deform_finite,
                    sampled_skinning_max_extent_m=max_extent,complete=anim.get('extras',{}).get('complete'))
        report['sampled_skinning_min_y_m']=min(v[0][1] for v in bounds)
        report['sampled_ground_penetration_warning']=report['sampled_skinning_min_y_m']<-.03
        report['structural_pass']=finite and valid_nodes and strict_times and norm_error<1e-5 and no_scale and deform_finite
        animations.append(report);all_angles.extend(angles)
    solve_path=Path(animated).with_suffix('.solve.npz');metrics={}
    if solve_path.exists():
        x=np.load(solve_path);feet=x['solved_feet'];contact=x['contacts'];speed=np.linalg.norm(np.diff(feet,axis=0)*30,axis=2)
        stance=speed[contact[1:]&contact[:-1]]
        metrics=dict(root_xyz_range=np.ptp(x['root'],axis=0).tolist(),stance_samples=len(stance),
                     inferred_stance_ankle_speed_median=float(np.median(stance)) if len(stance) else None,
                     inferred_stance_ankle_speed_p95=float(np.percentile(stance,95)) if len(stance) else None,
                     all_frame_ankle_speed_max=float(speed.max()),
                     caution='Contacts are inferred solver constraints, not independently measured foot-skating ground truth.')
    return dict(file=Path(animated).name,sha256=hashlib.sha256(Path(animated).read_bytes()).hexdigest(),bytes=Path(animated).stat().st_size,
                checks=checks,skins=skin_reports,vertices=vertices,weight_sum_max_error=weight_error,animations=animations,
                root_and_contact_metrics=metrics,structural_pass=all(checks.values()) and all(a['structural_pass'] for a in animations),
                visual_acceptance=False)


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--male-source',required=True);ap.add_argument('--female-source',required=True)
    ap.add_argument('--male',required=True);ap.add_argument('--female',required=True);ap.add_argument('--out',required=True)
    args=ap.parse_args()
    result=dict(schema_version=1,models=[inspect(args.male_source,args.male),inspect(args.female_source,args.female)],
                poc_pass=False,owner_visual_acceptance='PENDING',
                blockers=['Space 003 has only 8 source frames; true motion end is absent.',
                          'Single-view depth and occluded wrist/elbow reconstruction remain approximate.'],
                validation_scope='GLB parse; original data preservation; skin/bind; all channels; all-frame sampled skinning; rotation continuity; root/contacts')
    Path(args.out).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))


if __name__=='__main__':main()
