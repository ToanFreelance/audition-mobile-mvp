"""Exact anchor constraint for face 398187's skin fan, preserving lower lip."""
import bpy,numpy as np,sys,json
from pathlib import Path
src,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True);bpy.ops.wm.open_mainfile(filepath=str(src));o=bpy.data.objects['node_0'];m=o.data;n=len(m.vertices);k=m.shape_keys.key_blocks;v=np.empty((n,3),np.float32);q=v.copy();k['M01_Natural_V32'].data.foreach_get('co',v.ravel());k['M01_Natural_V33'].data.foreach_get('co',q.ravel());f=np.array([x.vertices[:] for x in m.polygons])
def c2(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t**3*(10+t*(-15+6*t))
x,h,z=v.T;locked=(abs(x)<.0415)&(h<.334)&(h>.282)&(z>.19);center=v[f[398187]].mean(0);dist=np.linalg.norm(v-center,axis=1);ring=(dist>.003)&(dist<.014)&(h<.331)&(z>.22);ids=np.flatnonzero(ring);pts=v[ids].astype(float);_,sel=np.unique(np.round(pts,6),axis=0,return_index=True);pts=pts[sel];ids=ids[sel]
u=(pts[:,0]-center[0])/.01;t=(pts[:,1]-center[1])/.01;A=np.stack([u*0+1,u,t,u*u,u*t,t*t],1);w=np.exp(-np.linalg.norm(pts-center,axis=1)**2/.012**2)*(1+19*locked[ids])
# KKT constrained least-squares: exact source lower-lip anchor on the bad face.
anchor=239338;u0=(v[anchor,0]-center[0])/.01;t0=(v[anchor,1]-center[1])/.01;C=np.array([1,u0,t0,u0*u0,u0*t0,t0*t0]);AA=A*w[:,None];bb=pts[:,2]*w;K=np.zeros((7,7));K[:6,:6]=AA.T@AA;K[:6,6]=C;K[6,:6]=C;rhs=np.r_[AA.T@bb,v[anchor,2]];coeff=np.linalg.solve(K,rhs)[:6]
u=(x-center[0])/.01;t=(h-center[1])/.01;target=np.stack([u*0+1,u,t,u*u,u*t,t*t],1)@coeff
raw=target-z;outer_cap=c2(.006,.010,dist);delta=(1-outer_cap)*raw+outer_cap*.001*np.tanh(raw/.001);weight=1-c2(.004,.013,dist);delta*=weight;delta[locked]=0
mask=weight>0;q[mask,2]=v[mask,2]+delta[mask];q[locked]=v[locked];q[h>=.378]=v[h>=.378];k['M01_Natural_V33'].data.foreach_set('co',q.ravel());assert np.array_equal(q[locked],v[locked])
(out/'repair.json').write_text(json.dumps({'anchor':anchor,'anchorFitError':float(abs(C@coeff-v[anchor,2])),'maxCorrection':float(abs(delta).max()),'affectedVertices':int((abs(delta)>1e-8).sum()),'lowerProtectedMaxDelta':float(abs(q[locked]-v[locked]).max()),'method':'exact constrained quadratic surface; no lower-lip anchor displacement'},indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(out/'M01-Natural-V33-Final-03.blend'),compress=True)
