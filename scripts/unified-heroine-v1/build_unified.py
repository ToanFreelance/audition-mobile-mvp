#!/usr/bin/env python3
"""Unified Heroine V1: genuine VRoid A canonical rig/face with VRoid B skinned fashion donors.
Technical candidate; source terms belong to pixiv. Does not author a new procedural body.
Pure Python 3.10+; output GLB embeds source UV/textures and bind matrices.
"""
import copy
import hashlib
import json
import os
import pathlib
import struct
import sys
import urllib.request

HERE = pathlib.Path(__file__).resolve().parents[2]
OUT = HERE / "public/characters/unified-heroine-v1/unified-heroine-v1.glb"
ROOT = "https://raw.githubusercontent.com/madjin/vrm-samples/master/vroid/stable/"
CDN = "https://cdn.jsdelivr.net/gh/madjin/vrm-samples@master/vroid/stable/"
SOURCE_DIR = pathlib.Path(os.environ.get("UNIFIED_HEROINE_SOURCE_DIR", "/tmp/unified-heroine-sources"))
TARGET = os.environ.get("UNIFIED_HEROINE_OUT")

def source(which):
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    file = SOURCE_DIR / ("AvatarSample_" + which + ".vrm")
    if file.exists() and file.stat().st_size > 10_000_000:
        return file
    for base in (ROOT, CDN):
        try:
            req = urllib.request.Request(base + file.name, headers={"User-Agent": "Audition-Mobile-MVP-Unified-Heroine-QA"})
            with urllib.request.urlopen(req, timeout=55) as res:
                content = res.read()
            if len(content) < 10_000_000:
                raise ValueError("incomplete VRM source")
            file.write_bytes(content)
            return file
        except Exception as exc:
            print("SOURCE_DOWNLOAD_RETRY",base,type(exc).__name__,file=sys.stderr)
    raise RuntimeError("VRoid source unavailable: "+which)

def parse(path):
    data = path.read_bytes()
    magic, version, total = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or total != len(data):
        raise ValueError("not a valid GLB/VRM: " + str(path))
    at = 12
    json_chunk, binary_chunk = None, None
    while at < len(data):
        length, kind = struct.unpack_from("<I4s", data, at)
        at += 8
        chunk = data[at:at+length]
        at += length
        if kind == b"JSON":
            json_chunk = json.loads(chunk)
        elif kind == b"BIN\x00":
            binary_chunk = chunk
    if json_chunk is None or binary_chunk is None:
        raise ValueError("missing JSON/BIN GLB chunks")
    return json_chunk,binary_chunk

def align4(data):
    return data + bytes((-len(data))%4)

def glb_encode(model,binchunk):
    binchunk = align4(binchunk)
    model["buffers"] = [{"byteLength":len(binchunk)}]
    j = align4(json.dumps(model, separators=(",",":"),ensure_ascii=False).encode("utf-8")).replace(b"\0",b" ")
    total = 12+8+len(j)+8+len(binchunk)
    return struct.pack("<4sII",b"glTF",2,total)+struct.pack("<I4s",len(j),b"JSON")+j+struct.pack("<I4s",len(binchunk),b"BIN\x00")+binchunk

def main():
    A, ab = parse(source("A"))
    B, bb = parse(source("B"))
    a,b=copy.deepcopy(A),B
    assert len(a["skins"]) == 3 and len(b["skins"]) == 3, "unexpected VRoid sample"
    assert len(a["meshes"][0]["primitives"][0].get("targets",[])) >= 20, "canonical face morphs missing"

    a_names = {n["name"]:i for i,n in enumerate(a["nodes"]) if n.get("name")}
    bmap={}
    added=[]
    for i,n in enumerate(b["nodes"]):
        name=n.get("name")
        if name in a_names:
            bmap[i]=a_names[name]
            continue
        new=copy.deepcopy(n)
        new.pop("children",None)
        new.pop("mesh",None)
        new.pop("skin",None)
        # A local rest axes are identical; additional donor-specific hair/skirt
        # joints are parented onto matching canonical bones, not a second rig.
        new["name"] = "UHV1_B_" + (name or ("Node_"+str(i)))
        bmap[i]=len(a["nodes"])
        a["nodes"].append(new)
        added.append(i)
    for i in added:
        parent=next((p for p,node in enumerate(b["nodes"]) if i in node.get("children",[])),None)
        if parent is None:
            a["scenes"][a.get("scene",0)]["nodes"].append(bmap[i])
        else:
            a["nodes"][bmap[parent]].setdefault("children",[]).append(bmap[i])

    # Keep all canonical source A mesh/image bytes unchanged. Append donor B
    # buffer byte region and remap glTF structural indices. No raster facade.
    byte_offset=len(align4(ab))
    merged_bin=align4(ab)+bb
    offsets={key:len(a.get(key,[])) for key in ("bufferViews","accessors","images","textures","samplers","materials","meshes","skins")}
    for bv in b["bufferViews"]:
        v=copy.deepcopy(bv)
        v["buffer"]=0
        v["byteOffset"]=v.get("byteOffset",0)+byte_offset
        a["bufferViews"].append(v)
    for ac in b["accessors"]:
        v=copy.deepcopy(ac)
        if "bufferView" in v: v["bufferView"]+=offsets["bufferViews"]
        if "sparse" in v:
            for field in ("indices","values"):
                v["sparse"][field]["bufferView"]+=offsets["bufferViews"]
        a["accessors"].append(v)
    for im in b.get("images",[]):
        v=copy.deepcopy(im)
        if "bufferView" in v: v["bufferView"]+=offsets["bufferViews"]
        a["images"].append(v)
    for sample in b.get("samplers",[]):
        a["samplers"].append(copy.deepcopy(sample))
    for tex in b.get("textures",[]):
        v=copy.deepcopy(tex)
        if "sampler" in v:v["sampler"]+=offsets["samplers"]
        if "source" in v:v["source"]+=offsets["images"]
        v.pop("extensions",None)
        a["textures"].append(v)
    for mat in b.get("materials",[]):
        v=copy.deepcopy(mat)
        v["name"]="UHV1_FashionIdol_"+v.get("name","material")
        v.pop("extensions",None) # glTF/PBR fallback, avoid VRM0 MToon runtime
        pbr=v.get("pbrMetallicRoughness",{})
        for tx in (pbr.get("baseColorTexture"),pbr.get("metallicRoughnessTexture"),v.get("normalTexture"),v.get("occlusionTexture"),v.get("emissiveTexture")):
            if tx is not None: tx["index"]+=offsets["textures"]
        a["materials"].append(v)

    # VRoid A Body.baked combines 4 skin surfaces and 3 garment surfaces.
    # Split only glTF primitive references into separate source SkinnedMeshes:
    # no new vertices/UV/weights; same canonical armature; body skin stays visible.
    basic_parts = {"BasicTop":[],"BasicBottom":[],"BasicShoes":[]}
    basic_skin_prims=[]
    for prim in a["meshes"][1]["primitives"]:
        material_name=a["materials"][prim["material"]]["name"]
        key=("BasicTop" if "Tops_" in material_name else
             "BasicBottom" if "Bottoms_" in material_name else
             "BasicShoes" if "Shoes_" in material_name else None)
        if key:basic_parts[key].append(prim)
        else:basic_skin_prims.append(prim)
    if len(basic_skin_prims) < 1 or any(not parts for parts in basic_parts.values()):
        raise RuntimeError("Unexpected canonical body: missing distinct skin/outfit primitives")
    a["meshes"][1]["primitives"]=basic_skin_prims
    for label,prims in basic_parts.items():
        idx=len(a["meshes"])
        a["meshes"].append({"name":"UHV1_"+label,"primitives":prims})
        node_id=len(a["nodes"])
        a["nodes"].append({"name":"UHV1_"+label+"_Skinned","mesh":idx,"skin":1,
            "extras":{"wardrobe":"basic","provenance":"VRoidSample_A_real_skinned"}})
        a["scenes"][a.get("scene",0)]["nodes"].append(node_id)

    def donor_mesh(name,prims):
        new={"name":"UHV1_"+name,"primitives":[]}
        for prim in prims:
            p=copy.deepcopy(prim)
            p["attributes"]={key:val+offsets["accessors"] for key,val in p["attributes"].items()}
            if "indices" in p:p["indices"]+=offsets["accessors"]
            if "material" in p:p["material"]+=offsets["materials"]
            if "targets" in p:
                p["targets"]=[{key:val+offsets["accessors"] for key,val in t.items()} for t in p["targets"]]
            new["primitives"].append(p)
        idx=len(a["meshes"])
        a["meshes"].append(new)
        return idx

    def donor_skin(which):
        skin=copy.deepcopy(b["skins"][which])
        skin["name"]="UHV1_CanonicalArmature_DonorSkin_"+str(which)
        skin["joints"]=[bmap[n] for n in skin["joints"]]
        if "skeleton" in skin:skin["skeleton"]=bmap[skin["skeleton"]]
        if "inverseBindMatrices" in skin:skin["inverseBindMatrices"]+=offsets["accessors"]
        idx=len(a["skins"]);a["skins"].append(skin)
        return idx
    body_skin=donor_skin(1)
    hair_skin=donor_skin(2)

    body=b["meshes"][1]["primitives"]
    groups = {
        "PremiumTop":[p for p in body if "Tops_" in b["materials"][p["material"]]["name"]],
        "PremiumBottom":[p for p in body if "Bottoms_" in b["materials"][p["material"]]["name"]],
        "PremiumShoes":[p for p in body if "Shoes_" in b["materials"][p["material"]]["name"]],
    }
    if any(not ps for ps in groups.values()):
        raise RuntimeError("missing B real garment meshes; refusing synthetic fallback")
    counts={}
    for label,primitives in groups.items():
        idx=donor_mesh(label,primitives)
        node_index=len(a["nodes"])
        a["nodes"].append({"name":"UHV1_"+label+"_Skinned","mesh":idx,"skin":body_skin,"extras":{"wardrobe":"premium","provenance":"VRoidSample_B_real_skinned"}})
        a["scenes"][a.get("scene",0)]["nodes"].append(node_index)
        counts[label]=len(primitives)
    hair_id=donor_mesh("FashionPonytail",b["meshes"][2]["primitives"])
    a["nodes"].append({"name":"UHV1_FashionPonytail_Skinned","mesh":hair_id,"skin":hair_skin,"extras":{"hair":"pony","provenance":"VRoidSample_B_real_skinned"}})
    a["scenes"][a.get("scene",0)]["nodes"].append(len(a["nodes"])-1)

    # Re-color original A hair using preserved maps and distinct material sections.
    # The approved A face/head geometry, eyelashes, UVs and facial textures remain untouched.
    highlights={
        13:[0.98,0.87,1.0,1], # lilac light
        14:[0.93,0.83,1.0,1], # pale violet
        15:[0.87,0.74,0.94,1],# plum shadow
        16:[0.96,0.76,0.96,1],# lilac sheen
    }
    for idx,col in highlights.items():
        mat=a["materials"][idx]
        mat.setdefault("pbrMetallicRoughness",{})["baseColorFactor"]=col
        mat["name"]="UHV1_LavenderBob_"+mat.get("name","")
    # Retain baked VRoid skin & cloth textures; lavender/fashion material
    # styling only via per-material color factors, never replace the face.
    for i,look in [(10,[0.98,0.86,1.0,1]),(11,[0.91,0.78,0.98,1]),(12,[0.94,0.88,1.0,1])]:
        a["materials"][i].setdefault("pbrMetallicRoughness",{})["baseColorFactor"]=look

    # Preserve named morphs before removing VRM0-specific extension.
    face_targets=len(a["meshes"][0]["primitives"][0].get("targets",[]))
    morph_names=["FaceMorph_%02d"%i for i in range(face_targets)]
    for group in A.get("extensions",{}).get("VRM",{}).get("blendShapeMaster",{}).get("blendShapeGroups",[]):
        groupname=group.get("name") or group.get("presetName") or "Other"
        if groupname == "Neutral":continue
        for bind in group.get("binds",[]):
            if bind.get("mesh")==0 and 0 <= bind.get("index",-1) < face_targets:
                morph_names[bind["index"]]=groupname
    a["meshes"][0].setdefault("extras",{})["targetNames"]=morph_names

    # Strip VRM extension (its blendShape index metadata only references
    # original 3 A meshes). Preserve real facial glTF morph POSITION targets.
    a.pop("extensions",None)
    a.pop("extensionsUsed",None)
    a.pop("extensionsRequired",None)
    for n in a["nodes"]: n.pop("extensions",None)
    for mat in a["materials"]: mat.pop("extensions",None)
    for tex in a["textures"]: tex.pop("extensions",None)
    for mesh in a["meshes"]:mesh.pop("extensions",None)
    a["asset"]["generator"]="Audition Unified Heroine V1 from pixiv VRoid A+B real assets"
    a["asset"]["copyright"]="VRoid Studio preset AvatarSample_A/B (pixiv) — inspect usage terms before release"
    a.setdefault("extras",{})["unifiedHeroineV1"]={
        "canonicalFace":"AvatarSample_A/Face.baked","canonicalArmature":"AvatarSample_A",
        "fashionWardrobe":"AvatarSample_B/Body.baked clothing primitives",
        "hairClassic":"AvatarSample_A/Hair001.baked","hairPony":"AvatarSample_B/Hair001.baked",
        "donorOnlyBonesAdded":len(added),"sharedSkeletonNames":len(b["nodes"])-len(added),
        "premiumPieces":counts,"visualAcceptance":"PENDING_OWNER_IPHONE","commercialReady":False,
    }
    out = pathlib.Path(TARGET) if TARGET else OUT
    out.parent.mkdir(parents=True,exist_ok=True)
    result=glb_encode(a,merged_bin)
    out.write_bytes(result)
    data_digest=hashlib.sha256(result).hexdigest()
    manifest={"output":str(out),"size":len(result),"sha256":data_digest,
        "faceMorphCount":len(a["meshes"][0]["primitives"][0].get("targets",[])),
        "canonicalA":str(source("A")),"donorB":str(source("B")),
        "nodes":len(a["nodes"]),"meshes":len(a["meshes"]),"skins":len(a["skins"]),
        "donorOnlyBonesAdded":len(added),"premiumPrimitives":counts,
        "faceBNotImported":True,"vrmExtensionRemoved":True,
        "limits":["real visual comparison pending","B->A bind-pose clothing fit pending","not production licensed retail SKU"]}
    (out.parent/"build-manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps(manifest,ensure_ascii=False,indent=2))

if __name__=="__main__":
    main()

