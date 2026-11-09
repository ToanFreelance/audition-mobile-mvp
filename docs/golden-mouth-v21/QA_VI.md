# Golden Mouth V2.1 M01 — Visual FAIL

**Bản thử iteration 04 chưa đạt cổng mỹ thuật. Không tích hợp vào route QA.**
Môi dưới bớt nhô và nếp ngang ngắn hơn, nhưng khóe còn bó, upper contour còn sắc,
có vệt chuyển tiếp mới ở da bên môi. Chưa đủ thuyết phục so với Golden.
Dừng theo strict gate; V2 vẫn là runtime cũ, không đồng nghĩa owner chấp nhận V2.

## Root cause và cách thực hiện

Đã chẩn đoán bằng material gốc, clay bỏ normal map, normal tính lại, albedo với
specular=0, một đèn định hướng và silhouette. Nếp khóe vẫn còn trong clay:
nén ngang/dọc V2 tác động cả vùng đỡ quanh miệng là nguyên nhân hình học chính.
Điểm trắng môi dưới và viền sáng môi trên còn khi bỏ specular/normal map: một
phần highlight đã baked vào base color. Không bẻ mesh để xóa pigment/ánh sáng này.
Chi tiết: `ROOT_CAUSE_VI.md`, `evidence/diagnostic-grid.jpg`.

Blender 4.3.2 thật, shape key riêng trên native mesh. Không cắt ellipse, không
retopology hoặc ghép dải môi. Giữ Basis và V2 key nguyên vẹn. Lượt cuối:
- Nới vùng lateral theo landmark (không resize đầu), giữ vị trí miệng.
- Giảm projection riêng lower volume và upper roll, giữ seam gần kín.
- Curvature-aware relaxation ngoài commissure bằng fit quadratic lân cận bề mặt
  thực; khóa seam, tách hai phía. Chỉ dịch đỉnh hiện có, không tạo mặt vá.
- Nhóm các đỉnh trùng vị trí để tính toán; không weld/delete vertex thực.
- Bỏ phép phục hồi tọa độ dọc má quá rộng của các lượt trước.
- Không sửa UV, texture hay material. Vertex groups gồm cả mask hướng dẫn không
  kích hoạt trong lượt cuối. Đây là deformation theo vùng, không thao tác brush thủ công.

Iteration 01/02 thất bại do graph averaging không bảo toàn độ dốc trên mesh mật độ
không đều và khóa seam chưa đúng, có mặt đổi hướng. Iteration 03 hết đảo mặt nhưng
chuyển tiếp da vẫn xấu. Đã loại cả ba; iteration 04 bắt đầu lại từ đúng V2 iteration 2.

## Kết quả thực

| Kiểm tra | Kết quả |
|---|---|
| Native vertex / triangle | 292645 / 499762, giữ nguyên |
| Đỉnh khác V2 / Basis | 5132 / 6025 |
| Displacement tối đa so V2 | .0046556 đơn vị model |
| Tam giác đổi hướng >90° | 0; dot nhỏ nhất .50015 |
| Basis, V2 key, connectivity, UV, texture packed | Mở lại và so sánh tuyệt đối PASS |
| Width / IPD | V2 .33545 → V2.1 .36900; Golden xấp xỉ .367 |
| Lower-volume landmark depth | .252860 → .250060 |
| Upper-roll landmark depth | .271968 → .270768 |

Landmark source/pixel và sai số ở `LANDMARKS_VI.md`. Golden chỉ có chính diện,
không thể suy ra projection 3D chuẩn từ minh họa. Khớp width không đồng nghĩa khớp biểu cảm.

## Cổng mỹ thuật

| Tiêu chí | Nhận xét |
|---|---|
| Flat skin patch / môi dây | Không thấy kiểu lỗi V1; native surface được giữ |
| Nếp kéo ngang khóe | Ngắn hơn, nhưng kết thúc còn bị bó: chưa đạt |
| Lower lip | Bớt nhô nhưng còn đầy hơn cảm giác Golden |
| Upper contour / Cupid | Roll và viền sáng baked còn sắc: chưa đạt |
| Pinching / pursing | Chưa thả lỏng như Golden |
| Shading seam mới | Vệt chuyển tiếp mảnh ở da bên môi, rõ ở crop: chưa đạt |
| Identity | Giữ đầu, mũi, cằm và mắt; không redesign |
| Front / cả hai 35° | Chưa thuyết phục tại khóe/roll |
| Gần Golden hơn V2 | Width gần hơn, mỹ thuật tổng thể chưa đủ để PASS |

Đã xem đủ front, trái/phải 35°, profile, mouth, clay và crop phóng lớn. Không promote
iteration 04; không tuyên bố production-ready hay owner acceptance. Không làm M02–M09.

## Render và runtime

Cycles CPU thật: Blender 4.3.2, 8 threads, 64 samples, 680×760, không denoise.
So sánh gốc/V1/V2/V2.1 cùng camera, ánh sáng và scale. Mắt V8 trong render cuối
xuất từ module Three.js hiện có. Golden crop nguyên reference được scale đều theo
IPD và căn đồng tử; không warp, paint hoặc blur kết quả.

**WebGL2 V2.1: NOT RUN vì Visual FAIL; không phải renderer BLOCKED.** Không có
framebuffer, shader compile/link hoặc preview iPhone V2.1 mới. Không lấy PASS V2
cũ làm bằng chứng cho V2.1. Export buffer bằng Node chỉ phục vụ Cycles.
Route `/qa/female-golden-mouth-v2/index.html` vẫn giữ nguyên V2.

V8: diff thư mục mắt so baseline `1a0ba6e4fd8a1a0e76453a2e698fb9fcc5746576` rỗng;
export xác minh không giao vùng mắt/miệng. Chưa chạy lại blink/expression/buffer
identity trong browser vì không qua artistic gate. Restore Basis/V2 trong Blender
đã kiểm chứng, không gọi đó là runtime restoration PASS.

## Checkpoint, tệp và phạm vi

Nhánh `work/female-golden-mouth-v1-qa`, PR #26 giữ OPEN/Draft, không merge.
Baseline b9be09dfee1de8203bd1edfa9c4629ec2d7596b4; checkpoint chẩn đoán e3a415d;
checkpoint script trước render cuối 8e339fb. Chỉ thêm `scripts/golden-mouth-v21/`
và `docs/golden-mouth-v21/`. Không sửa public route, V8, gameplay, catalog,
WebAudio, Gauge, RoomState, Stage hoặc Shop. GLB gốc không commit.

Nguồn SHA-256: b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90.
V2 baseline editable: libfile_8c7edd0bc63c8191880baca7a6cb33a7.
V2.1 iteration 04: libfile_4743c82e6a0081919d5d651c5feeef2b, 54,493,284 bytes;
SHA-256 6492dae47c16bd4702752c532b419f323bd70735581838f58cc23d52a0086ac4.

Ngày 09/11/2026 tiếp tục sau gián đoạn: tệp tạm cuối phiên trước đã mất. Đã khôi
phục script từ commit 8e339fb và .blend iteration 04 đã lưu, hash đúng; dựng lại
render từ checkpoint. Không sculpt lại từ đầu. Xem `evidence/reopen-verification.json`.
Lệnh sculpt/export/render đầy đủ ở `CHECKPOINT.md`; mở lại kiểm chứng:
```
blender --background --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v21/verify_checkpoint.py -- \
 /path/M01-Native-V2-Iteration-02.blend \
 /path/M01-Native-V21-Iteration-04.blend /path/reopen-verification.json
```

Điểm dừng: phải sửa commissure, upper roll và chuyển tiếp da trước khi tích hợp.
Không tiếp tục tăng preset để bù cho M01 chưa đạt.
