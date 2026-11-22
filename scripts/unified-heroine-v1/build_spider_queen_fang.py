# Spider Queen Fang V1 — isolated art asset generated from parametric sculpted geometry.
# Blender 4/5, reproducible. Coordinates authored in canonical VRoid glTF
# mouth-local metres (gltf Y-up, negative Z toward the face/front).
import bpy, math, os
from mathutils import Vector
from math import sin, cos, pi
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.materials, bpy.data.meshes, bpy.data.curves):
    pass

def color_mat(name, color, metallic=0, roughness=.3, emission=None, emission_strength=0):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.use_nodes=True
    bs=m.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value=(*color,1)
    bs.inputs["Metallic"].default_value=metallic
    bs.inputs["Roughness"].default_value=roughness
    if emission:
        bs.inputs["Emission Color"].default_value=(*emission,1)
        bs.inputs["Emission Strength"].default_value=emission_strength
    return m
ivory=color_mat("SQ_Pearlescent_IvoryEnamel",(.91,.865,.99),.10,.16)
gold=color_mat("SQ_RoseGold_Filigree",(.79,.46,.33),.87,.23)
silver=color_mat("SQ_MoonSilver_Canines",(.58,.37,.63),.72,.25)
gem=color_mat("SQ_Alexandrite_VioletCrystal",(.33,.075,.61),.25,.10, (.08,.014,.15),.32)
highlight=color_mat("SQ_Ceramic_GlossRim",(.96,.89,1),.06,.09)

# VRoid glTF coordinate -> Blender Z-up (glTF x,y,z = Blender x,z,-y).
def xyz(x,y,z): return (x,-z,y)

def loft_tooth(side):
    n=16; rings=12
    v=[];f=[];uvcoords=[]
    # Sculpted asymmetrical tapered canine with small hooked tip
    for k in range(rings+1):
        t=k/rings
        y=.0048-.0145*t
        cx=side*(.0128-.0022*(t*t))
        cz=-.0030-.0047*(t*t)
        taper=max(.035,(1-t)**.76)
        rx=.00245*taper*(1-.08*sin(t*pi))
        rz=.0017*taper*(1+.10*sin(2*pi*t))
        for i in range(n):
            a=2*pi*i/n
            x=cx+rx*cos(a)
            z=cz+rz*sin(a) + (0.00035*sin(t*pi)*sin(2*a))
            v.append(xyz(x,y,z))
    for j in range(rings):
        for i in range(n):
            a=j*n+i;b=j*n+(i+1)%n;c=(j+1)*n+(i+1)%n;d=(j+1)*n+i
            f.append((a,b,c,d))
    f.append(tuple(reversed(tuple(range(n)))))
    f.append(tuple(rings*n+i for i in range(n)))
    mesh=bpy.data.meshes.new("SQ_FangMesh"+("L" if side<0 else "R"))
    mesh.from_pydata(v, [], f);mesh.update()
    obj=bpy.data.objects.new("SQ_Fang_"+("Left" if side<0 else "Right"),mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(ivory)
    for face in mesh.polygons: face.use_smooth=True
    # Accurate UV seams per ring; original object has independent UV geometry.
    uv=mesh.uv_layers.new(name="SQ_Fang_UV")
    for poly in mesh.polygons:
        if poly.index >= n*rings: continue
        ring=poly.index//n; seg=poly.index%n
        coords=[(seg/n,ring/rings),((seg+1)/n,ring/rings),((seg+1)/n,(ring+1)/rings),(seg/n,(ring+1)/rings)]
        for corner,loop in enumerate(poly.loop_indices): uv.data[loop].uv=coords[corner]
    return obj

def path_tube(name,points,radius,material,cyclic=False,resolution=3):
    curve=bpy.data.curves.new(name,"CURVE");curve.dimensions="3D";curve.resolution_u=5
    spline=curve.splines.new("BEZIER");spline.bezier_points.add(len(points)-1)
    for bp,p in zip(spline.bezier_points,points):
        bp.co=xyz(*p);bp.handle_left_type="AUTO";bp.handle_right_type="AUTO"
    spline.use_cyclic_u=cyclic
    curve.bevel_depth=radius;curve.bevel_resolution=min(resolution,2)
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    # Convert before export to permanent 3D mesh with material and normals.
    bpy.ops.object.select_all(action="DESELECT");obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.convert(target="MESH")
    return bpy.context.view_layer.objects.active

def gemstone(name,x,y,z,r=.0027,mat=gem):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=r,location=xyz(x,y,z))
    obj=bpy.context.object;obj.name=name;obj.scale=(1,.73,1.25)
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons: polygon.use_smooth=False
    return obj

for side in [-1,1]:
    loft_tooth(side)
    label="L" if side<0 else "R"
    # Rose gold per-canine gumline collar with lifted ends
    cx=side*.0128
    pts=[]
    for j in range(13):
        t=2*pi*j/12
        pts.append((cx+.0026*cos(t),.0049+.0002*cos(2*t),-.003+.00175*sin(t)))
    path_tube("SQ_Lace_EnamelCollar_"+label,pts,.00027,gold,True)
    # Tiny accent along outside canine, this is metal geometry not a painted line.
    path_tube("SQ_MoonSilver_Edge_"+label,[(side*.0148,.001,-.0043),(side*.0135,-.002,-.0056),(side*.0107,-.005,-.0077)],.00019,silver)
    # Inlaid amethyst at tooth root, jewel with actual faceted surfaces.
    gemstone("SQ_Alexandrite_Stud_"+label,side*.0132,.0018,-.0067,.00075)
    # Fine spider-silk swept along upper lip; a 3D curve with 4-5 varying supports.
    path_tube("SQ_SpiderSilk_Arm_"+label,[(side*.0032,.0062,-.0049),(side*.0082,.0076,-.0047),(side*.0132,.0064,-.0059)],.00015,gold)
    path_tube("SQ_SpiderSilk_Thread_"+label,[(side*.0072,.0072,-.0048),(side*.0098,.0090,-.0045),(side*.0134,.0095,-.0041)],.00012,silver)
    gemstone("SQ_Opal_DeWdrops_"+label,side*.0098,.0055,-.0046,.00055,highlight)

# Central tiny onyx/violet faceted cabochon is the signature of spider motif,
# placed at upper philtrum so the fang ends do not look like a moustache.
gemstone("SQ_Queen_CrownGem",0,.0014,-.0062,.0011)

# Low-poly but finished glassy inset tooth reflections, no emissive flat planes.
for side in [-1,1]:
    label="L" if side<0 else "R"
    path_tube("SQ_Tooth_GlossLine_"+label,[
        (side*.0115,.0012,-.0057),
        (side*.0111,-.0028,-.0065),
        (side*.0106,-.0048,-.0076)],.00012,highlight)

out=os.path.join(os.path.dirname(__file__),'../../public/characters/unified-heroine-v1/spider-queen-fang-v1.glb')
out=os.path.abspath(out);os.makedirs(os.path.dirname(out),exist_ok=True)
# glTF writer triangulates quad rings, turns curves into real permanent geometry.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_apply=True)
import hashlib
from pathlib import Path
sha=hashlib.sha256(Path(out).read_bytes()).hexdigest()
name="spider-queen-fang-v1-"+sha[:12]+".glb"
final=Path(out).with_name(name)
Path(out).rename(final)
# Pack a reproducible binary payload for GitHub API transport; Vercel build only
# needs Node to decompress this to the exact checked GLB, not Blender.
import base64,gzip
packed_dir=Path(__file__).parent/"packed"
packed_dir.mkdir(parents=True,exist_ok=True)
for stale in packed_dir.glob("spider-queen-fang-v1.part*.b64"):
    stale.unlink()
packed=base64.b64encode(gzip.compress(final.read_bytes(),compresslevel=9,mtime=0)).decode("ascii")
for i in range(0,len(packed),14400):
    (packed_dir/("spider-queen-fang-v1.part%02d.b64"%(i//14400))).write_text(packed[i:i+14400])
print("SPIDER_QUEEN_PACK",len(packed),"bytes base64",len(list(packed_dir.glob("spider-queen-fang-v1.part*.b64"))),"parts")
print("SPIDER_QUEEN_ASSET",str(final),final.stat().st_size,"sha256",sha,"mesh_objects",len([o for o in bpy.data.objects if o.type=="MESH"]))

