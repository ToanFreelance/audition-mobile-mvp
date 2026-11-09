"""Render exported ACTUAL Three.js rig buffers. Not a substitute procedural rig."""
import bpy,sys,json,math
import numpy as np
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1]).resolve();styles=sys.argv[sys.argv.index('--')+2:] or ['natural']
asset=Path(__file__).resolve().parents[2]/'public/qa';bpy.ops.wm.open_mainfile(filepath=str(root/'base.blend'));s=bpy.context.scene
s.cycles.samples=96;s.cycles.use_denoising=False;s.render.resolution_x=640;s.render.resolution_y=720
for o in s.objects:
 if o.type=='LIGHT':o.data.energy*=.42
s.world.node_tree.nodes['Background'].inputs[1].default_value=.45
old=bpy.data.objects['node_0'];source=old.data.materials[0];bpy.data.objects.remove(old,do_unlink=True)
def material(name,color=(1,1,1,1),rough=.5,texture=None,vertex=False):
 m=bpy.data.materials.new(name);m.use_nodes=True;pb=m.node_tree.nodes.get('Principled BSDF');pb.inputs['Base Color'].default_value=color;pb.inputs['Roughness'].default_value=rough;pb.inputs['Specular IOR Level'].default_value=.25
 if texture:
  it=m.node_tree.nodes.new('ShaderNodeTexImage');it.image=bpy.data.images.load(str(texture));m.node_tree.links.new(it.outputs['Color'],pb.inputs['Base Color'])
  if vertex:
   vc=m.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Col';mul=m.node_tree.nodes.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1;m.node_tree.links.new(it.outputs['Color'],mul.inputs[1]);m.node_tree.links.new(vc.outputs['Color'],mul.inputs[2]);m.node_tree.links.new(mul.outputs['Color'],pb.inputs['Base Color'])
 return m
skin=material('SkinPatch',texture=asset/'female-golden-face-v1/mouth-skin.webp',rough=.58,vertex=True);bridge=material('Bridge',texture=asset/'female-golden-face-v1/mouth-skin.webp',rough=.58)
white=material('Sclera',(.91,.87,.90,1),.32);iris=material('ApprovedIris',texture=asset/'female-golden-eye-v8/approved-iris-atlas.webp',rough=.45);pn=iris.node_tree.nodes.get('Principled BSDF');tx=next(n for n in iris.node_tree.nodes if n.type=='TEX_IMAGE');iris.node_tree.links.new(tx.outputs['Color'],pn.inputs['Emission Color']);pn.inputs['Emission Strength'].default_value=.32
mats={'source':source,'sclera':white,'iris':iris,'LipsAndPerioralSkin':skin,'FixedSkinStitch':bridge,'RecessedClosedMouthCavity':material('Cavity',(.031,.006,.012,1),.95),'UpperDentalArch':material('Teeth',(.98,.91,.83,1),.32),'TongueInsideCavity':material('Tongue',(.51,.13,.17,1),.55)}
objects=[]
for style in styles:
 quarter=style.endswith('-quarter');name=style.replace('-quarter','')
 for ob in objects:
  oldmesh=ob.data;bpy.data.objects.remove(ob,do_unlink=True);bpy.data.meshes.remove(oldmesh)
 objects=[]
 parts=json.loads((root/'runtime'/f'{name}.json').read_text())
 for part in parts:
  def read(key,dt='<f4',dim=3):return np.fromfile(root/'runtime'/part[key],dt).reshape(-1,dim)
  p=read('position');p[:,1:]*=-1;faces=read('index','<u4');me=bpy.data.meshes.new(part['name']);me.from_pydata(p,[],faces);me.update();ob=bpy.data.objects.new(part['name'],me);s.collection.objects.link(ob);objects.append(ob);me.materials.append(mats[part['material']]);me.polygons.foreach_set('use_smooth',np.ones(len(me.polygons),bool))
  nn=read('normal');nn[:,1:]*=-1;me.normals_split_custom_set_from_vertices(nn.tolist())
  if part.get('uv'):
   uv=read('uv',dim=2)
   if part['material']!='iris':uv[:,1]=1-uv[:,1]
   me.uv_layers.new().data.foreach_set('uv',uv[faces].reshape(-1))
  if part.get('color'):
   colors=read('color');col=me.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT');col.data.foreach_set('color',np.c_[colors,np.ones(len(colors))].reshape(-1))
 yaw=math.pi/5 if quarter else 0;s.camera.location=(1.9*math.sin(yaw),-1.9*math.cos(yaw),.51);s.camera.rotation_euler=(Vector((0,0,.51))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.ortho_scale=.94
 s.render.filepath=str(root/f'evidence/mouth-{style}.png');bpy.ops.render.render(write_still=True)
