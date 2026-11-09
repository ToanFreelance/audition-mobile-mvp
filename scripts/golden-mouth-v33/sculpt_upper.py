"""V33 upper-lip-only moving quadratic surface refinement; V32 lower lip locked."""
import bpy,numpy as np,sys,json,hashlib
from pathlib import Path
from mathutils.kdtree import KDTree
src,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256(src.read_bytes()).hexdigest()=='cd53bb6d1fd7d0178300958d47c73511fc253e7a68b8fc57aad5ebd5345401c7'
bpy.ops.wm.open_mainfile(filepath=str(src));o=bpy.data.objects['node_0'];m=o.data;keys=m.shape_keys.key_blocks;n=len(m.vertices);v=np.empty((n,3),np.float32);keys['M01_Natural_V32'].data.foreach_get('co',v.ravel());q=v.copy()
def c2(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t**3*(10+t*(-15+6*t))
# Restrict neighbors to upper surface; no averaging through the closed mouth seam.
unique,first,group=np.unique(v,axis=0,return_index=True,return_inverse=True)
valid=(unique[:,1]>.335)&(unique[:,1]<.374)&(abs(unique[:,0])<.066)&(unique[:,2]>.235)
points=unique[valid];tree=KDTree(len(points))
for i,p in enumerate(points):tree.insert(p.tolist(),i)
tree.balance();changed=np.zeros_like(unique);weights=np.zeros(len(unique))
for i,p in enumerate(unique):
 x,h,z=p
 if not(abs(x)<.044 and .3358<h<.361 and z>.247):continue
 w=float(c2(.3358,.340,h)*(1-c2(.352,.361,h))*(1-c2(.030,.044,abs(x))))
 if w<=0:continue
 near=tree.find_range(p.tolist(),.008);ids=np.array([j for co,j,d in near]);ds=np.array([d for co,j,d in near])
 if len(ids)<12:continue
 pts=points[ids].astype(float);center=p.astype(float);rel=(pts-center)/.008
 # Local chart estimated from native upper surface; fit height in its tangent basis.
 cov=(rel*np.exp(-(ds/.006)**2)[:,None]).T@rel;ev,vec=np.linalg.eigh(cov);normal=vec[:,0]
 if normal[2]<0:normal=-normal
 tangent1=vec[:,2];tangent2=np.cross(normal,tangent1)
 u=rel@tangent1;t=rel@tangent2;height=rel@normal
 A=np.stack([u*0+1,u,t,u*u,u*t,t*t],axis=1);ww=np.exp(-(ds/.006)**2);coef=np.linalg.lstsq(A*ww[:,None],height*ww,rcond=None)[0]
 distance=.008*coef[0];distance=.0012*np.tanh(distance/.0012)
 changed[i]=normal*distance*.72*w;weights[i]=w
q+=changed[group].astype(np.float32)
# Explicit immutable lower/support and upper-face zones; seam lower side unchanged.
lower=(abs(v[:,0])<.0415)&(v[:,1]<.334)&(v[:,1]>.282)&(v[:,2]>.19)
assert np.array_equal(q[lower],v[lower]);q[v[:,1]>=.378]=v[v[:,1]>=.378]
for key in keys:key.value=0
key=o.shape_key_add(name='M01_Natural_V33');key.data.foreach_set('co',q.ravel());key.value=1
for name,mask in [('Lower_lip_LOCK',lower),('Upper_lip_edit',weights[group]>.01),('Upper_face_LOCK',v[:,1]>=.378)]:
 g=o.vertex_groups.new(name='V33_'+name);g.add(np.flatnonzero(mask).tolist(),1,'REPLACE')
np.savez_compressed(out/'surface.npz',v32=v,sculpt=q,lower=lower)
r={'method':'one-pass upper-surface moving quadratic fit, seam-safe, local normal direction','changed':int((np.linalg.norm(q-v,axis=1)>1e-8).sum()),'maxDisplacement':float(np.linalg.norm(q-v,axis=1).max()),'lowerLocked':int(lower.sum()),'lowerMaxDelta':float(abs(q[lower]-v[lower]).max()),'status':'PENDING_VISUAL'};(out/'sculpt.json').write_text(json.dumps(r,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(out/'M01-Natural-V33-Upper-01.blend'),compress=True);print(json.dumps(r))
