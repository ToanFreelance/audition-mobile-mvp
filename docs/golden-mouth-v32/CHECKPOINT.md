# M01 V3.2 — checkpoint ban đầu

Ngày 09/11/2026 (Việt Nam). Nhánh work/female-golden-mouth-v1-qa; HEAD trước task
473e3ca837007afd6fc0ca8bd5ad5de92f4f28fe. PR #26 đã kiểm OPEN/Draft, không merge.
Blender /usr/bin/blender 4.3.2. Accepted V8 diff rỗng so 1a0ba6e4fd8a1a0e76453a2e698fb9fcc5746576.

V3 là nền chính, không tiếp tục biến dạng V3.1:
- Input V3 libfile_b9f3f69b851881919c97804b45a158ea; SHA e0862f84330901f3cbe1dfa4e9deba47a12e7a8dc3e4c6c3e1091f144acdf0bf.
- Input V3.1 chỉ đối chiếu libfile_a501a8480b7c8191863aaf1a389fb245; SHA dac46039732b674d86349409c6f78da12f5d629321bbd318cdc4a5022fcdd4f9.
- GLB upload/Female_anime_origin(6).glb, SHA b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90.
- Golden owner upload/576DB180-B6A4-4EF0-BD99-EE6183F85C1A(3).jpeg, ô M01 trên trái.
Tất cả hash đã kiểm. Local ROOT=/workspace/scratch/e27dffa28e71/m01-v32; input nằm ROOT/input.

Đã đọc chỉ dẫn dự án, QA V3/V3.1, source refinement; xem sáu góc, clay/phóng lớn,
profile và mặt cắt. Stage01 tạo key M01_Natural_V32 bằng đúng V3, Basis/V3 bất biến.

## Chẩn đoán trước sculpt

V3.1 lấy chênh tọa độ gốc−V3 theo từng đỉnh rồi cắt positive-depth, dùng mask theo
height nguồn và diffusion trên graph không đều. Độ nhô trung bình tăng nhưng trường
sửa vẫn giữ chi tiết không mong muốn của chênh biến dạng; biên mask và graph tạo
thay đổi gradient không ổn định. UV split đã được đồng bộ nhưng gợn vẫn còn; render
bỏ custom normals vẫn có gợn. Vì vậy không dùng lại trường này hoặc averaging mesh.

V3.2 sẽ dùng trường dịch chuyển C2 tần số thấp được điều khiển bởi các cụm hỗ trợ
giải phẫu; hướng dựa mặt da lân cận được fit bậc thấp, không lấy từng pixel/pigment
hoặc chênh depth native làm amplitude. Duy trì độ nhô lip gần V3.1, thêm mô đỡ quanh
môi. Mask mũi height>=.378 được khóa chính xác và biên chuyển tiếp sẽ được kiểm.
Sửa seam riêng bằng tọa độ native, giữ UV/ID. Không sửa texture để che lỗi.

Chưa visual/geometry PASS. Chỉ một lượt đầu và một correction mỹ thuật nếu cần;
kiểm hình học thật trước khi quyết định runtime. GLB gốc không commit.

## Lượt 01 và correction tập trung
Lượt 01 .blend đã lưu: libfile_801f50132ea48191873ec0a90c7d69a0,
SHA 7b97129f8eab5b1324696008d051baa2504da08a6f4cb3d4bca36af41205ede9.
Mở lại xác minh Basis/source, V3, UV và material; mũi/UV split chính xác.
Clay lượt 01 hết gợn V3.1; khóe vẫn sắc, vùng translation-only seam gây lõm và
face 412066 bị xoay >90° tại rìa. Không chấp nhận.

Correction duy nhất giữ nguyên trường thể tích. Fit positive affine map từ vòng
bề mặt thực quanh seam để tiếp khớp tangent thay vì giữ một đảo native chỉ tịnh tiến.
Vùng outer commissure (không qua seam giữa) fit quadratic cục bộ với mức chỉnh
capped .0008, mask C2. Không nén width, không diffusion mesh. Render/verify lại.

## Kiểm tra liên tục của correction
Phát hiện hard clamp trong giới hạn displacement commissure gây gãy gradient dù
mask C2. Sửa duy nhất clamp thành .002*tanh(delta/.002), không thay control-volume,
mask hoặc tiếp tục tuning anatomy. Lưu iteration03 riêng, không ghi đè iteration02.
Nếu mảng curvature vẫn còn, dừng Visual FAIL. Đây là sửa lỗi tính liên tục trong
cùng lượt correction, không thêm thiết kế miệng.

## Checkpoint cuối và phục hồi

Iteration03 (sửa liên tục của cùng correction) đã lưu: libfile_b23cc9d3507c8191acda5e4d1ca77fce.
SHA cd53bb6d1fd7d0178300958d47c73511fc253e7a68b8fc57aad5ebd5345401c7,
55134315 bytes. Mở lại kiểm với GLB và V3: Basis/V3/UV/topology/texture đúng,
zero face >90°, zero suy biến/giao cắt perioral, mũi/UV split delta=0.
Iteration02 lịch sử: libfile_42f2fcf1b12081919058a3a982ec4265,
SHA ddf7016c719e315e2eacecce86a0595adfa33006ef5a0c82fafb6419f9479c70.
Không ghi đè bản trước.

Kết luận cuối vẫn VISUAL FAIL: gợn nhân trung đã hết rõ, mô đỡ đầy hơn V3.1,
nhưng khóe chưa tròn và có một facet nhỏ dưới khóe phải. Không runtime/WebGL2,
không preview V3.2. V3 sạch và V2 preview giữ nguyên; không làm M02–M09.

## Lệnh thực đã chạy

CWD=/workspace/scratch/e27dffa28e71/audition-mobile-mvp;
ROOT=/workspace/scratch/e27dffa28e71/m01-v32. Dưới đây dùng đường dẫn rút gọn
để có thể chuyển workspace; thay ROOT bằng thư mục làm việc thực.

```bash
blender --background --factory-startup --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v32/inspect_baselines.py -- \
 ROOT/input/M01-Natural-V3-Iteration-02.blend \
 ROOT/input/M01-Natural-V31-Iteration-04.blend ROOT/diagnosis
blender --background --factory-startup --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v32/sculpt_m01.py -- \
 --v3 ROOT/input/M01-Natural-V3-Iteration-02.blend --output ROOT/iteration-01
blender --background --factory-startup --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v32/correct_continuity.py -- \
 --v3 ROOT/input/M01-Natural-V3-Iteration-02.blend --output ROOT/iteration-03
blender --background --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v32/verify.py -- \
 ROOT/input/M01-Natural-V3-Iteration-02.blend \
 ROOT/iteration-03/M01-Natural-V32-Iteration-03.blend \
 /path/Female_anime_origin.glb ROOT/verify03.json
blender --background --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v3/render_native.py -- \
 ROOT/iteration-03/M01-Natural-V32-Iteration-03.blend ROOT/iteration-03 \
 clay mouth left35 right35 profile front
blender --background --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v32/sample_profiles.py -- \
 ROOT/input/M01-Natural-V3-Iteration-02.blend \
 ROOT/input/M01-Natural-V31-Iteration-04.blend \
 ROOT/iteration-03/M01-Natural-V32-Iteration-03.blend ROOT/profiles03
python3 scripts/golden-mouth-v32/plot_profiles.py ROOT/profiles03 evidence
python3 scripts/golden-mouth-v32/curvature_audit.py \
 ROOT/diagnosis/baselines.npz ROOT/profiles03/geometry.npz evidence/curvature.json
python3 scripts/golden-mouth-v32/make_sheets.py ROOT Golden.jpeg evidence
```

`correct_m01.py` tái tạo iteration02 trước sửa hard-clamp; chỉ lịch sử chẩn đoán.
`correct_continuity.py` là source cuối. Cả hai đều mở V3 mới, không stack V3.1 hoặc
iteration01. Hash .blend tái tạo có thể khác do metadata Blender; phải so tọa độ/key,
UV và topology bằng verify.py, không coi hash khác là geometry khác ngay.

Baseline v3/v31 trong ROOT được render bằng cùng render_native.py, đủ sáu góc;
chọn key được lưu trong mỗi checkpoint. Mọi Cycles ở đây CPU 64 samples, không
denoise. Phép diagnostic xóa custom normals dùng script generic
scripts/golden-mouth-v31/diagnose_normals.py với input .blend V3.2, không lưu đè file.

Các checkpoint Git: 5d2fc5c (nguồn/chẩn đoán), 7aeeb9a (support đầu),
3fe2a92 (seam/commissure correction), 19628d1 (sửa clamp, trước render cuối).
Tất cả nằm trên cùng work branch. Scripts/diagnostic nhỏ trong Git, PNG/data/logs
lớn trong ZIP lưu riêng; original GLB không commit.

ZIP cuối: libfile_a27e36a3ef248191b4aa00b4f1b7dc21,
Golden-Mouth-V32-M01-Visual-FAIL-Evidence.zip, 52602742 bytes,
SHA 0bef8da09a92a95c9f9ae982ddf7786197e3d324263ff51485a535a8718eefd5.
55 mục, CRC và PNG đã kiểm trước upload; lưu thành công. ZIP chứa các render gốc
V3/V3.1/V3.2 và dữ liệu diagnostic để không phải render lại chỉ để đọc bằng chứng.
