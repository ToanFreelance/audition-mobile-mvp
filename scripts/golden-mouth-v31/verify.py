import bpy,sys,numpy as np,json,hashlib
from pathlib import Path
from mathutils.bvhtree import BVHTree
old,new,out=map(Path,sys.argv[sys.argv.index('--')+1:])
def load(path):
 bpy.ops.wm.open_mainfile(filepath=str(path));m=bpy.data.objects['node_0'].data;n=len(m.vertices);keys={}
 for key in m.shape_keys.key_blocks:
  a=np.empty((n,3),np.float32);key.data.foreach_get('co',a.ravel());keys[key.name]=a
 f=np.array([p.vertices[:] for p in m.polygons]);uv=np.empty(len(m.loops)*2,np.float32);m.uv_layers.active.data.foreach_get('uv',uv)
 images=sorted(hashlib.sha256(bytes(i.packed_file.data)).hexdigest() for i in bpy.data.images if i.packed_file)
 return keys,f,uv,images
k0,f0,u0,i0=load(old);k,f,u,i=load(new);p=k['Basis'];v=k['M01_Natural_V3'];q=k['M01_Natural_V31']
assert np.array_equal(k0['Basis'],p) and np.array_equal(k0['M01_Natural_V3'],v)
assert np.array_equal(f0,f) and np.array_equal(u0,u) and i==i0
nose=p[:,1]>=.378;assert np.array_equal(q[nose],p[nose])
inside=(abs(p[:,0])<.11)&(p[:,1]>.275)&(p[:,1]<.40)&(p[:,2]>.18)
ids=np.flatnonzero(inside[f].all(1));fs=f[ids];_,groups=np.unique(np.round(p,6),axis=0,return_inverse=True);gf=groups[fs]
def collisions(a):
 tree=BVHTree.FromPolygons(a.tolist(),fs.tolist(),all_triangles=True,epsilon=0)
 return {(int(ids[x]),int(ids[y])) for x,y in tree.overlap(tree) if x<y and not set(gf[x]).intersection(gf[y])}
c0=collisions(v);c1=collisions(q);cb=collisions(p)
def norm(a):
 t=a[f].astype(float);r=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);ar=np.linalg.norm(r,axis=1);return r/np.maximum(ar[:,None],1e-20),ar/2
n0,a0=norm(p);n1,a1=norm(q);dot=(n0*n1).sum(1);aff=(np.linalg.norm(q-p,axis=1)>1e-8)[f].any(1)
r={'BasisExact':True,'V3Exact':True,'topologyExact':True,'UVExact':True,'packedTexturesExact':True,'noseMaskCount':int(nose.sum()),'noseMaxDelta':float(abs(q[nose]-p[nose]).max()),'facesOver90':int((dot[aff]<0).sum()),'minimumDot':float(dot[aff].min()),'seamFaceDot':float(dot[411680]),'degenerateAffected':int((a1[aff]<1e-14).sum()),'BasisIntersectionPairs':len(cb),'V3IntersectionPairs':len(c0),'V31IntersectionPairs':len(c1),'remainingPairs':[{'faces':[a,b],'center':p[f[[a,b]]].mean((0,1)).tolist()} for a,b in sorted(c1)],'introducedIntersectionPairs':sorted(c1-c0),'collisionScope':'native perioral triangles; excludes adjacency and coincident UV vertices, epsilon 0','blendSHA256':hashlib.sha256(new.read_bytes()).hexdigest(),'bytes':new.stat().st_size}
np.savez_compressed(out.with_suffix('.npz'),basis=p,v3=v,sculpt=q,faces=f)
out.write_text(json.dumps(r,indent=2));print(json.dumps(r))
