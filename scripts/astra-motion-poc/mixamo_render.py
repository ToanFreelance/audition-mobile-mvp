"""Render evaluated FBX joints or actual exported textured GLB in Blender."""
import bpy,sys,argparse,json,hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector
ap=argparse.ArgumentParser();ap.add_argument('--input');ap.add_argument('--out');ap.add_argument('--frames',default='');ap.add_argument('--size',type=int,default=640);ap.add_argument('--samples',type=int,default=4)
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.fps=30;source=a.input.endswith('.npz');rods=[]
if source:
    data=np.load(a.input);world=data['world'];parents=data['parents'];n=len(world)
    for j,p in enumerate(parents):
        if p<0:continue
        name=str(data['names'][j]);radius=.028 if not any(x in name for x in ['Hand','Toe','Thumb','Index','Middle','Ring','Pinky']) else .009
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=1);ob=bpy.context.object;ob.name=name
        mat=bpy.data.materials.new(name);mat.diffuse_color=(.12,.65,.86,1) if 'Left' in name else (.92,.38,.13,1);ob.data.materials.append(mat);rods.append((j,p,ob,radius))
else:
    bpy.ops.import_scene.gltf(filepath=str(Path(a.input).resolve()));arm=next(o for o in s.objects if o.type=='ARMATURE');arm.animation_data_create()
    for t in arm.animation_data.nla_tracks:t.mute=True
    act=next(x for x in bpy.data.actions if 'finish-special-001' in x.name);arm.animation_data.action=act
    if hasattr(act,'slots') and len(act.slots):arm.animation_data.action_slot=act.slots[0]
    n=int(round(act.frame_range[1]))+1
s.render.engine='CYCLES';s.cycles.samples=a.samples;s.cycles.use_denoising=True;s.render.threads_mode='FIXED';s.render.threads=4;s.render.use_persistent_data=True
s.render.resolution_x=a.size;s.render.resolution_y=a.size;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG'
s.world=bpy.data.worlds.new('Studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.48,.53,.62,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.6;s.view_settings.view_transform='Standard';s.view_settings.exposure=-.7
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.012));ground=bpy.context.object;mat=bpy.data.materials.new('Ground');mat.diffuse_color=(.22,.25,.28,1);ground.data.materials.append(mat)
for loc,power in [((3,-4,6),950),((-4,-2,3),650),((0,3,4),800)]:
    light=bpy.data.lights.new('Area','AREA');light.energy=power;light.size=4;ob=bpy.data.objects.new('Area',light);s.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,.8))-ob.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.cameras.new('Camera');ob=bpy.data.objects.new('Camera',camera);s.collection.objects.link(ob);center=np.zeros(2)
if source:center=(world[:,0,:2,3].min(axis=0)+world[:,0,:2,3].max(axis=0))/2
ob.location=(center[0]+3,center[1]-6,3.1);ob.rotation_euler=(Vector((center[0],center[1],.85))-ob.location).to_track_quat('-Z','Y').to_euler();camera.type='ORTHO';camera.ortho_scale=3.3;s.camera=ob
identity=dict(input_sha256=hashlib.sha256(Path(a.input).read_bytes()).hexdigest(),samples=a.samples,size=a.size,blender=bpy.app.version_string,fps=30,motion_blur=False)
stamp=out/'render-input.json'
if stamp.exists():assert json.loads(stamp.read_text())==identity,'Changed inputs: use a new render directory'
stamp.write_text(json.dumps(identity,indent=2))
frames=[int(f) for f in a.frames.split(',')] if a.frames else list(range(n))
for f in frames:
    path=out/f'{f:04d}.png'
    if path.exists():continue
    if source:
        for j,p,ob,r in rods:
            v=Vector(world[f,j,:3,3]);u=Vector(world[f,p,:3,3]);d=v-u;ob.location=(u+v)/2;ob.scale=(r,r,max(.005,d.length/2));ob.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    else:s.frame_set(f)
    s.render.filepath=str(path.resolve());bpy.ops.render.render(write_still=True)
(out/'render-complete.json').write_text(json.dumps(dict(frames=frames,identity=identity),indent=2))
