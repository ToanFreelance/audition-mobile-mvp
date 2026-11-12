from PIL import Image, ImageDraw, ImageFont, ImageOps
from pathlib import Path

r = Path(__file__).resolve().parents[1] / "review"
font = "/usr/share/fonts/truetype/dejavu/DejaVuSans"


def face(sz, b=False):
    return ImageFont.truetype(font + ("-Bold" if b else "") + ".ttf", sz)


def sheet(name, title, caption, panels, w=370, h=550):
    bw = 22
    canvas = Image.new("RGB", (bw + (bw + w) * len(panels), h + 192), "#F6F3F1")
    dr = ImageDraw.Draw(canvas)
    dr.text(
        (bw, 17),
        "AUDITION MOBILE   /   VITA     •     V1.1",
        font=face(15, True),
        fill="#705a78",
    )
    dr.text((bw, 42), title, font=face(32, True), fill="#302936")
    dr.text((bw, 92), caption, font=face(17), fill="#57495a")
    for i, (fn, label, crop) in enumerate(panels):
        img = Image.open(r / (fn + ".png")).convert("RGB")
        if crop:
            img = img.crop(crop)
        x = bw + i * (w + bw)
        y = 130
        bg = Image.new("RGB", (w, h), img.getpixel((2, 2)))
        img.thumbnail((w, h), Image.Resampling.LANCZOS)
        bg.paste(img, ((w - img.width) // 2, (h - img.height) // 2))
        canvas.paste(bg, (x, y))
        dr.text((x, y + h + 11), label, font=face(18, True), fill="#3e3046")
    canvas.save(r / (name + ".jpg"), quality=93, subsampling=0)


sheet(
    "Vita-V11-Comparison",
    "Từ Vita đến trang phục sàn nhảy",
    "Cùng mặt A, tư thế, camera chính diện và bộ đèn trắng trong Blender Cycles.",
    [
        ("A-full", "A  ·  Trang phục Vita", None),
        ("casual-full", "V1.1  ·  Lavender Street Idol", None),
        ("casual-front", "V1.1  ·  Chi tiết áo và nơ", None),
    ],
)
sheet(
    "Vita-V11-Swaps",
    "Đổi tóc và tháo nơ khi đang cười",
    "Ba khung hình liên tiếp của cùng một nhân vật trong Three.js.",
    [
        ("swap-bob-bow", "Bob Vita  ·  Có nơ", None),
        ("swap-lob-bow", "Lob dài  ·  Có nơ", None),
        ("swap-lob-off", "Lob dài  ·  Tháo nơ", None),
    ],
    300,
    475,
)
sheet(
    "Vita-V11-Renderers",
    "Cùng bộ đồ dưới ba cách dựng hình",
    "Góc toàn thân chính diện. Hai bản WebGL2 dùng chung camera và hệ đèn.",
    [
        ("mobile", "Blender  ·  Cycles", None),
        ("glb-mobile", "Three.js  ·  GLB / PBR", None),
        ("vrm-mobile", "Three.js  ·  VRM / MToon", None),
    ],
    290,
    560,
)
sheet(
    "Vita-V11-Outfits",
    "Chuyển trang phục trên cùng bộ xương",
    "Hai khung WebGL2 giữ nguyên tóc lob, camera và tư thế. Nơ đã tháo.",
    [("swap-vita", "Bộ Vita", None), ("swap-club", "Bộ casual", None)],
    370,
    570,
)
sheet(
    "Vita-V11-Poses",
    "Kiểm tra nếp váy khi đổi tư thế",
    "Ảnh Cycles của bộ đồ sau khi chỉnh trọng số quanh hông.",
    [
        ("casual-back", "Nhìn từ phía sau", None),
        ("step-knee", "Nhấc gối", None),
        ("step-reach", "Bước chéo và vươn tay", None),
    ],
)
sheet(
    "Vita-V11-Expressions",
    "Khuôn mặt A sau khi thay trang phục",
    "Ba biểu cảm từ các binding VRM gốc, cùng camera và ánh sáng.",
    [
        (f"expression-{k}", lbl, None)
        for k, lbl in [
            ("Neutral", "Trung tính"),
            ("Joy", "Cười"),
            ("Blink", "Chớp mắt"),
        ]
    ],
    300,
    320,
)
