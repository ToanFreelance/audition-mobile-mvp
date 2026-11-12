"""Đóng gói bằng chứng và bản thử Three.js chạy qua HTTP cục bộ."""

import os, pathlib, zipfile, hashlib, json
from PIL import Image

r = pathlib.Path(__file__).resolve().parents[1]
three = pathlib.Path(os.environ["THREE_DIR"])
vrm = pathlib.Path(os.environ["VRM_PKG"])
stem = "Vita-Premium-Cute-V11"
page = (
    (r / "scripts/web.html")
    .read_text()
    .replace('"/three/', '"./vendor/three/')
    .replace("'/vrm.js'", "'./vendor/vrm/three-vrm.module.min.js'")
    .replace("'/wardrobe.glb'", "'./review/wardrobe.glb'")
    .replace("'/asset.'+mode", "'./out/Vita-Premium-Cute-V11.'+mode")
)
files = [
    r / "README.md",
    *(f for f in (r / "scripts").iterdir() if f.is_file()),
    *(f for f in (r / "review").iterdir() if f.is_file() and f.name != "draft.png"),
]
for f in files:
    if f.suffix in [".png", ".jpg"]:
        Image.open(f).verify()
hashes = {
    f.name: hashlib.sha256(f.read_bytes()).hexdigest()
    for f in (r / "out").iterdir()
    if f.suffix in [".blend", ".vrm", ".glb"]
}
with zipfile.ZipFile(
    r / "out" / (stem + "-Review.zip"), "w", zipfile.ZIP_DEFLATED, compresslevel=6
) as z:
    for f in files:
        z.write(f, str(f.relative_to(r)))
    z.writestr("demo.html", page)
    z.writestr(
        "manifest.json",
        json.dumps({"commit": os.environ["POC_COMMIT"], "sha256": hashes}, indent=2),
    )
    for p in [
        "build/three.module.js",
        "build/three.core.js",
        "examples/jsm/loaders/GLTFLoader.js",
        "examples/jsm/utils/BufferGeometryUtils.js",
        "LICENSE",
    ]:
        z.write(three / p, "vendor/three/" + p)
    z.write(vrm / "LICENSE", "vendor/vrm/LICENSE")
    z.write(vrm / "lib/three-vrm.module.min.js", "vendor/vrm/three-vrm.module.min.js")
    for n in ["install", "export", "verify", "web"]:
        z.write(r / "work" / (n + ".log"), "logs/" + n + ".log")
with zipfile.ZipFile(r / "out" / (stem + "-Review.zip")) as z:
    assert z.testzip() is None
