"""Reopen final Blender checkpoint; verify original keys, packed images and preset drivers."""
import bpy,numpy as np,json,hashlib,sys
from pathlib import Path
locked,folder=map(Path,sys.argv[sys.argv.index('--')+1:]);a=np.load(folder/'poses.npz');styles=json.loads((folder/'catalog.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(locked));m=bpy.data.objects['node_0'].data;n=len(m.vertices);old={}
for key in m.shape_keys.key_blocks:
 q=np.empty((n,3),np.float32);key.data.foreach_get('co',q.ravel());old[key.name]=q
images=sorted(hashlib.sha256(bytes(i.packed_file.data)).hexdigest() for i in bpy.data.images if i.packed_file);materials=[x.name for x in m.materials]
old_faces=np.array([p.vertices[:] for p in m.polygons]);old_uv=np.empty((len(m.loops),2),np.float32);m.uv_layers.active.data.foreach_get('uv',old_uv.ravel())
bpy.ops.wm.open_mainfile(filepath=str(folder/'Golden-Mouth-V4.blend'));o=bpy.data.objects['node_0'];m=o.data
backup=bpy.data.objects['V4_Original_Head_Uncut'].data;assert len(backup.vertices)==292645 and len(backup.polygons)==499762;assert np.array_equal(np.array([p.vertices[:] for p in backup.polygons]),old_faces);backup_uv=np.empty_like(old_uv);backup.uv_layers.active.data.foreach_get('uv',backup_uv.ravel());assert np.array_equal(backup_uv,old_uv);assert np.array_equal(np.array([p.vertices[:] for p in m.polygons]),a['faces'])
for name,q in old.items():
 saved=np.empty_like(q);m.shape_keys.key_blocks[name].data.foreach_get('co',saved.ravel());assert np.array_equal(saved,q),name
assert materials==[x.name for x in m.materials];assert images==sorted(hashlib.sha256(bytes(i.packed_file.data)).hexdigest() for i in bpy.data.images if i.packed_file)
results=[]
for i,st in enumerate(styles):
 o['MouthPreset']=i;o.update_tag();bpy.context.view_layer.update();weights=[m.shape_keys.key_blocks[s['key']].value for s in styles];expected=[float(k==i) for k in range(9)];assert weights==expected,(i,weights)
 ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());em=ev.to_mesh();p=np.array([v.co[:] for v in em.vertices],np.float32);ev.to_mesh_clear();error=float(abs(p-a['poses'][i]).max());assert error<1e-7,(st['code'],error)
 for name,visible in [('V4_Cavity',True),('V4_UpperTeeth',st['teeth']),('V4_Gum',st['teeth']),('V4_Tongue',st['tongue'])]:
  ob=bpy.data.objects[name];assert ob.parent==o;assert bool(ob.hide_render)==(not visible),(i,name,ob.hide_render);assert ob.data.shape_keys.key_blocks[st['code']].value==1
 results.append({'code':st['code'],'oneHot':True,'evaluatedMaxFloatError':error,'interiorAttachedAndVisibilityCorrect':True})
r={'lockedSha256':hashlib.sha256(locked.read_bytes()).hexdigest(),'finalBlendSha256':hashlib.sha256((folder/'Golden-Mouth-V4.blend').read_bytes()).hexdigest(),'BasisAndPriorKeysExact':list(old),'M01Exact':True,'packedImagesExact':True,'headMaterialIdentityExact':True,'originalFullTopologyBackupExact':True,'driverResults':results};(folder/'checkpoint-audit.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
