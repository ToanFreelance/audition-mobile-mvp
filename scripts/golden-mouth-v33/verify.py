"""Validate saved V33 against immutable V32, original GLB and protected regions."""
import bpy,numpy as np,sys,json,hashlib,struct
from pathlib import Path
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:];old,new,source,out=map(Path,args[:4]);allow_width='--allow-width' in args
out.parent.mkdir(parents=True,exist_ok=True)
def load(path):
 bpy.ops.wm.open_mainfile(filepath=str(path));m=bpy.data.objects['node_0'].data;k={};n=len(m.vertices)
 for key in m.shape_keys.key_blocks:
  a=np.empty((n,3),np.float32);key.data.foreach_get('co',a.ravel());k[key.name]=a
 f=np.array([p.vertices[:] for p in m.polygons]);uv=np.empty((len(m.loops),2),np.float32);m.uv_layers.active.data.foreach_get('uv',uv.ravel());images=sorted(hashlib.sha256(bytes(i.packed_file.data)).hexdigest() for i in bpy.data.images if i.packed_file)
 return k,f,uv,images,[x.name for x in m.materials]
k0,f0,u0,im0,mat0=load(old);k,f,uv,im,mat=load(new);p=k['Basis'];v=k['M01_Natural_V32'];q=k['M01_Natural_V33']
for name in k0:assert np.array_equal(k[name],k0[name]),name+' modified'
assert np.array_equal(f,f0) and np.array_equal(uv,u0) and im==im0 and mat==mat0
blob=source.read_bytes();assert hashlib.sha256(blob).hexdigest()=='b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90';js=struct.unpack_from('<I',blob,12)[0];gl=json.loads(blob[20:20+js]);binary=blob[28+js:];pr=gl['meshes'][0]['primitives'][0]
def read(i,dim):
 a=gl['accessors'][i];b=gl['bufferViews'][a['bufferView']];return np.frombuffer(binary,{5126:'<f4',5123:'<u2',5125:'<u4'}[a['componentType']],a['count']*dim,b.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,dim)
sp=read(pr['attributes']['POSITION'],3)[:,[0,2,1]]*np.array([1,-1,1]);sf=read(pr['indices'],1).reshape(-1,3);su=read(pr['attributes']['TEXCOORD_0'],2)[sf].reshape(-1,2).copy();su[:,1]=1-su[:,1];assert np.array_equal(sp,p) and np.array_equal(sf,f) and np.array_equal(su,uv)
nose=p[:,1]>=.378;assert np.array_equal(q[nose],p[nose]);assert np.isfinite(q).all()
lower=(abs(v[:,0])<.0415)&(v[:,1]<.334)&(v[:,1]>.282)&(v[:,2]>.19);support=(abs(v[:,0])<.070)&(v[:,1]>.282)&(v[:,1]<.312)&(v[:,2]>.19)
if not allow_width:assert np.array_equal(q[lower],v[lower]) and np.array_equal(q[support],v[support])
else:assert np.array_equal(q[lower,1:],v[lower,1:]) and abs(q[lower,0]-v[lower,0]).max()<.0024
_,groups=np.unique(p,axis=0,return_inverse=True);spread=[]
for j in range(3):
 lo=np.full(groups.max()+1,np.inf);hi=np.full(groups.max()+1,-np.inf);np.minimum.at(lo,groups,q[:,j]);np.maximum.at(hi,groups,q[:,j]);spread.append(float((hi-lo).max()))
def geom(a):
 t=a[f].astype(float);cr=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);ar=np.linalg.norm(cr,axis=1);return cr/np.maximum(ar[:,None],1e-20),ar*.5
n0,ar0=geom(p);n1,ar1=geom(q);dots=(n0*n1).sum(1);affected=(np.linalg.norm(q-p,axis=1)>1e-8)[f].any(1);bad=np.flatnonzero(affected&(dots<0))
inside=(abs(p[:,0])<.11)&(p[:,1]>.275)&(p[:,1]<.40)&(p[:,2]>.18);ids=np.flatnonzero(inside[f].all(1));fs=f[ids];gf=groups[fs]
def collisions(a):
 tree=BVHTree.FromPolygons(a.tolist(),fs.tolist(),all_triangles=True,epsilon=0)
 return {(int(ids[x]),int(ids[y])) for x,y in tree.overlap(tree) if x<y and not set(gf[x]).intersection(gf[y])}
pairs=collisions(q);prior=collisions(v)
r={'blender':bpy.app.version_string,'sourceSHA256':hashlib.sha256(blob).hexdigest(),'blendSHA256':hashlib.sha256(new.read_bytes()).hexdigest(),'blendBytes':new.stat().st_size,'keys':list(k),'vertices':len(p),'triangles':len(f),'sourceBasisTopologyUVExact':True,'priorShapeKeysExact':True,'texturesMaterialsUnchanged':True,'noseCount':int(nose.sum()),'noseMaxDelta':float(abs(q[nose]-p[nose]).max()),'UVSplitSpreadXYZ':spread,'lowerProtectedCount':int(lower.sum()),'lowerMaxDeltaXYZ':abs(q[lower]-v[lower]).max(0).tolist(),'lowerSupportCount':int(support.sum()),'lowerSupportMaxDeltaXYZ':abs(q[support]-v[support]).max(0).tolist(),'widthProbe':allow_width,'facesOver90':len(bad),'minimumNormalDot':float(dots[affected].min()),'degenerateAffected':int((ar1[affected]<1e-14).sum()),'badFaces':[{'id':int(i),'vertices':f[i].tolist(),'center':p[f[i]].mean(0).tolist()} for i in bad],'V32IntersectionPairs':len(prior),'candidateIntersectionPairs':len(pairs),'introducedIntersectionPairs':sorted(pairs-prior),'artifactAngle397282_398187':float(np.degrees(np.arccos(np.clip(n1[397282]@n1[398187],-1,1)))),'collisionScope':'native perioral abs(x)<.11, .275<h<.40, z>.18; excludes adjacent/UV duplicate vertices'}
np.savez_compressed(out.with_suffix('.npz'),basis=p,v32=v,sculpt=q,faces=f,lower=lower,support=support);out.write_text(json.dumps(r,indent=2));print(json.dumps(r))
