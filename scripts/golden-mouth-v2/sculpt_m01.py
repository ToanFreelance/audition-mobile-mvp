"""Native-head M01 checkpoint. Run with Blender, not system Python.
No triangle deletion, skin replacement, lip strips, or new mouth mesh.
"""
import argparse, hashlib, json, math, sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

EXPECTED = 'b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90'
parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--render', nargs='*', default=[])
parser.add_argument('--sculpt', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
source = Path(args.source).resolve()
out = Path(args.output).resolve(); out.mkdir(parents=True, exist_ok=True)
assert hashlib.sha256(source.read_bytes()).hexdigest() == EXPECTED
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
head = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
mesh = head.data
assert len(mesh.vertices) == 292645 and len(mesh.polygons) == 499762
basis = head.shape_key_add(name='Basis', from_mix=False)
sculpt = head.shape_key_add(name='M01_Natural_EXPERIMENTAL', from_mix=False)
p = np.empty((len(mesh.vertices), 3), dtype=np.float32)
mesh.vertices.foreach_get('co', p.ravel())
np.save(out / 'source_blender_positions.npy', p)

# Proportional deformation of the EXISTING lip/philtrum/chin surface.
# Coordinates refer to the imported native mesh; no analytical replacement surface.
def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1)
    return t*t*t*(t*(t*6-15)+10)
x,h,depth=p.T
front=smooth(.17,.22,depth)
radial=np.sqrt((x/.115)**2+((h-.335)/.085)**2)
support=(1-smooth(.60,1,radial))*front
lipband=1-smooth(.023,.052,np.abs(h-.335))
q=p.copy()
q[:,0]-=.22*x*(1-smooth(.052,.105,np.abs(x)))*lipband*front
# Lower original upturned corners without pulling down the central Cupid bow.
corner=.010*np.minimum((np.abs(x)/.052)**2,1)
q[:,1]+=(-.28*(h-.335)-corner)*support*lipband
# Very restrained reduction in native lower-lip projection; keeps native rolls.
lower=np.exp(-((h-.320)/.012)**2)*np.exp(-(x/.040)**4)*front
q[:,2]-=.0015*lower
changed=np.linalg.norm(q-p,axis=1)>1e-8
sculpt.data.foreach_set('co',q.ravel())
sculpt.value=1 if args.sculpt else 0
np.savez_compressed(out/'m01-native-delta.npz',indices=np.flatnonzero(changed),
                   delta=(q-p)[changed],basis=p[changed])

scene = bpy.context.scene
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'
scene.cycles.samples = 40; scene.cycles.use_denoising = False
scene.render.threads_mode = 'FIXED'; scene.render.threads = 8
scene.render.resolution_x = 680; scene.render.resolution_y = 760
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'Standard'
scene.world = bpy.data.worlds.new('NeutralWorld'); scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.18,.18,.18,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .5
for name, loc, energy, size in [('Key',(-1.5,-2,2),75,2),('Fill',(1.5,-1,1),45,2)]:
    bpy.ops.object.light_add(type='AREA', location=loc)
    light=bpy.context.object; light.name=name; light.data.energy=energy; light.data.size=size
    light.rotation_euler=(Vector((0,0,.5))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(); camera=bpy.context.object; scene.camera=camera
camera.data.type='ORTHO'
clay=bpy.data.materials.new('NeutralClay'); clay.use_nodes=True
bs=clay.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(.5,.5,.5,1)
bs.inputs['Roughness'].default_value=.7
views={'front':(0,.51,.94),'left35':(-35,.51,.94),'right35':(35,.51,.94),
       'profile':(90,.51,.94),'mouth':(0,.34,.24),'clay':(0,.34,.24)}
report={'source':str(source),'sha256':EXPECTED,'blender':bpy.app.version_string,
        'vertices':len(mesh.vertices),'triangles':len(mesh.polygons),
        'method':'Controlled proportional deformation of native surface in Blender shape key; no retopology',
        'iteration':1,'changed_vertices':int(changed.sum()),
        'maximum_displacement':float(np.linalg.norm(q-p,axis=1).max()),
        'stage':'SCULPT_EXPERIMENT' if args.sculpt else 'ORIGINAL_REFERENCE','visual_gate':'NOT_EVALUATED',
        'command':sys.argv,'eyes':'No V8 files modified; original import only'}
(out/'checkpoint.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'m01-native.blend'),compress=True)
for view in args.render:
    angle,height,scale=views[view]; yaw=math.radians(angle)
    camera.location=(1.9*math.sin(yaw),-1.9*math.cos(yaw),height)
    camera.rotation_euler=(Vector((0,0,height))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=scale
    scene.view_layers[0].material_override=clay if view=='clay' else None
    scene.render.filepath=str(out/f'{"v2" if args.sculpt else "original"}-{view}.png')
    bpy.ops.render.render(write_still=True)
