"""Read-only material/normal ablations of the preserved V2 checkpoint."""
import bpy, numpy as np, json, sys, math
from pathlib import Path
from mathutils import Vector
p=Path(sys.argv[sys.argv.index('--')+1]);out=Path(sys.argv[sys.argv.index('--')+2]);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(p));s=bpy.context.scene;o=bpy.data.objects['node_0'];me=o.data
n=len(me.vertices);basis=np.empty((n,3),np.float32);v2=basis.copy();me.shape_keys.key_blocks[0].data.foreach_get('co',basis.ravel());me.shape_keys.key_blocks[1].data.foreach_get('co',v2.ravel())
np.savez_compressed(out/'surface.npz',basis=basis,v2=v2,edges=np.array([e.vertices[:] for e in me.edges]),faces=np.array([f.vertices[:] for f in me.polygons]))
report={'blender':bpy.app.version_string,'has_custom_normals':me.has_custom_normals,'materials':[]}
for m in me.materials:
 report['materials'].append({'name':m.name,'nodes':[{'type':x.type,'name':x.name,'image':x.image.name if x.type=='TEX_IMAGE' else None} for x in m.node_tree.nodes],'links':[(l.from_node.name,l.from_socket.name,l.to_node.name,l.to_socket.name) for l in m.node_tree.links]})
(out/'material-audit.json').write_text(json.dumps(report,indent=2))
s.cycles.samples=32;s.cycles.use_denoising=False;s.cycles.device='CPU';s.render.threads=8
s.render.resolution_x=680;s.render.resolution_y=760
clay=bpy.data.materials.new('DiagnosticClay');clay.use_nodes=True;bs=clay.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.5,.5,.5,1);bs.inputs['Roughness'].default_value=.8;bs.inputs['Specular IOR Level'].default_value=0
sil=bpy.data.materials.new('Silhouette');sil.use_nodes=True;nodes=sil.node_tree.nodes;nodes.clear();em=nodes.new('ShaderNodeEmission');em.inputs[0].default_value=(.015,.015,.015,1);sil.node_tree.links.new(em.outputs[0],nodes.new('ShaderNodeOutputMaterial').inputs[0])
def cam(angle=0,height=.34,scale=.24):
 a=math.radians(angle);s.camera.location=(1.9*math.sin(a),-1.9*math.cos(a),height);s.camera.rotation_euler=(Vector((0,0,height))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.ortho_scale=scale
cam()
def render(name,override=None):
 s.view_layers[0].material_override=override;s.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
render('v2-original-material');render('v2-clay-custom',clay)
# Recalculate diagnostic normals only, without changing any vertex.
if me.has_custom_normals:
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.mesh.customdata_custom_splitnormals_clear()
render('v2-clay-geometric',clay)
# Diffuse pigmentation only; no normal/roughness/specular detail.
mat=me.materials[0];pb=mat.node_tree.nodes.get('Principled BSDF')
for key in ['Normal','Roughness','Metallic']:
 for link in list(pb.inputs[key].links):mat.node_tree.links.remove(link)
pb.inputs['Roughness'].default_value=.8;pb.inputs['Metallic'].default_value=0;pb.inputs['Specular IOR Level'].default_value=0
render('v2-albedo-geometric')
# Controlled one-sided light, zero specular, world unchanged.
for ob in s.objects:
 if ob.type=='LIGHT':ob.hide_render=ob.name!='Key'
render('v2-directional',clay)
me.shape_keys.key_blocks[1].value=0;render('original-directional',clay)
cam(90);s.camera.location.y=-.245;s.world.node_tree.nodes['Background'].inputs[0].default_value=(1,1,1,1);render('original-silhouette',sil)
me.shape_keys.key_blocks[1].value=1;render('v2-silhouette',sil)
