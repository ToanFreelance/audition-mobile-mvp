"""Xuất hai cấu hình cùng actor, dùng đúng vật liệu và cutoff trong glTF."""

import bpy, pathlib, struct, json

r = pathlib.Path(__file__).resolve().parents[1]
rig = bpy.data.objects["Armature"]
stem = "Vita-Style04-Golden-Hair-V12"
old = bpy.data.objects["Hair_Bob"]


def select(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objs:
        ob.hide_set(False)
        ob.select_set(True)


# Join final skin meshes on the export copy to share a draw call. The editable source stays split.
pieces = [bpy.data.objects[n] for n in ["Style04_Cards", "Style04_Fine_Fibres"]]
select(pieces)
bpy.context.view_layer.objects.active = pieces[0]
bpy.ops.object.join()
new = bpy.context.view_layer.objects.active
new.name = "Hair_Style04"
m = new.data.materials[0]
tex = next(n for n in m.node_tree.nodes if n.type == "TEX_IMAGE")
bs = m.node_tree.nodes.get("Principled BSDF")
m.node_tree.links.new(tex.outputs["Alpha"], bs.inputs["Alpha"])
default = [
    o for o in bpy.context.scene.objects if o.type == "MESH" and not o.hide_render
]


def binary(path):
    raw = path.read_bytes()
    n = struct.unpack_from("<I", raw, 12)[0]
    return json.loads(raw[20 : 20 + n]), raw[20 + n :]


src, _ = binary(pathlib.Path(__import__("os").environ["V11_GLB"]))
baseline = {m["name"]: m for m in src["materials"]}


def export(objects, path):
    select([rig, *objects])
    bpy.context.view_layer.objects.active = rig
    assert bpy.ops.export_scene.gltf(
        filepath=str(path),
        use_selection=True,
        export_extras=True,
        export_skins=True,
        export_morph=True,
        export_animations=False,
        export_tangents=True,
        export_all_influences=True,
    ) == {"FINISHED"}
    j, tail = binary(path)
    # Blender's internal registered property collides with its RNA property on re-import.
    # Keep all explicit cosmetic IDs while omitting private editor-state extras.
    for entries in j.values():
        for entry in entries if isinstance(entries, list) else []:
            if isinstance(entry, dict) and isinstance(entry.get("extras"), dict):
                entry["extras"].pop("vrm_addon_extension", None)
                if not entry["extras"]:
                    entry.pop("extras")
    for mat in j["materials"]:
        ref = baseline.get(mat["name"])
        if ref:
            for k in ["alphaMode", "alphaCutoff", "doubleSided"]:
                if k in ref:
                    mat[k] = ref[k]
                else:
                    mat.pop(k, None)
        if mat["name"] == m.name:
            mat.update(alphaMode="MASK", alphaCutoff=0.42, doubleSided=True)
            assert "baseColorTexture" in mat["pbrMetallicRoughness"]
    b = json.dumps(j, separators=(",", ":"), ensure_ascii=False).encode()
    b += b" " * (-len(b) % 4)
    path.write_bytes(
        struct.pack("<4sIIII", b"glTF", 2, 20 + len(b) + len(tail), len(b), 0x4E4F534A)
        + b
        + tail
    )


export(default, r / "out" / (stem + ".glb"))
export([*default, old], r / "review/wardrobe.glb")
