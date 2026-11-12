"""Ghi checkpoint kiểm định được, bảo toàn guide và GBH trong source."""

import bpy, json, sys
from pathlib import Path

r = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(r / "scripts"))
from rebake import rebake

delta = rebake()
assert rebake() < 0.00001
for o in bpy.data.collections["STYLE04 V13 • Native Hair Curves"].objects:
    o.data.surface = bpy.data.objects["Scalp"]
    o.data.surface_uv_map = bpy.data.objects["Scalp"].data.uv_layers.active.name
for name in ["groom", "rebake"]:
    t = bpy.data.texts.get("V13 · " + name + ".py") or bpy.data.texts.new(
        "V13 · " + name + ".py"
    )
    t.clear()
    t.write((r / "scripts" / (name + ".py")).read_text())
s = bpy.context.scene
s["artisticGate"] = "FAIL"
s["scope"] = "Checkpoint mái, lớp bên trái, phần đỉnh liền kề"
s.cycles.use_denoising = False
s.cycles.samples = 64
(r / "review/rebake.json").write_text(
    json.dumps(
        {
            "maximumDifferenceMm": delta,
            "repeatDifferenceMm": rebake(),
            "stage": "checkpoint",
            "artisticGate": "FAIL",
        },
        indent=2,
    )
)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(
    filepath=str(r / "out/Vita-Style04-Groom-V13.blend"), compress=True
)
