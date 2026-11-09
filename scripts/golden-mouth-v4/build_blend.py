"""Build editable native-head keys plus attached interior, without replacing facial skin."""
import bpy,numpy as np,sys,json,hashlib
from pathlib import Path
src,folder=map(Path,sys.argv[sys.argv.index('--')+1:]);a=np.load(folder/'poses.npz');styles=json.loads((folder/'catalog.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(src));o=bpy.data.objects['node_0'];old=o.data;n=len(old.vertices);du=a['duplicates'];f=a['faces'];base=a['basis'];poses=a['poses'];groups=a['groups'];oldkeys={}
for key in old.shape_keys.key_blocks:
 p=np.empty((n,3),np.float32);key.data.foreach_get('co',p.ravel());oldkeys[key.name]=np.r_[p,p[du]]
# Preserve original imported material/image datablocks and all loop UVs.
oldloops=np.empty((len(old.loops),3),np.float32);old.corner_normals.foreach_get('vector',oldloops.ravel());bpy.context.view_layer.update();ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());em=ev.to_mesh();m01loops=np.empty_like(oldloops);em.corner_normals.foreach_get('vector',m01loops.ravel());ev.to_mesh_clear();m=bpy.data.meshes.new('V4_NativeHead_SeamSplit');m.from_pydata(base.tolist(),[],f.tolist());m.materials.clear()
for mat in old.materials:m.materials.append(mat)
m.uv_layers.new(name=old.uv_layers.active.name).data.foreach_set('uv',a['uv'].ravel());m.polygons.foreach_set('use_smooth',np.ones(len(f),bool));o.data=m
for name,p in oldkeys.items():key=o.shape_key_add(name=name);key.data.foreach_set('co',p.ravel());key.value=0
for st,p in zip(styles,poses):
 if st['code']=='M01':continue
 key=o.shape_key_add(name=st['key']);key.data.foreach_set('co',p.ravel())
# Keep neutral baseline visuals when first opened; pose-specific normals set for renders.
m.normals_split_custom_set(oldloops.tolist());m.shape_keys.key_blocks['M01_Natural_V33'].value=1
np.savez_compressed(folder/'shading.npz',baseLoopNormals=oldloops,m01LoopNormals=m01loops,groups=groups)
def material(name,color,roughness):
 mat=bpy.data.materials.new(name);mat.diffuse_color=(*color,1);mat.use_nodes=True;pb=mat.node_tree.nodes.get('Principled BSDF');pb.inputs['Base Color'].default_value=(*color,1);pb.inputs['Roughness'].default_value=roughness;return mat
cavitymat=material('V4_OralCavity',(.035,.006,.012),.94);toothmat=material('V4_Enamel',(.87,.81,.72),.32);tonguemat=material('V4_Tongue',(.45,.075,.11),.65);gummat=material('V4_Gum',(.29,.045,.07),.75)
parts={}
def meshpart(name,points,faces,mat):
 mm=bpy.data.meshes.new(name);mm.from_pydata(np.asarray(points).tolist(),[],np.asarray(faces).tolist());mm.materials.append(mat);mm.polygons.foreach_set('use_smooth',np.ones(len(faces),bool));ob=bpy.data.objects.new(name,mm);bpy.context.collection.objects.link(ob);ob.parent=o;ob.hide_render=True;parts[name]=ob;return ob
upper=a['upper'];lower=a['lower'];loop=np.r_[upper,lower[-2:0:-1]];L=len(loop);openindex=next(i for i,s in enumerate(styles) if s['code']=='M03');cavposes=[];cf=[]
for q,st in zip(poses,styles):
 if not st['open']:q=poses[openindex]
 rim=q[loop];center=np.array([0,(rim[:,1].max()+rim[:,1].min())*.5,float(rim[:,2].mean()-.05)]);vv=[]
 for scale,depth in [(1,0),(.995,.004),(.92,.013),(.76,.030),(.45,.047)]:
  r=rim.copy();r[:,:2]=center[:2]+(r[:,:2]-center[:2])*scale;r[:,2]-=depth;vv.extend(r)
 vv.append(center);cavposes.append(vv)
for j in range(4):
 for k in range(L):
  x=j*L+k;y=j*L+(k+1)%L;cf.extend([[x,y,x+L],[y,y+L,x+L]])
for k in range(L):cf.append([4*L+k,4*L+(k+1)%L,5*L])
meshpart('V4_Cavity',cavposes[0],cf,cavitymat)
# Blender bevel operations author a reusable rounded tooth, then form a dental arch.
bpy.ops.mesh.primitive_cube_add(size=1);unit=bpy.context.object;unit.scale=(.0115,.011,.009);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);bevel=unit.modifiers.new('Rounded_enamel_edges','BEVEL');bevel.width=.0013;bevel.segments=3;bpy.context.view_layer.objects.active=unit;bpy.ops.object.modifier_apply(modifier=bevel.name);bpy.ops.object.modifier_add(type='TRIANGULATE');bpy.ops.object.modifier_apply(modifier=unit.modifiers[-1].name);up=np.array([v.co[:] for v in unit.data.vertices]);uf=np.array([p.vertices[:] for p in unit.data.polygons]);bpy.data.objects.remove(unit,do_unlink=True)
teethposes=[];toothfaces=np.concatenate([uf+i*len(up) for i in range(8)])
for q,st in zip(poses,styles):
 if not st['teeth']:q=poses[openindex]
 rim=q[upper];order=np.argsort(rim[:,0]);rim=rim[order];width=(rim[-1,0]-rim[0,0])*.80;vv=[]
 for i in range(8):
  xx=(i-3.5)*width/8;top=np.interp(xx,rim[:,0],rim[:,1])+.003;zz=np.interp(xx,rim[:,0],rim[:,2])-.009
  pt=up.copy();pt[:,0]*=width/(8*.0115);pt+=np.array([xx,top-.0055,zz]);vv.extend(pt)
 teethposes.append(vv)
meshpart('V4_UpperTeeth',teethposes[0],toothfaces,toothmat)
# A shallow upper gum band behind the lip anchors the tooth roots.
gumposes=[];gf=[]
for q,st in zip(poses,styles):
 if not st['teeth']:q=poses[openindex]
 rim=q[upper];order=np.argsort(rim[:,0]);rim=rim[order];xs=np.linspace(rim[0,0]*.83,rim[-1,0]*.83,33);vv=[]
 for x0 in xs:
  y=np.interp(x0,rim[:,0],rim[:,1]);z=np.interp(x0,rim[:,0],rim[:,2])-.010;vv.extend([[x0,y+.006,z],[x0,y-.0005,z]])
 gumposes.append(vv)
for i in range(32):gf.extend([[i*2,i*2+1,i*2+2],[i*2+1,i*2+3,i*2+2]])
meshpart('V4_Gum',gumposes[0],gf,gummat)
# Tongue stays deep within the lower cavity and follows each opening.
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=1);un=bpy.context.object;tp=np.array([v.co[:] for v in un.data.vertices]);tfaces=[]
for face in un.data.polygons:
 ids=list(face.vertices)
 for j in range(1,len(ids)-1):tfaces.append([ids[0],ids[j],ids[j+1]])
bpy.data.objects.remove(un,do_unlink=True);tongueposes=[]
for q,st in zip(poses,styles):
 if not st['tongue']:q=poses[openindex]
 rim=q[lower];center=rim[len(rim)//2];width=(q[upper[-1],0]-q[upper[0],0])*.30;pt=tp*np.array([width,.004,.012])+np.array([0,center[1]+.004,center[2]-.020]);tongueposes.append(pt)
meshpart('V4_Tongue',tongueposes[0],tfaces,tonguemat)
allposes={'V4_Cavity':cavposes,'V4_UpperTeeth':teethposes,'V4_Gum':gumposes,'V4_Tongue':tongueposes}
for name,pp in allposes.items():
 ob=parts[name];ob.shape_key_add(name='Basis')
 for st,p in zip(styles,pp):key=ob.shape_key_add(name=st['code']);key.data.foreach_set('co',np.asarray(p,np.float32).ravel())
 ob['attached_to']='node_0';ob['no_independent_actor']=True
np.savez_compressed(folder/'interior.npz',**{name:np.array(pp,np.float32) for name,pp in allposes.items()},**{name+'_faces':np.array([t.vertices[:] for t in ob.data.polygons]) for name,ob in parts.items()})
o['V4_source_vertices']=n;o['V4_seam_duplicates']=len(du);o['V4_M01_locked_sha256']='7fdc16e00012f785c76dba9d88700e7139b0e36c85f302d7a0dd0940508bcb8a';o['V4_catalog']=json.dumps(styles,ensure_ascii=False)
path=folder/'Golden-Mouth-V4.blend';bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True);print(json.dumps({'blend':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,'keys':list(m.shape_keys.key_blocks.keys()),'parts':list(parts)}))
