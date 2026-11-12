"""Ghép bằng chứng dựng hình thật. Ghi rõ checkpoint chưa hoàn thiện."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

r = Path(__file__).resolve().parents[1] / "review"
font = "/usr/share/fonts/truetype/dejavu/DejaVuSans"


def ft(size, bold=False):
    return ImageFont.truetype(font + ("-Bold" if bold else "") + ".ttf", size)


def sheet(name, title, panels, width=340, height=405):
    pad = 20
    im = Image.new("RGB", (pad + (width + pad) * len(panels), height + 184), "#f4eff2")
    d = ImageDraw.Draw(im)
    d.text(
        (pad, 12),
        "AUDITION MOBILE    /    VITA A    ·    STYLE 04 V1.3",
        font=ft(14, True),
        fill="#765c75",
    )
    d.text((pad, 40), title, font=ft(28, True), fill="#352c3c")
    d.text(
        (pad, 83),
        "MỸ THUẬT FAIL  ·  Checkpoint mái, trái và đỉnh liền kề",
        font=ft(16, True),
        fill="#9b3e4c",
    )
    for i, (file, caption, crop) in enumerate(panels):
        a = Image.open(r / file).convert("RGB")
        if crop:
            a = a.crop(crop)
        a.thumbnail((width, height), Image.Resampling.LANCZOS)
        box = Image.new("RGB", (width, height), a.getpixel((2, 2)))
        box.paste(a, ((width - a.width) // 2, (height - a.height) // 2))
        x = pad + i * (width + pad)
        im.paste(box, (x, 116))
        d.text((x, height + 130), caption, font=ft(15, True), fill="#352c3c")
    im.save(r / (name + ".jpg"), quality=94, subsampling=0)


sheet(
    "Style04-V13-Comparison",
    "Golden Concept / V1.2 / checkpoint V1.3",
    [
        ("concept04.jpg", "Mẫu 04 của chủ dự án", (0, 15, 341, 437)),
        ("v12-front.png", "V1.2  ·  Cycles", None),
        ("v13-front.png", "V1.3  ·  Cycles  ·  đang dở", None),
    ],
)
sheet(
    "Style04-V13-Groom",
    "Guide, mesh đất sét và vật liệu",
    [
        ("v13-guides.png", "Hair Curves  ·  từng vùng", None),
        ("v13-clay-front.png", "Đầu ra GBH  ·  đất sét", None),
        ("v13-hair-front.png", "Cùng mesh  ·  lavender", None),
    ],
)
sheet(
    "Style04-V13-Details",
    "Cổng mỹ thuật của mái và lớp ôm mặt",
    [
        ("v13-left35.png", "Góc trái 35°", None),
        ("v13-fringe.png", "Cận mái", None),
        ("v13-side-detail.png", "Cận lớp bên trái", None),
    ],
)
sheet(
    "Style04-V13-WebGL2",
    "Checkpoint trong Three.js r180",
    [
        ("swap-old.png", "Bob V1.1  ·  đang cười", (0, 177, 390, 665)),
        ("swap-style04.png", "Checkpoint  ·  đang cười", (0, 177, 390, 665)),
        ("glb-mobile.png", "Khung 390 × 844", None),
    ],
    300,
    420,
)
sheet(
    "Style04-V13-Renderers",
    "Vẻ ngoài của cùng checkpoint",
    [
        ("v13-front.png", "Blender 4.3.2  ·  Cycles", None),
        ("glb-face.png", "Three.js r180  ·  GLB/PBR", (0, 177, 390, 665)),
    ],
    360,
    430,
)
