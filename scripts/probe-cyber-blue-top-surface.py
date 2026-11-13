"""REJECTED DIAGNOSTIC PROBE, not an accepted wearable or shipping converter.
One bounded surface-reconstruction experiment. Kept to reproduce the documented
hood, silhouette and authored-UV failures; no renderer/runtime imports this file.
Private inputs/outputs only. Do not put its derived assets in public/ or Git.
"""
import bpy,bmesh,argparse,sys,json,hashlib,zipfile,io,struct,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

args=argparse.ArgumentParser()
args.add_argument("--blend",type=Path,required=True);args.add_argument("--zip",type=Path,required=True);args.add_argument("--out",type=Path,required=True)
args=args.parse_args(sys.argv[sys.argv.index("--")+1:])
assert hashlib.sha256(args.blend.read_bytes()).hexdigest()=="138a5b8321bd333e409340be321e483bdef6f2e6bebe5758bc8af6d4d75fed52"
assert hashlib.sha256(args.zip.read_bytes()).hexdigest()=="4ef821492096d9facaf166fadb2f6f2c01b364571ac52b80cfb2c6f7cb883868"
args.out=args.out.resolve()
repo_root=Path(__file__).resolve().parents[1]
if args.out==repo_root or repo_root in args.out.parents:
 raise ValueError("Private probe outputs must be outside the repository")
args.out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(args.blend))
donor=bpy.data.objects["Vita_Suit"];rig=next(m.object for m in donor.modifiers if m.type=="ARMATURE")
# Source images stay private. Only the TOP item is read.
with zipfile.ZipFile(args.zip) as z:
 with zipfile.ZipFile(io.BytesIO(z.read("Cyber Blue/cyberbluetops.vroidcustomitem"))) as q:
  candidates=[]
  for n in q.namelist():
   if not n.endswith(".transferable"):continue
   raw=q.read(n);start=raw.find(b"\x89PNG\r\n\x1a\n")
   if start<0:continue
   at=start+8
   while at+12<=len(raw):
    length=struct.unpack_from(">I",raw,at)[0];kind=raw[at+4:at+8];at+=length+12
    if kind==b"IEND":break
   png=raw[start:at];candidates.append(png)
  primary=max(candidates,key=len)
  image_path=args.out/"owner-top-atlas.png";image_path.write_bytes(primary)
  atlas=bpy.data.images.load(str(image_path),check_existing=False)
# Preserve the original donor and all original mesh datablocks.
bm=bmesh.new();bm.from_mesh(donor.data)
bmesh.ops.delete(bm,geom=[f for f in bm.faces if not donor.data.materials[f.material_index].name.endswith("_SKIN")],context="FACES")
for co,no in [((0,0,1.05),(0,0,-1)),((0,0,1.405),(0,0,1)),((0.512,0,0),(1,0,0)),((-0.512,0,0),(-1,0,0))]:
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-6,plane_co=co,plane_no=no,clear_outer=True)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-5)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context="VERTS")
bm.normal_update()
# Material ease is derived from the real skin surface, not primitive shells.
for v in bm.verts:
 amount=0.015 if abs(v.co.x)<0.14 else 0.012
 v.co+=v.normal*amount
# Extend the actual waist border into a loose jacket hem over the existing skirt.
hem=[e for e in bm.edges if e.is_boundary and max(abs(v.co.z-1.05) for v in e.verts)<0.025]
frontiers=hem
for z,spread in [(1.015,1.18),(0.97,1.42),(0.92,1.73),(0.875,1.95)]:
 original=set(v for e in frontiers for v in e.verts)
 ex=bmesh.ops.extrude_edge_only(bm,edges=frontiers)
 newverts=[v for v in ex["geom"] if isinstance(v,bmesh.types.BMVert)]
 # Absolute target profile avoids cumulative scale drift.
 for v in newverts:
  old=min(original,key=lambda w:(w.co-v.co).length_squared)
  angle=math.atan2(old.co.y-0.022,old.co.x)
  v.co=Vector((0.105*spread*math.cos(angle),0.022+0.082*spread*math.sin(angle),z))
 frontiers=[e for e in bm.edges if e.is_boundary and all(v in newverts for v in e.verts)]
# Cap only for remeshing. The four openings are recut afterwards.
bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
mesh=bpy.data.meshes.new("CyberBlue_SurfaceSeed");bm.to_mesh(mesh);bm.free()
coat=bpy.data.objects.new("CyberBlueTop_V1_SurfaceCoat",mesh);bpy.context.collection.objects.link(coat)
bpy.ops.object.select_all(action="DESELECT");coat.select_set(True);bpy.context.view_layer.objects.active=coat
remesh=coat.modifiers.new("Independent garment topology","REMESH");remesh.mode="VOXEL";remesh.voxel_size=0.008
bpy.ops.object.modifier_apply(modifier=remesh.name)
smooth=coat.modifiers.new("Surface relaxation","SMOOTH");smooth.factor=0.5;smooth.iterations=4
bpy.ops.object.modifier_apply(modifier=smooth.name)
bm=bmesh.new();bm.from_mesh(coat.data)
for co,no in [((0,0,0.882),(0,0,-1)),((0,0,1.397),(0,0,1)),((0.506,0,0),(1,0,0)),((-0.506,0,0),(-1,0,0))]:
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-6,plane_co=co,plane_no=no,clear_outer=True)
# Open center front. The slit is structural geometry, not an alpha-only decal.
remove=[]
for f in bm.faces:
 c=f.calc_center_median()
 gap=0.018+0.055*max(0,min(1,(1.10-c.z)/0.218))
 if c.y<-0.018 and abs(c.x)<gap:remove.append(f)
bmesh.ops.delete(bm,geom=remove,context="FACES")
bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context="VERTS")
# Smooth only the new front cut, leaving measured cuffs and hem fixed.
for _ in range(3):
 verts=[v for v in bm.verts if v.is_boundary and v.co.y<-0.018 and abs(v.co.x)<0.095 and 0.895<v.co.z<1.389]
 bmesh.ops.smooth_vert(bm,verts=verts,factor=0.4,use_axis_x=True,use_axis_y=True,use_axis_z=True)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.to_mesh(coat.data);bm.free()
# Collar/hood fold follows the real neck outline. One sewn surface extension.
bm=bmesh.new();bm.from_mesh(coat.data)
neck=[e for e in bm.edges if e.is_boundary and all(v.co.z>1.385 for v in e.verts)]
for row in range(3):
 old=set(v for e in neck for v in e.verts)
 ex=bmesh.ops.extrude_edge_only(bm,edges=neck)
 verts=[v for v in ex["geom"] if isinstance(v,bmesh.types.BMVert)]
 for v in verts:
  v.co.x*=1.18
  v.co.y=0.005+(v.co.y-0.005)*1.25
  v.co.z+=0.009 if row<2 else -0.008
 neck=[e for e in bm.edges if e.is_boundary and all(v in verts for v in e.verts)]
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.to_mesh(coat.data);bm.free()

# Deliberate source-cloth panel mapping. This is new UV, NOT native VRoid UV.
panel_specs=[
 ("CyberBlue_WhiteSourceCloth",(0.07,0.04,0.18,0.18)),
 ("CyberBlue_DarkSourceCloth",(0.01,0.08,0.10,0.19)),
 ("CyberBlue_BlueSourceCloth",(0.39,0.77,0.16,0.16)),
]
for name,patch in panel_specs:
 mat=bpy.data.materials.new(name);mat.use_nodes=True
 nodes=mat.node_tree.nodes;bsdf=nodes.get("Principled BSDF")
 bsdf.inputs["Roughness"].default_value=0.86
 tex=nodes.new("ShaderNodeTexImage");tex.image=atlas;tex.interpolation="Linear"
 mat.node_tree.links.new(tex.outputs["Color"],bsdf.inputs["Base Color"])
 coat.data.materials.append(mat)
uv=coat.data.uv_layers.new(name="Authored_Panel_UV")
for face in coat.data.polygons:
 c=face.center;ax=abs(c.x)
 sleeve=ax>0.155 and c.z>1.24
 hood=c.z>1.385
 if hood:panel=2
 elif sleeve:panel=1 if c.y>0.015 or c.z>1.374 else 0
 else:
  side=abs(c.x)>max(0.075,0.12-(1.27-c.z)*0.2)
  panel=2 if side and c.z<1.19 else (0 if c.z>1.23 and abs(c.x)>0.045 else 1)
 face.material_index=panel;face.use_smooth=True
 px,py,pw,ph=panel_specs[panel][1]
 for li in face.loop_indices:
  v=coat.data.vertices[coat.data.loops[li].vertex_index].co
  u=((v.x+0.55)/1.1 if sleeve else (v.x+0.23)/0.46)
  t=(v.z-0.88)/0.55
  uv.data[li].uv=(px+pw*max(0,min(1,u)),py+ph*max(0,min(1,t)))

# Skin weights: nearest triangle + barycentric interpolation, top four normalized.
donor.data.calc_loop_triangles()
triangles=[tuple(t.vertices) for t in donor.data.loop_triangles if donor.data.materials[t.material_index].name.endswith("_SKIN")]
points=[v.co.copy() for v in donor.data.vertices]
bvh=BVHTree.FromPolygons(points,triangles,all_triangles=True)
weights=[{donor.vertex_groups[g.group].name:g.weight for g in v.groups} for v in donor.data.vertices]
def bary(p,a,b,c):
 v0=b-a;v1=c-a;v2=p-a;d00=v0.dot(v0);d01=v0.dot(v1);d11=v1.dot(v1);d20=v2.dot(v0);d21=v2.dot(v1)
 den=d00*d11-d01*d01
 if abs(den)<1e-12:return (1,0,0)
 v=(d11*d20-d01*d21)/den;w=(d00*d21-d01*d20)/den
 raw=[max(0,1-v-w),max(0,v),max(0,w)];total=sum(raw)
 return [v/total for v in raw]
for name in [b.name for b in rig.data.bones]:coat.vertex_groups.new(name=name)
for v in coat.data.vertices:
 location,normal,idx,dist=bvh.find_nearest(v.co)
 if idx is None:raise RuntimeError("No donor triangle")
 ids=triangles[idx];mix=bary(location,*[points[i] for i in ids]);w={}
 for i,f in zip(ids,mix):
  for name,value in weights[i].items():w[name]=w.get(name,0)+value*f
 if v.co.z<1.05:w={"J_Bip_C_Hips":1}
 best=sorted(w.items(),key=lambda p:-p[1])[:4];total=sum(x[1] for x in best)
 for name,value in best:
  if value>1e-7:coat.vertex_groups[name].add([v.index],value/total,"REPLACE")
mod=coat.modifiers.new("Vita original rig","ARMATURE");mod.object=rig
coat.parent=rig
# Numeric gate and report. Surface remains an approximation until art QA.
bm=bmesh.new();bm.from_mesh(coat.data);unseen=set(bm.verts);parts=[]
while unseen:
 v=unseen.pop();part={v};queue=[v]
 while queue:
  v=queue.pop()
  for edge in v.link_edges:
   w=edge.other_vert(v)
   if w in unseen:unseen.remove(w);part.add(w);queue.append(w)
 parts.append(len(part))
report={"method":"Vita_Suit skin surface / independent voxel topology / authored UV / barycentric skin weights","fidelity":"approximate","vertices":len(coat.data.vertices),"polygons":len(coat.data.polygons),"connectedComponents":parts,"nonManifoldNonBoundaryEdges":sum(not e.is_manifold and not e.is_boundary for e in bm.edges),"weightSumMin":min(sum(g.weight for g in v.groups) for v in coat.data.vertices),"weightSumMax":max(sum(g.weight for g in v.groups) for v in coat.data.vertices),"privateOnly":True,"status":"rejected-diagnostic-only","knownFailures":["flat collar instead of source hood","body-hugging silhouette","jagged front opening and panel boundaries","incorrect source colors/UV","missing inner top layer"]}
bm.free()
(args.out/"reconstruction-report.json").write_text(json.dumps(report,indent=2))
bpy.ops.object.select_all(action="DESELECT");coat.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=coat
bpy.ops.export_scene.gltf(filepath=str(args.out/"REJECTED-PROBE-CyberBlueTop.glb"),export_format="GLB",use_selection=True,export_animations=False,export_skins=True,export_extras=True)
for o in bpy.data.objects:
 if o.type=="MESH" and o!=coat:o.hide_render=True
coat.hide_render=False
bpy.ops.wm.save_as_mainfile(filepath=str(args.out/"REJECTED-PROBE-CyberBlueTop-private.blend"))
print("RECONSTRUCTION_REPORT",json.dumps(report))
