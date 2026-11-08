import bpy,sys,math
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1]);bpy.ops.wm.open_mainfile(filepath=str(root/'../m01-work/M01-Native-V2-Iteration-02.blend'));s=bpy.context.scene;o=bpy.data.objects['node_0'];s.cycles.samples=8;s.cycles.use_denoising=False
m=bpy.data.materials.new('GeometrySilhouette');m.use_nodes=True;m.node_tree.nodes.clear();e=m.node_tree.nodes.new('ShaderNodeEmission');e.inputs[0].default_value=(.015,.015,.015,1);m.node_tree.links.new(e.outputs[0],m.node_tree.nodes.new('ShaderNodeOutputMaterial').inputs[0]);s.view_layers[0].material_override=m
s.world.node_tree.nodes['Background'].inputs[0].default_value=(1,1,1,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=1
s.camera.location=(1.9,-.245,.34);s.camera.rotation_euler=(Vector((0,-.245,.34))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.ortho_scale=.16
for val,name in [(0,'original'),(1,'v2')]:
 o.data.shape_keys.key_blocks[1].value=val;s.render.filepath=str(root/'diagnostics'/f'{name}-silhouette.png');bpy.ops.render.render(write_still=True)
