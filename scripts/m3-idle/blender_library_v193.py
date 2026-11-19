"""Reproducible Blender source for all nine source-reviewed full-body actions.
blender -b -t 4 -P scripts/m3-idle/blender_library_v193.py -- \
 --assets PRIVATE_M3_CACHE --output PRIVATE_OUTPUT --clips F01 F02 --render keys
The private meshes/source video are not part of the repository. No detector data
are consumed by this authoring/bake. Stage controls are editable Blender actions.
"""
import argparse,hashlib,json,math,shutil,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
from mathutils import Matrix,Quaternion,Vector
import blender_f01_v192 as base
from poses_v193 import WINDOWS,POSES,FEET,CONTACTS
C,CI=base.C,base.CI

def import_rig(assets,out,family):
    paths=([('body','body/drophunter.vrm'),('eyes','eyes/regulareyes.vrm'),
      ('top','chest/shirt.vrm'),('bottom','legs/casualshorts.vrm'),
      ('shoes','feet/sneakers.vrm'),('hair','head/short.vrm')] if family=='drophunter' else
      [('body','body/neurohacker.vrm'),('eyes','eyes/regulareyes.vrm'),
      ('top','chest/logotee.vrm'),('bottom','legs/cargoshorts.vrm'),
      ('shoes','foot/simpleshoes.vrm'),('hair','head/short.vrm')])
    arm=None
    for slot,path in paths:
        temp=out/(slot+'.glb');shutil.copyfile(assets/family/path,temp)
        old=set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(temp),bone_heuristic='BLENDER')
        added=set(bpy.data.objects)-old
        rig=next(o for o in added if o.type=='ARMATURE')
        if arm is None:arm=rig;arm.name=family+'_canonical'
        for obj in added:
            if obj.type=='MESH' and any(m.type=='ARMATURE' for m in obj.modifiers):
                obj.name=slot+':'+obj.name
                transform=obj.matrix_world.copy();obj.parent=arm;obj.matrix_world=transform
                for mod in obj.modifiers:
                    if mod.type=='ARMATURE':mod.object=arm
            elif obj!=arm:bpy.data.objects.remove(obj,do_unlink=True)
        temp.unlink()
    return arm,paths

def hand_pose(id,side,f):
    """Authored palm direction/twist/flex; interpolated as quaternion controls."""
    sign=1 if side=='L' else -1
    direction=(.06*sign,-.99,.10);twist=.12;flex=.25
    if id=='F01' and side=='L':
        direction=base.DIRECTIONS[f];twist=.45 if 112<=f<=230 else .12;flex=.12 if 112<=f<=230 else .28
    elif id=='F02':
        if side=='L' and 86<=f<=134:direction=(.10,.9,.38);twist=.35;flex=.16
        elif side=='R':direction=(-.15,-.55,.82);flex=.35
    elif id=='F03':
        direction=(-.15*sign,.85,.50);twist=sign*.25;flex=.55
    elif id=='F04':
        if side=='L' and 36<=f<=166:direction=(-.55,.65,.52);flex=.18;twist=.25
    elif id=='F05':
        direction=(-.60,-.60,.50) if side=='L' else (.80,.05,.60);twist=sign*.35;flex=.28
    elif id=='M02':
        if side=='L':direction=(.25,.85,.46);twist=.6;flex=.25
        else:direction=(.20,-.75,.63);flex=.35
    elif id=='X01':
        if side=='L' and 89<=f<=165:direction=(-.20,.85,.48);twist=.3;flex=.20
        elif side=='L' and 38<=f<=76:direction=(-.85,.20,.48)
        elif side=='R':direction=(-.15,-.50,.85);flex=.30
    elif id=='M03':
        if side=='R' and 60<=f<=142:direction=(-.35,.90,.25);twist=-.25;flex=.55
        elif side=='R' and 40<=f<=162:direction=(.25,.65,.72);flex=.30
        elif side=='L':direction=(.10,-.98,-.10)
    return Vector(direction).normalized(),twist,flex

def hand_rotation(id,side,f):
    direction,twist,flex=hand_pose(id,side,f);sign=1 if side=='L' else -1
    def quat(d,t):
        d=Vector(d).normalized()
        return Quaternion(d,t) @ Vector((sign,0,0)).rotation_difference(d)
    neutral=((.06*sign,-.99,.10),.12);keys=None
    if id=='F02' and side=='L':
        raised=((.10,.9,.38),.35)
        keys=[(0,neutral),(64,neutral),(96,raised),(120,raised),(173,neutral),(411,neutral)]
    elif id=='F04' and side=='L':
        chest=((-.55,.65,.52),.25)
        keys=[(0,neutral),(24,neutral),(48,chest),(158,chest),(194,neutral),(231,neutral)]
    elif id=='X01' and side=='L':
        waist=((-.85,.20,.48),.12);cheek=((-.20,.85,.48),.3)
        keys=[(0,neutral),(25,neutral),(50,waist),(76,waist),(114,cheek),(140,cheek),(191,neutral),(242,neutral)]
    elif id=='M03' and side=='R':
        chest=((.25,.65,.72),.12);open_hand=((-.35,.90,.25),-.25)
        keys=[(0,neutral),(20,neutral),(50,chest),(81,open_hand),(132,open_hand),(152,chest),(182,neutral),(193,neutral)]
    if keys:
        for (a,va),(b,vb) in zip(keys,keys[1:]):
            if a<=f<=b:
                t=(f-a)/(b-a);t=t*t*(3-2*t);q=quat(*va);r=quat(*vb)
                if q.dot(r)<0:r.negate()
                return q.slerp(r,t),flex
    return quat(direction,twist),flex

def elbow_pole(id,side,f,x):
    sign=1 if side=='L' else -1
    pole=(x+sign*.43,.78,-.08)
    if id=='F01' and side=='L':
        t=min(1,max(0,(f-80)/48),max(0,(272-f)/42));t=t*t*(3-2*t)
        pole=(x+.42,.65+.13*t,.20-.28*t)
    if id=='F03':pole=(x+sign*.43,1.10 if 72<=f<=132 else .87,-.06)
    if id=='F04' and side=='L' and 36<=f<=166:pole=(x+.37,.86,.03)
    if id=='F05':pole=(x+sign*.43,.87,.20)
    if id=='M02' and side=='L':pole=(x+.48,.94,-.06)
    if id=='X01' and side=='L':pole=(x+.42,.90,-.03)
    if id=='M03' and side=='L':pole=(x+.40,.87,-.16)
    return Vector(pole)

def author(arm,id):
    base.previous_quaternions.clear()
    bpy.context.view_layer.objects.active=arm;arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for side in ['L','R']:
        for parent,child in [('upper_arm','lower_arm'),('lower_arm','hand'),('upper_leg','lower_leg'),('lower_leg','foot')]:
            arm.data.edit_bones[parent+'.'+side].tail=arm.data.edit_bones[child+'.'+side].head
    bpy.ops.object.mode_set(mode='OBJECT')
    bones=arm.pose.bones
    for bone in bones:bone.rotation_mode='QUATERNION'
    hips_rest=bones['hips'].bone.matrix_local.copy()
    for row in POSES[id]:
        f,x,y,z,yaw,cy,roll,pitch,hy,hp,hr,*hands=row
        for name,q in [('hips',base.rotation(yaw,roll)),
          ('spine',base.rotation(cy*.55,-roll*.4,pitch*.55)),
          ('chest',base.rotation(cy*.45,-roll*.25,pitch*.45)),
          ('neck',base.rotation(hy*.3,hr*.3,hp*.3)),('head',base.rotation(hy*.7,hr*.7,hp*.7)),
          ('shoulder.L',base.rotation(0,.02)),('shoulder.R',base.rotation(0,-.02))]:
            bone=bones[name];basis=bone.bone.matrix_local.to_3x3()
            desired=C.to_3x3() @ q.to_matrix() @ CI.to_3x3()
            base.key(bone,'rotation_quaternion',(basis.inverted() @ desired @ basis).to_quaternion(),f)
        base.key(bones['hips'],'location',hips_rest.to_3x3().inverted() @ (C.to_3x3() @ Vector((x,y,z))),f)
    bpy.context.view_layer.update()
    for side in ['L','R']:
        hand=base.empty('CTRL_hand_'+side);elbow=base.empty('POLE_elbow_'+side)
        foot=base.empty('CTRL_foot_'+side);knee=base.empty('POLE_knee_'+side)
        for obj in [hand,foot]:obj.rotation_mode='QUATERNION'
        ankle_height=bones['foot.'+side].bone.head_local.z
        sole=min((o.matrix_world @ v.co).z for o in bpy.data.objects
            if o.type=='MESH' and o.name.startswith('shoes:') for v in o.data.vertices)
        for f,x,z,lift,yaw,pitch in FEET[id][side]:
            base.key(foot,'location',C.to_3x3() @ Vector((x,ankle_height-sole+lift,z)),f)
            q=C.to_quaternion() @ base.rotation(yaw,0,pitch) @ CI.to_quaternion()
            base.key(foot,'rotation_quaternion',q @ bones['foot.'+side].bone.matrix_local.to_quaternion(),f)
        sign=1 if side=='L' else -1
        for row in POSES[id]:
            f,x,y,z,yaw,cy,roll,pitch,hy,hp,hr,*hands=row
            wrist=Vector(hands[:3] if side=='L' else hands[3:])
            base.key(hand,'location',C.to_3x3() @ wrist,f)
            base.key(elbow,'location',C.to_3x3() @ elbow_pole(id,side,f,x),f)
            # Poles point forward and out, never behind the anatomical knee.
            base.key(knee,'location',C.to_3x3() @ Vector((x+sign*.14,.42,1)),f)
            q,flex=hand_rotation(id,side,f)
            world=C.to_quaternion() @ q @ CI.to_quaternion()
            base.key(hand,'rotation_quaternion',world @ bones['hand.'+side].bone.matrix_local.to_quaternion(),f)
            for digit in ['thumb','index','middle','ring','little']:
                for segment in ['proximal','intermediate','distal']:
                    bone=bones.get(digit+'.'+segment+'.'+side)
                    if bone is None:continue
                    amount=flex
                    if id=='M03' and side=='R' and 71<=f<=132 and digit=='index':amount=.04
                    q=C.to_quaternion() @ Quaternion(Vector((0,0,-sign)),amount) @ CI.to_quaternion()
                    basis=bone.bone.matrix_local.to_quaternion()
                    base.key(bone,'rotation_quaternion',basis.inverted() @ q @ basis,f)
        for kind,target,pole in [('arm',hand,elbow),('leg',foot,knee)]:
            bone=bones[('lower_arm.' if kind=='arm' else 'lower_leg.')+side]
            ik=bone.constraints.new('IK');ik.name=id+'_'+kind+'_two_bone'
            ik.target=target;ik.pole_target=pole;ik.chain_count=2;ik.use_stretch=False
            for joint in [bone,bone.parent]:
                joint.ik_stretch=0
                for axis in ['x','y','z']:
                    setattr(joint,'use_ik_limit_'+axis,True)
                    setattr(joint,'ik_min_'+axis,-2.8 if kind=='arm' else -1.4)
                    setattr(joint,'ik_max_'+axis,2.8 if kind=='arm' else 1.4)
            if kind=='arm':
                bone.lock_ik_x=bone.lock_ik_y=True
                bone.ik_min_z=-2.8 if side=='L' else .06
                bone.ik_max_z=-.06 if side=='L' else 2.8
            else:
                bone.lock_ik_y=bone.lock_ik_z=True;bone.ik_min_x=-.02;bone.ik_max_x=2.4
            bpy.context.scene.frame_set(1);scores=[]
            for angle in [0,math.pi/2,-math.pi/2,math.pi]:
                ik.pole_angle=angle;bpy.context.view_layer.update()
                scores.append(((bone.head-pole.location).length,angle))
            ik.pole_angle=min(scores)[1]
        for name,target in [('hand.'+side,hand),('foot.'+side,foot)]:
            con=bones[name].constraints.new('COPY_ROTATION');con.name=id+'_authored_orientation'
            con.target=target;con.target_space=con.owner_space='WORLD'
    for obj in [arm,*bpy.data.objects]:base.smooth(obj)
    arm.animation_data.action.name=id+'_full_body_source_keys'

def bake(arm,assets,out,id,family):
    first,last=WINDOWS[id];count=last-first+1
    original=base.original_world(assets/family/'body'/(family+'.vrm'))
    driven=[b for b in arm.pose.bones if b.name in original and
      (b.constraints or b.name in ['hips','spine','chest','neck','head','shoulder.L','shoulder.R'] or
       b.name.startswith(('upper_arm.','lower_arm.','upper_leg.','lower_leg.','thumb.','index.','middle.','ring.','little.')))]
    frames=list(range(count));tracks={b.name:{'frames':frames,'values':[]} for b in driven}
    tracks['hips.position']={'frames':frames,'values':[]};rows=[]
    for frame in frames:
        bpy.context.scene.frame_set(frame+1);bpy.context.view_layer.update()
        world={b.name:CI @ arm.matrix_world @ b.matrix @ b.bone.matrix_local.inverted() @ C @ original[b.name]
               for b in arm.pose.bones if b.name in original}
        for bone in driven:
            matrix=world[bone.name]
            if bone.parent and bone.parent.name in world:matrix=world[bone.parent.name].inverted() @ matrix
            q=matrix.to_quaternion().normalized();values=tracks[bone.name]['values']
            if values and sum(a*b for a,b in zip([q.x,q.y,q.z,q.w],values[-4:]))<0:q.negate()
            values.extend(round(v,9) for v in [q.x,q.y,q.z,q.w])
        tracks['hips.position']['values'].extend(round(v,9) for v in world['hips'].translation-original['hips'].translation)
        yaw=[]
        for side in ['L','R']:
            matrix=(world['foot.'+side] @ original['foot.'+side].inverted()).to_3x3()
            yaw.append(math.atan2(matrix[0][2],matrix[2][2]))
        rows.append({'frame':frame,'joints':{n:list(m.translation) for n,m in world.items()},'footYaw':yaw,
          'contact':[any(a<=frame<=b for a,b in CONTACTS[id][s]) for s in ['L','R']]})
    data={'fps':30,'lastFrame':count-1,'sourceFrameCount':count,'sourceStartFrame':first,
      'authoring':'Blender V1.9.3 manual full-body source keys; visual acceptance OPEN',
      'motionOwner':'blender-full-body','rigFamily':family,'authoringKeyFrames':[r[0] for r in POSES[id]],
      'contactWindows':CONTACTS[id],
      'footSamples':[[r['joints']['foot.'+s] for s in ['L','R']] for r in rows],
      'footYawSamples':[r['footYaw'] for r in rows],'tracks':tracks}
    (out/(id+'-blender.json')).write_text(json.dumps(data,separators=(',',':'))+'\n')
    (out/'blender-pivots.json').write_text(json.dumps(rows,separators=(',',':')))
    mapping={b.name:{'parent':b.parent.name if b.parent else None,
      'restBlender':[v for row in b.bone.matrix_local for v in row],
      'restGltf':[v for row in original[b.name] for v in row]} for b in driven}
    (out/'rig-mapping.json').write_text(json.dumps(mapping,indent=2))
    return len(driven)+1

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--assets',type=Path,required=True);parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--clips',nargs='+',choices=list(WINDOWS),default=list(WINDOWS))
    parser.add_argument('--render',choices=['keys','none'],default='keys')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    for id in args.clips:
        out=(args.output/id).resolve();out.mkdir(parents=True,exist_ok=True)
        bpy.ops.wm.read_factory_settings(use_empty=True)
        scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=WINDOWS[id][1]-WINDOWS[id][0]+1;scene.render.fps=30
        family='drophunter' if id in ['F01','F02','F03','F04','F05'] else 'neurohacker'
        arm,paths=import_rig(args.assets.resolve(),out,family);author(arm,id)
        track_count=bake(arm,args.assets.resolve(),out,id,family)
        front,side=base.stage();scene.camera=front;scene.frame_set(1)
        bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out/(id+'-authoring.blend')))
        manifest={'clip':id,'blender':bpy.app.version_string,'sourceFrames':WINDOWS[id],
          'rigFamily':family,'rigBones':len(arm.data.bones),'tracks':track_count,'contactWindows':CONTACTS[id],
          'keyFrames':[r[0] for r in POSES[id]],
          'sourceSHA256':'863d368b02d0b3b5280fdba15befd73f0eb98139ed189d80118eb3d53c7e9bdb',
          'assets':{path:hashlib.sha256((args.assets/family/path).read_bytes()).hexdigest() for slot,path in paths},
          'depthStatus':'MANUAL_ARTISTIC_INFERENCE_NOT_MEASURED','visualAcceptance':'OPEN'}
        (out/'manifest.json').write_text(json.dumps(manifest,indent=2))
        if args.render=='keys':
            for view,cam in [('front',front),('side',side)]:
                scene.camera=cam;(out/view).mkdir(exist_ok=True)
                for frame in manifest['keyFrames']:
                    scene.frame_set(frame+1);scene.render.filepath=str(out/view/f'{frame:04}.png')
                    bpy.ops.render.render(write_still=True)
        print('V193_COMPLETE',id,json.dumps(manifest),flush=True)
if __name__=='__main__':main()
