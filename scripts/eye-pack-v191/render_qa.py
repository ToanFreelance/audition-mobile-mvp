"""Evidence is rendered ONLY after importing the exported GLB.
Blender --background --python render_qa.py -- GLB OUT [probe|before|final]
Camera/light/color management match the V1.9 QA baseline.
"""
import bpy,hashlib,json,math,sys
from pathlib import Path
import numpy as np
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'eye-pack-v19'))
from glb_tools import GLB
args=sys.argv[sys.argv.index('--')+1:];asset,out=Path(args[0]).resolve(),Path(args[1]).resolve();mode=args[2] if len(args)>2 else 'probe';out.mkdir(parents=True,exist_ok=True)
raw=GLB(asset);version='1.9.1' if any(n.get('extras',{}).get('version')=='1.9.1' for n in raw.j['nodes']) else '1.9'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(asset),merge_vertices=False)
parts=[o for o in bpy.data.objects if o.type=='MESH']
for o in parts:
 if o.name.startswith('EyeSet_') and o.get('version')!=version:o.name='LEGACY_UNUSED_'+o.name
for o in parts:
 if o.get('version')==version:o.name=o.name.split('.')[0]
# Blender 4.5 imports morph POSITION but ignores target NORMAL. Read the
# EXPORTED normal targets too; this matches glTF/Three.js rather than freezing
# the rest normals on a moving eyelid.
normal_targets={}
for ni,node in enumerate(raw.j['nodes']):
 prim=raw.mesh(ni)
 if not prim.get('targets') or 'NORMAL' not in prim['targets'][0]:continue
 used=np.unique(raw.array(prim['indices']).ravel())
 normal_targets[node['name']]=tuple(raw.array(a)[used] for a in [prim['attributes']['NORMAL'],prim['targets'][0]['NORMAL'],prim['targets'][1]['NORMAL']])
scene=bpy.data.scenes.new('EyeSet_V191_Reimport_QA');bpy.context.window.scene=scene
scene['source_glb_sha256']=hashlib.sha256(asset.read_bytes()).hexdigest();scene['source_glb_version']=version
for o in parts:
 matrix=o.matrix_world.copy();o.parent=None;o.matrix_world=matrix;scene.collection.objects.link(o)
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32 if mode in ['final','before'] else 16;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.image_settings.file_format='PNG';scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.19,.24,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
def light(name,loc,energy,size,color):
 data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size;data.color=color;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,-.12,.52))-o.location).to_track_quat('-Z','Y').to_euler()
light('Key',(.6,-1.3,1.6),55,1.8,(1,.92,.91));light('Fill',(-1,-.8,.8),30,1.6,(.85,.91,1))
camera=bpy.data.objects.new('QA_Camera',bpy.data.cameras.new('QA_Camera'));scene.collection.objects.link(camera);scene.camera=camera;camera.data.type='ORTHO'
def aim(kind='eyes',yaw=0):
 if kind=='face':target,scale,wh=Vector((0,-.10,.51)),1.,(720,800)
 elif kind=='macro':target,scale,wh=Vector((-.119,-.275,.52)),.127,(850,650)
 else:target,scale,wh=Vector((0,-.265,.527)),.425,(1120,370)
 camera.data.ortho_scale=scale;camera.location=target+Vector((2*math.sin(yaw),-2*math.cos(yaw),.025));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.resolution_x,scene.render.resolution_y=wh
def select(eye):
 head='Head_Base_Protected_ConceptV191' if version=='1.9.1' else 'Head_Base_Protected_ConceptV19'
 for o in parts:
  visible=o.name==head or (o.name.startswith('EyeSet_'+eye+'_') and o.get('version')==version);o.hide_render=not visible;o.hide_viewport=False;o.hide_set(not visible)
 bpy.context.view_layer.update()
def blink(amount):
 for o in parts:
  if not o.data.shape_keys:continue
  keys=o.data.shape_keys.key_blocks;keys['Blink'].value=amount;keys['BlinkArc'].value=4*amount*(1-amount)
  if o.name in normal_targets:
   rest,end,arc=normal_targets[o.name];norm=rest+end*amount+arc*4*amount*(1-amount);norm/=np.maximum(np.linalg.norm(norm,axis=1,keepdims=True),1e-12);norm=norm[:,[0,2,1]]*[1,-1,1]
   assert len(norm)==len(o.data.vertices),(o.name,len(norm),len(o.data.vertices));o.data.normals_split_custom_set_from_vertices(norm.tolist());o.data.update()
 bpy.context.view_layer.update()
completed=[]
def render(eye,kind='eyes',yaw=0,amount=0,label=None,isolate=None):
 select(eye);aim(kind,yaw);blink(amount);name=label or f'{eye}_{kind}';scene.render.filepath=str(out/(name+'.png'))
 if isolate:
  for o in parts:
   visible=(o.name==isolate) if isolate.startswith('Head_') else ('UpperLidBridge_ISSUE' in o.name if isolate=='bridge' else o.name.startswith('EyeSet_'+eye+'_') and o.get('version')==version and ('_'+isolate+'_') in o.name)
   o.hide_render=not visible;o.hide_set(not visible)
  bpy.context.view_layer.update()
 else:assert len([o for o in parts if not o.hide_render and o.name.startswith('EyeSet_')])==8
 print('REIMPORTED_GLB_RENDER',name,flush=True);bpy.ops.render.render(write_still=True);completed.append(name)
 (out/'render_manifest.json').write_text(json.dumps({'source':str(asset),'sha256':scene['source_glb_sha256'],'version':version,'mode':mode,'engine':'Cycles CPU','samples':scene.cycles.samples,'normalMorphs':'exported GLB NORMAL targets applied explicitly','renders':completed},indent=2))
eyes=['natural','joyful','sad','playful','angry','doll','idol','star','heart']
if mode=='isolate':
 for layer in ['Head_Base_Protected_ConceptV19','Skin','Lids','Ocular','Lashes','bridge','Head_Base_Protected']:
  for yaw,label in [(0,'front'),(28,'right')]:render('natural',yaw=math.radians(yaw),label=layer+'_'+label,isolate=layer)
elif mode=='probe':
 render('natural');render('natural','face',math.radians(28),label='natural_right')
 for a,label in [(.5,'half'),(1,'closed')]:render('natural',amount=a,label='natural_blink_'+label)
 render('sad',amount=1,label='sad_blink_closed')
else:
 for eye in eyes:render(eye)
 if mode=='before':
  for eye in eyes:render(eye,'face')
 if mode=='final':
  for eye in eyes:
   render(eye,'face');render(eye,'macro')
   for yaw,label in [(-28,'left'),(28,'right')]:render(eye,'face',math.radians(yaw),label=eye+'_'+label)
  for eye in ['natural','joyful','sad','angry','doll','heart']:
   for a,label in [(0,'open'),(.5,'half'),(1,'closed'),(.5,'reopening'),(0,'restored')]:render(eye,amount=a,label=eye+'_blink_'+label)
  blink(0);select('natural');aim('face');bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out.parent/'Female_head_EyeSetPack_V191_working.blend'),compress=True)
