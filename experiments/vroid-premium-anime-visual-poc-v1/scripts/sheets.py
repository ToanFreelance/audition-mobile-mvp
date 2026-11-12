from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
review = root / "review"
base = "/usr/share/fonts/truetype/dejavu/DejaVuSans"


def font(n, bold=False):
    return ImageFont.truetype(base + ("-Bold" if bold else "") + ".ttf", n)


def sheet(name, title, sub, rows, labels, width, height, rowlabels=None):
    gap = 14
    pad = 30
    rowlab = 40 if rowlabels else 0
    cols = len(rows[0])
    lineheight = 58
    canvas = Image.new(
        "RGB",
        (
            2 * pad + cols * width + (cols - 1) * gap,
            123 + len(rows) * (height + lineheight + rowlab) + 17,
        ),
        "#f6f3f5",
    )
    d = ImageDraw.Draw(canvas)
    d.text(
        (pad, 18), "AUDITION MOBILE MVP   /   VITA", font=font(15, True), fill="#785b75"
    )
    d.text((pad, 43), title, font=font(31, True), fill="#302832")
    d.text((pad, 88), sub, font=font(17), fill="#635869")
    y = 123
    for idx, row in enumerate(rows):
        if rowlabels:
            d.text((pad, y + 3), rowlabels[idx], font=font(21, True), fill="#584559")
            y += rowlab
        for i, fi in enumerate(row):
            x = pad + i * (width + gap)
            im = Image.open(review / (fi + ".png")).convert("RGB")
            im.thumbnail((width, height), Image.Resampling.LANCZOS)
            canvas.paste(
                im, (x + (width - im.width) // 2, y + (height - im.height) // 2)
            )
            d.text((x, y + height + 12), labels[i], font=font(19, True), fill="#382e3b")
        y += height + lineheight
    canvas.save(review / name, quality=94, subsampling=0)


sheet(
    "Vita-Premium-Anime-V1-Comparison.jpg",
    "Ba phương án trên cùng khuôn mặt Vita",
    "Chính diện  ·  Cùng camera, biểu cảm nghỉ và bộ đèn  ·  Blender Cycles",
    [["original-front", "A-front", "B-front"]],
    ["Vita gốc", "A  ·  Giữ tỷ lệ gốc", "B  ·  Tinh chỉnh tỷ lệ"],
    422,
    488,
)
sheet(
    "Vita-Premium-Anime-V1-Expressions.jpg",
    "Biểu cảm của hai phương án",
    "Preset VRM gốc, cùng camera cận mặt  ·  Blender Cycles",
    [
        [v + "-expr-" + e for e in ["Neutral", "Joy", "Blink", "A", "Surprised"]]
        for v in ["A", "B"]
    ],
    ["Nghỉ", "Cười · Joy", "Chớp mắt", "Mở miệng · A", "Ngạc nhiên"],
    252,
    276,
    ["A  ·  Giữ tỷ lệ gốc", "B  ·  Tinh chỉnh tỷ lệ"],
)
sheet(
    "Vita-Premium-Anime-V1-Renderers.jpg",
    "Phương án B qua ba cách hiển thị",
    "Cùng góc chính diện  ·  WebGL2 dùng ánh sáng của cảnh kiểm tra độc lập",
    [["B-front", "vrm-front", "glb-front"]],
    ["Blender  ·  Cycles", "Three.js  ·  VRM / MToon", "Three.js  ·  GLB / PBR"],
    365,
    425,
)
