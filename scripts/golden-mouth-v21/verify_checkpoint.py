import bpy,numpy as np,sys,json,hashlib
from pathlib import Path
base,new,out=map(Path,sys.argv[sys.argv.index('--')+1:])
def snapshot(path):
 bpy.ops.wm.open_mainfile(filepath=str(path));m=bpy.data.objects['node_0'].data;keys=[]
 for k in m.shape_keys.key_blocks:
  co=np.empty((len(m.vertices),3),np.float32);k.data.foreach_get('co',co.ravel());keys.append((k.name,co,k.value))
 uv=np.empty(len(m.uv_layers.active.data)*2,np.float32);m.uv_layers.active.data.foreach_get('uv',uv)
 return keys,np.array([p.vertices[:] for p in m.polygons]),uv,{im.name:hashlib.sha256(bytes(im.packed_file.data)).hexdigest() for im in bpy.data.images if im.packed_file}
a=snapshot(base);b=snapshot(new)
r={'basis_exact':np.array_equal(a[0][0][1],b[0][0][1]),'v2_key_exact':np.array_equal(a[0][1][1],b[0][1][1]),'topology_exact':np.array_equal(a[1],b[1]),'uv_exact':np.array_equal(a[2],b[2]),'packed_textures_exact':a[3]==b[3]};assert all(r.values())
r.update({'blender':bpy.app.version_string,'keys':[(k[0],k[2]) for k in b[0]],'vertices':len(b[0][0][1]),'triangles':len(b[1]),'fileSha256':hashlib.sha256(new.read_bytes()).hexdigest(),'runtime':'NOT_RUN'})
out.write_text(json.dumps(r,indent=2));print(json.dumps(r))
