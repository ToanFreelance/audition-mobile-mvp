import bpy,sys,runpy
from pathlib import Path
src,out=sys.argv[sys.argv.index('--')+1:];bpy.ops.wm.open_mainfile(filepath=src);o=bpy.data.objects['node_0'];bpy.context.view_layer.objects.active=o;o.select_set(True)
bpy.ops.mesh.customdata_custom_splitnormals_clear()
s=bpy.context.scene;from mathutils import Vector
s.camera.location=(0,-1.9,.34);s.camera.rotation_euler=(Vector((0,0,.34))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.ortho_scale=.24;s.view_layers[0].material_override=bpy.data.materials['NeutralClay'];s.render.filepath=out;bpy.ops.render.render(write_still=True)
