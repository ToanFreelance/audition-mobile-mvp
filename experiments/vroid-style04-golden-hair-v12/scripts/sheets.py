from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

r = Path(__file__).resolve().parents[1] / "review"
font = "/usr/share/fonts/truetype/dejavu/DejaVuSans"


def text(sz, bold=False):
    return ImageFont.truetype(font + ("-Bold" if bold else "") + ".ttf", sz)


def sheet(file, title, sub, panels, w=350, h=415):
    pad = 20
    im = Image.new("RGB", (pad + len(panels) * (pad + w), h + 184), "#f6f2f3")
    d = ImageDraw.Draw(im)
    d.text(
        (pad, 15),
        "AUDITION MOBILE    /    VITA A      •      V1.2",
        font=text(15, True),
        fill="#73576e",
    )
    d.text((pad, 42), title, font=text(30, True), fill="#342938")
    d.text((pad, 88), sub, font=text(16), fill="#644f61")
    for i, (f, cap, crop) in enumerate(panels):
        a = Image.open(r / f).convert("RGB")
        if crop:
            a = a.crop(crop)
        a.thumbnail((w, h), Image.Resampling.LANCZOS)
        x = pad + (pad + w) * i
        bg = Image.new("RGB", (w, h), a.getpixel((2, 2)))
        bg.paste(a, ((w - a.width) // 2, (h - a.height) // 2))
        im.paste(bg, (x, 122))
        d.text((x, 134 + h), cap, font=text(17, True), fill="#342938")
    im.save(r / (file + ".jpg"), quality=94, subsampling=0)


sheet(
    "Style04-V12-Concept",
    "Style 04  ·  Bob lavender tỉa lớp",
    "Trái là ô 04 trong bản vẽ của chủ dự án. Hai ảnh bên phải là render 3D cùng khuôn mặt A.",
    [
        ("concept04.jpg", "Mẫu duyệt  ·  góc dưới trái", (0, 15, 341, 437)),
        ("v11-front.png", "Bob V1.1  ·  Cycles", None),
        ("style04-front.png", "Style 04 V1.2  ·  Cycles", None),
    ],
)
sheet(
    "Style04-V12-Angles",
    "Hình dáng quanh đầu",
    "Bốn góc máy trực giao dưới cùng một bộ đèn trắng.",
    [
        (f"style04-{k}.png", t, None)
        for k, t in [
            ("left35", "Trái 35°"),
            ("right35", "Phải 35°"),
            ("side", "Nghiêng phải"),
            ("back", "Sau gáy"),
        ]
    ],
    255,
    310,
)
sheet(
    "Style04-V12-Construction",
    "Cấu trúc tóc",
    "Hai góc tóc riêng, cận mái và các đường dẫn được đọc trực tiếp từ cảnh Blender.",
    [
        ("hair-front.png", "Tóc riêng  ·  trước", None),
        ("hair-side.png", "Tóc riêng  ·  nghiêng", None),
        ("fringe-detail.png", "Cận phần mái", None),
        ("guide-view.png", "Guide 3D", None),
    ],
    255,
    310,
)
sheet(
    "Style04-V12-WebGL2",
    "Đổi tóc trong Three.js",
    "Giữ cùng actor, bộ xương và nụ cười. Cột phải dùng GLB mặc định ở 390 × 844.",
    [
        ("swap-old.png", "V1.1  ·  đang cười", (0, 177, 390, 665)),
        ("swap-style04.png", "V1.2  ·  đang cười", (0, 177, 390, 665)),
        ("glb-mobile.png", "Toàn thân  ·  WebGL2", None),
    ],
    300,
    420,
)
sheet(
    "Style04-V12-Renderers",
    "Tóc V1.2 dưới hai bộ dựng hình",
    "Chính diện, biểu cảm trung tính. Ánh sáng studio Cycles và bộ đèn runtime V1.1.",
    [
        ("style04-front.png", "Blender 4.3.2  ·  Cycles", None),
        ("glb-face.png", "Three.js r180  ·  GLB/PBR", (0, 177, 390, 665)),
    ],
    360,
    420,
)
sheet(
    "Style04-V12-GBH",
    "Từ guide đến mesh GBH",
    "Cùng góc máy. 178 guide cho lớp card chính và 65 guide cho sợi chi tiết.",
    [
        ("guide-view.png", "Guide theo vùng", None),
        ("clay-front.png", "Mesh xuất  ·  đất sét", None),
        ("hair-front.png", "Vật liệu lavender", None),
    ],
)
