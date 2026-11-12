"""Carry the native alpha contract into the generic glTF exporter output."""

from asset import *

p = ROOT / "out" / f"{BASE}-B.glb"
asset = Asset(p)
template = Asset(ROOT / "work/polished.vrm")
native = {m["name"]: m for m in template.doc["materials"]}
for m in asset.doc["materials"]:
    original = native[m["name"].removeprefix("Studio · ")]
    m["doubleSided"] = original.get("doubleSided", False)
    m["alphaMode"] = original.get("alphaMode", "OPAQUE")
    if m["alphaMode"] == "MASK":
        m["alphaCutoff"] = original.get("alphaCutoff", 0.5)
asset.save(p)
