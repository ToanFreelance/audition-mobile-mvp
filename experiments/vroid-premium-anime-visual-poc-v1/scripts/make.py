from asset import *
import materials, refine

assert (
    hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    == "f2bf78f28a24e2f75f5ca0b6c3b646654c394e4b03592dfaa0d0633ef0972b4d"
)
a = Asset(SOURCE)
materials.apply(a)
a.save(ROOT / "work/polished.vrm")
summary = refine.apply(a)
print(summary)
a.doc["extensions"]["VRM"]["meta"]["title"] = "Vita · Premium Anime B"
a.save(ROOT / "work/refined.vrm")
print("Written A and B")
