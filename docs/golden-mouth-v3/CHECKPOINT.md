# Golden Mouth V3 M01 — checkpoint cuối, VISUAL FAIL

Đã hoàn tất Stage A/B/C và sáu góc Cycles. Dừng sau iteration 02, không có lượt 03.
Không tích hợp WebGL2; V2 preview giữ nguyên. Các phần Stage A/B bên dưới là nhật ký
checkpoint trước render, không phải trạng thái QA cuối. Kết luận tại `QA_VI.md`.

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

## Checkpoint cuối đã lưu và mở lại

| Tệp | ID lưu bền | Kích thước / SHA-256 |
|---|---|---|
| M01-Natural-V3-Iteration-01.blend | libfile_47e38d51d09881919608f59bf2735d9f | 52.116.710 bytes / cf8dcfa3f2a68a87a73e6207afd8aa85788735db67434af7c1fd1bdaa29a45f3 |
| M01-Natural-V3-Iteration-02.blend | libfile_b9f3f69b851881919c97804b45a158ea | 52.117.816 bytes / e0862f84330901f3cbe1dfa4e9deba47a12e7a8dc3e4c6c3e1091f144acdf0bf |
| Golden-Mouth-V3-M01-Visual-FAIL-Evidence.zip | libfile_ed16bfefbdb4819195efc026a60a0647 | 28.787.334 bytes / fb081022011e8a8a94f440ea01fb6d76c44bdcdb4ab8eda617054148685bc145 |

Iteration 02 mở lại bằng Blender 4.3.2: Basis bằng GLB, connectivity/UV khớp tuyệt đối,
hai keys, ba packed images, chỉ node_0 render. `evidence/reopen02.json` và
`texture-validation.json` ghi kết quả. File lớn không đưa vào Git.
V2/V2.1 lịch sử không bị ghi đè. Sparse data V3 ở `experimental/m01-native.json.gz`.

Các lệnh thực đã chạy (thay đường dẫn tuyệt đối theo môi trường mới):

```bash
blender --background --factory-startup --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v3/sculpt_m01.py -- \
 --source '/workspace/scratch/e27dffa28e71/upload/Female_anime_origin(6).glb' \
 --controls scripts/golden-mouth-v3/landmarks-correction.json \
 --output /workspace/scratch/e27dffa28e71/m01-v3/iteration-02

blender --background --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v3/render_native.py -- \
 /workspace/scratch/e27dffa28e71/m01-v3/iteration-02/M01-Natural-V3.blend \
 /workspace/scratch/e27dffa28e71/m01-v3/iteration-02 clay front mouth left35 right35 profile

blender --background --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v3/verify_native.py -- \
 '/workspace/scratch/e27dffa28e71/upload/Female_anime_origin(6).glb' \
 /workspace/scratch/e27dffa28e71/m01-v3/M01-Natural-V3-Iteration-02.blend \
 /workspace/scratch/e27dffa28e71/m01-v3/verify02.json

python3 scripts/golden-mouth-v3/analyze_surface.py \
 '/workspace/scratch/e27dffa28e71/upload/Female_anime_origin(6).glb' \
 /workspace/scratch/e27dffa28e71/m01-v3/iteration-02/native-sculpt.npz \
 docs/golden-mouth-v3/evidence/surface-audit.json

blender --background --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v3/inspect_material.py -- \
 /workspace/scratch/e27dffa28e71/m01-v3/M01-Natural-V3-Iteration-02.blend \
 /workspace/scratch/e27dffa28e71/m01-v3/material-diagnostic
```

Export ngoại tuyến chỉ để render Cycles với mắt V8 hiện có:

```bash
node scripts/golden-mouth-v2/export_comparison.mjs \
 '/workspace/scratch/e27dffa28e71/upload/Female_anime_origin(6).glb' \
 /workspace/scratch/e27dffa28e71/qa-deps/node_modules/three/build/three.module.js \
 /workspace/scratch/e27dffa28e71/m01-v3/iteration-02/m01-native.json.gz \
 /workspace/scratch/e27dffa28e71/m01-v3/comparison-runtime
cp /workspace/scratch/e27dffa28e71/m01-v3/comparison-runtime/v2.json \
 /workspace/scratch/e27dffa28e71/m01-v3/comparison-runtime/v3.json
ln -s M01-Natural-V3-Iteration-02.blend /workspace/scratch/e27dffa28e71/m01-v3/checkpoint.blend
blender --background --factory-startup --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v3/render_comparison.py -- \
 /workspace/scratch/e27dffa28e71/m01-v3 \
 v3:front v3:left35 v3:right35 v3:profile v3:mouth v3:clay
python3 scripts/golden-mouth-v3/make_sheets.py \
 /workspace/scratch/e27dffa28e71/m01-v3/comparison \
 '/workspace/scratch/e27dffa28e71/upload/576DB180-B6A4-4EF0-BD99-EE6183F85C1A(3).jpeg' \
 docs/golden-mouth-v3/evidence
```

Exporter cũ đặt tên nhãn `v2` cho sparse input; đổi tên manifest thành `v3.json`,
không thay bytes hình học. Script render dựng mesh từ những buffer thực đó.
Đây không phải khởi tạo browser/WebGL2. `comparison/` còn chứa ảnh lịch sử
Original/V1/V2/V2.1 đã phục hồi, cùng camera/light. ZIP bằng chứng cuối giữ PNG
gốc, dữ liệu lượt thử, logs và SHA manifest; scripts/báo cáo nằm trong Git.

Để phục hồi nhanh: tải iteration 02, kiểm SHA rồi chạy verify. Để tái tạo từ đầu:
lấy GLB đúng SHA, checkout nhánh/commit checkpoint, chạy sculpt với correction
controls. Không cần tọa độ V2/V2.1. Bind cache của solver ẩn là tiện ích authoring;
shape key đã lưu độc lập. Khả năng tái dựng sau này dựa vào script + controls và
GLB; hash file .blend tái tạo có thể khác do metadata Blender.

Còn lại về sản phẩm: chỉnh anatomy khóe/upper roll bằng sculpt tương tác và duyệt
clay lại trước mọi texture/runtime. Không tự tiếp tục tăng lượt deformation hoặc
triển khai preset khác. V3 hiện tại chỉ giữ làm bằng chứng thất bại có thể phục hồi.
