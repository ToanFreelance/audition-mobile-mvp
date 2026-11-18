"""F01 full-body action on the actual Drophunter rig. Blender 4.3.2.
blender -b -t 4 -P scripts/m3-idle/blender_f01_v192.py -- --assets CACHE --output OUT
Control positions are source-reviewed authoring decisions. Depth remains inferred.
"""
import argparse
import hashlib
import json
import math
import shutil
import struct
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Quaternion, Vector

C = Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
CI = C.inverted()
# frame, pelvis XYZ offset, pelvis yaw, chest yaw, roll, left/right wrist XYZ
POSES = [
 (0,-.028,-.006,0,-.06,.02,-.015,.075,.94,.16,-.232,.856,.045),
 (30,-.030,-.005,0,-.065,.02,-.012,.073,.941,.16,-.231,.856,.046),
 (60,-.026,-.006,0,-.055,.02,-.015,.076,.94,.16,-.230,.855,.048),
 (80,-.028,-.006,0,-.06,.02,-.015,.075,.94,.16,-.232,.856,.045),
 (92,-.032,-.008,.002,-.055,.025,-.017,.080,.939,.16,-.232,.856,.045),
 (100,-.022,-.009,.005,.01,.06,-.01,.15,.965,.19,-.224,.855,.04),
 (106,-.005,-.008,.003,.10,.11,0,.235,1.025,.21,-.205,.852,.045),
 (112,.012,-.006,0,.18,.12,.01,.29,1.105,.22,-.190,.85,.06),
 (119,.047,-.007,-.003,.26,.14,.022,.31,1.145,.20,-.153,.85,.08),
 (128,.103,-.009,-.006,.32,.13,.034,.355,1.155,.20,-.109,.85,.10),
 (140,.105,-.008,-.008,.33,.12,.033,.345,1.12,.21,-.095,.85,.10),
 (172,.099,-.008,-.009,.31,.13,.030,.35,1.15,.21,-.107,.85,.10),
 (200,.103,-.007,-.008,.32,.13,.032,.35,1.15,.21,-.105,.85,.10),
 (224,.101,-.008,-.008,.31,.13,.031,.344,1.14,.21,-.108,.85,.10),
 (230,.101,-.008,-.008,.31,.13,.031,.344,1.125,.21,-.108,.85,.10),
 (238,.098,-.008,-.006,.30,.09,.028,.32,.94,.08,-.11,.85,.10),
 (243,.083,-.009,-.004,.25,.065,.025,.27,.875,.06,-.12,.85,.09),
 (249,.055,-.010,0,.16,.02,.013,.22,.87,.06,-.14,.852,.075),
 (255,.015,-.009,.002,.06,-.01,0,.16,.87,.10,-.18,.853,.055),
 (262,-.025,-.008,0,-.055,-.01,-.02,.10,.93,.17,-.226,.855,.04),
 (268,-.040,-.006,0,-.08,.005,-.02,.063,.95,.17,-.245,.857,.04),
 (290,-.029,-.005,0,-.06,.02,-.014,.073,.942,.16,-.234,.857,.045),
 (312,-.028,-.006,0,-.06,.02,-.015,.075,.94,.16,-.232,.856,.045),
]
FEET = {
 'L': [(0,.165,-.025,0,.12,0),(92,.165,-.025,0,.12,0),
       (96,.165,-.025,0,.12,0),(101,.146,-.005,.009,.15,-.05),
       (106,.116,.020,.007,.18,.035),(109,.110,.025,0,.20,0),
       (257,.110,.025,0,.20,0),(262,.127,.008,.010,.17,-.05),
       (268,.160,-.023,.003,.13,.02),(272,.165,-.025,0,.12,0),
       (312,.165,-.025,0,.12,0)],
 'R': [(0,-.170,.027,0,-.04,0),(109,-.170,.027,0,-.04,0),
       (115,-.133,.025,.008,.08,-.04),(121,-.088,.022,.004,.18,.025),
       (125,-.080,.020,0,.20,0),(245,-.080,.020,0,.20,0),
       (251,-.118,.024,.010,.10,-.045),(257,-.170,.027,0,-.04,0),
       (259,-.170,.027,0,-.04,0),(312,-.170,.027,0,-.04,0)]
}
CONTACTS = {'L':[[0,96],[109,257],[272,312]],'R':[[0,109],[125,245],[257,312]]}
DIRECTIONS = {
 0:(-.85,-.4,.25),30:(-.85,-.4,.25),60:(-.85,-.4,.25),80:(-.85,-.4,.25),
 92:(-.80,-.35,.48),100:(-.55,-.2,.81),106:(-.05,.45,.89),112:(.4,.75,.52),
 119:(.55,.8,.2),128:(.55,.8,.2),140:(.55,.8,.2),172:(.55,.8,.2),200:(.55,.8,.2),
 224:(.6,.6,.5),230:(.5,.2,.84),238:(.3,-.85,.45),243:(.1,-.98,.1),
 249:(.1,-.98,.1),255:(-.3,-.8,.5),262:(-.85,-.4,.25),
 268:(-.85,-.4,.25),290:(-.85,-.4,.25),312:(-.85,-.4,.25)}
previous_quaternions = {}

def key(obj, prop, value, frame):
    if prop == 'rotation_quaternion':
        value=value.normalized()
        identity=(obj.as_pointer(),prop)
        previous=previous_quaternions.get(identity)
        if previous is not None and previous.dot(value)<0:
            value.negate()
        previous_quaternions[identity]=value.copy()
    setattr(obj,prop,value)
    obj.keyframe_insert(data_path=prop,frame=frame+1)

def smooth(obj):
    if not obj.animation_data or not obj.animation_data.action:
        return
    for curve in obj.animation_data.action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation='BEZIER'
            point.handle_left_type=point.handle_right_type='AUTO_CLAMPED'

def empty(name):
    obj=bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_type='SPHERE'
    obj.empty_display_size=.025
    return obj

def rotation(yaw=0,roll=0,pitch=0):
    return Quaternion((0,1,0),yaw) @ Quaternion((0,0,1),roll) @ Quaternion((1,0,0),pitch)

def import_rig(assets,out):
    armature=None
    for slot,path in [('body','body/drophunter.vrm'),('eyes','eyes/regulareyes.vrm'),
                      ('top','chest/shirt.vrm'),('bottom','legs/casualshorts.vrm'),
                      ('shoes','feet/sneakers.vrm'),('hair','head/short.vrm')]:
        temp=out/(slot+'.glb')
        shutil.copyfile(assets/'drophunter'/path,temp)
        old=set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(temp),bone_heuristic='BLENDER')
        added=set(bpy.data.objects)-old
        rig=next(o for o in added if o.type=='ARMATURE')
        if armature is None:
            armature=rig
            armature.name='F01_Drophunter_198'
        for obj in added:
            if obj.type=='MESH' and any(m.type=='ARMATURE' for m in obj.modifiers):
                obj.name=slot+':'+obj.name
                transform=obj.matrix_world.copy()
                obj.parent=armature
                obj.matrix_world=transform
                for mod in obj.modifiers:
                    if mod.type=='ARMATURE':
                        mod.object=armature
            elif obj!=armature:
                bpy.data.objects.remove(obj,do_unlink=True)
        temp.unlink()
    return armature

def author(arm):
    bpy.context.view_layer.objects.active=arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for side in ['L','R']:
        for parent,child in [('upper_arm','lower_arm'),('lower_arm','hand'),
                             ('upper_leg','lower_leg'),('lower_leg','foot')]:
            arm.data.edit_bones[parent+'.'+side].tail=arm.data.edit_bones[child+'.'+side].head
    bpy.ops.object.mode_set(mode='OBJECT')
    bones=arm.pose.bones
    for bone in bones:
        bone.rotation_mode='QUATERNION'
    hips_rest=bones['hips'].bone.matrix_local.copy()
    for row in POSES:
        f,x,y,z,yaw,chest_yaw,roll,*hands=row
        body=[('hips',rotation(yaw,roll)),('spine',rotation(chest_yaw*.55,-roll*.50,-.015)),
              ('chest',rotation(chest_yaw*.45,-roll*.28,-.01)),
              ('neck',rotation(.04 if 112<=f<=238 else 0,0,.01)),
              ('head',rotation(.08 if 119<=f<=230 else -.015,-.025,.025)),
              ('shoulder.L',rotation(0,.035 if 112<=f<=230 else .01)),
              ('shoulder.R',rotation(0,-.012))]
        for name,q in body:
            bone=bones[name]
            desired=C.to_3x3() @ q.to_matrix() @ CI.to_3x3()
            basis=bone.bone.matrix_local.to_3x3()
            key(bone,'rotation_quaternion',(basis.inverted() @ desired @ basis).to_quaternion(),f)
        key(bones['hips'],'location',hips_rest.to_3x3().inverted() @ (C.to_3x3() @ Vector((x,y,z))),f)
    bpy.context.view_layer.update()
    for side in ['L','R']:
        hand=empty('CTRL_hand_'+side)
        elbow=empty('POLE_elbow_'+side)
        foot=empty('CTRL_foot_'+side)
        knee=empty('POLE_knee_'+side)
        for obj in [hand,foot]:
            obj.rotation_mode='QUATERNION'
        ankle_height=bones['foot.'+side].bone.head_local.z
        sole=min((o.matrix_world @ v.co).z for o in bpy.data.objects
                 if o.type=='MESH' and o.name.startswith('shoes:') for v in o.data.vertices)
        for f,x,z,lift,yaw,pitch in FEET[side]:
            key(foot,'location',C.to_3x3() @ Vector((x,ankle_height-sole+lift,z)),f)
            q=C.to_quaternion() @ rotation(yaw,0,pitch) @ CI.to_quaternion()
            key(foot,'rotation_quaternion',q @ bones['foot.'+side].bone.matrix_local.to_quaternion(),f)
        sign=1 if side=='L' else -1
        for row in POSES:
            f,x,y,z,yaw,chest_yaw,roll,*hands=row
            wrist=Vector(hands[:3] if side=='L' else hands[3:])
            if side=='L' and 112<=f<=230:
                wrist.z=.075
                wrist.x-=.012
            near_belt=side=='L' and (f<=106 or f>=262)
            if near_belt:
                wrist.z=.205
            key(hand,'location',C.to_3x3() @ wrist,f)
            key(elbow,'location',C.to_3x3() @ Vector((x+sign*(.42 if near_belt else .22),.65,.20 if near_belt else -.10)),f)
            key(knee,'location',C.to_3x3() @ Vector((x+sign*.11,.42,1)),f)
            direction=Vector(DIRECTIONS[f] if side=='L' else (-.10,-.99,.06)).normalized()
            q=Vector((sign,0,0)).rotation_difference(direction)
            twist=.45 if side=='L' and 112<=f<=230 else .12
            q=Quaternion(direction,twist) @ q
            world=C.to_quaternion() @ q @ CI.to_quaternion()
            key(hand,'rotation_quaternion',world @ bones['hand.'+side].bone.matrix_local.to_quaternion(),f)
        for kind,target,pole in [('arm',hand,elbow),('leg',foot,knee)]:
            bone=bones[('lower_arm.' if kind=='arm' else 'lower_leg.')+side]
            ik=bone.constraints.new('IK')
            ik.name='F01_'+kind+'_two_bone'
            ik.target=target
            ik.pole_target=pole
            ik.chain_count=2
            ik.use_stretch=False
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
                bone.lock_ik_y=bone.lock_ik_z=True
                bone.ik_min_x=-.02
                bone.ik_max_x=2.4
            bpy.context.scene.frame_set(1)
            scores=[]
            for angle in [0,math.pi/2,-math.pi/2,math.pi]:
                ik.pole_angle=angle
                bpy.context.view_layer.update()
                scores.append(((bone.head-pole.location).length,angle))
            ik.pole_angle=min(scores)[1]
        for name,target in [('hand.'+side,hand),('foot.'+side,foot)]:
            con=bones[name].constraints.new('COPY_ROTATION')
            con.name='F01_authored_orientation'
            con.target=target
            con.target_space=con.owner_space='WORLD'
        for digit in ['thumb','index','middle','ring','little']:
            for segment in ['proximal','intermediate','distal']:
                bone=bones.get(digit+'.'+segment+'.'+side)
                if not bone:
                    continue
                for row in POSES:
                    f=row[0]
                    flex=.12 if side=='L' and 112<=f<=230 else .28
                    q=C.to_quaternion() @ Quaternion(Vector((0,0,-sign)),flex) @ CI.to_quaternion()
                    basis=bone.bone.matrix_local.to_quaternion()
                    key(bone,'rotation_quaternion',basis.inverted() @ q @ basis,f)
    for obj in [arm,*bpy.data.objects]:
        smooth(obj)

def original_world(asset):
    raw=asset.read_bytes()
    nodes=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])['nodes']
    parents={child:i for i,n in enumerate(nodes) for child in n.get('children',[])}
    worlds={}
    def world(i):
        if i in worlds:
            return worlds[i]
        node=nodes[i]
        q=node.get('rotation',[0,0,0,1])
        local=Matrix.LocRotScale(Vector(node.get('translation',[0,0,0])),
            Quaternion((q[3],*q[:3])),Vector(node.get('scale',[1,1,1])))
        worlds[i]=world(parents[i]) @ local if i in parents else local
        return worlds[i]
    return {n['name']:world(i) for i,n in enumerate(nodes) if 'name' in n}

def bake(arm,assets,out):
    original=original_world(assets/'drophunter/body/drophunter.vrm')
    driven=[b for b in arm.pose.bones if b.name in original and
        (b.constraints or b.name in ['hips','spine','chest','neck','head','shoulder.L','shoulder.R'] or
         b.name.startswith(('upper_arm.','lower_arm.','upper_leg.','lower_leg.','thumb.','index.','middle.','ring.','little.')))]
    tracks={b.name:{'frames':list(range(313)),'values':[]} for b in driven}
    tracks['hips.position']={'frames':list(range(313)),'values':[]}
    rows=[]
    for frame in range(313):
        bpy.context.scene.frame_set(frame+1)
        bpy.context.view_layer.update()
        world={b.name:CI @ arm.matrix_world @ b.matrix @ b.bone.matrix_local.inverted() @ C @ original[b.name]
               for b in arm.pose.bones if b.name in original}
        for bone in driven:
            matrix=world[bone.name]
            if bone.parent and bone.parent.name in world:
                matrix=world[bone.parent.name].inverted() @ matrix
            q=matrix.to_quaternion().normalized()
            values=tracks[bone.name]['values']
            if values and sum(a*b for a,b in zip([q.x,q.y,q.z,q.w],values[-4:]))<0:
                q.negate()
            values.extend(round(v,9) for v in [q.x,q.y,q.z,q.w])
        hip=world['hips'].translation-original['hips'].translation
        tracks['hips.position']['values'].extend(round(v,9) for v in hip)
        yaw=[]
        for side in ['L','R']:
            matrix=(world['foot.'+side] @ original['foot.'+side].inverted()).to_3x3()
            yaw.append(math.atan2(matrix[0][2],matrix[2][2]))
        rows.append({'frame':frame,'joints':{n:list(m.translation) for n,m in world.items()},
                     'footYaw':yaw,'contact':[any(a<=frame<=b for a,b in CONTACTS[s]) for s in ['L','R']]})
    data={'fps':30,'lastFrame':312,'sourceFrameCount':313,'sourceStartFrame':0,
          'authoring':'Blender 4.3 full-body F01 pilot; owner acceptance OPEN',
          'motionOwner':'blender-full-body','contactWindows':CONTACTS,
          'footSamples':[[r['joints']['foot.'+s] for s in ['L','R']] for r in rows],
          'footYawSamples':[r['footYaw'] for r in rows],'tracks':tracks}
    (out/'F01-blender.json').write_text(json.dumps(data,separators=(',',':')))
    (out/'blender-pivots.json').write_text(json.dumps(rows))
    mapping={b.name:{'parent':b.parent.name if b.parent else None,
                    'restBlender':[v for row in b.bone.matrix_local for v in row],
                    'restGltf':[v for row in original[b.name] for v in row]} for b in driven}
    (out/'rig-mapping.json').write_text(json.dumps(mapping,indent=2))

def camera(name,position,target,scale):
    data=bpy.data.cameras.new(name)
    obj=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.location=position
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO'
    data.ortho_scale=scale
    return obj

def stage():
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=24
    scene.cycles.use_denoising=False
    scene.cycles.device='CPU'
    scene.render.resolution_x=336
    scene.render.resolution_y=448
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.world=bpy.data.worlds.new('Review_world')
    scene.world.color=(.15,.15,.15)
    scene.view_settings.view_transform='Standard'
    scene.view_settings.look='None'
    for name,pos,power,size in [('Key',(2,-3,4),300,4),('Fill',(-3,-2,2),180,3),('Rim',(1,2,3),220,3)]:
        data=bpy.data.lights.new(name,'AREA')
        obj=bpy.data.objects.new(name,data)
        bpy.context.collection.objects.link(obj)
        obj.location=pos
        obj.rotation_euler=(Vector((0,0,.8))-obj.location).to_track_quat('-Z','Y').to_euler()
        data.energy=power
        data.shape='DISK'
        data.size=size
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.002))
    floor=bpy.context.object
    floor.name='Review_floor'
    material=bpy.data.materials.new('Review_floor')
    material.diffuse_color=(.12,.16,.22,1)
    floor.data.materials.append(material)
    return camera('Front',(0,-4,1.12),(0,0,.8),1.82),camera('Side',(3,-.8,1.1),(0,0,.8),1.82)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--assets',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--render',choices=['keys','none'],default='keys')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    out=args.output.resolve()
    out.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene
    scene.frame_start=1
    scene.frame_end=313
    scene.render.fps=30
    arm=import_rig(args.assets.resolve(),out)
    author(arm)
    bake(arm,args.assets.resolve(),out)
    front,side=stage()
    scene.camera=front
    scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'F01-authoring.blend'))
    manifest={'blender':bpy.app.version_string,'sourceFrames':[0,312],'rigBones':len(arm.data.bones),
      'contactWindows':CONTACTS,'keyFrames':[r[0] for r in POSES],
      'sourceSHA256':'863d368b02d0b3b5280fdba15befd73f0eb98139ed189d80118eb3d53c7e9bdb',
      'assetSHA256':hashlib.sha256((args.assets/'drophunter/body/drophunter.vrm').read_bytes()).hexdigest()}
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2))
    if args.render=='keys':
        for view,cam in [('front',front),('side',side)]:
            scene.camera=cam
            (out/view).mkdir(exist_ok=True)
            for frame in manifest['keyFrames']:
                scene.frame_set(frame+1)
                scene.render.filepath=str(out/view/f'{frame:04}.png')
                bpy.ops.render.render(write_still=True)
    print('F01_BLENDER_COMPLETE',json.dumps(manifest))
if __name__=='__main__':
    main()
