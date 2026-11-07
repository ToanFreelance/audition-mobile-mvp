import bpy,json,math,sys,gzip
import numpy as np
from mathutils import Vector
from pathlib import Path
root=Path(sys.argv[sys.argv.index('--')+1]).resolve();asset=Path(__file__).resolve().parents[2]/'public/qa/female-golden-eye-v8'
bpy.ops.wm.open_mainfile(filepath=str(root/'base.blend'))
s=bpy.context.scene;s.cycles.use_denoising=False;s.cycles.samples=96
# Softer, lower-energy light prevents clipping the source's baked skin highlights.
for o in s.objects:
 if o.type=='LIGHT':o.data.energy*=.42
s.world.node_tree.nodes['Background'].inputs[1].default_value=.45
old=bpy.data.objects['node_0'];mat=old.data.materials[0];bpy.data.objects.remove(old,do_unlink=True)
m=np.load(root/'model.npz');base=m['pos'];tri=m['tri'];uv=m['uv'];meta=json.loads((asset/'eye-rig.json').read_text());buf=gzip.decompress((asset/'eye-patch.bin.gz').read_bytes());nr=meta['removedTriangles'];nv=meta['affectedVertices'];remove=np.frombuffer(buf,'<u4',nr);ids=np.frombuffer(buf,'<u4',nv,nr*4);delta=np.frombuffer(buf,'<f4',9*nv*3,(nr+nv)*4).reshape(9,nv,3)
extension=json.loads(gzip.decompress((asset/'eye-boundary.json.gz').read_bytes()));base=np.vstack([base,extension['position']]).astype('<f4');uv=np.vstack([uv,extension['uv']]);keep=np.ones(len(tri),bool);keep[remove]=False;faces=np.vstack([tri[keep],extension['faces']])
def mesh_obj(name,verts,faces,uvs,material):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(name,me);s.collection.objects.link(ob);me.materials.append(material)
 if uvs is not None:
  layer=me.uv_layers.new();layer.data.foreach_set('uv',uvs.reshape(-1))
 me.polygons.foreach_set('use_smooth',np.ones(len(me.polygons),bool));return ob
coords=base.copy();coords[:,1:]*=-1
head=mesh_obj('OriginalHeadWithOcularOpening',coords,faces,uv[faces]*[1,-1]+[0,1],mat)
white=bpy.data.materials.new('Sclera');white.diffuse_color=(.91,.87,.9,1);white.use_nodes=True;pn=white.node_tree.nodes.get('Principled BSDF');pn.inputs['Base Color'].default_value=(.91,.87,.9,1);pn.inputs['Roughness'].default_value=.32;pn.inputs['Specular IOR Level'].default_value=.28
R=meta['eyeRadius'];cx,cy,cz=meta['eyeCenter'];eyeobjs=[]
from PIL import Image
atlas=Image.open(asset/'approved-iris-atlas.webp')
for k in range(9):atlas.crop((k%3*384,k//3*384,k%3*384+384,k//3*384+384)).save(root/f'evidence/tile-{k}.png')
def eye(side,k):
 yaw=meta['gazeYaw'][k];r=meta['irisRadii'][k];v=[];f=[];tex=[];ns=96;nrings=16
 for ring in range(nrings+1):
  rr=r*ring/nrings
  for a in range(ns+1):
   angle=2*math.pi*a/ns;x=rr*math.cos(angle);z=rr*math.sin(angle);y=math.sqrt(R*R-rr*rr)+.00035
   xx=x*math.cos(yaw)-y*math.sin(yaw);yy=x*math.sin(yaw)+y*math.cos(yaw)
   v.append([side*cx+xx,-(cy+yy),-(cz+z)]);tex.append([.5+x/(2*r),.5-z/(2*r)])
 for ring in range(nrings):
  for a in range(ns):
   n=ring*(ns+1)+a
   if ring>0:f.append([n,n+1,n+ns+1])
   f.append([n+1,n+ns+2,n+ns+1])
 material=bpy.data.materials.new('ApprovedIris');material.use_nodes=True;nodes=material.node_tree.nodes;links=material.node_tree.links;pb=nodes.get('Principled BSDF');pb.inputs['Roughness'].default_value=.45;pb.inputs['Specular IOR Level'].default_value=.1;it=nodes.new('ShaderNodeTexImage');it.image=bpy.data.images.load(str(root/f'evidence/tile-{k}.png'));links.new(it.outputs['Color'],pb.inputs['Base Color']);links.new(it.outputs['Color'],pb.inputs['Emission Color']);pb.inputs['Emission Strength'].default_value=.32
 iris=mesh_obj('Iris',v,f,np.asarray(tex)[np.asarray(f)],material)
 edge=[];contour=meta['targetContours'][k]
 for i,a in enumerate(contour):
  b=contour[(i+1)%len(contour)]
  for step in range(8):
   t=step/8;edge.append([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t])
 n=len(edge);vertices=[];faces=[];rings=20
 for ring in range(rings+1):
  for x,z in edge:
   u=side*(x-cx)*ring/rings;v=(z-cz)*ring/rings;y=math.sqrt(max(0,R*R-u*u-v*v));vertices.append([side*cx+u,-(cy+y),-(cz+v)])
 for ring in range(rings):
  for i in range(n):
   a=ring*n+i;b=ring*n+(i+1)%n;c=a+n;d=b+n
   if side>0:
    if ring>0:faces.append([a,b,c])
    faces.append([b,d,c])
   else:
    if ring>0:faces.append([a,c,b])
    faces.append([b,c,d])
 ball=mesh_obj('Sclera',vertices,faces,None,white)
 return [iris,ball]
chosen=sys.argv[sys.argv.index('--')+2:] if '--' in sys.argv else ['natural']
for style in chosen:
 quarter=style.endswith('-quarter');name=style.replace('-quarter','');k=meta['styles'].index(name);p=base.copy();p[ids]+=delta[k];p[:,1:]*=-1;head.data.vertices.foreach_set('co',p.reshape(-1));head.data.update()
 yaw=math.pi/5 if quarter else 0;s.camera.location=(1.9*math.sin(yaw),-1.9*math.cos(yaw),.56);s.camera.rotation_euler=(Vector((0,0,.56))-s.camera.location).to_track_quat('-Z','Y').to_euler()
 for ob in eyeobjs:bpy.data.objects.remove(ob,do_unlink=True)
 eyeobjs=eye(-1,k)+eye(1,k)
 s.render.filepath=str(root/f'evidence/v8-{style}.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'v8.blend'))
