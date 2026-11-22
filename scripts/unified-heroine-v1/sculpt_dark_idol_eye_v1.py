#!/usr/bin/env python3
"""Dark Idol Eye V1 — proportional sculpt of the ACTUAL VRoid face topology.
Blender 5, no inserted floating primitives. Existing 57 morph shapes and original
skin weights/UV are preserved: emit small vertex-offset patch for runtime QA.
"""
import bpy, json, math, hashlib, os
from pathlib import Path
from collections import defaultdict

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/"public/characters/unified-heroine-v1/unified-heroine-v1-a41bb9e659e5.glb"
OUT=ROOT/"app/tools/unified-heroine-v1/dark-idol-eye-v1-sculpt.json"
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(BASE))
face=next((o for o in bpy.data.objects if o.type=="MESH" and o.name=="Face"),None)
assert face is not None and len(face.data.vertices)==2054
keys=face.data.shape_keys.key_blocks
assert len(keys)==57, "Do not silently change original face morph topology"
assert any(k.name=="Blink" for k in keys)
assert face.vertex_groups, "Skin weights need to survive"
indices=defaultdict(set)
for poly in face.data.polygons:
    name=face.data.materials[poly.material_index].name
    if "FaceEyeline" in name:mat="eyeline"
    elif "FaceEyelash" in name:mat="eyelash"
    else:continue
    for vi in poly.vertices:indices[mat].add(vi)

def clamp(x):return min(1.,max(0.,x))
def smooth(a,b,x):
    t=clamp((x-a)/(b-a))
    return t*t*(3-2*t)
patch={"version":1,"faceVertexCount":len(face.data.vertices),
       "sourceSha256":hashlib.sha256(BASE.read_bytes()).hexdigest(),
       "targetMaterials":{"eyeline":"FaceEyeline","eyelash":"FaceEyelash"},
       "treatment":"dark-idol native-topology proportional sculpt, morph-preserving",
       "vertices":{}}
for group in ("eyeline","eyelash"):
    entries=[]
    for vi in sorted(indices[group]):
        co=keys["Basis"].data[vi].co
        x=float(co.x)
        # glTF Y corresponds to Blender local Z + bind-space offset.
        sy=float(co.z)+0.031718
        ax=abs(x)
        sign=1 if x>=0 else -1
        # Outer lash wing. Sculpt selected vertices of native meshes; not false
        # glasses/torus/quad accessories. Keep inner lid and iris untouched.
        wing=smooth(.045,.082,ax)
        tail=smooth(.063,.083,ax)
        upper=smooth(1.397,1.418,sy)
        if group=="eyelash":
            dx=sign*(.0102*wing*upper+.0106*tail)
            dy=.0125*wing*upper+.0190*tail
            dz=-.0023*wing*upper
            # Gentle lift of eyelash row in mid eye while preserving roots
            lift=smooth(.032,.056,ax)*(1-smooth(.060,.085,ax))*smooth(1.414,1.429,sy)
            dy+=.0032*lift
        else:
            dx=sign*(.0068*wing*upper+.0110*tail)
            dy=.0085*wing*upper+.0170*tail
            dz=-.0020*wing*upper
        if max(abs(dx),abs(dy),abs(dz))<.00008:continue
        # Blender x,z,-y -> glTF x,y,z. Record actual coordinate adjustments,
        # not replacing source geometry.
        delta=[round(dx,7),round(dy,7),round(dz,7)]
        entries.append([vi,*delta])
        # 57 shapes receive the same offset. Morph differences are unmodified.
        for shape in keys:
            value=shape.data[vi].co
            value.x+=dx;value.z+=dy;value.y-=dz
    patch["vertices"][group]=entries
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(patch,ensure_ascii=False,separators=(",",":")))
print("DARK_IDOL_SCULPT",str(OUT),"faceVerts",len(face.data.vertices),
  "shapeKeys",len(keys),"offsets",[(k,len(v)) for k,v in patch["vertices"].items()],
  "bytes",OUT.stat().st_size)

