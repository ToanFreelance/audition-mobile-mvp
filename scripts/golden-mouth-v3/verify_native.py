import bpy,sys,hashlib,json,numpy as np,struct
from pathlib import Path
source,blend,out=map(Path,sys.argv[sys.argv.index('--')+1:]);blob=source.read_bytes();js=struct.unpack_from('<I',blob,12)[0];gl=json.loads(blob[20:20+js]);binary=blob[28+js:];prim=gl['meshes'][0]['primitives'][0]
def read(i,dim):
 a=gl['accessors'][i];v=gl['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']];return np.frombuffer(binary,dt,a['count']*dim,a.get('byteOffset',0)+v.get('byteOffset',0)).reshape(-1,dim)
p=read(prim['attributes']['POSITION'],3)[:,[0,2,1]]*np.array([1,-1,1]);f=read(prim['indices'],1).reshape(-1,3)
bpy.ops.wm.open_mainfile(filepath=str(blend));o=bpy.data.objects['node_0'];m=o.data;k=m.shape_keys.key_blocks;bp=np.empty((len(m.vertices),3),np.float32);k['Basis'].data.foreach_get('co',bp.ravel());faces=np.array([p.vertices[:] for p in m.polygons]);uv=read(prim['attributes']['TEXCOORD_0'],2);lu=np.empty((len(m.loops),2),np.float32);m.uv_layers.active.data.foreach_get('uv',lu.ravel());expecteduv=uv[f].reshape(-1,2).copy();expecteduv[:,1]=1-expecteduv[:,1]
r={'sourceSHA256':hashlib.sha256(blob).hexdigest(),'blendSHA256':hashlib.sha256(blend.read_bytes()).hexdigest(),'bytes':blend.stat().st_size,'blender':bpy.app.version_string,'BasisEqualsOriginalGLB':bool(np.array_equal(bp,p)),'connectivityEqualsOriginalGLB':bool(np.array_equal(faces,f)),'uvEqualsOriginalGLB':bool(np.array_equal(lu,expecteduv)),'keys':list(k.keys()),'vertices':len(m.vertices),'triangles':len(m.polygons),'packedImages':len([im for im in bpy.data.images if im.packed_file]),'visibleMeshObjects':[ob.name for ob in bpy.context.scene.objects if ob.type=='MESH' and not ob.hide_render]}
image_hashes=[]
for im in gl['images']:
 v=gl['bufferViews'][im['bufferView']];start=v.get('byteOffset',0);image_hashes.append(hashlib.sha256(binary[start:start+v['byteLength']]).hexdigest())
r['packedTexturesEqualOriginalBytes']=sorted(image_hashes)==sorted(hashlib.sha256(bytes(im.packed_file.data)).hexdigest() for im in bpy.data.images if im.packed_file)
r['maxUVDifference']=float(abs(lu-expecteduv).max())
assert r['packedTexturesEqualOriginalBytes']
assert r['BasisEqualsOriginalGLB'] and r['connectivityEqualsOriginalGLB'] and r['uvEqualsOriginalGLB'];assert r['keys']==['Basis','M01_Natural_V3'];assert r['visibleMeshObjects']==['node_0'];out.write_text(json.dumps(r,indent=2));print(json.dumps(r))
