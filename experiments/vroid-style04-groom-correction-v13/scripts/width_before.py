"""Đo lại từng dải V1.2 từ mesh đã chốt, dùng chỉ mục truy ngược guide."""

import bpy, json, numpy as np
from pathlib import Path

r = Path(__file__).resolve().parents[1]
mesh = bpy.data.objects["Style04_Cards"].data
batches = [x.value for x in mesh.attributes["style04_batch"].data]
indexes = [x.value for x in mesh.attributes["style04_index"].data]
lookup = {(a, b): i for i, (a, b) in enumerate(zip(batches, indexes))}
report = []
for guide in bpy.data.collections["STYLE04 • GBH live regions"].objects:
    if guide.type != "CURVES" or not guide.get("style04Batch"):
        continue
    cols = int(guide.name[-1])
    widths = []
    tips = []
    for c in guide.data.curves:
        for sample, bucket in [(len(c.points) // 2, widths), (len(c.points) - 1, tips)]:
            i = c.points[sample].index * cols
            a = mesh.vertices[lookup[(guide["style04Batch"], i)]].co
            b = mesh.vertices[lookup[(guide["style04Batch"], i + cols - 1)]].co
            bucket.append((a - b).length * 1000)
    report.append(
        {
            "object": guide.name,
            "curves": len(guide.data.curves),
            "medianMidWidthMm": float(np.median(widths)),
            "medianTipWidthMm": float(np.median(tips)),
        }
    )
(r / "review/v12-measured-widths.json").write_text(json.dumps(report, indent=2))
print(report)
