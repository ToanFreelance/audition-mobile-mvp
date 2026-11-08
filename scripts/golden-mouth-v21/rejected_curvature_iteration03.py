"""V2.1: region-constrained native surface refinement, no new topology.
Opens preserved V2 iteration 2. Basis and V2 remain editable and unmodified.
"""
import bpy, numpy as np, argparse, json, gzip, hashlib, math, sys
from pathlib import Path
from mathutils import Vector
ap=argparse.ArgumentParser();ap.add_argument('--checkpoint',required=True);ap.add_argument('--output',required=True);ap.add_argument('--iteration',type=int,default=3);ap.add_argument('--render',nargs='*',default=[]);a=ap.parse_args(sys.argv[sys.argv.index('--')+1:])
out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=a.checkpoint);s=bpy.context.scene;o=bpy.data.objects['node_0'];me=o.data;n=len(me.vertices)
assert n==292645 and len(me.polygons)==499762
p=np.empty((n,3),np.float32);v=p.copy();me.shape_keys.key_blocks[0].data.foreach_get('co',p.ravel());me.shape_keys.key_blocks[1].data.foreach_get('co',v.ravel())
def ramp(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*t*(t*(t*6-15)+10)
def band(c,inner,outer,t):return 1-ramp(inner,outer,abs(t-c))
x,h,z=v.T;ax=abs(x);front=ramp(.195,.22,z);q=v.copy()
# Restore native cheek support outside the anatomical commissures, not the seam.
perioral=ramp(.039,.058,ax)*(1-ramp(.082,.108,ax))*band(.337,.022,.060,h)*front
q[:,1]+=(p[:,1]-v[:,1])*(.35*perioral)
# Lateral relaxation widens M01 toward the measured Golden width/IPD.
# This is not global head scaling: lip coordinates and perioral supports only.
widen=(1-ramp(.041,.083,ax))*band(.336,.021,.050,h)*front
q[:,0]+=.10*x*widen
# Lower lip volume and labiomental transition: retain lip roll and seam anchors.
lower=band(.324,.003,.018,h)*(1-ramp(.023,.048,ax))*front*(1-ramp(.331,.335,h))
q[:,2]-=.0038*lower
q[:,1]+=.0014*lower
# Upper central/lateral roll: controlled depth correction, fades before philtrum.
upper=band(.346,.003,.016,h)*(1-ramp(.026,.048,ax))*front*ramp(.336,.341,h)
q[:,2]-=.0024*upper
# Region constraints are evaluated on the unchanged V2 coordinates.
commissure=ramp(.036,.046,ax)*(1-ramp(.072,.093,ax))*band(.336,.009,.030,h)*front
upper_relax=band(.349,.004,.013,h)*(1-ramp(.028,.043,ax))*front*ramp(.338,.342,h)
lower_relax=band(.319,.002,.012,h)*(1-ramp(.023,.040,ax))*front*(1-ramp(.329,.333,h))
# Virtual weld graph ONLY: actual vertex IDs, UV seams, faces stay untouched.
# The source duplicates vertices at UV/material boundaries. Relaxing them separately
# tears the surface. Canonical graph shares every coincident position's neighbors.
_,canonical,group=np.unique(np.round(v,6),axis=0,return_index=True,return_inverse=True)
vc=v[canonical];qc=q[canonical].copy();cx,ch,cz=vc.T
# Moving local quadratic surface relaxation. Unlike a naive neighbor average,
# fitting in actual X/Y coordinates is invariant to tessellation density and
# preserves an affine skin slope. No polygons or replacement surface are created.
from mathutils.kdtree import KDTree
seam_pin=(abs(cx)<.044)&(abs(ch-.335)<.004)
weights=(.8*commissure+.50*upper_relax+.40*lower_relax)[canonical]
weights[seam_pin]=0
valid=(cz>.215)&(ch>.29)&(ch<.38)&(abs(cx)<.12)
kd=KDTree(int(valid.sum()))
for j in np.flatnonzero(valid):kd.insert((float(cx[j]),float(ch[j]),0),int(j))
kd.balance();before=qc.copy();dz=np.zeros(len(vc),np.float32)
for j in np.flatnonzero((weights>.0001)&valid):
 r=.016 if abs(cx[j])>.044 else .007
 nearby=kd.find_range((float(cx[j]),float(ch[j]),0),r)
 ids0=np.array([t[1] for t in nearby],np.int32)
 if abs(cx[j])>.044:
  ids0=ids0[(abs(cx[ids0])>.042)&(cx[ids0]*cx[j]>0)]
 elif ch[j]>.335:ids0=ids0[ch[ids0]>.340]
 else:ids0=ids0[ch[ids0]<.330]
 if len(ids0)<12:continue
 u=(qc[ids0,0]-qc[j,0])/r;w=(qc[ids0,1]-qc[j,1])/r
 A=np.column_stack([np.ones(len(u)),u,w,u*u,u*w,w*w]);ww=np.exp(-2*(u*u+w*w))
 beta=np.linalg.lstsq(A*ww[:,None],qc[ids0,2]*ww,rcond=1e-5)[0]
 dz[j]=np.clip(beta[0]-qc[j,2],-.0018,.0018)*weights[j]
qc[:,2]+=dz
q+=(qc-before)[group]
regions={'PerioralSupport':perioral,'LateralWidth':widen,'LowerVolume':lower,'UpperRoll':upper,'Commissures':commissure,'UpperRelax':upper_relax,'LabiomentalRelax':lower_relax}
for name,w in regions.items():
 vg=o.vertex_groups.new(name='V21_'+name)
 for i in np.flatnonzero(w>.001):vg.add([int(i)],float(min(w[i],1)),'REPLACE')
for k in me.shape_keys.key_blocks:k.value=0
key=o.shape_key_add(name=f'M01_Natural_V21_Iteration{a.iteration:02}',from_mix=False);key.data.foreach_set('co',q.ravel());key.value=1
ids=np.flatnonzero(np.linalg.norm(q-p,axis=1)>1e-8)
faces=np.array([f.vertices[:] for f in me.polygons],np.int32)
def normals(pos):
 tr=pos[faces];nn=np.cross(tr[:,1]-tr[:,0],tr[:,2]-tr[:,0]);return nn/np.maximum(np.linalg.norm(nn,axis=1,keepdims=True),1e-16)
f0=normals(v);f1=normals(q);dots=(f0*f1).sum(1);affected=np.any(np.linalg.norm(q-v,axis=1)[faces]>1e-8,axis=1)
np.savez_compressed(out/'refinement.npz',basis=p,v2=v,v21=q,indices=ids)
uv=np.empty(len(me.uv_layers.active.data)*2,np.float32);me.uv_layers.active.data.foreach_get('uv',uv)
report={'status':'EXPERIMENT_NOT_VISUALLY_ACCEPTED','blender':bpy.app.version_string,'sourceSha256':'b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90','checkpoint':a.checkpoint,'checkpointSha256':hashlib.sha256(Path(a.checkpoint).read_bytes()).hexdigest(),'vertices':n,'triangles':len(faces),'changedFromBasis':len(ids),'changedFromV2':int(np.count_nonzero(np.linalg.norm(q-v,axis=1)>1e-8)),'maxDisplacementFromV2':float(np.linalg.norm(q-v,axis=1).max()),'minFaceNormalDotAgainstV2':float(dots[affected].min()),'flippedFaces':int((dots[affected]<0).sum()),'topologySha256':hashlib.sha256(faces.tobytes()).hexdigest(),'uvSha256':hashlib.sha256(uv.tobytes()).hexdigest(),'regions':{name:int((w>.001).sum()) for name,w in regions.items()},'command':sys.argv}
(out/'validation.json').write_text(json.dumps(report,indent=2))
# Match V2 exporter, preserving original normal values outside changed vertices.
bpy.context.view_layer.update();ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh();loops=np.empty(len(ev.loops),np.int32);ev.loops.foreach_get('vertex_index',loops);ln=np.empty((len(loops),3),np.float32);ev.corner_normals.foreach_get('vector',ln.ravel());vn=np.zeros_like(q);np.add.at(vn,loops,ln);vn/=np.maximum(np.linalg.norm(vn,axis=1,keepdims=True),1e-12)
delta=(q-p)[:,[0,2,1]]*np.array([1,1,-1]);nn=vn[:,[0,2,1]]*np.array([1,1,-1])
runtime={'version':2,'iteration':f'2.1-{a.iteration:02}','sourceSha256':report['sourceSha256'],'vertexCount':n,'triangleCount':len(faces),'indices':ids.tolist(),'delta':delta[ids].round(9).tolist(),'normal':nn[ids].round(9).tolist(),'method':'Blender native regions, seam-pinned curvature-aware surface relaxation and constrained lip-roll sculpt'}
(out/'m01-native.json.gz').write_bytes(gzip.compress(json.dumps(runtime,separators=(',',':')).encode(),mtime=0))
s.cycles.samples=64;s.cycles.use_denoising=False;s.cycles.device='CPU';s.render.threads_mode='FIXED';s.render.threads=8
s.render.resolution_x=680;s.render.resolution_y=760
clay=bpy.data.materials.get('NeutralClay') or bpy.data.materials.new('NeutralClay');clay.use_nodes=True;clay.use_fake_user=True;bs=clay.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.5,.5,.5,1);bs.inputs['Roughness'].default_value=.7
bpy.ops.wm.save_as_mainfile(filepath=str(out/f'M01-Native-V21-Iteration-{a.iteration:02}.blend'),compress=True)
for name in a.render:
 angle,height,scale={'front':(0,.51,.94),'left35':(-35,.51,.94),'right35':(35,.51,.94),'profile':(90,.51,.94),'mouth':(0,.34,.24),'clay':(0,.34,.24)}[name];yaw=math.radians(angle);s.camera.location=(1.9*math.sin(yaw),-1.9*math.cos(yaw),height);s.camera.rotation_euler=(Vector((0,0,height))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.ortho_scale=scale;s.view_layers[0].material_override=clay if name=='clay' else None;s.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
