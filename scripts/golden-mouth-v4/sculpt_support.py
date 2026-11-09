"""Blender native Laplacian Deform: lip handles drive curved surrounding tissue.
Temporary surface subset is an authoring workspace only; runtime retains all native skin.
"""
import bpy,numpy as np,sys,json,shutil
from pathlib import Path
from scipy.sparse import coo_matrix,diags
from scipy.sparse.csgraph import dijkstra
from scipy.sparse.linalg import spsolve
args=sys.argv[sys.argv.index('--')+1:];src,out=map(Path,args[:2]);experimental='--experimental-inner' in args;reuse=Path(args[args.index('--reuse')+1]) if '--reuse' in args else None;reused={}
if reuse:
 ra=np.load(reuse/'poses.npz');rs=json.loads((reuse/'catalog.json').read_text());reused={st['code']:q for st,q in zip(rs,ra['poses'])}
out.mkdir(parents=True,exist_ok=True);a=np.load(src/'poses.npz');styles=json.loads((src/'catalog.json').read_text());v=a['poses'][0];f=a['faces'];g=a['groups'];_,first=np.unique(g,return_index=True);vv=v[first];gf=g[f];inside=(abs(vv[:,0])<.125)&(vv[:,1]>.240)&(vv[:,1]<.378)&(vv[:,2]>.170);fs=gf[inside[gf].all(1)];ids=np.unique(fs);remap=np.full(len(vv),-1);remap[ids]=np.arange(len(ids));lf=remap[fs];p=vv[ids];edges=np.sort(np.concatenate([lf[:,[0,1]],lf[:,[1,2]],lf[:,[2,0]]]),axis=1);ee,ct=np.unique(edges,axis=0,return_counts=True);boundary=np.zeros(len(ids),bool);boundary[np.unique(ee[ct==1])]=True
if '--reuse-controls' in args:
 rc=np.load(args[args.index('--reuse-controls')+1]);assert int(rc['vertexCount'])==len(v)
 for code in ['M03','M06']:
  reused[code]=v.copy();reused[code][rc['indices']]=rc[code]
lip=(abs(p[:,0])<.052)&(p[:,1]>.317)&(p[:,1]<.354)&(p[:,2]>.230);seam=np.unique(g[np.r_[a['upper'],a['lower']]]);lip|=np.isin(ids,seam);handles=boundary|lip
length=np.linalg.norm(p[ee[:,0]]-p[ee[:,1]],axis=1);graph=coo_matrix((np.r_[length,length],(np.r_[ee[:,0],ee[:,1]],np.r_[ee[:,1],ee[:,0]])),shape=(len(p),len(p))).tocsr();distance=dijkstra(graph,directed=False,indices=np.flatnonzero(np.isin(ids,seam)),min_only=True)
# Only the native folded inner lining is relaxed, never external lip volume/skin.
inner=(distance<.006)&(distance>1e-7)&(~boundary)&experimental;inner_global=np.zeros(len(vv),bool);inner_global[ids[inner]]=True
w=1/np.maximum(length,.0001);A=coo_matrix((np.r_[w,w],(np.r_[ee[:,0],ee[:,1]],np.r_[ee[:,1],ee[:,0]])),shape=(len(p),len(p))).tocsr();L=diags(np.array(A.sum(1)).ravel())-A;ii=np.flatnonzero(inner);jj=np.flatnonzero(~inner)
poses=[];reports=[]
for st,q0 in zip(styles,a['poses']):
 if st['code']=='M01':poses.append(q0);continue
 if st['code'] in reused:
  poses.append(reused[st['code']]);reports.append({'code':st['code'],'reusedVerifiedPrototype':str(reuse)});continue
 bpy.ops.wm.read_factory_settings(use_empty=True);mesh=bpy.data.meshes.new('Native_Perioral_Authoring');mesh.from_pydata(p.tolist(),[],lf.tolist());o=bpy.data.objects.new('Native_Perioral_Authoring',mesh);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);vg=o.vertex_groups.new(name='Anatomical_Handles');vg.add(np.flatnonzero(handles).tolist(),1,'REPLACE');mod=o.modifiers.new('Curvature_Support','LAPLACIANDEFORM');mod.vertex_group=vg.name;mod.iterations=12;bpy.ops.object.laplaciandeform_bind(modifier=mod.name);assert mod.is_bind
 target=p.copy();desired=q0[first][ids];target[lip]=desired[lip];mesh.vertices.foreach_set('co',target.ravel());mesh.update();bpy.context.view_layer.update();ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());em=ev.to_mesh();result=np.array([x.co[:] for x in em.vertices]);ev.to_mesh_clear();u=vv.astype(float).copy();u[ids]=result;u[ids[boundary&~lip]]=p[boundary&~lip];q=u[g]
 # Unroll the scan's closed-groove lining between fixed seam and outer lip.
 # This is a local mesh edit in each new pose, not a replacement skin mesh.
 if experimental:
  lining=result.copy();lining[ii]=spsolve(L[ii][:,ii],-L[ii][:,jj]@lining[jj]);u[ids[inner]]=lining[inner]
 # Real local orientation repair, not a normal-only change. UV counterparts share a handle.
 ref=a['basis'][first].astype(float);tri=ref[gf];cr=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);ar=np.linalg.norm(cr,axis=1);norm=cr/np.maximum(ar[:,None],1e-20);start=u.copy();locked=ref[:,1]>=.378
 repair_iterations=0
 for iteration in range(40):
  t=u[gf];cross=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);signed=(cross*norm).sum(1);bad=np.flatnonzero((signed<ar*.025)&(~inner_global[gf].any(1)))
  if not len(bad):break
  for fi in bad:
   ff=gf[fi];t=u[ff];grad=np.array([np.cross(t[1]-t[2],norm[fi]),np.cross(t[2]-t[0],norm[fi]),np.cross(t[0]-t[1],norm[fi])]);grad[locked[ff]]=0;den=(grad*grad).sum()
   if den<1e-24:continue
   current=np.dot(np.cross(t[1]-t[0],t[2]-t[0]),norm[fi]);move=grad*((ar[fi]*.03-current)/den)*1.03;maxmove=np.linalg.norm(move,axis=1).max()
   if maxmove>.0005:move*=.0005/maxmove
   u[ff]+=move
  repair_iterations=iteration+1
 q=u[g].astype(np.float32);q[a['basis'][:,1]>=.378]=v[a['basis'][:,1]>=.378];poses.append(q);report={'code':st['code'],'nativeModifier':'LAPLACIANDEFORM','iterations':12,'regionVertices':len(ids),'lipHandles':int(lip.sum()),'fixedBoundary':int(boundary.sum()),'orientationCorrectionIterations':repair_iterations,'maxOrientationCorrection':float(np.linalg.norm(u-start,axis=1).max())};reports.append(report);print(json.dumps(report),flush=True)
np.savez_compressed(out/'poses.npz',**{k:a[k] for k in a.files if k not in ['poses','inner_lining']},poses=np.stack(poses),inner_lining=inner_global[g]);shutil.copy(src/'catalog.json',out/'catalog.json');(out/'support-sculpt.json').write_text(json.dumps(reports,indent=2))
