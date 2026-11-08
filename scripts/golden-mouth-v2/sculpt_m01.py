"""Native-head M01 checkpoint. Run with Blender, not system Python.
No triangle deletion, skin replacement, lip strips, or new mouth mesh.
"""
import argparse, gzip, hashlib, json, math, struct, sys
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
parser.add_argument('--iteration', type=int, choices=[1,2], default=2)
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
corner=(.010 if args.iteration==1 else .0055)*np.minimum((np.abs(x)/.052)**2,1)
compression=.28 if args.iteration==1 else .28+.18*smooth(.331,.347,h)
q[:,1]+=(-compression*(h-.335)-corner)*support*lipband
# Very restrained reduction in native lower-lip projection; keeps native rolls.
lower=np.exp(-((h-.320)/.012)**2)*np.exp(-(x/.040)**4)*front
q[:,2]-=.0015*lower
changed=np.linalg.norm(q-p,axis=1)>1e-8
sculpt.data.foreach_set('co',q.ravel())
sculpt.value=1 if args.sculpt else 0
np.savez_compressed(out/'m01-native-delta.npz',indices=np.flatnonzero(changed),
                   delta=(q-p)[changed],basis=p[changed])
# Prove importer preserved source vertex identity before publishing sparse data.
blob=source.read_bytes(); size=struct.unpack_from('<I',blob,12)[0]
gltf=json.loads(blob[20:20+size]); binary=blob[28+size:]
primitive=gltf['meshes'][0]['primitives'][0]
def accessor(i,dim):
    a=gltf['accessors'][i];v=gltf['bufferViews'][a['bufferView']]
    return np.frombuffer(binary,'<f4',a['count']*dim,v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,dim)
raw=accessor(primitive['attributes']['POSITION'],3)
assert np.allclose(p,raw[:,[0,2,1]]*np.array([1,-1,1]),atol=1e-7)
ids=np.flatnonzero(changed)
# Read evaluated Blender split normals, including the native custom normals.
# Preserve the original imported normal outside the sculpt's compact support.
sculpt.value=1; bpy.context.view_layer.update()
evaluated=head.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
loops=np.empty(len(evaluated.loops),dtype=np.int32); evaluated.loops.foreach_get('vertex_index',loops)
ln=np.empty((len(evaluated.loops),3),dtype=np.float32)
evaluated.corner_normals.foreach_get('vector',ln.ravel())
vn=np.zeros_like(p); np.add.at(vn,loops,ln)
vn/=np.maximum(np.linalg.norm(vn,axis=1,keepdims=True),1e-12)
delta=(q-p)[:,[0,2,1]]*np.array([1,1,-1])
normals=vn[:,[0,2,1]]*np.array([1,1,-1])
runtime={'version':2,'iteration':args.iteration,'sourceSha256':EXPECTED,
         'vertexCount':len(p),'triangleCount':len(mesh.polygons),
         'indices':ids.tolist(),'delta':delta[ids].round(9).tolist(),
         'normal':normals[ids].round(9).tolist(),
         'method':'Blender native-surface proportional shape-key deformation'}
(out/'m01-native.json.gz').write_bytes(gzip.compress(json.dumps(runtime,separators=(',',':')).encode(),mtime=0))
sculpt.value=1 if args.sculpt else 0

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
        'iteration':args.iteration,'changed_vertices':int(changed.sum()),
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
