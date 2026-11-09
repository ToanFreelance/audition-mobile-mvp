import bpy,sys
from pathlib import Path
from mathutils import Vector
src,out=sys.argv[sys.argv.index('--')+1:];bpy.ops.wm.open_mainfile(filepath=src);s=bpy.context.scene;m=bpy.data.objects['node_0'].data.materials[0];n=m.node_tree.nodes;pb=n.get('Principled BSDF');em=n.new('ShaderNodeEmission');em.inputs['Strength'].default_value=1;m.node_tree.links.new(pb.inputs['Base Color'].links[0].from_socket,em.inputs['Color']);m.node_tree.links.new(em.outputs[0],n.get('Material Output').inputs['Surface']);s.camera.location=(0,-1.9,.350);s.camera.rotation_euler=(Vector((0,0,.350))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.ortho_scale=.13;s.view_layers[0].material_override=None;s.cycles.samples=16;s.render.filepath=out;bpy.ops.render.render(write_still=True)
