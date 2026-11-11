from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
review = root / "review"
f = "/usr/share/fonts/truetype/dejavu/"
regular = lambda n: ImageFont.truetype(f + "DejaVuSans.ttf", n)
bold = lambda n: ImageFont.truetype(f + "DejaVuSans-Bold.ttf", n)


def sheet(names, title, filename):
    canvas = Image.new("RGB", (1496, 996), "#f7f5f7")
    draw = ImageDraw.Draw(canvas)
    draw.text((20, 16), "AUDITION MOBILE MVP  /  VITA", font=bold(18), fill="#675873")
    draw.text((18, 45), title, font=regular(37), fill="#282232")
    for i, (file, label) in enumerate(names):
        x = 20 + 736 * i
        canvas.paste(Image.open(review / file).convert("RGB"), (x, 104))
        draw.text((x, 922), label, font=bold(24), fill="#34283d")
    draw.text(
        (20, 965),
        "Blender 4.3.2   ·   Cycles   ·   Cùng camera, ánh sáng và biểu cảm",
        font=regular(15),
        fill="#625e69",
    )
    canvas.save(review / filename, quality=94, subsampling=0)


sheet(
    [
        ("01-original-front.png", "Vita nguyên bản"),
        ("03-style04-front.png", "Style 04  /  Lavender Layered Bob"),
    ],
    "So sánh chính diện",
    "Vita-Style04-Comparison.jpg",
)
sheet(
    [
        ("02-original-left35.png", "Vita nguyên bản"),
        ("04-style04-left35.png", "Style 04  /  Lavender Layered Bob"),
    ],
    "So sánh góc trái 35°",
    "Vita-Style04-Comparison-35.jpg",
)
