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
