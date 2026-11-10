"""Render genuine matched-camera Cycles evidence. No retouching."""
import bpy,sys,math
from pathlib import Path
from mathutils import Vector
blend,output,mode,*views=sys.argv[sys.argv.index('--')+1:];out=Path(output).resolve();out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(Path(blend).resolve()));s=bpy.context.scene
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.use_denoising=False;s.cycles.samples=64;s.render.threads_mode='FIXED';s.render.threads=8
s.render.resolution_x=800;s.render.resolution_y=900;s.render.resolution_percentage=100
s.world.node_tree.nodes['Background'].inputs[0].default_value=(.21,.21,.21,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.45
s.view_settings.view_transform='Standard';s.view_settings.look='None';s.view_settings.exposure=0
# Identical lights for V1/V2, independently of saved file setup.
for o in list(s.objects):
 if o.type=='LIGHT':bpy.data.objects.remove(o,do_unlink=True)
for name,loc,power,size in [('Key',(-1,-1.8,2),65,2),('Fill',(1,-1,1.1),25,2),('Rim',(.3,1.5,1.8),45,2)]:
 bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.name=name;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(Vector((0,0,.6))-l.location).to_track_quat('-Z','Y').to_euler()
if mode=='clay':
 m=bpy.data.materials.new('Evidence_NeutralClay');m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.43,.43,.43,1);p.inputs['Roughness'].default_value=.72;p.inputs['Specular IOR Level'].default_value=.18;s.view_layers[0].material_override=m
elif mode=='lavender':
 m=bpy.data.materials.new('Evidence_SimpleLavender');m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.31,.17,.355,1);p.inputs['Roughness'].default_value=.64;p.inputs['Specular IOR Level'].default_value=.22
 for o in s.objects:
  if o.type=='MESH' and (o.name.startswith('V2_') or o.name.startswith('S04_')):o.data.materials.clear();o.data.materials.append(m)
for view in views or ['front','left35','right35','profile','elevated','fringe']:
 yaw,target,height,scale={'front':(0,.59,.59,1.18),'left35':(-35,.59,.59,1.18),'right35':(35,.59,.59,1.18),'profile':(90,.59,.59,1.18),'elevated':(0,.63,1.28,1.18),'fringe':(0,.82,1.02,.64)}[view];a=math.radians(yaw)
 s.camera.location=(2.3*math.sin(a),-2.3*math.cos(a),height);s.camera.rotation_euler=(Vector((0,0,target))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.type='ORTHO';s.camera.data.ortho_scale=scale
 s.render.resolution_x=1100 if view=='fringe' else 800;s.render.resolution_y=1100 if view=='fringe' else 900
 s.render.filepath=str(out/(view+'.png'));bpy.ops.render.render(write_still=True)
