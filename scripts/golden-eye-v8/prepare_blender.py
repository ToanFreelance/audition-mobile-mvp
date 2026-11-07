import bpy,sys,math
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
from pathlib import Path
import json, struct, numpy as np
source=Path(sys.argv[sys.argv.index('--')+1]).resolve();output=Path(sys.argv[sys.argv.index('--')+2]).resolve();output.mkdir(parents=True,exist_ok=True);(output/'evidence').mkdir(exist_ok=True)
b=source.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);binary=b[28+n:]
def acc(i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']];dim={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
 return np.frombuffer(binary,dtype=dt,count=a['count']*dim,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,dim)
p=j['meshes'][0]['primitives'][0];np.savez(output/'model.npz',pos=acc(p['attributes']['POSITION']),uv=acc(p['attributes']['TEXCOORD_0']),tri=acc(p['indices']).reshape(-1,3))
bpy.ops.import_scene.gltf(filepath=str(source))
obj=[o for o in bpy.context.scene.objects if o.type=='MESH'][0]
print('OBJECT',obj.name,tuple(obj.dimensions),obj.matrix_world)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False
scene.render.resolution_x=700;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('World');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.14,.25,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
scene.view_settings.view_transform='Standard'
for name,loc,power,size in [('Key',(-1,-2,2),110,2),('Fill',(1,-1,1.2),55,2),('Rim',(1,1,1.4),80,1.5)]:
 bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.name=name;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,.5))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-1.9,.56));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.56))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=1.13;scene.camera=camera
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(output/'evidence/original.png');scene.render.film_transparent=False
bpy.ops.wm.save_as_mainfile(filepath=str(output/'base.blend'))

