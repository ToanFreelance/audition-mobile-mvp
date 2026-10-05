"""Blender evaluation of original FBX files, no inferred animation."""
import bpy,json,sys
import numpy as np
from pathlib import Path
root=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=root/'mixamo-finish';out.mkdir(exist_ok=True);reports=[]
for label,filename in [('swipes','Breakdance Swipes.fbx'),('flair','Flair 2.fbx')]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(root/'upload'/filename),automatic_bone_orientation=False)
    sc=bpy.context.scene;arm=next(o for o in sc.objects if o.type=='ARMATURE');action=arm.animation_data.action
    fps=sc.render.fps/sc.render.fps_base;first,last=map(int,action.frame_range);names=[b.name for b in arm.data.bones]
    rest=np.array([arm.matrix_world@b.matrix_local for b in arm.data.bones]);tracks=[]
    for f in range(first,last+1):
        sc.frame_set(f);bpy.context.view_layer.update();tracks.append([arm.matrix_world@arm.pose.bones[n].matrix for n in names])
    tracks=np.array(tracks);parents=[names.index(b.parent.name) if b.parent else -1 for b in arm.data.bones]
    r=dict(file=filename,blender=bpy.app.version_string,fps=fps,frame_range_inclusive=[first,last],samples=len(tracks),duration=(last-first)/fps,bones=names,parents=parents,object_matrix=np.array(arm.matrix_world).tolist(),mesh_count=sum(o.type=='MESH' for o in sc.objects),root_xyz_range=np.ptp(tracks[:,0,:3,3],axis=0).tolist(),coordinate_system='Blender world Z-up metres; imported centimetre conversion .01',rest_height=float(np.ptp(rest[:,:3,3],axis=0)[2]))
    np.savez_compressed(out/(label+'.npz'),world=tracks,rest=rest,names=names,parents=parents,fps=fps);reports.append(r)
(out/'source-inspection.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports,indent=2))
