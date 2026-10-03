"""Render embedded clips from the final exported GLB, never a proxy rig."""
import argparse
import json
import hashlib
import math
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--glb',required=True);ap.add_argument('--manifest',required=True)
    ap.add_argument('--out',required=True);ap.add_argument('--frames',default='');ap.add_argument('--step',type=int,default=1)
    ap.add_argument('--v2',action='store_true');ap.add_argument('--motion',default='');ap.add_argument('--samples',type=int,default=4)
    ap.add_argument('--threads',type=int,default=2)
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
    if args.v2:
        scene.render.resolution_x=768;scene.render.resolution_y=576;scene.render.threads=args.threads
        scene.cycles.samples=args.samples;scene.cycles.denoising_quality='FAST';scene.view_settings.exposure=-.75
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
    if args.v2:camera.ortho_scale=3.4  # landscape: 3.4 horizontal = 2.55 vertical
    manifest=json.loads(Path(args.manifest).read_text());motions=manifest['motions']
    if args.v2:
        # Prevent stale frame reuse after a rebake or changed render settings.
        identity=dict(glb_sha256=hashlib.sha256(Path(args.glb).read_bytes()).hexdigest(),samples=args.samples,width=768,height=576,exposure=-.75,blender=bpy.app.version_string,camera='static per-clip root-range center; vertical span 2.55; horizontal span 3.4')
        stamp=out/'render-input.json'
        if stamp.exists() and json.loads(stamp.read_text())!=identity:raise ValueError('Render input changed: choose a new output directory.')
        stamp.write_text(json.dumps(identity,indent=2)+'\n');rendered={}
        for m in motions:
            if args.motion and m['id']!=args.motion:continue
            action=next(a for a in bpy.data.actions if m['id'] in a.name);arm.animation_data.action=action
            if hasattr(action,'slots') and len(action.slots):arm.animation_data.action_slot=action.slots[0]
            diag=Path(args.glb).parent/(Path(args.glb).stem+'-diagnostics')/(m['id']+'.solve.npz')
            roots=np.load(diag)['root'];a,b=m['production_within_working_frames'];center=float((roots[a:b,0].min()+roots[a:b,0].max())/2)
            obj.location=(center,-4.8,2.0);obj.rotation_euler=(Vector((center,0,.9))-obj.location).to_track_quat('-Z','Y').to_euler()
            n=m['source_frame_range'][1]-m['source_frame_range'][0]
            wanted=[int(f) for f in args.frames.split(',')] if args.frames else list(range(0,n,args.step))
            dest=out/m['id'];dest.mkdir(exist_ok=True)
            for f in wanted:
                path=dest/f'{f:04}.png'
                if path.exists():continue
                scene.frame_set(f);bpy.context.view_layer.update();scene.render.filepath=str(path.resolve());bpy.ops.render.render(write_still=True)
            rendered[m['id']]=dict(local_frames=wanted,source_frames=[f+m['source_frame_range'][0] for f in wanted],action_frame_range=list(action.frame_range))
        (out/('render-'+(args.motion or 'all')+'.json')).write_text(json.dumps(dict(identity=identity,clips=rendered,fps=30,engine='Cycles CPU',denoise='FAST',motion_blur=False),indent=2)+'\n')
        return
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
