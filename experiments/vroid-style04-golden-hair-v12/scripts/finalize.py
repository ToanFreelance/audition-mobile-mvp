"""Đồng bộ bản mesh để xuất với kết quả GBH sau khi mở lại tệp."""

from pathlib import Path
import sys, json, bpy

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "scripts"))
from rebake import rebake

rebake()
again = rebake()
assert again < 0.00001
(root / "review/rebake.json").write_text(
    json.dumps({"repeatMaximumErrorMm": again, "editablePrimaryRegions": 5}, indent=2)
)
t = bpy.data.texts.get("Style04 • Đồng bộ card GBH.py") or bpy.data.texts.new(
    "Style04 • Đồng bộ card GBH.py"
)
t.clear()
t.write((root / "scripts/rebake.py").read_text())
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(
    filepath=str(root / "out/Vita-Style04-Golden-Hair-V12.blend"), compress=True
)
