"""V3.1 surface-relative projection correction; opens immutable V3 checkpoint."""
import bpy,numpy as np,sys,json,hashlib
from pathlib import Path
blend,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256(blend.read_bytes()).hexdigest()=='e0862f84330901f3cbe1dfa4e9deba47a12e7a8dc3e4c6c3e1091f144acdf0bf'
bpy.ops.wm.open_mainfile(filepath=str(blend));o=bpy.data.objects['node_0'];m=o.data;k=m.shape_keys.key_blocks;n=len(m.vertices)
def coords(key):
 a=np.empty((n,3),np.float32);key.data.foreach_get('co',a.ravel());return a
p=coords(k['Basis']);v=coords(k['M01_Natural_V3']);q=v.copy();f=np.array([x.vertices[:] for x in m.polygons])
def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
x,h,z=p.T
# Full anatomical preservation cap: entire source head above lower nasal plane.
# Smoothly restore V3 residual in the lower philtrum before the exact lock.
keep=1-smooth(.365,.378,h);q=p+(q-p)*keep[:,None]
# Forward support follows the actual loss of native depth; not a uniform translation.
foot=(1-smooth(.055,.085,abs(x)))*smooth(.286,.306,h)*(1-smooth(.360,.378,h))*smooth(.19,.225,z)
restore=np.maximum(p[:,2]-v[:,2],0)*.62*foot
lower=.0014*np.exp(-((h-.310)/.014)**2-(x/.045)**4)*foot
lateral=.0018*np.exp(-((abs(x)-.045)/.015)**2-((h-.335)/.018)**2)*foot
q[:,2]+=restore+lower+lateral
# Seam repair: preserve native differential triangle shape in a tiny core, using
# the V3.1 displacement at its center. Smooth transition of displacement, not
# averaging positions, so the original seam isn't erased or stitched across.
center=p[f[411680]].mean(0);distance=np.linalg.norm(p-center,axis=1)
w=1-smooth(.0018,.006,distance);translation=(q[f[411680]]-p[f[411680]]).mean(0)
q=q*(1-w[:,None])+(p+translation)*w[:,None]
nose=h>=.378;q[nose]=p[nose]
key=o.shape_key_add(name='M01_Natural_V31');key.data.foreach_set('co',q.ravel());k['M01_Natural_V3'].value=0;key.value=1
for name,mask in [('Nasal_preservation',nose),('Projection_support',foot>.01),('Seam_repair',w>0)]:
 vg=o.vertex_groups.new(name='V31_'+name);vg.add(np.flatnonzero(mask).tolist(),1,'REPLACE')
def geom(a):
 t=a[f].astype(float);r=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);ar=np.linalg.norm(r,axis=1);return r/np.maximum(ar[:,None],1e-20),ar/2
n0,a0=geom(p);n1,a1=geom(q);dots=(n0*n1).sum(1);affected=(np.linalg.norm(q-p,axis=1)>1e-8)[f].any(1)
marks=[243775,243576,239703,247593,247298,239979,243821,239816]
report={'blender':bpy.app.version_string,'baselineSHA':hashlib.sha256(blend.read_bytes()).hexdigest(),'vertices':n,'triangles':len(f),'changedFromV3':int((np.linalg.norm(q-v,axis=1)>1e-8).sum()),'facesOver90':int((dots[affected]<0).sum()),'minimumDot':float(dots[affected].min()),'seamFaceDot':float(dots[411680]),'degenerateAffected':int((a1[affected]<1e-14).sum()),'noseMask':'all source height >= .378, including entire upper head','noseVertices':int(nose.sum()),'noseMaxDelta':float(np.linalg.norm(q[nose]-p[nose],axis=1).max()),'landmarks':{str(i):{'basis':p[i].tolist(),'v3':v[i].tolist(),'v31':q[i].tolist()} for i in marks},'status':'PENDING_VISUAL_AND_INTERSECTION_QA'}
(out/'validation.json').write_text(json.dumps(report,indent=2));np.savez_compressed(out/'surface.npz',basis=p,v3=v,sculpt=q,faces=f,nose=nose)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'M01-Natural-V31-Iteration-01.blend'),compress=True)
print(json.dumps(report),flush=True)
