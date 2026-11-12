"""Kiểm tra hình học, UV, vật liệu gán và weights của trang phục V1.1."""

from pathlib import Path
import bpy, os, json, hashlib, struct

root = Path(__file__).resolve().parents[1]


def signature(file):
    bpy.ops.wm.open_mainfile(filepath=str(file))
    out = {}
    for obj in bpy.data.objects:
        if obj.get("cosmeticSlot") != "OutfitSlot" or obj.type != "MESH":
            continue
        mesh = obj.data
        digest = hashlib.sha256()
        for v in mesh.vertices:
            digest.update(struct.pack("<3f", *v.co))
            for g in v.groups:
                digest.update(
                    obj.vertex_groups[g.group].name.encode()
                    + b"\0"
                    + struct.pack("<f", g.weight)
                )
        for p in mesh.polygons:
            digest.update(struct.pack("<I", p.material_index))
            digest.update(struct.pack("<" + "I" * len(p.vertices), *p.vertices))
        for uv in mesh.uv_layers:
            for l in uv.data:
                digest.update(struct.pack("<2f", *l.uv))
        for m in mesh.materials:
            digest.update(m.name.encode() + b"\0")
        out[obj.name] = digest.hexdigest()
    return out


base = signature(os.environ["V11_BLEND"])
final = signature(root / "out/Vita-Style04-Groom-V13.blend")
assert base and base == final
(root / "review/outfit-lock.json").write_text(json.dumps(base, indent=2))
