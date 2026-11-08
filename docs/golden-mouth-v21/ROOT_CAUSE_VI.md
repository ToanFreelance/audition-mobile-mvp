# Chẩn đoán V2.1 trước khi sculpt

Ngày 2026-11-08. Baseline đã xác minh: b9be09dfee1de8203bd1edfa9c4629ec2d7596b4,
PR #26 OPEN/Draft, nhánh work/female-golden-mouth-v1-qa. Blender 4.3.2.
Mở đúng M01-Native-V2-Iteration-02.blend; không dùng iteration 1.
Nguồn GLB SHA-256 b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90.

## Phép thử đã chạy, chưa sửa mesh

`diagnose.py` mở checkpoint và render Cycles CPU 32 samples, 680×760,
không denoise. Giữ camera, exposure và ánh sáng V2 cho ba phép loại trừ đầu:
material gốc; clay không normal map; clay với normal hình học tính lại.
Thêm albedo + roughness .8/specular 0, clay một đèn định hướng và silhouette.
Không lưu đè checkpoint. File material-audit.json ghi node/link gốc.

| Lỗi | Bằng chứng và nguyên nhân | Hướng sửa |
|---|---|---|
| A: nếp kéo ngang khóe | Còn trong clay và sau xóa custom normals. Clay một đèn làm nếp rõ hơn; bản gốc có đường chuyển tiếp ít ngang hơn. Nén ngang/dọc V2 kéo cả vùng đỡ quanh khóe, không chỉ môi. | Giới hạn theo vùng commissure/perioral, phục hồi độ cong đỡ và relaxation có biên; giữ seam. |
| B: môi dưới đầy | Khối và bóng dưới môi tồn tại trong clay, là hình học. Điểm trắng giữa môi vẫn tồn tại khi specular=0 và bỏ normal map: một phần highlight đã baked. | Giảm độ nhô khối có kiểm soát, không biến dạng để xóa highlight texture. |
| C: viền trên sắc | Clay vẫn có lip roll gắt; thay custom normal không xóa lỗi. Viền sáng còn trong phép albedo-only: texture làm sắc thêm. | Relax riêng roll và hai đoạn bên; giữ Cupid nhẹ, chưa sửa texture khi chưa đánh giá geometry mới. |
| D: hơi chúm/căng | Tỷ lệ chiều rộng nhỏ đi và hai khóe bị ép; xuất hiện trong clay và material. Không do camera: đối chiếu cùng projection. | Nới vùng lateral có giới hạn, không tiếp tục thu nhỏ toàn miệng; giữ hở môi gần bằng 0. |

Các kết luận là phân tích hình ảnh, không khẳng định đã sửa hay đạt visual gate.
Custom normal nguồn có tồn tại, nhưng không phải nguyên nhân chính của A–D.
Normal map/roughness có thể tăng tương phản chi tiết, không giải thích được lỗi còn trong clay.
Không đổi ánh sáng để làm mất nếp. Không sửa mắt, mũi, tỷ lệ đầu hay catalog.

## Phục hồi

V2 giữ nguyên tại Library libfile_8c7edd0bc63c8191880baca7a6cb33a7.
Chạy: `blender --background --threads 8 --python-exit-code 1 --python scripts/golden-mouth-v21/diagnose.py -- /path/M01-Native-V2-Iteration-02.blend /path/diagnostics`.
Bước tiếp: tạo shape key V2.1 riêng, lưu checkpoint rồi render trước mọi tích hợp runtime.
