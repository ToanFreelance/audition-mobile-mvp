"""Read-only Checkpoint A audit. Run with Blender --disable-autoexec -b --python.
No private geometry, images, texture bytes or credentials are included in output.
"""
import argparse
import hashlib
import io
import json
import struct
import sys
import zipfile
from pathlib import Path

import bpy

EXPECTED_GLB = "d422159770ee8e9fbc9d78f2f256d5ee988651373cbd211aaa99efd7ecf2bad8"
EXPECTED_ZIP = "4ef821492096d9facaf166fadb2f6f2c01b364571ac52b80cfb2c6f7cb883868"
EXPECTED_BLEND = "138a5b8321bd333e409340be321e483bdef6f2e6bebe5758bc8af6d4d75fed52"


def verified(path, expected):
    value = hashlib.sha256(path.read_bytes()).hexdigest()
    if value != expected:
        raise ValueError(f"SHA-256 mismatch: {path.name}: {value}")
    return {"name": path.name, "bytes": path.stat().st_size, "sha256": value}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--vita-glb", type=Path, required=True)
    parser.add_argument("--cyber-zip", type=Path, required=True)
    parser.add_argument("--vita-blend", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    report = {"scope": "Cyber Blue TOP only; read-only feasibility"}
    report["files"] = [
        verified(args.vita_glb, EXPECTED_GLB),
        verified(args.cyber_zip, EXPECTED_ZIP),
        verified(args.vita_blend, EXPECTED_BLEND),
    ]
    raw = args.vita_glb.read_bytes()
    if raw[:4] != b"glTF":
        raise ValueError("Not GLB")
    document = json.loads(raw[20:20 + struct.unpack_from("<I", raw, 12)[0]])
    report["glb"] = {
        "skinCount": len(document.get("skins", [])),
        "jointCount": len(document["skins"][0]["joints"]),
        "animationCount": len(document.get("animations", [])),
        "outfit": [
            {"name": mesh.get("name"), "primitiveCount": len(mesh["primitives"]),
             "hasUV": any("TEXCOORD_0" in p["attributes"] for p in mesh["primitives"]),
             "allPrimitivesSkinned": all({"JOINTS_0", "WEIGHTS_0"} <= p["attributes"].keys()
                                        for p in mesh["primitives"])}
            for mesh in document["meshes"]
            if mesh.get("name") == "Street_Bomber_Pleats_Sneakers"
        ],
    }
    with zipfile.ZipFile(args.cyber_zip) as archive:
        matches = [n for n in archive.namelist() if n.endswith("/cyberbluetops.vroidcustomitem")]
        if len(matches) != 1:
            raise ValueError("Expected one Cyber Blue top")
        with zipfile.ZipFile(io.BytesIO(archive.read(matches[0]))) as top:
            meta = json.loads(top.read("v1customitem/meta.json"))
            report["topSource"] = {
                "entries": len(top.namelist()),
                "group": meta["rootTransferableGroupTypeId"],
                "standaloneMeshFiles": [n for n in top.namelist()
                                        if n.lower().endswith((".glb", ".vrm", ".fbx", ".obj"))],
                "canonicalTemplates": [],
            }
            payloads = b"".join(top.read(n) for n in top.namelist()
                                if n.endswith((".transferable", ".transferablegroup")))
            for token in ("N00_005_01_Tops", "N00_010_01_OnePiece", "SkinAlphaMask"):
                if token.encode() in payloads:
                    report["topSource"]["canonicalTemplates"].append(token)

    bpy.ops.wm.open_mainfile(filepath=str(args.vita_blend))
    donor = bpy.data.objects.get("Vita_Suit")
    if donor is None or donor.type != "MESH":
        raise ValueError("Missing full Vita_Suit donor")
    counts = {key: 0 for key in ("torso", "leftAxilla", "rightAxilla", "leftUpperArm", "rightUpperArm")}
    skin_faces = 0
    for face in donor.data.polygons:
        if not donor.data.materials[face.material_index].name.endswith("_SKIN"):
            continue
        skin_faces += 1
        x, _y, z = donor.matrix_world @ face.center
        if 1.05 < z < 1.36 and abs(x) < 0.1:
            counts["torso"] += 1
        if 1.22 < z < 1.39 and 0.07 < x < 0.17:
            counts["leftAxilla"] += 1
        if 1.22 < z < 1.39 and -0.17 < x < -0.07:
            counts["rightAxilla"] += 1
        if 1.25 < z < 1.43 and 0.17 < x < 0.33:
            counts["leftUpperArm"] += 1
        if 1.25 < z < 1.43 and -0.33 < x < -0.17:
            counts["rightUpperArm"] += 1
    report["blendDonor"] = {
        "name": donor.name, "hiddenRender": donor.hide_render,
        "vertices": len(donor.data.vertices), "skinFaces": skin_faces,
        "vertexGroupCount": len(donor.vertex_groups), "skinRegionFaceCounts": counts,
    }
    report["feasibility"] = {
        "canonicalConversion": False,
        "surfaceReconstructionCandidate": all(n > 0 for n in counts.values()),
        "proofLimit": "Coverage only; does not certify garment topology, UV, bind alignment or art quality.",
        "publicRedistributionCleared": False,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False))
    # The opened .blend and approved GLB are never saved or overwritten.


if __name__ == "__main__":
    main()

