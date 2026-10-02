"""Render embedded clips from the final exported GLB, never a proxy rig."""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--glb',required=True);ap.add_argument('--manifest',required=True)
    ap.add_argument('--out',required=True);ap.add_argument('--frames',default='');ap.add_argument('--step',type=int,default=1)
    args=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps=30  # glTF importer converts seconds to scene frames here
    bpy.ops.import_scene.gltf(filepath=str(Path(args.glb).resolve()))
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=4;scene.cycles.use_denoising=True
    scene.render.resolution_x=384;scene.render.resolution_y=448;scene.render.resolution_percentage=100
    scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.fps=30
    scene.render.use_persistent_data=True
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    scene.world=bpy.data.worlds.new('QA neutral studio');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.60,.65,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
    scene.view_settings.view_transform='Standard'
    arm=next(o for o in scene.objects if o.type=='ARMATURE')
    arm.animation_data_create()
    for track in arm.animation_data.nla_tracks:track.mute=True
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.005))
    ground=bpy.context.object;ground.name='QA_Ground'
    mat=bpy.data.materials.new('QA_Ground_Material');mat.diffuse_color=(.20,.23,.27,1);ground.data.materials.append(mat)
    for name,loc,power,size in [('Key',(3,-4,5),800,4),('Fill',(-4,-2,3),500,3),('Rim',(0,3,4),650,3)]:
        lamp=bpy.data.lights.new(name,'AREA');lamp.energy=power;lamp.shape='DISK';lamp.size=size
        obj=bpy.data.objects.new(name,lamp);scene.collection.objects.link(obj);obj.location=loc
        obj.rotation_euler=(Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
    camera=bpy.data.cameras.new('QA_Camera');obj=bpy.data.objects.new('QA_Camera',camera);scene.collection.objects.link(obj)
    obj.location=(0,-4.8,2.0);obj.rotation_euler=(Vector((0,0,.9))-obj.location).to_track_quat('-Z','Y').to_euler()
    camera.type='ORTHO';camera.ortho_scale=2.3;scene.camera=obj
    manifest=json.loads(Path(args.manifest).read_text());motions=manifest['motions']
    wanted=[int(f) for f in args.frames.split(',')] if args.frames else list(range(motions[0]['source_frame_range'][0],manifest['frames'],args.step))
    actions={}
    for m in motions:
        actions[m['id']]=next(a for a in bpy.data.actions if m['id'] in a.name)
    for f in wanted:
        m=next(m for m in motions if m['source_frame_range'][0]<=f<m['source_frame_range'][1])
        action=actions[m['id']];arm.animation_data.action=action
        if hasattr(action,'slots') and len(action.slots):arm.animation_data.action_slot=action.slots[0]
        scene.frame_set(f-m['source_frame_range'][0])
        bpy.context.view_layer.update()
        scene.render.filepath=str((out/f'{f:04d}.png').resolve())
        bpy.ops.render.render(write_still=True)
    (out/'render.json').write_text(json.dumps(dict(glb=Path(args.glb).name,blender=bpy.app.version_string,
        frames=wanted,source_fps=30,render_sample_step=args.step,engine='Cycles CPU',samples=4,
        width=384,height=448,actions={name:list(action.frame_range) for name,action in actions.items()}),indent=2)+'\n')


if __name__=='__main__':main()
