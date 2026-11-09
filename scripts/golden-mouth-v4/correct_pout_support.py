"""Native Blender corrective smoothing on upper skin support only; lips/M01 locked."""
import bpy,numpy as np,sys,json,shutil
from pathlib import Path
src,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True);a=np.load(src/'poses.npz');styles=json.loads((src/'catalog.json').read_text());v=a['poses'][0];g=a['groups'];f=a['faces'];_,first=np.unique(g,return_index=True);vv=v[first];gf=g[f];inside=(abs(vv[:,0])<.13)&(vv[:,1]>.24)&(vv[:,1]<.378)&(vv[:,2]>.17);ff=gf[inside[gf].all(1)];ids=np.unique(ff);remap=np.full(len(vv),-1);remap[ids]=np.arange(len(ids));p=vv[ids];lf=remap[ff]
def c2(lo,hi,x):
 t=np.clip((x-lo)/(hi-lo),0,1);return t**3*(10+t*(-15+6*t))
w=c2(.349,.357,p[:,1])*(1-c2(.368,.378,p[:,1]))*(1-c2(.065,.105,abs(p[:,0])));poses=a['poses'].copy();report=[]
for k,st in enumerate(styles):
 if st['code'] not in ['M05','M09']:continue
 bpy.ops.wm.read_factory_settings(use_empty=True);m=bpy.data.meshes.new('NativeSkinSupport');m.from_pydata(p.tolist(),[],lf.tolist());o=bpy.data.objects.new('NativeSkinSupport',m);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);vg=o.vertex_groups.new(name='UpperSupport_ONLY')
 for i,weight in enumerate(w):
  if weight>0:vg.add([i],float(weight),'REPLACE')
 mod=o.modifiers.new('PuckerSupportCorrective','CORRECTIVE_SMOOTH');mod.factor=1;mod.iterations=20;mod.smooth_type='LENGTH_WEIGHTED';mod.rest_source='BIND';mod.vertex_group=vg.name;mod.use_pin_boundary=True;bpy.ops.object.correctivesmooth_bind(modifier=mod.name);assert mod.is_bind
 target=poses[k,first][ids];m.vertices.foreach_set('co',target.ravel());m.update();bpy.context.view_layer.update();ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());em=ev.to_mesh();q=np.array([v.co[:] for v in em.vertices]);ev.to_mesh_clear();q[w==0]=target[w==0];u=poses[k,first].copy();u[ids]=q;new=u[g];nose=a['basis'][:,1]>=.378;new[nose]=poses[k,nose];locked=(v[:,1]<.349)&(abs(v[:,0])<.052);assert np.array_equal(new[locked],poses[k,locked]);report.append({'code':st['code'],'modifier':'CORRECTIVE_SMOOTH','rest':'M01','iterations':20,'lipProtectedExact':True,'maxDisplacement':float(np.linalg.norm(new-poses[k],axis=1).max())});poses[k]=new
np.savez_compressed(out/'poses.npz',**{k:a[k] for k in a.files if k!='poses'},poses=poses)
for name in ['catalog.json','topology.json']:shutil.copy(src/name,out/name)
(out/'pout-support-correction.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
