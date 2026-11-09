"""V32: clean V3 + anatomical C2 support volumes in a fitted skin-normal chart.
No V31 coordinates, native-delta clipping, graph diffusion, or mesh replacement.
"""
import argparse,sys,json,hashlib
from pathlib import Path
import bpy,numpy as np
ap=argparse.ArgumentParser();ap.add_argument('--v3',required=True);ap.add_argument('--output',required=True);a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);src=Path(a.v3);out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256(src.read_bytes()).hexdigest()=='e0862f84330901f3cbe1dfa4e9deba47a12e7a8dc3e4c6c3e1091f144acdf0bf'
bpy.ops.wm.open_mainfile(filepath=str(src));o=bpy.data.objects['node_0'];m=o.data;n=len(m.vertices);keys=m.shape_keys.key_blocks
p=np.empty((n,3),np.float32);v=p.copy();keys['Basis'].data.foreach_get('co',p.ravel());keys['M01_Natural_V3'].data.foreach_get('co',v.ravel());f=np.array([t.vertices[:] for t in m.polygons]);q=v.astype(float)
def c2(lo,hi,x):
 t=np.clip((x-lo)/(hi-lo),0,1);return t*t*t*(10+t*(-15+6*t))
x,h,z=v.T
# Fit surrounding skin at uniform XY samples; omit lip relief and inner seam.
skin=(abs(x)<.09)&(h>.29)&(h<.381)&(z>.215)&((abs(x)>.055)|(h>.358)|(h<.309))
pts=v[skin];_,sample=np.unique(np.round(pts[:,:2]/.0015),axis=0,return_index=True);pts=pts[sample]
chart_samples=len(pts)
u=pts[:,0]/.075;t=(pts[:,1]-.337)/.04;A=np.stack([u*0+1,u,t,u*u,u*t,t*t],axis=1);coef=np.linalg.lstsq(A,pts[:,2],rcond=None)[0]
u=x/.075;t=(h-.337)/.04;dx=(coef[1]+2*coef[3]*u+coef[4]*t)/.075;dy=(coef[2]+coef[4]*u+2*coef[5]*t)/.04
# Mostly outward normal, reduced tangential component to preserve delicate M01 pose.
direction=np.stack([-.12*dx,-.10*dy,np.ones(n)],axis=1)
foot=(1-c2(.068,.105,abs(x)))*c2(.278,.300,h)*(1-c2(.354,.378,h))*c2(.18,.225,z)
upper_and_lateral=.0050*np.exp(-(x/.075)**2-((h-.337)/.030)**2)
lower_support=.0010*np.exp(-(x/.060)**2-((h-.306)/.014)**2)
amplitude=(upper_and_lateral+lower_support)*foot
q+=amplitude[:,None]*direction
# Restore V3's tiny nasal residual with C2 falloff; protected head is exact Basis.
restore=c2(.354,.378,p[:,1]);q+=restore[:,None]*(p-v)
# Final targeted correction: fit a positive affine differential map to the
# surrounding V3 surface, rather than a translation-only native island.
# Round only the outer skin termination, without averaging across the lip seam.
corner_reports=[]
for corner in [247298,239979]:
 c=q[corner].copy();rxy=np.linalg.norm(q[:,:2]-c[:2],axis=1)
 ring=(rxy>.006)&(rxy<.024)&(q[:,2]>.215)&(q[:,2]<.276)&(abs(q[:,0])>abs(c[0])+.001)
 pts=q[ring];_,sel=np.unique(np.round(pts[:,:2]/.001),axis=0,return_index=True);pts=pts[sel]
 u=(pts[:,0]-c[0])/.02;t=(pts[:,1]-c[1])/.02;A=np.stack([u*0+1,u,t,u*u,u*t,t*t],axis=1)
 coeff=np.linalg.lstsq(A,pts[:,2],rcond=None)[0];u=(q[:,0]-c[0])/.02;t=(q[:,1]-c[1])/.02
 fit=np.stack([u*0+1,u,t,u*u,u*t,t*t],axis=1)@coeff
 w=.40*c2(abs(c[0])-.001,abs(c[0])+.006,abs(q[:,0]))*(1-c2(.009,.022,rxy))*c2(.19,.22,q[:,2])
 dz=w*np.clip(fit-q[:,2],-.002,.002);q[:,2]+=dz
 corner_reports.append({'vertex':corner,'skinSamples':len(pts),'maxAdjustment':float(abs(dz).max())})
repairs=[([411680,412066],.005,.013),([397033,397043,398668],.005,.013)]
seam_reports=[]
for faces,core,outer in repairs:
 center=p[f[faces]].mean((0,1));distance=np.linalg.norm(p-center,axis=1)
 ring=(distance>.005)&(distance<.017);pp=p[ring].astype(float);qq=q[ring]
 # Affine least-squares fit with a weak identity prior; preserves native detail.
 pc=pp.mean(0);qc=qq.mean(0);X=pp-pc;Y=qq-qc
 lam=np.trace(X.T@X)*.0003
 J=np.linalg.solve(X.T@X+lam*np.eye(3),X.T@Y+lam*np.eye(3))
 assert np.linalg.det(J)>0,'Invalid seam differential map'
 fitted=(p-pc)@J+qc;w=1-c2(core,outer,distance)
 q=q*(1-w[:,None])+fitted*w[:,None]
 seam_reports.append({'faces':faces,'jacobian':J.tolist(),'determinant':float(np.linalg.det(J))})
nose=p[:,1]>=.378;q[nose]=p[nose];q=q.astype(np.float32)
key=o.shape_key_add(name='M01_Natural_V32');key.data.foreach_set('co',q.ravel());keys['M01_Natural_V3'].value=0;key.value=1
for name,mask in [('Protected_nose',nose),('Upper_support',(foot>.01)&(h>.345)),('Lateral_support',(foot>.01)&(abs(x)>.035)),('Lower_support',(foot>.01)&(h<.327))]:
 vg=o.vertex_groups.new(name='V32_'+name);vg.add(np.flatnonzero(mask).tolist(),1,'REPLACE')
def normals(y):
 tri=y[f].astype(float);cross=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);ar=np.linalg.norm(cross,axis=1);return cross/np.maximum(ar[:,None],1e-20),ar*.5
n0,ar0=normals(p);n1,ar1=normals(q);dot=(n0*n1).sum(1);affected=(np.linalg.norm(q-p,axis=1)>1e-8)[f].any(1)
report={'commissures':corner_reports,'seamMaps':seam_reports,'method':'V3 geometry + C2 anatomical support along low-frequency skin-normal chart','blender':bpy.app.version_string,'keys':['Basis','M01_Natural_V3','M01_Natural_V32'],'vertices':n,'triangles':len(f),'changedFromV3':int((np.linalg.norm(q-v,axis=1)>1e-8).sum()),'chartCoefficients':coef.tolist(),'chartSkinSamples':chart_samples,'facesOver90':int((dot[affected]<0).sum()),'minNormalDot':float(dot[affected].min()),'degenerateAffected':int((ar1[affected]<1e-14).sum()),'noseCount':int(nose.sum()),'noseMaxDelta':float(abs(q[nose]-p[nose]).max()),'maxSupportAmplitude':float(amplitude.max()),'geometryBasis':'V3, not V31','status':'NOT_VISUALLY_REVIEWED'}
np.savez_compressed(out/'surface.npz',basis=p,v3=v,sculpt=q,faces=f,amplitude=amplitude,direction=direction,foot=foot)
(out/'sculpt.json').write_text(json.dumps(report,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(out/'M01-Natural-V32-Iteration-02.blend'),compress=True);print(json.dumps(report))
