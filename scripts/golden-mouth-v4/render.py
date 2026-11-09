"""Cycles CPU renders of exact authored coordinates; no painted/AI evidence."""
import bpy,numpy as np,sys,json,math
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).parent))
from shading import loop_normals
folder=Path(sys.argv[sys.argv.index('--')+1]);jobs=sys.argv[sys.argv.index('--')+2:];a=np.load(folder/'poses.npz');sh=np.load(folder/'shading.npz');styles=json.loads((folder/'catalog.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(folder/'Golden-Mouth-V4.blend'));original=bpy.data.objects['node_0'];m=original.data;f=a['faces'];s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=48;s.cycles.use_denoising=False;s.render.threads_mode='FIXED';s.render.threads=8;s.render.resolution_x=680;s.render.resolution_y=760;s.render.resolution_percentage=100
# A render mesh is a coordinate-exact copy of the selected key, with posed normals.
# This avoids Blender custom normals being transported a second time by shape keys.
mm=bpy.data.meshes.new('V4_RenderExactKey');mm.from_pydata(a['poses'][0].tolist(),[],f.tolist());mm.uv_layers.new().data.foreach_set('uv',a['uv'].ravel());mm.polygons.foreach_set('use_smooth',np.ones(len(f),bool))
for mat in m.materials:mm.materials.append(mat)
ob=bpy.data.objects.new('V4_ExactKeyRender',mm);bpy.context.collection.objects.link(ob);ob.matrix_world=original.matrix_world.copy();original.hide_render=True
for job in jobs:
 code,view=job.split(':');idx=next(i for i,st in enumerate(styles) if st['code']==code);st=styles[idx];q=a['poses'][idx];mm.vertices.foreach_set('co',q.ravel());mm.update()
 loops=loop_normals(a['poses'][0],q,f,a['groups'],sh['m01LoopNormals'],clay=view=='clay')
 mm.normals_split_custom_set(loops.tolist())
 for name in ['V4_Cavity','V4_UpperTeeth','V4_Gum','V4_Tongue']:
  part=bpy.data.objects[name]
  for key in part.data.shape_keys.key_blocks:key.value=0
  part.data.shape_keys.key_blocks[code].value=1
  part.hide_render=not(st['open'] if name=='V4_Cavity' else st['teeth'] if name in ['V4_UpperTeeth','V4_Gum'] else st['tongue'])
 angle,height,scale={'front':(0,.51,.94),'left35':(-35,.51,.94),'right35':(35,.51,.94),'mouth':(0,.335,.24),'clay':(0,.335,.24),'close35':(35,.335,.25),'profile':(90,.51,.94)}[view];yaw=math.radians(angle);s.camera.location=(1.9*math.sin(yaw),-1.9*math.cos(yaw),height);s.camera.rotation_euler=(Vector((0,0,height))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.ortho_scale=scale;s.view_layers[0].material_override=bpy.data.materials['NeutralClay'] if view=='clay' else None
 out=folder/'renders';out.mkdir(exist_ok=True);s.render.filepath=str(out/(code+'-'+view+'.png'));bpy.context.view_layer.update();bpy.ops.render.render(write_still=True)
