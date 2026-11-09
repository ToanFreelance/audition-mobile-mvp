"""Original-Basis V3. Native landmark editing with Blender Laplacian Deform.
No V2 coordinates, procedural lip construction, vertex averaging, or retopology.
Working surface is a solver copy of native triangles; final head keeps IDs/UV.
"""
import bpy, numpy as np, json, hashlib, argparse, sys, gzip, math
from pathlib import Path
from mathutils import Vector
ap=argparse.ArgumentParser();ap.add_argument('--source',required=True);ap.add_argument('--controls',required=True);ap.add_argument('--output',required=True);a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
source=Path(a.source);sha=hashlib.sha256(source.read_bytes()).hexdigest();assert sha=='b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90'
cfg=json.loads(Path(a.controls).read_text());bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source));head=next(o for o in bpy.context.scene.objects if o.type=='MESH');me=head.data
n=len(me.vertices);assert n==292645 and len(me.polygons)==499762
p=np.empty((n,3),np.float32);me.vertices.foreach_get('co',p.ravel());faces=np.array([f.vertices[:] for f in me.polygons],np.int32)
# Local native surface; source model itself is never cut or welded.
inside=(abs(p[:,0])<.12)&(p[:,1]>.272)&(p[:,1]<.399)&(p[:,2]>.178)
face_ids=np.flatnonzero(inside[faces].all(1));source_ids=np.unique(faces[face_ids]);local_faces=np.searchsorted(source_ids,faces[face_ids]);sp=p[source_ids]
_,first,group=np.unique(np.round(sp,6),axis=0,return_index=True,return_inverse=True);vp=sp[first];fp=group[local_faces];fp=fp[(fp[:,0]!=fp[:,1])&(fp[:,1]!=fp[:,2])&(fp[:,0]!=fp[:,2])]
# Anchor three boundary rings: stable continuity to original unedited facial skin.
edges=np.sort(np.concatenate([fp[:,[0,1]],fp[:,[1,2]],fp[:,[2,0]]]),axis=1);ee,count=np.unique(edges,axis=0,return_counts=True);pinned=np.zeros(len(vp),bool);pinned[np.unique(ee[count==1])]=True
for _ in range(3):pinned[np.unique(ee[pinned[ee].any(1)])]=True
proxy_mesh=bpy.data.meshes.new('NativeSurface_SolverMesh');proxy_mesh.from_pydata(vp,[],fp);proxy_mesh.update();proxy=bpy.data.objects.new('AUTHORING_ONLY_LaplacianSurface',proxy_mesh);bpy.context.scene.collection.objects.link(proxy)
proxy.matrix_world=head.matrix_world.copy();anchors=proxy.vertex_groups.new(name='Anchor');anchors.add(np.flatnonzero(pinned).tolist(),1,'REPLACE');target=vp.copy();occupied=pinned.copy();landmarks=[]
for h in cfg['handles']:
 c=p[h['vertex']];dist=np.linalg.norm(vp-c,axis=1);selected=(dist<h['radius'])&(~occupied);ids=np.flatnonzero(selected);assert len(ids)>0,h['name']
 delta=np.zeros(3) if h.get('pin') else np.array(h['target'])-c;
 angle=math.radians(h.get('rotate_depth_degrees',0));rot=np.array([[math.cos(angle),-math.sin(angle),0],[math.sin(angle),math.cos(angle),0],[0,0,1]])
 target[ids]=(vp[ids]-c)@rot.T+c+delta;occupied[ids]=True;anchors.add(ids.tolist(),1,'REPLACE')
 vg=proxy.vertex_groups.new(name=h['name']);vg.add(ids.tolist(),1,'REPLACE')
 # Preserve editing handles in the .blend for later human/interactive sculpting.
 marker=bpy.data.objects.new(h['name']+'_target',None);bpy.context.scene.collection.objects.link(marker);marker.empty_display_type='SPHERE';marker.empty_display_size=.002;marker.location=head.matrix_world@Vector(c+delta);marker.hide_render=True
 landmarks.append({'name':h['name'],'sourceVertex':h['vertex'],'source':c.tolist(),'target':(c+delta).tolist(),'anchorCount':len(ids),'radius':h['radius']})
mod=proxy.modifiers.new('ArtistLandmark_LaplacianDeform','LAPLACIANDEFORM');mod.vertex_group=anchors.name;mod.iterations=cfg['solver_iterations']
bpy.ops.object.select_all(action='DESELECT');proxy.select_set(True);bpy.context.view_layer.objects.active=proxy;bpy.context.view_layer.update();print('BIND_START',len(vp),len(fp),flush=True);bpy.ops.object.laplaciandeform_bind(modifier=mod.name);assert mod.is_bind,'Actual Blender binding failed';print('BIND_OK',flush=True)
proxy_mesh.vertices.foreach_set('co',target.ravel());proxy_mesh.update();bpy.context.view_layer.update();ev=proxy.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh();solved=np.empty_like(vp);ev.vertices.foreach_get('co',solved.ravel());assert np.isfinite(solved).all()
q=p.copy();delta=solved-vp;delta[pinned]=0;q[source_ids]+=delta[group]
head.shape_key_add(name='Basis');key=head.shape_key_add(name='M01_Natural_V3');key.data.foreach_set('co',q.ravel());key.value=1
# Solver geometry is retained only for authoring; never displayed/rendered/exported.
proxy.hide_render=True;proxy.hide_set(True)
for h in cfg['handles']:
 vg=head.vertex_groups.new(name='V3_'+h['name']);ids=np.flatnonzero(np.linalg.norm(p-p[h['vertex']],axis=1)<h['radius']);vg.add(ids.tolist(),1,'REPLACE')
changed=np.linalg.norm(q-p,axis=1)>1e-8;ids=np.flatnonzero(changed)
def fn(v):
 t=v[faces];f=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);return f/np.maximum(np.linalg.norm(f,axis=1,keepdims=True),1e-15)
f0=fn(p);f1=fn(q);affected=changed[faces].any(1);dots=(f0*f1).sum(1);uv=np.empty(len(me.uv_layers.active.data)*2,np.float32);me.uv_layers.active.data.foreach_get('uv',uv)
np.savez_compressed(out/'native-sculpt.npz',basis=p,sculpt=q,sourceIds=source_ids,solverBasis=vp,solverResult=solved,solverFaces=fp,pinned=pinned)
report={'blender':bpy.app.version_string,'sourceSha256':sha,'source':'DIRECT_ORIGINAL_GLB_IMPORT','vertices':n,'triangles':len(faces),'changed':len(ids),'solverVertices':len(vp),'solverTriangles':len(fp),'boundaryPins':int(pinned.sum()),'maxDisplacement':float(np.linalg.norm(q-p,axis=1).max()),'minimumFaceNormalDot':float(dots[affected].min()),'facesTurnedOver90':int((dots[affected]<0).sum()),'topologySha256':hashlib.sha256(faces.tobytes()).hexdigest(),'uvSha256':hashlib.sha256(uv.tobytes()).hexdigest(),'landmarks':landmarks,'status':'EXPERIMENT_NOT_VISUALLY_REVIEWED','command':sys.argv}
(out/'validation.json').write_text(json.dumps(report,indent=2));(out/'controls.json').write_text(json.dumps(cfg,indent=2))
bpy.context.view_layer.update();ev=head.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh();li=np.empty(len(ev.loops),np.int32);ev.loops.foreach_get('vertex_index',li);ln=np.empty((len(li),3),np.float32);ev.corner_normals.foreach_get('vector',ln.ravel());vn=np.zeros_like(p);np.add.at(vn,li,ln);vn/=np.maximum(np.linalg.norm(vn,axis=1,keepdims=True),1e-12)
d=(q-p)[:,[0,2,1]]*np.array([1,1,-1]);nn=vn[:,[0,2,1]]*np.array([1,1,-1]);runtime={'version':3,'sourceSha256':sha,'vertexCount':n,'triangleCount':len(faces),'indices':ids.tolist(),'delta':d[ids].round(9).tolist(),'normal':nn[ids].round(9).tolist(),'method':'Original native surface, Blender Laplacian Deform with anatomical anchors'}
(out/'m01-native.json.gz').write_bytes(gzip.compress(json.dumps(runtime,separators=(',',':')).encode(),mtime=0))
# Neutral lighting identical to V2/V2.1. Texture is untouched during geometry gate.
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=64;s.cycles.use_denoising=False;s.render.threads_mode='FIXED';s.render.threads=8;s.render.resolution_x=680;s.render.resolution_y=760;s.render.resolution_percentage=100;s.view_settings.view_transform='Standard'
s.world=bpy.data.worlds.new('NeutralWorld');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.18,.18,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.5
for name,loc,energy,size in [('Key',(-1.5,-2,2),75,2),('Fill',(1.5,-1,1),45,2)]:
 bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.name=name;l.data.energy=energy;l.data.size=size;l.rotation_euler=(Vector((0,0,.5))-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-1.9,.51));s.camera=bpy.context.object;s.camera.rotation_euler=(Vector((0,0,.51))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.type='ORTHO';s.camera.data.ortho_scale=.94
clay=bpy.data.materials.new('NeutralClay');clay.use_nodes=True;clay.use_fake_user=True;bs=clay.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.5,.5,.5,1);bs.inputs['Roughness'].default_value=.7
bpy.ops.object.select_all(action='DESELECT');head.select_set(True);bpy.context.view_layer.objects.active=head
bpy.ops.wm.save_as_mainfile(filepath=str(out/'M01-Natural-V3.blend'),compress=True);print(json.dumps(report),flush=True)
