import bpy,sys,math
from pathlib import Path
from mathutils import Vector
src,out,*views=sys.argv[sys.argv.index('--')+1:];out=Path(out);out.mkdir(parents=True,exist_ok=True);bpy.ops.wm.open_mainfile(filepath=src);s=bpy.context.scene
for view in views:
 angle,height,scale={'front':(0,.51,.94),'left35':(-35,.51,.94),'right35':(35,.51,.94),'profile':(90,.51,.94),'upper':(0,.350,.13),'upper_clay':(0,.350,.13),'mouth':(0,.34,.24),'clay':(0,.34,.24)}[view];yaw=math.radians(angle);s.camera.location=(1.9*math.sin(yaw),-1.9*math.cos(yaw),height);s.camera.rotation_euler=(Vector((0,0,height))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.ortho_scale=scale;s.view_layers[0].material_override=bpy.data.materials['NeutralClay'] if 'clay' in view else None;s.render.filepath=str(out/(view+'.png'));bpy.ops.render.render(write_still=True)
