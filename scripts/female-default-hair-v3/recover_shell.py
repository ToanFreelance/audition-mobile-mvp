"""Recover the fitted, UV-preserving V3 bob shell from the attached Hunyuan GLB.

python recover_shell.py Female_hair_origin.glb fitted-shell.glb
The compressed selection is indexed against this exact source. No face data is used.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path

import numpy as np


SOURCE_SHA256 = "b2674e644b7997f2947698440b518bd412ffd3f2d8cbe211a78384b5dab737a5"


def fit(positions):
    x, front, negative_height = positions.T
    z = -negative_height
    y = -front
    width = np.interp(z, [.20, .48, .75, .98], [1.17, 1.23, 1.23, 1.14])
    back = np.clip((y - .10) / .15, 0, 1)
    fitted_y = y * 1.085 + .043 + .037 * back * np.clip((z - .27) / .25, 0, 1)
    return np.column_stack(((x - .002) * width, -fitted_y, -(z * 1.15 - .035)))


def recover(source, output):
    data = source.read_bytes()
    if hashlib.sha256(data).hexdigest() != SOURCE_SHA256:
        raise ValueError("Face indices require the original Hunyuan Style 04 GLB")
    json_length = struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20:20 + json_length])
    binary = memoryview(data)[28 + json_length:]
    primitive = doc["meshes"][0]["primitives"][0]
    views = doc["bufferViews"]
    accessors = doc["accessors"]

    def read(accessor_id):
        accessor = accessors[accessor_id]
        view = views[accessor["bufferView"]]
        dimensions = {"VEC3": 3, "VEC2": 2, "SCALAR": 1}[accessor["type"]]
        dtype = {5125: "<u4", 5126: "<f4"}[accessor["componentType"]]
        return np.frombuffer(binary, dtype, accessor["count"] * dimensions,
                             view.get("byteOffset", 0)).reshape(-1, dimensions)

    selection = np.load(Path(__file__).with_name("source-face-selection.npz"))
    selected = selection["keep"] & ~selection["cut"]
    indices = read(primitive["indices"]).reshape(-1, 3)[selected]
    used, remapped = np.unique(indices, return_inverse=True)
    attributes = primitive["attributes"]
    positions = read(attributes["POSITION"])[used].astype(float)
    normals = read(attributes["NORMAL"])[used]
    epsilon = 1e-5
    jacobian = np.stack([(fit(positions + delta) - fit(positions - delta)) / (2 * epsilon)
                         for delta in np.eye(3) * epsilon], axis=2)
    normals = np.linalg.solve(jacobian.transpose(0, 2, 1), normals[..., None])[:, :, 0]
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-8)

    replacements = {}
    for index, values in [(attributes["POSITION"], fit(positions).astype("<f4")),
                          (attributes["NORMAL"], normals.astype("<f4")),
                          (attributes["TEXCOORD_0"], read(attributes["TEXCOORD_0"])[used]),
                          (primitive["indices"], remapped.astype("<u4").reshape(-1, 1))]:
        accessor = accessors[index]
        accessor.update(count=len(values), min=values.min(axis=0).tolist(),
                        max=values.max(axis=0).tolist())
        replacements[accessor["bufferView"]] = values.tobytes()

    packed = bytearray()
    for i, view in enumerate(views):
        start = view.get("byteOffset", 0)
        chunk = replacements.get(i, binary[start:start + view["byteLength"]])
        view.update(byteOffset=len(packed), byteLength=len(chunk))
        packed.extend(chunk)
        packed.extend(bytes(-len(packed) % 4))
    doc["buffers"][0]["byteLength"] = len(packed)
    header = json.dumps(doc, separators=(",", ":")).encode()
    header += b" " * (-len(header) % 4)
    output.write_bytes(struct.pack("<4sIIII", b"glTF", 2, 28 + len(header) + len(packed),
                                   len(header), 0x4e4f534a) + header +
                       struct.pack("<II", len(packed), 0x004e4942) + packed)


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("source", type=Path)
    cli.add_argument("output", type=Path)
    args = cli.parse_args()
    recover(args.source, args.output)
