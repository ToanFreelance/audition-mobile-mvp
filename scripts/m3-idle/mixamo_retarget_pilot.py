#!/usr/bin/env python3
"""Import Mixamo animation-only FBX and retarget onto ORIGINAL M3 VRM glTF rest skeleton.

Dependencies: numpy, scipy. No external service, no FBX SDK, no generated poses.
Validation / preview only. Do not ship before owner visual approval.
"""
import argparse
import json
import math
import struct
import zlib
from pathlib import Path
from collections import defaultdict
import numpy as np
from scipy.spatial.transform import Rotation as Rot

TICKS_PER_SEC = 46186158000.0

class FNode:
    def __init__(self, name, props, children):
        self.name, self.props, self.children = name, props, children
    def first(self, name):
        return next((child for child in self.children if child.name == name), None)


def read_fbx(path):
    data = Path(path).read_bytes()
    if not data.startswith(b'Kaydara FBX Binary  \x00\x1a\x00'):
        raise ValueError('Expected binary FBX')
    ver = struct.unpack_from('<I', data, 23)[0]
    long = ver >= 7500
    def node(offset):
        if long:
            end, nprops, _, namelen = struct.unpack_from('<QQQB', data, offset)
            pos = offset+25
            terminator = 25
        else:
            end, nprops, _, namelen = struct.unpack_from('<IIIB', data, offset)
            pos = offset+13
            terminator = 13
        if not end:
            return None, pos
        name = data[pos:pos+namelen].decode('utf8', 'replace'); pos += namelen
        props=[]
        for _ in range(nprops):
            kind = chr(data[pos]); pos+=1
            if kind in 'YCIFDL':
                fmt = {'Y':'h','C':'?','I':'i','F':'f','D':'d','L':'q'}[kind]
                props.append(struct.unpack_from('<'+fmt, data, pos)[0]);pos+=struct.calcsize(fmt)
            elif kind in 'SR':
                size=struct.unpack_from('<I',data,pos)[0];pos+=4
                buf=data[pos:pos+size];pos+=size
                props.append(buf.decode('utf8','replace') if kind=='S' else buf)
            elif kind in 'fdilbc':
                n,encoding,length=struct.unpack_from('<III',data,pos);pos+=12
                raw=data[pos:pos+length];pos+=length
                if encoding == 1:raw=zlib.decompress(raw)
                elif encoding != 0:raise ValueError('unknown array encoding')
                dtype={'f':'<f4','d':'<f8','i':'<i4','l':'<i8','b':'i1','c':'i1'}[kind]
                props.append(np.frombuffer(raw, dtype=dtype, count=n).copy())
            else:raise ValueError(f'Unsupported property {kind}')
        children=[]
        while pos < end-terminator:
            child,pos=node(pos)
            if child:children.append(child)
            else:break
        return FNode(name,props,children),end
    items=[];offset=27
    while offset < len(data):
        n,new=node(offset)
        if not n:break
        items.append(n);offset=new
    return FNode('root',[],items)


def property_map(model):
    p=model.first('Properties70')
    return {v.props[0]:v.props[4:] for v in (p.children if p else []) if v.name=='P'}


def parse_animation(path):
    root=read_fbx(path)
    objects=root.first('Objects'); connections=root.first('Connections')
    byid={int(o.props[0]):o for o in objects.children if o.props and isinstance(o.props[0],int)}
    models={k:o for k,o in byid.items() if o.name=='Model'}
    curves={k:o for k,o in byid.items() if o.name=='AnimationCurve'}
    cnodes={k:o for k,o in byid.items() if o.name=='AnimationCurveNode'}
    conn=[o.props for o in connections.children if o.name=='C' and len(o.props)>=3]
    parent_ids={int(c[1]):int(c[2]) for c in conn if c[0]=='OO' and c[1] in models and c[2] in models}
    source={}
    for k,o in models.items():
        name=o.props[1].split('\x00')[0].removeprefix('mixamorig:')
        props=property_map(o)
        def xyz(prop):return np.array(props.get(prop,[0,0,0])[:3],dtype=float)
        source[k]={'name':name,'parent':parent_ids.get(k),'translation':xyz('Lcl Translation')/100,
                   'rotation':xyz('Lcl Rotation'),'pre':xyz('PreRotation'),'post':xyz('PostRotation')}
    keys=defaultdict(dict)
    for c in conn:
        if c[0]!='OP' or c[1] not in cnodes or c[2] not in models:continue
        nodeid, modelid, channel=c[1],c[2],c[3]
        if channel not in ['Lcl Rotation','Lcl Translation']:continue
        for sub in conn:
            if sub[0]!='OP' or sub[2]!=nodeid or sub[1] not in curves:continue
            curve=curves[sub[1]]
            t=curve.first('KeyTime')
            values=curve.first('KeyValueFloat') or curve.first('KeyValueDouble')
            if t is None or values is None:continue
            coord=sub[3].split('|')[-1]
            keys[modelid][(channel,coord)]=(np.asarray(t.props[0],dtype=np.int64),np.asarray(values.props[0],dtype=float))
    if not keys:raise ValueError('Missing animation curves')
    starts=[float(t[0]) for v in keys.values() for t,z in v.values()]
    ends=[float(t[-1]) for v in keys.values() for t,z in v.values()]
    t0=min(starts);t1=max(ends)
    fps=30
    framecount=int(round((t1-t0)/TICKS_PER_SEC*fps))+1
    seconds=(t0+np.arange(framecount)/fps*TICKS_PER_SEC)
    for k,m in source.items():
        m['frames_rotation']=np.tile(m['rotation'],(framecount,1))
        m['frames_translation']=np.tile(m['translation'],(framecount,1))
        for typ,channels,scale in [('Lcl Rotation',m['frames_rotation'],1),('Lcl Translation',m['frames_translation'],1/100)]:
            for index,axis in enumerate('XYZ'):
                if (typ,axis) not in keys[k]:continue
                ts,vs=keys[k][(typ,axis)]
                # Raw FBX rotation values are Euler degrees; use source’s full authored curves.
                channels[:,index]=np.interp(seconds,ts,vs)*scale
    names={v['name']:k for k,v in source.items()}
    if not all(k in names for k in ['Hips','Spine','LeftUpLeg','RightUpLeg','LeftArm','RightArm']):
        raise ValueError('Missing required Mixamo joints')
    return source,names,framecount


def parse_vrm(path):
    raw=Path(path).read_bytes()
    if raw[:4]!=b'glTF':raise ValueError('Expected VRM binary glTF')
    json_size=struct.unpack_from('<I',raw,12)[0]
    gltf=json.loads(raw[20:20+json_size])
    nodes=gltf['nodes']
    parents={child:i for i,n in enumerate(nodes) for child in n.get('children',[])}
    out={}
    cache={}
    def world(i):
        if i in cache:return cache[i]
        node=nodes[i]
        q=node.get('rotation',[0,0,0,1])
        rq=Rot.from_quat(q)
        t=np.asarray(node.get('translation',[0,0,0]),dtype=float)
        if i in parents:
            p_r,p_t=world(parents[i]);ret=(p_r*rq,p_t+p_r.apply(t))
        else:ret=(rq,t)
        cache[i]=ret
        return ret
    for i,node in enumerate(nodes):
        name=node.get('name')
        if not name:continue
        pr=nodes[parents[i]].get('name') if i in parents else None
        r,t=world(i)
        out[name]={'parent':pr,'world_rest_rotation':r,'world_rest_position':t,'local_rest_rotation':Rot.from_quat(node.get('rotation',[0,0,0,1])),
                   'local_rest_position':np.asarray(node.get('translation',[0,0,0]),dtype=float)}
    for name in ['hips','spine','chest','upper_chest','head','upper_arm.L','upper_leg.L','foot.L']:
        if name not in out:raise ValueError(f'M3 bone not found: {name}')
    return out


def skeleton_sources(loaded,framecount):
    source,names=loaded
    rest={};animated={}
    def calc(k):
        if k in rest:return
        m=source[k];parent=m['parent']
        if parent is not None:calc(parent)
        # FBX rotation order = Euler XYZ (extrinsic); PreRotation applied in local parent basis.
        r0=(Rot.from_euler('xyz',m['pre'],degrees=True)*Rot.from_euler('xyz',m['rotation'],degrees=True)*
            Rot.from_euler('xyz',m['post'],degrees=True).inv())
        rf=(Rot.from_euler('xyz',m['pre'],degrees=True)*Rot.from_euler('xyz',m['frames_rotation'],degrees=True)*
            Rot.from_euler('xyz',m['post'],degrees=True).inv())
        if parent is None:
            rest[k]=(r0,m['translation'])
            animated[k]=(rf,m['frames_translation'])
        else:
            pr,pt=rest[parent];paf,pat=animated[parent]
            rest[k]=(pr*r0,pt+pr.apply(m['translation']))
            animated[k]=(paf*rf,pat+paf.apply(m['frames_translation']))
    for k in source:calc(k)
    return rest,animated

MAP={'hips':'Hips','spine':'Spine','chest':'Spine1','upper_chest':'Spine2','neck':'Neck','head':'Head'}
for side,prefix in [('L','Left'),('R','Right')]:
    for target,src in [('shoulder','Shoulder'),('upper_arm','Arm'),('lower_arm','ForeArm'),('hand','Hand'),('upper_leg','UpLeg'),('lower_leg','Leg'),('foot','Foot'),('toes','ToeBase')]:
        MAP[target+'.'+side]=prefix+src
    for target,src in [('thumb','Thumb'),('index','Index'),('middle','Middle'),('ring','Ring'),('little','Pinky')]:
        for i,segment in enumerate(['proximal','intermediate','distal'],start=1):
            MAP[f'{target}.{segment}.{side}']=f'{prefix}Hand{src}{i}'


def retarget(source, names, framecount, target, clip_id, source_file, rig_family):
    source_rest,source_frames=skeleton_sources((source,names),framecount)
    # Need hierarchy order not alphabetical. Source and destination use same Y-up, left-positive-X.
    # True joint orientations are transferred via WORLD-SPACE DELTA FROM REST,
    # then converted back to each target's local quaternion under its animated parent.
    src_delta={}
    for dst,src in MAP.items():
        if dst not in target or src not in names:continue
        id=names[src]
        src_delta[dst]=source_frames[id][0]*source_rest[id][0].inv()
    order=[]
    def walk(name):
        if name in order:return
        p=target[name]['parent']
        if p in target:walk(p)
        order.append(name)
    for b in target:walk(b)
    n=framecount
    world={};tracks={}
    for name in order:
        b=target[name];base=b['world_rest_rotation'];parent=b['parent']
        if name in src_delta:
            wf=src_delta[name]*base
        elif parent in world:
            wf=world[parent]*b['local_rest_rotation']
        else:
            wf=Rot.from_quat(np.tile(base.as_quat(),(n,1)))
        world[name]=wf
        if name not in src_delta:continue
        local=world[parent].inv()*wf if parent in world else wf
        quats=local.as_quat()
        # Quaternion double-cover: maintain adjacent positive dot products.
        for i in range(1,len(quats)):
            if np.dot(quats[i-1],quats[i])<0:quats[i]*=-1
        tracks[name]={'frames':list(range(n)),'values':np.round(quats,7).reshape(-1).tolist()}
    src_hip=names['Hips'];hip=source_frames[src_hip][1]
    source_rest_hip=source_rest[src_hip][1]
    source_height=np.linalg.norm(source_rest[names['Hips']][1]-source_rest[names['LeftFoot']][1])
    target_height=np.linalg.norm(target['hips']['world_rest_position']-target['foot.L']['world_rest_position'])
    ratio=target_height/max(0.001,source_height)
    center=np.asarray(target['hips']['local_rest_position'])
    # Use the first source root position as local actor anchor; preserve authored sway.
    hip_offsets=(hip-hip[0])*ratio
    tracks['hips.position']={'frames':list(range(n)),'values':np.round(hip_offsets,7).reshape(-1).tolist()}
    return {'fps':30,'lastFrame':n-1,'sourceFrameCount':n,'sourceStartFrame':0,
            'authoring':'Retarget Mixamo FBX source hierarchy onto original M3 rest, source keyframes at 30 fps',
            'motionOwner':'mixamo-full-body','id':clip_id,'sourceFilename':Path(source_file).name,
            'rigFamily':rig_family,
            'tracks':tracks},world,hip_offsets


def validation(data,world,offsets,target):
    n=data['sourceFrameCount'];problems=[]
    metrics={'frames':n,'tracks':len(data['tracks']),'durationSeconds':n/30}
    for name,tr in data['tracks'].items():
        v=np.array(tr['values'],dtype=float)
        if not np.all(np.isfinite(v)):problems.append('non-finite: '+name)
        if name=='hips.position':continue
        q=v.reshape(n,4)
        if np.max(abs(np.linalg.norm(q,axis=1)-1))>1e-5:problems.append('non-unit quat '+name)
        if np.min(np.einsum('ij,ij->i',q[:-1],q[1:]))<0:problems.append('quaternion sign jump '+name)
    roots=np.array(offsets)
    metrics['rootHorizontalRadiusM']=round(float(np.max(np.linalg.norm(roots[:,[0,2]],axis=1))),4)
    # FK world positions. Rotations all exist, positions from parent rest translations.
    names=[]
    def order(n):
        if n in names:return
        p=target[n]['parent']
        if p in target:order(p)
        names.append(n)
    for k in target:order(k)
    out={}
    for name in names:
        b=target[name];p=b['parent']
        if p in out:
            pr,pt=out[p];pose=pt+pr.apply(np.tile(b['local_rest_position'],(n,1)))
            # rotation track for local or rest local
            rot=Rot.from_quat(np.array(data['tracks'][name]['values']).reshape(n,4)) if name in data['tracks'] else Rot.from_quat(np.tile(b['local_rest_rotation'].as_quat(),(n,1)))
            r=pr*rot
        else:
            pose=np.tile(b['local_rest_position'],(n,1));r=Rot.from_quat(np.tile(b['local_rest_rotation'].as_quat(),(n,1)))
        if name=='hips':pose+=roots
        out[name]=(r,pose)
    for side in ['L','R']:
        feet=out['foot.'+side][1]
        speed=np.linalg.norm(np.diff(feet[:,[0,2]],axis=0),axis=1)*30
        # Low ankle speed is a diagnostic only, NOT proof of ground contact.
        contact=speed<0.08
        diagnostics={'lowSpeedPercentage':round(100*float(contact.mean()),1),
                     'maxSoleYDeltaM':round(float(feet[:,1].max()-feet[:,1].min()),4),
                     'maxHorizontalRadiusM':round(float(np.linalg.norm(feet[:,[0,2]],axis=1).max()),4),
                     'loopStartEndFootDifferenceM':round(float(np.linalg.norm(feet[-1]-feet[0])),4),
                     'maxAnkleHorizontalSpeedMps':round(float(speed.max()),4),
                     'ankleHorizontalPathLengthM':round(float(np.linalg.norm(np.diff(feet[:,[0,2]],axis=0),axis=1).sum()),4)}
        metrics['foot'+side]=diagnostics
    max_step=0.0
    for name, track in data['tracks'].items():
        if name=='hips.position':continue
        q=Rot.from_quat(np.asarray(track['values']).reshape(n,4))
        deltas=(q[:-1].inv()*q[1:]).magnitude()*180/math.pi
        max_step=max(max_step,float(np.max(deltas)))
    metrics['maxRotationStepDegrees']=round(max_step,3)
    return out,metrics,problems


def save_preview(out,folder,prefix,frames_per_second=10):
    import cv2
    from PIL import Image,ImageDraw,ImageFont
    n=len(out['hips'][1]);names=['hips','spine','chest','upper_chest','neck','head','shoulder.L','upper_arm.L','lower_arm.L','hand.L','shoulder.R','upper_arm.R','lower_arm.R','hand.R','upper_leg.L','lower_leg.L','foot.L','upper_leg.R','lower_leg.R','foot.R']
    segments=[('hips','spine'),('spine','chest'),('chest','upper_chest'),('upper_chest','neck'),('neck','head')]+[(a+'.'+side,b+'.'+side) for a,b in [('shoulder','upper_arm'),('upper_arm','lower_arm'),('lower_arm','hand'),('upper_leg','lower_leg'),('lower_leg','foot')] for side in ['L','R']]+[('upper_chest','shoulder.L'),('upper_chest','shoulder.R'),('hips','upper_leg.L'),('hips','upper_leg.R')]
    target=Path(folder)/(prefix+'.mp4');fourcc=cv2.VideoWriter_fourcc(*'mp4v');video=cv2.VideoWriter(str(target),fourcc,frames_per_second,(960,720))
    if not video.isOpened():raise RuntimeError('preview encoder failed')
    for i in range(0,n,3):
        frame=np.full((720,960,3),25,dtype=np.uint8)
        for view in [0,1]:
            def xy(name):
                x,y,z=out[name][1][i];
                if view==0: return int(235 + x*370), int(600-y*370)
                return int(730 + z*370),int(600-y*370)
            for a,b in segments:
                if a not in out or b not in out:continue
                cv2.line(frame,xy(a),xy(b),(118,185,235) if a.endswith('.L') or b.endswith('.L') else (225,208,138),3,cv2.LINE_AA)
            for bone in names:
                if bone not in out:continue
                cv2.circle(frame,xy(bone),4,(221,241,235),-1,cv2.LINE_AA)
        cv2.putText(frame,prefix+f'  {i/30:.2f}s   /  {n/30:.2f}s', (25,37),cv2.FONT_HERSHEY_SIMPLEX,.7,(230,230,230),2,cv2.LINE_AA)
        cv2.putText(frame,'FRONT skeleton', (140,670),cv2.FONT_HERSHEY_SIMPLEX,.6,(200,200,200),1)
        cv2.putText(frame,'SIDE skeleton', (625,670),cv2.FONT_HERSHEY_SIMPLEX,.6,(200,200,200),1)
        video.write(frame)
    video.release()
    return str(target)


def main():
    p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--target',required=True);p.add_argument('--output',required=True);p.add_argument('--clip-id',required=True);p.add_argument('--rig-family',choices=['drophunter','neurohacker'],required=True);p.add_argument('--preview',action='store_true');args=p.parse_args()
    source,names,n=parse_animation(args.source)
    target=parse_vrm(args.target)
    result,rotations,offsets=retarget(source,names,n,target,args.clip_id,args.source,args.rig_family)
    fk,metrics,problems=validation(result,rotations,offsets,target)
    out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    (out/(args.clip_id+'.json')).write_text(json.dumps(result,separators=(',',':')))
    (out/(args.clip_id+'-qa.json')).write_text(json.dumps({'metrics':metrics,'errors':problems},indent=2))
    if args.preview:save_preview(fk,out,args.clip_id)
    print(args.clip_id,metrics,'ERRORS',problems)
    if problems:raise SystemExit(2)

if __name__=='__main__':main()