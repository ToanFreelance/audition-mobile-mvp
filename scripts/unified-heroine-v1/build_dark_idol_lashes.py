#!/usr/bin/env python3
"""Dark Idol sculpted lash fan. Source-fitted to original VRoid upper lid.
Blender modelling: curved tapered ribbons with 3D depth and Blink morph
sampled from the original character's 57 facial shape keys.
Only standalone lash surface is exported; source actor/rig never altered.
"""
import bpy,math,hashlib
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parents[2]
base=root/"public/characters/unified-heroine-v1/unified-heroine-v1-a41bb9e659e5.glb"
outdir=root/"public/characters/unified-heroine-v1"
bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(base))
face=bpy.data.objects["Face"]
assert len(face.data.vertices)==2054 and len(face.data.shape_keys.key_blocks)==57
native=face.data.shape_keys.key_blocks
baseverts=native["Basis"].data
blinkverts=native["Blink"].data
joyverts=native["Joy"].data
# Authoring rest origin in source GLTF world, in meters.
ANCHOR=(0,1.413,-.085)

# Each root is traced along the accepted VRoid A eyeliner/eyelash envelope.
# The tips follow a controlled cat-eye swoop: no torus/box primitives.
shapes=[
 (.037,1.426,-.095,.040,1.436,-.096,.00135),
 (.047,1.425,-.092,.052,1.440,-.092,.00175),
 (.055,1.421,-.088,.064,1.440,-.087,.0021),
 (.063,1.416,-.082,.079,1.438,-.080,.0028),
 (.069,1.412,-.078,.088,1.433,-.076,.0032),
 (.075,1.407,-.074,.096,1.428,-.072,.0037),
]

ink=bpy.data.materials.new("DarkIdol_Satin_EspressoInk")
ink.diffuse_color=(.058,.019,.051,1)
ink.use_nodes=True
pbr=ink.node_tree.nodes.get("Principled BSDF")
pbr.inputs["Base Color"].default_value=(.035,.010,.034,1)
pbr.inputs["Roughness"].default_value=.42
pbr.inputs["Metallic"].default_value=.03
ink.use_backface_culling=False

def gltf_to_blender(p):
    # Source glTF x,y,z -> Blender local x,-z,y, after subtracting anchor.
    x,y,z=p
    return Vector((x-ANCHOR[0],-(z-ANCHOR[2]),y-ANCHOR[1]))

def distance(a,b):
    return math.sqrt(sum((x-y)**2 for x,y in zip(a,b)))

source_lashes=set()
for poly in face.data.polygons:
    if "FaceEyelash" in face.data.materials[poly.material_index].name:
        source_lashes.update(poly.vertices)
rest=[]
for idx in source_lashes:
    co=baseverts[idx].co
    # glTF source Blender local Z needs constant bind-rest shift.
    rest.append((idx,(float(co.x),float(co.z)+.031718,-float(co.y)+.00006)))

def native_delta(point,which):
    x=point[0];cands=[v for v in rest if v[1][0]*x>0]
    cands.sort(key=lambda e:distance(point,e[1]))
    weights=[]
    for idx,pos in cands[:5]:
        d=max(distance(point,pos),.002)
        w=1/(d*d);weights.append((idx,w))
    den=sum(w for i,w in weights)
    dx=dy=dz=0
    for idx,w in weights:
        a=baseverts[idx].co;b=native[which].data[idx].co
        dx+=(b.x-a.x)*w/den
        dy+=(b.z-a.z)*w/den
        dz+=-(b.y-a.y)*w/den
    return Vector((dx,dy,dz))

def bezier(a,b,c,d,t):
    return a*(1-t)**3+b*(3*t*(1-t)**2)+c*(3*t*t*(1-t))+d*t**3

for side in [-1,1]:
    vertices=[];faces=[];blink_positions=[];joy_positions=[]
    def append_strip(root,tip,width,steps=7):
        nonlocal_placeholder=None
        # Width is measured in local tangent-normal of the eyelid silhouette.
        rx,ry,rz=root;tx,ty,tz=tip
        p0=Vector(root)
        p1=Vector((rx+(tx-rx)*.25,ry+.0024,rz-.00045))
        p2=Vector((rx+(tx-rx)*.66,ty+.003, tz-.001))
        p3=Vector(tip)
        start=len(vertices)
        root_b=native_delta(root,"Blink")
        root_j=native_delta(root,"Joy")
        for i in range(steps+1):
            t=i/steps
            pos=bezier(p0,p1,p2,p3,t)
            tangent=bezier(p0,p1,p2,p3,min(.998,t+.015))-bezier(p0,p1,p2,p3,max(0,t-.015))
            tangent.normalize()
            norm=Vector((-tangent.y,tangent.x,0.0))
            if norm.length<.01:norm=Vector((0,1,0))
            norm.normalize()
            half=(.53+.47*math.sin(t*math.pi*.72))*(1-t)**.70*width*.5
            if i==steps:half=.00004
            # Surface gently bows to the camera, flush at the lash root.
            for c in [-1,1]:
                q=pos+norm*half*c
                q.z-=.00045*math.sin(math.pi*t)
                vertices.append(gltf_to_blender(q))
                # Morph follows native eyelash root, attenuated towards tip.
                atten=1-.14*t
                blink_positions.append(gltf_to_blender(q+root_b*atten))
                joy_positions.append(gltf_to_blender(q+root_j*atten))
        for k in range(steps):
            i=start+2*k
            faces.append((i,i+1,i+3))
            faces.append((i,i+3,i+2))
    for sx,sy,sz,tx,ty,tz,width in shapes:
        append_strip((side*sx,sy,sz),(side*tx,ty,tz),width)
    mesh=bpy.data.meshes.new(f"DarkIdol_WingLashes_{side}")
    mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new("DarkIdol_WingLashes_"+("R" if side>0 else "L"),mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(ink)
    for poly in obj.data.polygons:poly.use_smooth=True
    basis=obj.shape_key_add(name="Basis",from_mix=False)
    blink=obj.shape_key_add(name="Blink",from_mix=False)
    joy=obj.shape_key_add(name="Joy",from_mix=False)
    for i in range(len(vertices)):
        blink.data[i].co=blink_positions[i]
        joy.data[i].co=joy_positions[i]

# Remove imported original actor; only newly modelled native-fitted eyelash 3D geometry.
for o in list(bpy.data.objects):
    if not o.name.startswith("DarkIdol_WingLashes_"):
        bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.object.select_all(action="SELECT")
out=outdir/"dark-idol-native-lashes-v1.glb"
bpy.ops.export_scene.gltf(filepath=str(out),export_format="GLB",use_selection=True,
                          export_apply=True,export_morph=True)
b=out.read_bytes()
digest=hashlib.sha256(b).hexdigest()
dest=out.with_name("dark-idol-native-lashes-v1-"+digest[:12]+".glb")
out.rename(dest)
print("DARK_IDOL_LASHES",str(dest),"bytes",len(b),
      "sha256",digest,
      "objects",len(bpy.data.objects),
      "faces",sum(len(o.data.polygons) for o in bpy.data.objects if o.type=="MESH"))

