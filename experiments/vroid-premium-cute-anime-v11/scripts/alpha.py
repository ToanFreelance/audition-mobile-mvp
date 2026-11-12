"""Khôi phục alpha của tóc/mi theo hợp đồng VRoid trên hai bản glTF."""

from pathlib import Path
import struct, json, os

r = Path(__file__).resolve().parents[1]


def read(p):
    raw = p.read_bytes()
    n = struct.unpack_from("<I", raw, 12)[0]
    return json.loads(raw[20 : 20 + n]), raw[20 + n :]


def write(p, j, tail):
    b = json.dumps(j, separators=(",", ":"), ensure_ascii=False).encode()
    b += b" " * (-len(b) % 4)
    p.write_bytes(
        struct.pack("<4sIIII", b"glTF", 2, 20 + len(b) + len(tail), len(b), 0x4E4F534A)
        + b
        + tail
    )


src, _ = read(Path(os.environ["VITA_SOURCE"]))
mats = {m["name"]: m for m in src["materials"]}
for p in [*r.glob("out/*.glb"), r / "review/wardrobe.glb"]:
    j, tail = read(p)
    for m in j["materials"]:
        a = mats.get(m["name"].removeprefix("Studio · "))
        if a:
            m["alphaMode"] = a.get("alphaMode", "OPAQUE")
            m["doubleSided"] = a.get("doubleSided", False)
            if m["alphaMode"] == "MASK":
                m["alphaCutoff"] = a.get("alphaCutoff", 0.5)
        else:
            m["doubleSided"] = True
    write(p, j, tail)
