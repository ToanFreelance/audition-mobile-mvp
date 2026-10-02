"""Target-owned two-bone position IK with bind-axis and temporal twist constraints.

No source skeleton, source bone rotations, geometry edits, or scale animation.
"""
import argparse
import json
from pathlib import Path
from types import SimpleNamespace
import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.spatial.transform import Rotation as R
from glb_io import GLB


def unit(v):
    v=np.asarray(v,dtype=float)
    return v/np.maximum(np.linalg.norm(v,axis=-1,keepdims=True),1e-9)


def frame(primary, secondary):
    y=unit(primary); x=unit(secondary-y*np.dot(secondary,y)); z=unit(np.cross(x,y))
    return np.column_stack([x,y,z])


def body_frame(across, up):
    return frame(up,across)


def smooth_rot(matrices,sigma=1.5):
    q=R.from_matrix(matrices).as_quat()
    for i in range(1,len(q)):
        if np.dot(q[i-1],q[i])<0:q[i]*=-1
    return R.from_quat(unit(gaussian_filter1d(q,sigma,axis=0,mode='nearest'))).as_matrix()


def ik2(anchor,end,pole,l1,l2):
    delta=end-anchor; dist=np.linalg.norm(delta)
    direction=unit(delta)
    # Explicit hinge limits 3..155 degrees of flexion.
    low=np.sqrt(l1*l1+l2*l2+2*l1*l2*np.cos(np.deg2rad(155)))
    high=np.sqrt(l1*l1+l2*l2+2*l1*l2*np.cos(np.deg2rad(3)))
    d=np.clip(dist,low,high)
    along=(l1*l1-l2*l2+d*d)/(2*d)
    bend=pole-anchor-direction*np.dot(pole-anchor,direction)
    if np.linalg.norm(bend)<1e-6:
        helper=np.array([0,0,1.])
        if abs(np.dot(helper,direction))>.98:helper=np.array([1.,0,0])
        bend=helper-direction*np.dot(helper,direction)
    middle=anchor+direction*along+unit(bend)*np.sqrt(max(l1*l1-along*along,0))
    return middle,anchor+direction*d


def transported_normal(primary,measured,previous,initial):
    """Keep roll continuous; include a measured bend-plane constraint, not swing-only."""
    seed=initial if previous is None else previous
    base=seed-primary*np.dot(seed,primary)
    if np.linalg.norm(base)<.05:
        base=np.cross(primary,[1,0,0])
        if np.linalg.norm(base)<.05:base=np.cross(primary,[0,0,1])
    base=unit(base)
    aim=measured-primary*np.dot(measured,primary)
    if np.linalg.norm(aim)<1e-5:return base
    aim=unit(aim)
    if np.dot(aim,base)<0:aim=-aim
    angle=np.arctan2(np.dot(np.cross(base,aim),primary),np.dot(base,aim))
    angle=np.clip(angle,-np.deg2rad(8),np.deg2rad(8))
    return R.from_rotvec(primary*angle).apply(base)


def solve(rig, targets, manifest, out, v2=False):
    args=SimpleNamespace(rig=rig,targets=targets,manifest=manifest,out=out)
    g=GLB(args.rig); rest=g.fk(); nodes=g.doc['nodes']; nframes=0
    data=np.load(args.targets); p=data['points']; uv=data['image'];fps=float(data['fps']);nframes=len(p)
    manifest=json.loads(Path(args.manifest).read_text())
    idx=lambda n:g.names['mixamorig:'+n]
    pos=lambda n:rest[idx(n)][:3,3]
    rot=lambda n:rest[idx(n)][:3,:3]
    parent=g.parent.get(idx('Hips'))
    if parent is not None and not np.allclose(rest[parent],np.eye(4),atol=1e-6):
        raise ValueError('This POC requires identity parent transform above Hips; adapt root-space solve first.')
    if any(not np.allclose(m[:3,:3].T@m[:3,:3],np.eye(3),atol=1e-5) for m in rest.values()):
        raise ValueError('Non-unit bind scale is unsupported; do not silently alter geometry or inverse binds.')
    rest_torso=body_frame(pos('LeftArm')-pos('RightArm'),pos('Neck')-pos('Hips'))
    rest_hip=body_frame(pos('LeftUpLeg')-pos('RightUpLeg'),pos('Spine')-pos('Hips'))
    shoulders=p[:,[11,12]].mean(axis=1);hips=p[:,[23,24]].mean(axis=1)
    torso_up=unit(shoulders-hips)
    hf=[];tf=[]
    for f in range(nframes):
        hf.append(body_frame(p[f,23]-p[f,24],.35*torso_up[f]+np.array([0,.65,0])))
        tf.append(body_frame(p[f,11]-p[f,12],torso_up[f]))
    hf=smooth_rot(np.array(hf));tf=smooth_rot(np.array(tf))
    specs=[('Left',False,[11,13,15]),('Right',False,[12,14,16]),('Left',True,[23,25,27]),('Right',True,[24,26,28])]
    chains=[]
    for side,leg,joints in specs:
        names=[side+x for x in (['UpLeg','Leg','Foot'] if leg else ['Arm','ForeArm','Hand'])]
        a,b,c=[pos(n) for n in names];l1=np.linalg.norm(b-a);l2=np.linalg.norm(c-b)
        u=unit(gaussian_filter1d(unit(p[:,joints[1]]-p[:,joints[0]]),1.5,axis=0))
        v=unit(gaussian_filter1d(unit(p[:,joints[2]]-p[:,joints[1]]),1.5,axis=0))
        rn=unit(np.cross(unit(b-a),unit(c-b)))
        if np.linalg.norm(rn)<.5:rn=np.array([0,0,1.])
        chains.append(dict(side=side,leg=leg,joints=joints,names=names,l1=l1,l2=l2,u=u,v=v,
                           bind_bases=[frame(unit(b-a),rn),frame(unit(c-b),rn)],rest_normal=rn,
                           previous=[None,None]))
    height=pos('HeadTop_End')[1]
    pixheight=np.median((np.max(uv[:,[27,28],1],axis=1)-uv[:,0,1])*235)
    pelvis_image=uv[:,[23,24],0].mean(axis=1)*190
    rootx=(pelvis_image-np.median(pelvis_image))*height/max(pixheight,100)
    if v2:rootx=data['rootxy'][:,0]*height/1.5
    rootx=gaussian_filter1d(rootx,1.5)
    root=np.tile(pos('Hips'),(nframes,1));root[:,0]+=rootx;root[:,2]=pos('Hips')[2]
    # Ground height from target ankle bind height; no source scale imposed on target bones.
    ground_ankle={side:pos(side+'Foot')[1] for side in ['Left','Right']}
    rel_feet=np.zeros((nframes,2,3));foot_targets=np.zeros_like(rel_feet)
    for s,ch in enumerate(chains[2:]):
        h_offset=pos(ch['side']+'UpLeg')-pos('Hips')
        rel_feet[:,s]=np.einsum('nij,j->ni',hf@rest_hip.T,h_offset)+ch['l1']*ch['u']+ch['l2']*ch['v']
    root[:,1]=np.max(np.array([ground_ankle['Left'],ground_ankle['Right']])[None,:]-rel_feet[:,:,1],axis=1)
    root[:,1]=gaussian_filter1d(root[:,1],1)
    if v2:root[:,1]+=data['airborne_height']*height/1.5
    foot_targets=root[:,None,:]+rel_feet
    contacts=np.zeros((nframes,2),dtype=bool)
    for s,side in enumerate(['Left','Right']):
        floor=ground_ankle[side]
        speed=np.linalg.norm(np.gradient(foot_targets[:,s][:,[0,2]],axis=0)*fps,axis=1)
        contact=(foot_targets[:,s,1] < floor+.035)&(speed<.65)
        if v2:
            j=27+s;pixel_speed=np.linalg.norm(np.gradient(uv[:,j]*[480,360],axis=0),axis=1)
            contact &= (data['confidence'][:,j]>.35)&(pixel_speed<2.5)&(data['airborne_height']<.012)
        # Require >=3 observed contact frames; retain run boundaries for QA.
        edges=np.diff(np.r_[False,contact,False].astype(int));starts=np.where(edges==1)[0];ends=np.where(edges==-1)[0]
        for a,b in zip(starts,ends):
            if b-a<3:continue
            contacts[a:b,s]=True
            anchor=np.median(foot_targets[a:b,s],axis=0);anchor[1]=floor
            for f in range(max(0,a-3),min(nframes,b+3)):
                w=1. if a<=f<b else max(0,1-min(abs(f-a),abs(f-(b-1)))/4)
                foot_targets[f,s]=(1-w)*foot_targets[f,s]+w*anchor
        foot_targets[:,s,1]=np.maximum(foot_targets[:,s,1],floor-.005)
    # Reach-aware pelvis correction before solving knees.
    for f in range(nframes):
        lower=0.
        for s,ch in enumerate(chains[2:]):
            offset=(hf[f]@rest_hip.T)@(pos(ch['side']+'UpLeg')-pos('Hips'))
            hip=root[f]+offset;end=foot_targets[f,s]
            horizontal=np.linalg.norm((hip-end)[[0,2]])
            maxdy=np.sqrt(max((ch['l1']+ch['l2']-.004)**2-horizontal**2,0))
            lower=max(lower,hip[1]-end[1]-maxdy)
        root[f,1]-=max(lower,0)
    rotations={}; bone_positions=[]; solved_feet=[];foot_yaw={'Left':None,'Right':None}
    for f in range(nframes):
        qs={};ts={idx('Hips'):root[f]};world={}
        def recalc():
            nonlocal world
            world=g.fk(qs,ts)
        def set_world(name,desired):
            node=idx(name);parent=g.parent.get(node)
            parent_r=world[parent][:3,:3] if parent is not None else np.eye(3)
            qs[node]=R.from_matrix(parent_r.T@desired).as_quat();recalc()
        recalc()
        hd=hf[f]@rest_hip.T;td=tf[f]@rest_torso.T
        set_world('Hips',hd@rot('Hips'))
        # Spine twist/lean distributed across the existing three spine joints.
        relative=R.from_matrix(hd.T@td).as_rotvec()
        for name,w in [('Spine',.33),('Spine1',.66),('Spine2',1.),('Neck',1.),('Head',1.)]:
            set_world(name,hd@R.from_rotvec(relative*w).as_matrix()@rot(name))
        if v2:
            across=p[f,2]-p[f,5];up=p[f,0]-shoulders[f]
            if np.linalg.norm(across)>.025 and np.linalg.norm(up)>.05 and min(data['confidence'][f,[2,5]])>.35:
                delta=R.from_matrix(tf[f].T@body_frame(across,up)).as_rotvec()
                delta*=min(1,np.deg2rad(12)/max(np.linalg.norm(delta),1e-8))
                for name,w in [('Neck',.3),('Head',.7)]:set_world(name,td@R.from_rotvec(w*delta).as_matrix()@rot(name))
        for ci,ch in enumerate(chains):
            side=ch['side'];a,b,c=ch['names']
            if v2 and not ch['leg'] and 'mixamorig:'+side+'Shoulder' in g.names:
                elevation=np.clip((ch['u'][f,1]+.7)*.13,0,.19)
                axis=td@np.array([0,0,1 if side=='Left' else -1.])
                set_world(side+'Shoulder',R.from_rotvec(axis*elevation).as_matrix()@td@rot(side+'Shoulder'))
            anchor=world[idx(a)][:3,3]
            pole=anchor+ch['l1']*ch['u'][f]
            end=foot_targets[f,ci-2] if ch['leg'] else pole+ch['l2']*ch['v'][f]
            middle,end=ik2(anchor,end,pole,ch['l1'],ch['l2'])
            directions=[unit(middle-anchor),unit(end-middle)]
            normal=np.cross(directions[0],directions[1])
            for k,name in enumerate([a,b]):
                n=transported_normal(directions[k],normal,ch['previous'][k],td@ch['rest_normal'])
                ch['previous'][k]=n
                desired=frame(directions[k],n)@ch['bind_bases'][k].T@rot(name)
                set_world(name,desired)
            if ch['leg']:
                j=27 if side=='Left' else 28;toe=j+4
                delta=p[f,toe]-p[f,j]
                desired_yaw=np.arctan2(delta[0],delta[2])
                pitch=0.
                if v2:
                    forward=hd@np.array([0,0,1.]);base_yaw=np.arctan2(forward[0],forward[2])
                    offset=np.arcsin(np.clip(delta[0]/.16,-.7,.7)) if min(data['confidence'][f,[j,toe]])>.4 else 0.
                    desired_yaw=base_yaw+.5*offset
                    heel=j+2
                    if min(data['confidence'][f,[heel,toe]])>.45:pitch=np.clip(-np.arctan2(p[f,toe,1]-p[f,heel,1],.16),-.4,.4)
                    if contacts[f,ci-2]:pitch*=.25
                previous=foot_yaw[side]
                if previous is not None:
                    dy=(desired_yaw-previous+np.pi)%(2*np.pi)-np.pi
                    desired_yaw=previous+np.clip(dy,-.18,.18)
                foot_yaw[side]=desired_yaw
                rest_d=pos(side+'ToeBase')-pos(side+'Foot')
                yaw=desired_yaw-np.arctan2(rest_d[0],rest_d[2])
                set_world(c,R.from_euler('yx',[yaw,pitch]).as_matrix()@rot(c))
            elif v2:
                # Always key the hand: sparse conditional channels are invalid.
                set_world(c,world[idx(c)][:3,:3].copy())
                wrist=15 if side=='Left' else 16;tips=[17,19] if side=='Left' else [18,20]
                measured=p[f,tips].mean(axis=0)-p[f,wrist]
                finger=next((n for n in [side+'HandMiddle1',side+'HandMiddle4'] if 'mixamorig:'+n in g.names),None)
                if finger and np.linalg.norm(measured)>.025 and min(data['confidence'][f,tips])>.6:
                    aim=unit(world[idx(finger)][:3,3]-world[idx(c)][:3,3]);desired=unit(measured);axis=np.cross(aim,desired)
                    if np.linalg.norm(axis)>1e-6:
                        angle=min(.4*np.arccos(np.clip(np.dot(aim,desired),-1,1)),np.deg2rad(22))
                        set_world(c,R.from_rotvec(unit(axis)*angle).as_matrix()@world[idx(c)][:3,:3])
            # Hand and fingers retain bind-local transforms relative to solved forearm.
        for node,q in qs.items():rotations.setdefault(node,[]).append(q)
        bone_positions.append([world[j][:3,3] for j in g.doc['skins'][0]['joints']])
        solved_feet.append([world[idx(side+'Foot')][:3,3] for side in ['Left','Right']])
    rotations={i:np.array(q) for i,q in rotations.items()}
    limited=0;post_correction=np.zeros_like(root)
    if v2:
        for i,q in rotations.items():
            assert len(q)==nframes
            mats=smooth_rot(R.from_quat(q).as_matrix(),1.)
            for order in [range(1,nframes),range(nframes-2,-1,-1)]:
                backward=order.step<0
                for f in order:
                    prev=f+1 if backward else f-1;delta=R.from_matrix(mats[prev].T@mats[f]).as_rotvec();angle=np.linalg.norm(delta)
                    if angle>np.deg2rad(18):mats[f]=mats[prev]@R.from_rotvec(delta*np.deg2rad(18)/angle).as_matrix();limited+=1
            rotations[i]=R.from_matrix(mats).as_quat()
        bone_positions=[];solved_feet=[]
        for f in range(nframes):
            world=g.fk({i:q[f] for i,q in rotations.items()},{idx('Hips'):root[f]})
            bone_positions.append([world[j][:3,3] for j in g.doc['skins'][0]['joints']])
            solved_feet.append([world[idx(side+'Foot')][:3,3] for side in ['Left','Right']])
        # Filtering rotations changes FK contacts. Correct the actual baked feet,
        # without changing target bone lengths or integrating root displacement.
        baked=np.array(solved_feet)
        for f in range(nframes):
            planted=contacts[f]
            if planted.any():
                delta=(foot_targets[f,planted]-baked[f,planted]).mean(axis=0)
                post_correction[f,[0,2]]=np.clip(delta[[0,2]],-.04,.04)
        post_correction[:,[0,2]]=gaussian_filter1d(post_correction[:,[0,2]],.8,axis=0)
        floors=np.array([ground_ankle['Left'],ground_ankle['Right']])
        lift=np.maximum(0,np.max(floors[None,:]-.005-baked[:,:,1],axis=1))
        post_correction[:,1]=np.maximum(lift,gaussian_filter1d(lift,1))
        root+=post_correction;bone_positions=np.array(bone_positions)+post_correction[:,None,:];solved_feet=baked+post_correction[:,None,:]
    for motion in manifest['motions']:
        a,b=motion['source_frame_range'];sel=np.r_[np.arange(a,b),b-1]
        g.append_animation(motion['id'],np.arange(b-a+1)/fps,{i:q[sel] for i,q in rotations.items()},idx('Hips'),root[sel],
                           {'poc':True,'source_frames_half_open':motion.get('original_source_frame_range',[a,b]),'source_fps':fps,'complete':motion['complete'],
                            'source_clip':motion.get('source_clip'),'owner_visual_acceptance':'PENDING','v2':v2,
                            'warning':None if motion['complete'] else 'INCOMPLETE: source ends after 8 frames; not a usable third motion',
                            'solver':'target two-bone IK + bind-axis frame constraints; no source bone rotations'})
    g.write(args.out)
    out=Path(args.out)
    np.savez_compressed(out.with_suffix('.solve.npz'),root=root,contacts=contacts,foot_targets=foot_targets,
                        solved_feet=np.array(solved_feet),joint_positions=np.array(bone_positions),fps=fps,post_filter_root_correction=post_correction)
    report=dict(target=Path(args.rig).name,joints=len(g.doc['skins'][0]['joints']),fps=fps,
                new_clips=[m['id'] for m in manifest['motions']],root_xyz_range=np.ptp(root,axis=0).tolist(),
                preserved='Original nodes, meshes, UV, materials, images, skins, inverse binds, animations, BIN prefix',
                algorithms=['Target-length two-bone IK','3..155 degree hinge limits','Bind-frame two-axis constraints',
                            'Continuous bend normal transport with <=8 degree measured twist correction/frame',
                            'Ankle contact locks with 3-frame release blend','Reach-aware pelvis correction','No root depth integration'],
                contacts_frames=contacts.sum(axis=0).tolist(),
                limitations=['Feet contacts inferred, no ground truth','Root height keeps one foot near floor: aerial bounce may be suppressed',
                             'Neck/head follow torso; fingers stay in original local rest pose','Third clip incomplete'])
    out.with_suffix('.solve.json').write_text(json.dumps(report,indent=2)+'\n')
    if v2:
        report.update(angular_filter_limited_updates=limited,post_filter_root_correction_max=np.max(np.abs(post_correction),axis=0).tolist(),
          limitations=['Contacts inferred, not independently measured ground truth.','Monocular elbow/wrist depth approximate.','Head delta bounded to 12 degrees; palm correction bounded to 22 degrees; fingers remain bind-local.','18 degree/frame angular filter may soften accents and alter contact; actual baked feet corrected afterwards.'])
        out.with_suffix('.solve.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report),flush=True)
    return report


def main():
    ap=argparse.ArgumentParser()
    for name in ['rig','targets','manifest','out']:ap.add_argument('--'+name,required=True)
    ap.add_argument('--v2',action='store_true');solve(**vars(ap.parse_args()))


if __name__=='__main__':main()
