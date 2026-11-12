"""Read and pack Vita's legacy VRM without reindexing any source vertex or accessor."""

from pathlib import Path
import json, struct, io, hashlib
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "work/Vita-Original.vrm"
BASE = "Vita-Premium-Anime-V1"


class Asset:
    def __init__(self, path):
        raw = Path(path).read_bytes()
        magic, version, size, n, tag = struct.unpack_from("<4sIIII", raw)
        assert (
            magic == b"glTF" and version == 2 and size == len(raw) and tag == 0x4E4F534A
        )
        self.doc = json.loads(raw[20 : 20 + n])
        self.bin = bytearray(
            raw[28 + n : 28 + n + self.doc["buffers"][0]["byteLength"]]
        )

    def array(self, i):
        a = self.doc["accessors"][i]
        v = self.doc["bufferViews"][a["bufferView"]]
        cols = {"VEC3": 3, "VEC2": 2, "SCALAR": 1, "VEC4": 4, "MAT4": 16}[a["type"]]
        dtype = {5126: "<f4", 5123: "<u2", 5125: "<u4", 5121: "u1"}[a["componentType"]]
        assert not v.get("byteStride") and not a.get("sparse")
        return np.frombuffer(
            self.bin,
            dtype,
            count=a["count"] * cols,
            offset=v.get("byteOffset", 0) + a.get("byteOffset", 0),
        ).reshape(-1, cols)

    def image(self, i):
        k = self.doc["images"][i]["bufferView"]
        v = self.doc["bufferViews"][k]
        p = v.get("byteOffset", 0)
        return Image.open(io.BytesIO(self.bin[p : p + v["byteLength"]])).convert("RGBA")

    def set_image(self, i, image):
        f = io.BytesIO()
        image.save(f, "PNG")
        data = f.getvalue()
        self.bin += b"\0" * ((-len(self.bin)) % 4)
        self.doc["images"][i]["bufferView"] = len(self.doc["bufferViews"])
        self.doc["bufferViews"].append(
            dict(buffer=0, byteOffset=len(self.bin), byteLength=len(data))
        )
        self.bin += data

    def save(self, path):
        self.doc["buffers"][0]["byteLength"] = len(self.bin)
        s = json.dumps(self.doc, separators=(",", ":"), ensure_ascii=False).encode()
        s += b" " * ((-len(s)) % 4)
        b = self.bin + b"\0" * ((-len(self.bin)) % 4)
        Path(path).write_bytes(
            struct.pack("<4sIIII", b"glTF", 2, 28 + len(s) + len(b), len(s), 0x4E4F534A)
            + s
            + struct.pack("<II", len(b), 0x004E4942)
            + b
        )
