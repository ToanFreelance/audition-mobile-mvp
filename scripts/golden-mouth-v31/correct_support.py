"""Targeted follow-up: regularize only added depth field; do not smooth head."""
import bpy,numpy as np,sys,hashlib
from pathlib import Path
src,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256(src.read_bytes()).hexdigest()=='7b4d08aac92ced480c6f9165dfeedb53ea20ca0e691b12ebacec785569ab9d7f'
bpy.ops.wm.open_mainfile(filepath=str(src));o=bpy.data.objects['node_0'];m=o.data;n=len(m.vertices);k=m.shape_keys.key_blocks
p=np.empty((n,3),np.float32);v=p.copy();q=p.copy()
for name,a in [('Basis',p),('M01_Natural_V3',v),('M01_Natural_V31',q)]:k[name].data.foreach_get('co',a.ravel())
f=np.array([x.vertices[:] for x in m.polygons]);mask=(abs(p[:,0])<.09)&(p[:,1]>.285)&(p[:,1]<.365)&(p[:,2]>.20)
ids=np.flatnonzero(mask);selected=mask[f].all(1);edges=np.unique(np.sort(np.concatenate([f[selected][:,[0,1]],f[selected][:,[1,2]],f[selected][:,[2,0]]]),axis=1),axis=0)
a,b=edges.T;weight=1/np.maximum(np.linalg.norm(v[a]-v[b],axis=1),.0005);den=np.bincount(np.r_[a,b],weights=np.r_[weight,weight],minlength=n);field=(q[:,2]-v[:,2]).copy();start=field.copy()
# Diffuse the correction amplitudes, not the native positions. Each pass retains
# the measured field as a soft constraint; no face-wide geometry averaging.
for _ in range(24):
 sums=np.bincount(np.r_[a,b],weights=np.r_[field[b]*weight,field[a]*weight],minlength=n)
 field[ids]=.25*start[ids]+.75*sums[ids]/np.maximum(den[ids],1e-12)
q[ids,2]=v[ids,2]+field[ids]
# Gentle reduction of commissure pocket depth with a 3D-local, seam-preserving mask.
for corner in [247298,239979]:
 dist=np.linalg.norm(v-v[corner],axis=1);w=np.exp(-(dist/.007)**2);w[dist>.021]=0;q[:,2]+=.001*w
# Retain the already verified seam repair core exactly, including depth.
center=p[f[411680]].mean(0);dist=np.linalg.norm(p-center,axis=1);t=np.clip((dist-.002)/.004,0,1);w=1-t*t*(3-2*t)
old=np.empty_like(q);k['M01_Natural_V31'].data.foreach_get('co',old.ravel());q=q*(1-w[:,None])+old*w[:,None]
# Right seam overlap detected by BVH: preserve native differential shape locally.
center=p[f[[397033,397043]]].mean((0,1));dist=np.linalg.norm(p-center,axis=1);t=np.clip((dist-.0018)/.0042,0,1);w=1-t*t*(3-2*t)
translation=(q[f[[397033,397043]]]-p[f[[397033,397043]]]).mean((0,1));q=q*(1-w[:,None])+(p+translation)*w[:,None]
q[p[:,1]>=.378]=p[p[:,1]>=.378]
k['M01_Natural_V31'].data.foreach_set('co',q.ravel());bpy.ops.wm.save_as_mainfile(filepath=str(out/'M01-Natural-V31-Iteration-02.blend'),compress=True)
