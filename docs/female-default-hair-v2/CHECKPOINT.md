# Phục hồi Style 04 V2 — chưa được duyệt

**VISUAL FAIL.** File secondary là blockout thử nghiệm đã dừng; primary là checkpoint chẩn đoán ban đầu. Không dùng hai file này như tóc production hoặc tiếp tục detailing khi chưa có quyết định owner.

| File | ID bền vững | Version |
| --- | --- | --- |
| Female-Default-Hair-Style04-V2-primary.blend | `libfile_8c2a06c42c708191bca2728672da1c32` | 0 |
| Female-Default-Hair-Style04-V2-secondary.blend | `libfile_b1060fccb9a0819186583e22aef772d5` | 1 |

`recovery-manifest.json` ghi hash, ID nguồn, Blender 4.3.2 và các lệnh đầy đủ. V1 không bị ghi đè. Bản secondary đã sửa winding tóc; không thay hình học mặt.

Để phục hồi chỉnh tay: lấy secondary bằng ID ở trên, mở Blender. Collections `STYLE04_V2_PRIMARY` và `STYLE04_V2_SECONDARY` chứa tóc; `Preview_M02_GoldenEyeV8` là mặt preview bất biến. Giữ `node_0`, backup V4 và mắt V8 nguyên trạng. Mỗi lọn chứa custom property `artist_stations` với điều khiển xyz/width/depth.

Để tái tạo final geometry: đặt V1 và V4 vào một thư mục references, giữ đúng tên và hash manifest. Từ repo chạy:

```bash
blender -b -t 8 --python scripts/female-default-hair-v2/author.py -- /absolute/references /absolute/output secondary
blender -b -t 8 --python scripts/female-default-hair-v2/render.py -- /absolute/output/Female-Default-Hair-Style04-V2-secondary.blend /absolute/output/clay clay
blender -b -t 8 --python scripts/female-default-hair-v2/render.py -- /absolute/output/Female-Default-Hair-Style04-V2-secondary.blend /absolute/output/lavender lavender
blender -b -t 4 --python scripts/female-default-hair-v2/validate.py -- /absolute/references /absolute/Female_anime_origin.glb /absolute/output /absolute/output/Female-Default-Hair-Style04-V2-secondary.blend
```

`render.py` cũng nhận V1 `.blend`; giữ nguyên chế độ và camera để tạo đối chứng. Không đổi ảnh tham chiếu hoặc khuôn mặt để làm kết quả có vẻ giống concept hơn.

Lưu ý: `author.py primary` hiện dùng khối chính đã sửa. Muốn đúng checkpoint primary lịch sử phải mở file primary đã lưu bằng ID; không giả định nó là output của source sau lượt refinement. Script final tái tạo hình học xác định; không hứa hash toàn bộ .blend bit-identical do metadata Blender.
