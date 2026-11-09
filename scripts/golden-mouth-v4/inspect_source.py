import bpy,numpy as np,sys,json,hashlib
from pathlib import Path
src,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256(src.read_bytes()).hexdigest()=='7fdc16e00012f785c76dba9d88700e7139b0e36c85f302d7a0dd0940508bcb8a'
bpy.ops.wm.open_mainfile(filepath=str(src));o=bpy.data.objects['node_0'];m=o.data;n=len(m.vertices);a={}
for key in m.shape_keys.key_blocks:
 p=np.empty((n,3),np.float32);key.data.foreach_get('co',p.ravel());a[key.name]=p
f=np.array([t.vertices[:] for t in m.polygons]);uv=np.empty((len(m.loops),2),np.float32);m.uv_layers.active.data.foreach_get('uv',uv.ravel())
np.savez_compressed(out/'native.npz',**a,faces=f,uv=uv)
p=a['M01_Natural_V33'];cent=p[f].mean(1);sel=(abs(cent[:,0])<.06)&(cent[:,1]>.315)&(cent[:,1]<.350)&(cent[:,2]>.17)
print(json.dumps({'blender':bpy.app.version_string,'keys':list(a),'vertices':n,'faces':len(f),'sourceSha':hashlib.sha256(src.read_bytes()).hexdigest(),'seamRegionFaces':int(sel.sum())}))
