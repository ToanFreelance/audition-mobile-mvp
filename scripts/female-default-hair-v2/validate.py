"""Reopen checkpoints, prove face preservation, audit static hair/head contact."""
import bpy,sys,hashlib,json
import numpy as np
from pathlib import Path
from mathutils.bvhtree import BVHTree
from mathutils import Vector
ref,src,out,*targets=sys.argv[sys.argv.index('--')+1:];ref=Path(ref).resolve();out=Path(out).resolve();out.mkdir(exist_ok=True,parents=True)
def digest(a):return hashlib.sha256(a.tobytes()).hexdigest()
def arr(items,prop,n,dtype=np.float32):
 a=np.empty((len(items),n),dtype);items.foreach_get(prop,a.ravel());return a
def signature(o):
 m=o.data;r={'positions':digest(arr(m.vertices,'co',3)),'loops':digest(arr(m.loops,'vertex_index',1,np.int32)),'polygonSizes':digest(arr(m.polygons,'loop_total',1,np.int32)),'matrix':list(sum((list(row) for row in o.matrix_world),[])),'materials':[x.name for x in m.materials],'uv':{u.name:digest(arr(u.data,'uv',2)) for u in m.uv_layers},'keys':{}}
 if m.shape_keys:r['keys']={k.name:digest(arr(k.data,'co',3)) for k in m.shape_keys.key_blocks}
 return r
bpy.ops.wm.read_factory_settings(use_empty=True);raw=Path(src).read_bytes();sha=hashlib.sha256(raw).hexdigest();assert sha=='b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90';bpy.ops.import_scene.gltf(filepath=str(Path(src).resolve()));original=[o for o in bpy.context.scene.objects if o.type=='MESH'][0];rawsig=signature(original)
bpy.ops.wm.open_mainfile(filepath=str(ref/'Golden-Mouth-V4-MVP-Nine-Presets.blend'));m4=signature(bpy.data.objects['node_0'])
bpy.ops.wm.open_mainfile(filepath=str(ref/'Female-Default-Hair-Style04-V1.blend'));assert m4==signature(bpy.data.objects['node_0'])
names=['node_0','Preview_M02_GoldenEyeV8','V4_Original_Head_Uncut','V8_Iris_-1','V8_Iris_1','V8_Sclera_-1','V8_Sclera_1','V4_Cavity','V4_Gum','V4_Tongue','V4_UpperTeeth'];baseline={n:signature(bpy.data.objects[n]) for n in names}
images={i.name:hashlib.sha256(bytes(i.packed_file.data)).hexdigest() for i in bpy.data.images if i.packed_file and not i.name.startswith('Style04')}
# Confirm M02 is the visible pose outside the eye patch, without moving any vertex.
head=bpy.data.objects['node_0'];q=arr(head.data.shape_keys.key_blocks['M02_soft_smile'].data,'co',3);p=bpy.data.objects['Preview_M02_GoldenEyeV8'];pv=arr(p.data.vertices,'co',3)[:len(q)]
qw=np.asarray([(head.matrix_world@Vector(x))[:] for x in q]);pw=np.asarray([(p.matrix_world@Vector(x))[:] for x in pv]);non_eye=(qw[:,2]<.40);m02err=float(abs(qw[non_eye]-pw[non_eye]).max());assert m02err<2e-7
results=[]
for target in targets:
 bpy.ops.wm.open_mainfile(filepath=str(Path(target).resolve()));same={n:signature(bpy.data.objects[n])==v for n,v in baseline.items()};assert all(same.values())
 image_same=all(bpy.data.images.get(n) and bpy.data.images[n].packed_file and hashlib.sha256(bytes(bpy.data.images[n].packed_file.data)).hexdigest()==v for n,v in images.items());assert image_same
 head=bpy.data.objects['Preview_M02_GoldenEyeV8'];hp=[head.matrix_world@v.co for v in head.data.vertices];hf=[tuple(p.vertices) for p in head.data.polygons];hb=BVHTree.FromPolygons(hp,hf)
 deps=bpy.context.evaluated_depsgraph_get();hair=[]
 for o in bpy.data.objects:
  if o.type!='MESH' or not o.name.startswith('V2_'):continue
  ev=o.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles();vs=[o.matrix_world@v.co for v in m.vertices];faces=[tuple(t.vertices) for t in m.loop_triangles];b=BVHTree.FromPolygons(vs,faces);pairs=b.overlap(hb);areas=[(vs[t[1]]-vs[t[0]]).cross(vs[t[2]]-vs[t[0]]).length/2 for t in faces]
  hair.append({'name':o.name,'vertices':len(vs),'triangles':len(faces),'finite':bool(np.isfinite(np.asarray(vs)).all()),'minTriangleArea':min(areas),'headIntersectionPairs':len(pairs),'intersectionBounds':[[min(hp[v][i] for _,f in pairs for v in hf[f]) for i in range(3)],[max(hp[v][i] for _,f in pairs for v in hf[f]) for i in range(3)]] if pairs else None});ev.to_mesh_clear()
 results.append({'file':Path(target).name,'sha256':hashlib.sha256(Path(target).read_bytes()).hexdigest(),'faceObjectsExact':same,'packedFacialImagesExact':image_same,'hair':hair,'hairTriangles':sum(x['triangles'] for x in hair),'headIntersectionPairs':sum(x['headIntersectionPairs'] for x in hair)})
report={'blender':bpy.app.version_string,'sourceSha256':sha,'originalGLBOpened':True,'V1NativeHeadEqualsMouthV4':True,'visibleM02LowerFaceMaxError':m02err,'baselineFaceSignatures':baseline,'results':results,'scope':'Static pose and mesh surface intersections only; no animation, WebGL or owner artistic acceptance.'};(out/'validation.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='baselineFaceSignatures'}))
