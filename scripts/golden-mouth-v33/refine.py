"""Anatomical upper roll/Cupid refinement and isolated right commissure repair."""
import bpy,numpy as np,sys,json,hashlib
from pathlib import Path
src,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(src));o=bpy.data.objects['node_0'];m=o.data;k=m.shape_keys.key_blocks;n=len(m.vertices)
v=np.empty((n,3),np.float32);u=v.copy();k['M01_Natural_V32'].data.foreach_get('co',v.ravel());k['M01_Natural_V33'].data.foreach_get('co',u.ravel());q=u.astype(float);f=np.array([t.vertices[:] for t in m.polygons])
def c2(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t**3*(10+t*(-15+6*t))
x,h,z=v.T;upper=c2(.3358,.340,h)*(1-c2(.353,.364,h))*(1-c2(.033,.050,abs(x)))*c2(.244,.259,z)
# Gently reduce the protruding crest and blend into healthy upper support.
roll=.00095*np.exp(-(x/.032)**4-((h-.347)/.0075)**2)
transition=.00022*np.exp(-(x/.036)**4-((h-.357)/.0055)**2)
q[:,2]+=upper*(-roll+transition)
# Shallow paired peaks and a gentler central dip; no lip-wide Y compression.
peaks=np.exp(-((abs(x)-.010)/.008)**2-((h-.350)/.006)**2)
central=np.exp(-(x/.006)**2-((h-.348)/.007)**2)
q[:,1]+=upper*(-.00075*peaks+.00022*central)
# Precise right lower-corner repair from a skin ring, with protected lower-lip anchors.
center=v[f[398187]].mean(0);dist=np.linalg.norm(v-center,axis=1)
locked=(abs(x)<.0415)&(h<.334)&(h>.282)&(z>.19)
ring=(dist>.003)&(dist<.014)&(h<.331)&(z>.22)
ids=np.flatnonzero(ring);pts=v[ids].astype(float);_,sel=np.unique(np.round(pts,6),axis=0,return_index=True);pts=pts[sel];ids=ids[sel]
u=(pts[:,0]-center[0])/.01;t=(pts[:,1]-center[1])/.01;A=np.stack([u*0+1,u,t,u*u,u*t,t*t],1)
w=np.exp(-np.linalg.norm(pts-center,axis=1)**2/.012**2)*(1+19*locked[ids])
coeff=np.linalg.lstsq(A*w[:,None],pts[:,2]*w,rcond=None)[0]
u=(x-center[0])/.01;t=(h-center[1])/.01;target=np.stack([u*0+1,u,t,u*u,u*t,t*t],1)@coeff
weight=1-c2(.004,.013,dist);delta=.001*np.tanh((target-z)/.001)*weight;delta[locked]=0;q[:,2]+=delta
q[locked]=v[locked];q[v[:,1]>=.378]=v[v[:,1]>=.378];q=q.astype(np.float32)
k['M01_Natural_V33'].data.foreach_set('co',q.ravel())
for name,mask in [('Upper_roll',upper>.01),('Cupid_peaks',(peaks*upper)>.1),('Right_corner_repair',weight>.01),('Lower_lip_LOCK',locked)]:
 g=o.vertex_groups.get('V33_'+name) or o.vertex_groups.new(name='V33_'+name);g.add(np.flatnonzero(mask).tolist(),1,'REPLACE')
r={'rightArtifactFaces':[398187,397282,398287,398285],'rightArtifactVertices':np.unique(f[[398187,397282,398287,398285]]).tolist(),'repairMaxDisplacement':float(abs(delta).max()),'lowerProtectedCount':int(locked.sum()),'lowerMaxDelta':float(abs(q[locked]-v[locked]).max()),'changedFromV32':int((np.linalg.norm(q-v,axis=1)>1e-8).sum()),'maxDisplacement':float(np.linalg.norm(q-v,axis=1).max()),'method':'local upper roll/Cupid controls plus constrained quadratic right-skin repair','status':'PENDING_VISUAL'}
(out/'sculpt.json').write_text(json.dumps(r,indent=2));np.savez_compressed(out/'surface.npz',v32=v,sculpt=q,lower=locked,artifact=weight>.01,faces=f)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'M01-Natural-V33-Refined-02.blend'),compress=True);print(json.dumps(r))
