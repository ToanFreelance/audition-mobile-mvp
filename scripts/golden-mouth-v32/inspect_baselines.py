import bpy,numpy as np,json,sys,hashlib
from pathlib import Path
old,ref,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
expected=['e0862f84330901f3cbe1dfa4e9deba47a12e7a8dc3e4c6c3e1091f144acdf0bf','dac46039732b674d86349409c6f78da12f5d629321bbd318cdc4a5022fcdd4f9']
a={}
for path,sha in zip([old,ref],expected):
 assert hashlib.sha256(path.read_bytes()).hexdigest()==sha
 bpy.ops.wm.open_mainfile(filepath=str(path));m=bpy.data.objects['node_0'].data
 for key in m.shape_keys.key_blocks:
  arr=np.empty((len(m.vertices),3),np.float32);key.data.foreach_get('co',arr.ravel())
  if key.name in a:assert np.array_equal(a[key.name],arr)
  a[key.name]=arr
f=np.array([x.vertices[:] for x in m.polygons]);p=a['Basis'];v=a['M01_Natural_V3'];r=a['M01_Natural_V31'];mask=(abs(v[:,0])<.075)&(v[:,1]>.35)&(v[:,1]<.378)&(v[:,2]>.22)
x=v[mask,0]/.075;y=(v[mask,1]-.364)/.02;A=np.stack([x**i*y**j for i in range(4) for j in range(4-i)],axis=1);delta=r[mask]-v[mask];fit=A@np.linalg.lstsq(A,delta,rcond=None)[0];res=np.linalg.norm(delta-fit,axis=1)
report={'blender':bpy.app.version_string,'keys':list(a),'vertexCount':len(p),'triangleCount':len(f),'V31UpperSupportCubicResidualP50P95Max':np.percentile(res,[50,95,100]).tolist(),'note':'Residual measures non-low-frequency content in V31 correction. It is not itself a visual acceptance test.'}
np.savez_compressed(out/'baselines.npz',basis=p,v3=v,v31=r,faces=f)
(out/'baseline.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
# Editable stage-1 V32 key from clean V3; no deformation yet.
bpy.ops.wm.open_mainfile(filepath=str(old));o=bpy.data.objects['node_0'];key=o.shape_key_add(name='M01_Natural_V32');key.data.foreach_set('co',v.ravel());o.data.shape_keys.key_blocks['M01_Natural_V3'].value=0;key.value=1
bpy.ops.wm.save_as_mainfile(filepath=str(out/'M01-Natural-V32-Stage-01.blend'),compress=True)
