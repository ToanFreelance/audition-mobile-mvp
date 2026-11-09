"""Diagnostic only: actual albedo-only Cycles renders, no texture editing."""
import bpy,sys,json,hashlib
from pathlib import Path
from mathutils import Vector
blend,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(blend));s=bpy.context.scene;head=bpy.data.objects['node_0']
m=head.data.materials[0];nodes=m.node_tree.nodes;pb=nodes.get('Principled BSDF')
audit={'material':m.name,'images':[{'name':im.name,'sha256':hashlib.sha256(bytes(im.packed_file.data)).hexdigest()} for im in bpy.data.images if im.packed_file],
       'links':[{'from':l.from_node.name+'.'+l.from_socket.name,'to':l.to_node.name+'.'+l.to_socket.name} for l in m.node_tree.links]}
(out/'material-audit.json').write_text(json.dumps(audit,indent=2))
base=pb.inputs['Base Color'].links[0].from_socket
em=nodes.new('ShaderNodeEmission');em.inputs['Strength'].default_value=1
m.node_tree.links.new(base,em.inputs['Color']);m.node_tree.links.new(em.outputs[0],nodes.get('Material Output').inputs['Surface'])
s.camera.location=(0,-1.9,.34);s.camera.rotation_euler=(Vector((0,0,.34))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.ortho_scale=.24
s.cycles.samples=16;s.cycles.use_denoising=False
for name,value in [('original',0),('v3',1)]:
    head.data.shape_keys.key_blocks['M01_Natural_V3'].value=value
    s.render.filepath=str(out/(name+'-albedo-only.png'));bpy.ops.render.render(write_still=True)
# No .blend is saved; source material and checkpoint are never overwritten.
