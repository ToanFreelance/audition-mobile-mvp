"""Ray-sample actual saved surfaces at identical XY; no depth target from Golden."""
import bpy,numpy as np,sys,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
v3path,v31path,v32path,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
xx=np.arange(-.084,.0841,.0015);yy=np.arange(.285,.3781,.0015);X,Y=np.meshgrid(xx,yy);depth={};geo={}
for name,path,key in [('v3',v3path,'M01_Natural_V3'),('v31',v31path,'M01_Natural_V31'),('v32',v32path,'M01_Natural_V32')]:
 bpy.ops.wm.open_mainfile(filepath=str(path));m=bpy.data.objects['node_0'].data;p=np.empty((len(m.vertices),3),np.float32);m.shape_keys.key_blocks[key].data.foreach_get('co',p.ravel());f=np.array([x.vertices[:] for x in m.polygons]);tree=BVHTree.FromPolygons(p.tolist(),f.tolist(),all_triangles=True)
 Z=np.full(X.shape,np.nan)
 for j in range(X.shape[0]):
  for i in range(X.shape[1]):
   hit=tree.ray_cast(Vector((float(X[j,i]),float(Y[j,i]),1)),Vector((0,0,-1)),2)[0]
   if hit is not None:Z[j,i]=hit.z
 depth[name]=Z;geo[name]=p
np.savez_compressed(out/'sampled-depth.npz',X=X,Y=Y,**depth)
regions={'upper_support':(abs(X)<.05)&(Y>.352)&(Y<.366),'lower_support':(abs(X)<.05)&(Y>.300)&(Y<.316),'lateral_support':(abs(X)>.050)&(abs(X)<.072)&(Y>.318)&(Y<.352)}
r={}
for name,mask in regions.items():
 d=(depth['v32']-depth['v31'])[mask];d=d[np.isfinite(d)]
 r[name]={'samples':len(d),'meanZGainOverV31':float(d.mean()),'minZGain':float(d.min()),'p05ZGain':float(np.percentile(d,5)),'maxZGain':float(d.max()),'fractionForward':float((d>0).mean()),'projectedVolumeGain':float(d.sum()*.0015**2)}
# Second derivative of the correction on a regular XY grid, excludes native lip roll.
region=(abs(X)<.05)&(Y>.354)&(Y<.371)
for name in ['v31','v32']:
 delta=depth[name]-depth['v3'];dy,dx=np.gradient(delta,.0015);dyy,dyx=np.gradient(dy,.0015);dxy,dxx=np.gradient(dx,.0015);mag=np.sqrt(dxx*dxx+2*dxy*dxy+dyy*dyy)
 r[name+'_upperCorrectionHessianP50P95']=np.percentile(mag[region],[50,95]).tolist()
r['notes']=['Projected volume is XY depth integral, not a watertight anatomical tissue volume.','Hessian measures correction roughness, not artistic acceptance.','All comparisons use actual triangle rays at equal XY.']
(out/'profiles.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
np.savez_compressed(out/'geometry.npz',faces=f,**geo)
