"""Mixamo world-space composite, target rest-axis calibration and limb IK.

Restored from the measured first pass after scratch loss. No local quaternion
copy, no time stretching, no changes to frozen Moonlight clips.
"""
import sys,json
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation as R,Slerp
from glb_io import GLB
from solve_target import ik2
from validate_glb import inspect

def rot(m):return R.from_matrix(m).as_matrix()
def swing(a,b):
    a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);v=np.cross(a,b);c=np.clip(a@b,-1,1)
    if np.linalg.norm(v)<1e-7:return np.eye(3)
    return R.from_rotvec(v/np.linalg.norm(v)*np.arccos(c)).as_matrix()
def depth(g,j):return 0 if j not in g.parent else 1+depth(g,g.parent[j])

def compose(root):
    out=root/'mixamo-finish';a=np.load(out/'swipes.npz');b=np.load(out/'flair.npz')
    assert np.array_equal(a['names'],b['names']) and np.array_equal(a['parents'],b['parents'])
    assert np.max(abs(a['rest']-b['rest']))<1e-6
    A=a['world'].copy();B=b['world'].copy();rest=a['rest'].copy()
    for x in [A,B,rest]:x[...,:3,:3]/=np.linalg.norm(x[...,:3,0],axis=-1)[...,None,None]
    phase=5;B=np.concatenate([B[phase:30],B[:phase+1]])
    yaw=R.from_euler('z',-75,degrees=True).as_matrix();B[:,:,:3,:3]=yaw@B[:,:,:3,:3];B[:,:,:3,3]=B[:,:,:3,3]@yaw.T
    end=88;overlap=8;A=A[:end];shift=A[end-overlap,0,:3,3]-B[0,0,:3,3];shift[2]=0;B[:,:,:3,3]+=shift
    parents=a['parents'];localA=A.copy();localB=B.copy()
    for j,p in enumerate(parents):
        if p>=0:localA[:,j]=np.linalg.inv(A[:,p])@A[:,j];localB[:,j]=np.linalg.inv(B[:,p])@B[:,j]
    blend=[]
    for k in range(overlap):
        t=(k+1)/(overlap+1);t=t*t*(3-2*t);frame=localA[end-overlap+k].copy()
        for j in range(len(parents)):frame[j,:3,:3]=Slerp([0,1],R.from_matrix(np.array([localA[end-overlap+k,j,:3,:3],localB[k,j,:3,:3]])))([t]).as_matrix()[0]
        frame[0,:3,3]=(1-t)*localA[end-overlap+k,0,:3,3]+t*localB[k,0,:3,3]
        for j,p in enumerate(parents):
            if p>=0:frame[j]=frame[p]@frame[j]
        blend.append(frame)
    W=np.concatenate([A[:-overlap],blend,B[overlap:]])
    center=(W[:,0,:2,3].min(axis=0)+W[:,0,:2,3].max(axis=0))/2;W[:,:,:2,3]-=center
    np.savez_compressed(out/'composite.npz',world=W,rest=rest,names=a['names'],parents=parents,fps=30)
    meta=dict(animation='finish-special-001',fps=30,samples=len(W),duration=(len(W)-1)/30,swipes_source_frames_inclusive=[1,end],flair_cycle_phase_start_source_frame=6,flair_single_cycle=True,duplicate_cycle_endpoint_removed_before_phase_shift=True,transition_output_frames_inclusive=[80,87],overlap_frames=8,flair_yaw_alignment_degrees=-75,flair_horizontal_alignment=shift.tolist(),natural_speed=True,time_stretch=False,recovery='No standing recovery in supplied Flair; ends on floor',source_visualization='Measured imported skeleton; zero source meshes')
    (out/'composition.json').write_text(json.dumps(meta,indent=2));return W,rest,list(a['names']),meta

def bake(root,sex,W,S,names,meta):
    out=root/'mixamo-finish';src=root/'mixamo-inputs/rigs'/f'{sex}_co_ban_MESHY_TEXTURED_RIG_v1.glb'
    g=GLB(src);T=g.fk();joints=g.doc['skins'][0]['joints'];sn={n:i for i,n in enumerate(names)}
    C=np.array([[1,0,0],[0,0,1],[0,-1,0.]])
    W=W.copy();S=S.copy();W[:,:,:3,:3]=C@W[:,:,:3,:3];W[:,:,:3,3]=W[:,:,:3,3]@C.T;S[:,:3,:3]=C@S[:,:3,:3];S[:,:3,3]=S[:,:3,3]@C.T
    hips=g.names['mixamorig:Hips'];scale=T[hips][1,3]/S[sn['mixamorig:Hips'],1,3]
    mapping={j:sn[g.doc['nodes'][j]['name']] for j in joints if g.doc['nodes'][j]['name'] in sn};order=sorted(mapping,key=lambda j:depth(g,j));cal={}
    for j,s in mapping.items():
        child=next((k for k in g.doc['nodes'][j].get('children',[]) if k in mapping),None);align=np.eye(3)
        if child is not None:align=swing(T[child][:3,3]-T[j][:3,3],S[mapping[child],:3,3]-S[s,:3,3])
        cal[j]=S[s,:3,:3].T@align@rot(T[j][:3,:3])
    roots=[];rotations={j:[] for j in mapping};skin=g.doc['skins'][0];ibm=g.accessor(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);samples=[];full=[]
    for mesh in g.doc['meshes']:
        for p in mesh['primitives']:
            at=p['attributes'];pos=g.accessor(at['POSITION']);js=g.accessor(at['JOINTS_0']);ws=g.accessor(at['WEIGHTS_0']);idx=np.linspace(0,len(pos)-1,min(25000,len(pos)),dtype=int)
            samples.append((np.c_[pos[idx],np.ones(len(idx))],js[idx],ws[idx]))
            for start in range(0,len(pos),65536):
                ix=slice(start,start+65536);full.append((np.c_[pos[ix],np.ones(len(pos[ix]))],js[ix],ws[ix]))
    def minimum(world):
        matrices=np.array([world[j]@m for j,m in zip(joints,ibm)])
        return min(float(np.einsum('nkij,nj,nk->ni',matrices[j],p,w)[:,1].min()) for p,j,w in samples)
    for f in range(len(W)):
        desired={j:W[f,s,:3,:3]@cal[j] for j,s in mapping.items()};q={};rootpos=W[f,0,:3,3]*scale
        def rebuild():return g.fk(q,{hips:rootpos})
        def setworld(j,m):
            world=rebuild();p=g.parent.get(j);parent=rot(world[p][:3,:3]) if p is not None else np.eye(3);q[j]=R.from_matrix(parent.T@m).as_quat()
        for j in order:setworld(j,desired[j])
        for side in ['Left','Right']:
            for labels in [('Arm','ForeArm','Hand'),('UpLeg','Leg','Foot')]:
                i,j,k=[g.names['mixamorig:'+side+x] for x in labels];world=rebuild();anchor=world[i][:3,3];endpoint=W[f,mapping[k],:3,3]*scale;pole=W[f,mapping[j],:3,3]*scale
                l1=np.linalg.norm(T[j][:3,3]-T[i][:3,3]);l2=np.linalg.norm(T[k][:3,3]-T[j][:3,3]);mid,endp=ik2(anchor,endpoint,pole,l1,l2,max_flex=175)
                for bone,child,a,b in [(i,j,anchor,mid),(j,k,mid,endp)]:
                    localdir=rot(T[bone][:3,:3]).T@(T[child][:3,3]-T[bone][:3,3]);base=desired[bone];setworld(bone,swing(base@localdir,b-a)@base)
                setworld(k,desired[k])
        low=minimum(rebuild());rootpos[1]+=max(0,.008-low);roots.append(rootpos.copy())
        for j in rotations:rotations[j].append(q[j])
    roots=np.array(roots);raw_steps=[];filtered_steps=[]
    for j,values in rotations.items():
        rs=R.from_quat(values);mats=rs.as_matrix();new=mats.copy()
        for f in range(1,len(W)-1):
            delta=(R.from_matrix(mats[f].T@mats[f-1]).as_rotvec()+R.from_matrix(mats[f].T@mats[f+1]).as_rotvec())*.18;new[f]=mats[f]@R.from_rotvec(delta).as_matrix()
        filtered=R.from_matrix(new);rotations[j]=filtered.as_quat();raw_steps.extend(np.rad2deg((rs[:-1].inv()*rs[1:]).magnitude()));filtered_steps.extend(np.rad2deg((filtered[:-1].inv()*filtered[1:]).magnitude()))
    exact_min=[];corrections=[]
    for f in range(len(W)):
        ww=g.fk({j:qs[f] for j,qs in rotations.items()},{hips:roots[f]});matrices=np.array([ww[j]@m for j,m in zip(joints,ibm)])
        low=min(float(np.einsum('nkj,nj,nk->n',matrices[js,1,:],ps,ws).min()) for ps,js,ws in full);correction=max(0,.004-low);roots[f,1]+=correction;exact_min.append(low+correction);corrections.append(correction)
    dest=out/f'{sex}_Mixamo_Finish_MVP_v1.glb'
    g.append_animation('finish-special-001',np.arange(len(W))/30,rotations,hips,roots,dict(source_frames_half_open=[0,len(W)],complete=True,composition=meta,method='Target rest-axis calibration, world orientation reconstruction, independent target-length two-bone IK, whole-skin floor lift'))
    g.write(dest);qa=inspect(src,dest);qa['target_scale_ratio']=float(scale)
    qa['continuity_cleanup']=dict(method='symmetric quaternion neighbour weight .18; endpoints unchanged',before_max=float(max(raw_steps)),after_max=float(max(filtered_steps)),before_p99=float(np.percentile(raw_steps,99)),after_p99=float(np.percentile(filtered_steps,99)))
    qa['all_vertex_floor_check']=dict(frames=len(W),minimum_y=min(exact_min),maximum_post_filter_root_lift=max(corrections),method='all original vertices/all influences/every frame')
    np.savez_compressed(out/(sex+'-solve.npz'),root=roots,final_all_vertex_floor_minimum=exact_min);return qa

if __name__=='__main__':
    root=Path(sys.argv[1]).resolve();W,S,names,meta=compose(root);qa=dict(composition=meta,models=[bake(root,sex,W,S,names,meta) for sex in ['Nam','Nu']],owner_visual_acceptance='PENDING',visual_status='WARNING_CANDIDATE_OWNER_REVIEW_REQUIRED')
    (root/'mixamo-finish/Finish_Mixamo_QA.json').write_text(json.dumps(qa,indent=2));print(json.dumps(qa,indent=2))
