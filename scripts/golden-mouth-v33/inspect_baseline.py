import bpy,numpy as np,sys,json,hashlib
from pathlib import Path
src,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256(src.read_bytes()).hexdigest()=='cd53bb6d1fd7d0178300958d47c73511fc253e7a68b8fc57aad5ebd5345401c7'
bpy.ops.wm.open_mainfile(filepath=str(src));o=bpy.data.objects['node_0'];m=o.data;keys=m.shape_keys.key_blocks;n=len(m.vertices);p=np.empty((n,3),np.float32);q=p.copy();keys['Basis'].data.foreach_get('co',p.ravel());keys['M01_Natural_V32'].data.foreach_get('co',q.ravel());f=np.array([t.vertices[:] for t in m.polygons])
# Lock lower vermilion and support. A narrow interface above h=.334 can blend the seam.
lower=(abs(q[:,0])<.042)&(q[:,1]<.3335)&(q[:,1]>.282)&(q[:,2]>.19)
np.savez_compressed(out/'baseline.npz',basis=p,v32=q,faces=f,lower=lower)
# Locate curvature artifact by adjacent-face normal angle in the specified right area.
_,groups=np.unique(p,axis=0,return_inverse=True);sel=(q[f].mean(1)[:,0]>.038)&(q[f].mean(1)[:,0]<.061)&(q[f].mean(1)[:,1]>.317)&(q[f].mean(1)[:,1]<.333)&(q[f].mean(1)[:,2]>.21)
ids=np.flatnonzero(sel);ff=groups[f[ids]];e=np.sort(np.concatenate([ff[:,[0,1]],ff[:,[1,2]],ff[:,[2,0]]]),axis=1);fi=np.tile(ids,3);order=np.lexsort((e[:,1],e[:,0]));e=e[order];fi=fi[order];same=np.all(e[:-1]==e[1:],axis=1);a=fi[:-1][same];b=fi[1:][same]
t=q[f].astype(float);nn=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);nn/=np.maximum(np.linalg.norm(nn,axis=1)[:,None],1e-20);angles=np.degrees(np.arccos(np.clip((nn[a]*nn[b]).sum(1),-1,1)));top=np.argsort(angles)[-12:][::-1]
report={'blender':bpy.app.version_string,'keys':list(keys.keys()),'vertices':n,'triangles':len(f),'lowerProtectedCount':int(lower.sum()),'artifactEdges':[{'faces':[int(a[j]),int(b[j])],'vertices':np.unique(f[[a[j],b[j]]]).tolist(),'center':q[f[[a[j],b[j]]]].mean((0,1)).tolist(),'angleDegrees':float(angles[j])} for j in top]}
(out/'baseline.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
