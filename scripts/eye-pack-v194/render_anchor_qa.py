"""QA-only Blender reimport/render of V1.9.3 and V1.9.4 real GLBs.
Usage: blender -b --python render_anchor_qa.py -- asset.glb output_dir
"""
import math,sys,json
from pathlib import Path
import bpy
from mathutils import Vector
asset=Path(sys.argv[sys.argv.index('--')+1]).resolve()
out=Path(sys.argv[sys.argv.index('--')+2]).resolve()
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(asset))
meshes=[o for o in bpy.data.objects if o.type=='MESH']
assert len(meshes)>20, 'Missing GLB nodes'
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.device='CPU'
scene.cycles.samples=12
# Ubuntu Blender package may lack OpenImageDenoiser: never request OIDN.
for layer in scene.view_layers:
    layer.cycles.use_denoising=False
scene.render.resolution_x=880
scene.render.resolution_y=560
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
if scene.world is None:
    scene.world=bpy.data.worlds.new('EyeQAWorld')
scene.world.color=(.30,.30,.30)
camera_data=bpy.data.cameras.new('EyeQA_Orthographic')
cam=bpy.data.objects.new('EyeQA_Camera',camera_data)
scene.collection.objects.link(cam)
scene.camera=cam
camera_data.type='ORTHO'
light_data=bpy.data.lights.new('EyeQA_Light','AREA')
light=bpy.data.objects.new('EyeQA_Key',light_data)
scene.collection.objects.link(light)
light.location=Vector((-.6,-1.0,1.4))
light_data.energy=380
light_data.shape='DISK'
light_data.size=2.2
report={'asset':str(asset),'meshCount':len(meshes),'views':[]}
for look in ('natural','doll'):
  for ob in meshes:
    nm=ob.name
    if nm.startswith('EyeSet_'):
      ob.hide_render=not nm.startswith('EyeSet_'+look+'_')
    elif nm.startswith('Head_Base_Protected'):
      ob.hide_render=not nm.startswith('Head_Base_Protected_ConceptV191')
  lids=[o for o in meshes if o.name.startswith('EyeSet_'+look+'_') and '_Lids_' in o.name]
  assert len(lids)==2, (look,[o.name for o in lids])
  center=sum((o.matrix_world@Vector(v.co) for o in lids for v in o.data.vertices), Vector((0,0,0)))
  center/=sum(len(o.data.vertices) for o in lids)
  for view,closed in (('front-open',False),('front-closed',True),('threequarter-open',False),('fullface-open',False)):
    for ob in meshes:
      keys=ob.data.shape_keys
      if keys:
        for key in keys.key_blocks:
          if key.name=='Blink': key.value=1. if closed else 0.
          if key.name=='BlinkArc': key.value=0.
    offset=Vector((.37,-1.15,.12)) if view=='threequarter-open' else Vector((0,-1.25,.08))
    cam.location=center+offset
    direction=center-cam.location
    cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    camera_data.ortho_scale=1.12 if view=='fullface-open' else .59
    scene.render.filepath=str(out/(look+'-'+view+'.png'))
    bpy.ops.render.render(write_still=True)
    report['views'].append({'look':look,'view':view,'path':scene.render.filepath})
(out/'render_report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
