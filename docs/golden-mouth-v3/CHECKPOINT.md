# Golden Mouth V3 M01 — Stage A, chưa sculpt / chưa acceptance

Ngày 09/11/2026. Nhánh work/female-golden-mouth-v1-qa. PR #26 OPEN/Draft.
HEAD thực đã kiểm tra: 99067f2b6db54fb03e5346ba3b64ceef2f6a8cc0.
Golden Eye V8 diff rỗng so 1a0ba6e4fd8a1a0e76453a2e698fb9fcc5746576.

Nguồn duy nhất cho tọa độ V3: GLB gốc, KHÔNG dùng tọa độ key V2/V2.1.
- Tệp local: /workspace/scratch/e27dffa28e71/upload/Female_anime_origin(6).glb
- Library nguồn: libfile_ddddbd8676a48191a30d5a0a27574ab4.
- SHA-256: b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90.
- Import Blender thật: 292645 vertices / 499762 triangles.
- Blender /usr/bin/blender 4.3.2; không cài bản khác.
- Golden owner: ảnh 576DB180-B6A4-4EF0-BD99-EE6183F85C1A(3).jpeg, ô trái trên.
- V2/V2.1 chỉ lịch sử: libfile_8c7edd0bc63c8191880baca7a6cb33a7 /
  libfile_4743c82e6a0081919d5d651c5feeef2b. Evidence V2.1 đã phục hồi từ
  libfile_77ef94b4fec08191ade3437f22decf4d.

## Tái tạo Stage A

```
blender --background --factory-startup --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v3/inspect_basis.py -- \
 /path/Female_anime_origin.glb /path/v3/diagnosis
```

Script import mới, kiểm SHA/count, lưu Basis + M01_Natural_V3 chưa biến dạng,
original-surface.npz và import.json. Không cần checkpoint V2 để tái tạo.

## Chẩn đoán và kế hoạch trước sửa

Đã đọc QA V2/V2.1 và source sculpt. Clay gốc có môi nổi thật, lip roll, khóe
cười và má liên tục. V2 nén rộng cả da quanh khóe làm mất phân bố curvature;
V2.1 averaging/fitting giảm lỗi số nhưng xuất hiện vệt chuyển tiếp và bó khóe.
Không tái sử dụng những trường biến dạng đó.

Hướng V3: các cụm landmark giải phẫu điều khiển Blender Laplacian Deform,
biên quanh miệng được giữ cố định. Solver giữ differential detail của bề mặt gốc,
không average geometry và không tạo hình môi bằng hàm. Working copy dùng để solve,
chuyển displacement về IDs gốc; không thay topology ở head xuất cuối.
Phải kiểm tra công cụ thực chạy được, sau đó clay/front mới đánh giá chất lượng.
Đây là kế hoạch thử có giới hạn, không khẳng định đạt artist quality.

Chỉ một lượt đầu + một lượt correction nếu có triển vọng. Nếu vẫn pinch/crease,
dừng Visual FAIL, giữ V2 preview. Không làm preset khác hoặc sửa kiến trúc.

## Stage B — trước render

Công cụ Blender Laplacian Deform đã bind và solve thật, 6891 đỉnh working copy;
head gốc vẫn 292645/499762. Tạo M01_Natural_V3 từ import mới. 14 cụm landmark,
1385 boundary pins. Geometry có 2 tam giác đổi hướng >90° cần kiểm tra; chưa PASS.
Không dùng smoothing hoặc fit mặt thay thế. Tệp .blend lưu cả solver copy ẩn và
marker điều khiển; copy này không render/export như một phần mặt.

```
blender --background --factory-startup --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v3/sculpt_m01.py -- \
 --source /path/Female_anime_origin.glb \
 --controls scripts/golden-mouth-v3/landmarks.json --output /path/iteration-01
blender --background --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v3/render_native.py -- \
 /path/iteration-01/M01-Natural-V3.blend /path/iteration-01 clay front mouth
```

## Stage C — correction đã lưu, trước gate cuối

Iteration 01 .blend đã lưu Library: libfile_47e38d51d09881919608f59bf2735d9f.
Đã mở lại kiểm: Basis = GLB gốc, UV/connectivity đúng, hai keys; chỉ head render.
Iteration 02 dùng `landmarks-correction.json`, cùng script và GLB gốc. Không stack
lên iteration 01. Công cụ quay cụm khóe ±25° và thêm guard seam bên trong.
Còn 1 tam giác quay hơn 90° (dot≈−.0435), chưa bỏ qua; chưa visual PASS.
Lệnh tái tạo như Stage B, thay controls bằng landmarks-correction.json, output iteration-02.
Chỉ còn gate/render/report; không thử iteration 03.
