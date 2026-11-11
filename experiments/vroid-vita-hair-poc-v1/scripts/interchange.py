"""Keep Vita's original glTF fallback shaders/media, including unlit face.
The VRM add-on's Blender nodes are for MToon and generic glTF export can
translate them to a different PBR shader. Preserve the baked groom and skin.
"""

import copy, json, struct, pathlib, hashlib

root = pathlib.Path(__file__).resolve().parents[1]


def unpack(path):
    b = path.read_bytes()
    n = struct.unpack_from("<I", b, 12)[0]
    j = json.loads(b[20 : 20 + n])
    return j, bytearray(b[28 + n : 28 + n + j["buffers"][0]["byteLength"]])


def pack(path, j, blob):
    j["buffers"][0]["byteLength"] = len(blob)
    s = json.dumps(j, separators=(",", ":"), ensure_ascii=False).encode()
    s += b" " * ((-len(s)) % 4)
    blob += b"\0" * ((-len(blob)) % 4)
    path.write_bytes(
        struct.pack("<4sIIII", b"glTF", 2, 28 + len(s) + len(blob), len(s), 0x4E4F534A)
        + s
        + struct.pack("<II", len(blob), 0x004E4942)
        + blob
    )


src, sbin = unpack(root / "out/Vita-Original.vrm")
path = root / "out/Vita-Style04-Hair-POC-V1.glb"
dst, dbin = unpack(path)


def pixels(doc, buf, i):
    view = doc["bufferViews"][doc["images"][i]["bufferView"]]
    a = view.get("byteOffset", 0)
    return bytes(buf[a : a + view["byteLength"]])


image_map = {
    hashlib.sha256(pixels(dst, dbin, i)).digest(): i for i in range(len(dst["images"]))
}


def texture(i):
    item = src["textures"][i]
    raw = pixels(src, sbin, item["source"])
    key = hashlib.sha256(raw).digest()
    if key not in image_map:
        im = copy.deepcopy(src["images"][item["source"]])
        dbin.extend(b"\0" * ((-len(dbin)) % 4))
        im["bufferView"] = len(dst["bufferViews"])
        dst["bufferViews"].append(
            {"buffer": 0, "byteOffset": len(dbin), "byteLength": len(raw)}
        )
        dbin.extend(raw)
        image_map[key] = len(dst["images"])
        dst["images"].append(im)
    mapping = {"source": image_map[key]}
    if "sampler" in item:
        sampler = src["samplers"][item["sampler"]]
        if sampler not in dst["samplers"]:
            dst["samplers"].append(sampler)
        mapping["sampler"] = dst["samplers"].index(sampler)
    if mapping not in dst["textures"]:
        dst["textures"].append(mapping)
    return dst["textures"].index(mapping)


def remap(o):
    if isinstance(o, dict):
        for key, value in o.items():
            if key.endswith("Texture") and isinstance(value, dict) and "index" in value:
                value["index"] = texture(value["index"])
            else:
                remap(value)


by_name = {m["name"]: m for m in src["materials"]}
for i, m in enumerate(dst["materials"]):
    if m["name"] in by_name:
        clone = copy.deepcopy(by_name[m["name"]])
        remap(clone)
        dst["materials"][i] = clone
    elif "directional RGBA" in m["name"]:
        m.update(alphaMode="MASK", alphaCutoff=0.40, doubleSided=True)
if "KHR_materials_unlit" not in dst["extensionsUsed"]:
    dst["extensionsUsed"].append("KHR_materials_unlit")
pack(path, dst, dbin)
