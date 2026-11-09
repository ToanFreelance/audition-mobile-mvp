# M01 V3.1 — phục hồi projection, chưa đạt mỹ thuật

**VISUAL FAIL — không tích hợp WebGL2, không thay preview V2.**
V3.1 phục hồi một phần độ nhô và sửa lỗi seam/mũi, nhưng bản cuối còn vệt/gợn
chuyển tiếp phía trên môi, khóe vẫn sắc. Không đánh đổi bề mặt sạch của V3 để lấy
projection. Owner chưa chấp nhận V3.1; giữ cả V3 và các lượt thử để đối chiếu.

## Nguồn và thực hiện

Tiếp tục từ V3 iteration02, không restart sculpt từ GLB. Source SHA và checkpoint
SHA đã đối chiếu đúng trước sửa; chi tiết trong CHECKPOINT.md. Blender 4.3.2 thật.
Basis và M01_Natural_V3 giữ nguyên tọa độ. Tạo key M01_Natural_V31 riêng.

Mất độ nhô không chỉ ở tâm môi: mặt cắt x=0 và x=.04 cho thấy upper roll, lower
volume và vùng hỗ trợ khác nhau. Chỉ cộng Z đều sẽ đẩy cả seam hoặc tạo khối mõm.
Lượt đầu phục hồi 62% phần mất chiều sâu native có mask giải phẫu, hỗ trợ nhẹ
labiomental và lateral. Không thay width/height tổng thể V3. Trường bổ sung được
làm mượt theo cạnh mesh, không averaging tọa độ mặt; giữ amplitude đo được làm
ràng buộc. Các bản này là thao tác bề mặt có kiểm soát bằng Blender Python,
không tuyên bố sculpt brush bằng tay hoặc artist-quality đã đạt.

Sửa seam dùng displacement cục bộ gần đồng nhất trên native triangle fan, giữ
hình dạng vi phân gốc của tam giác; chuyển tiếp mềm ra vùng V3.1. Không chỉ đổi
normal để che mặt đảo. Khóa toàn bộ đỉnh nguồn có local height >= .378 về Basis,
bao gồm mũi và phần đầu phía trên; chuyển tiếp nằm dưới vùng khóa.

## Các lượt đã thực hiện

- Iteration01: tăng support, sửa face 411680, zero mặt >90°, còn 1 cặp giao cắt seam phải.
- Iteration02: regularize trường support, nâng nhẹ commissure; hết giao cắt nhưng
  face 398668 ở rìa vùng seam phải quay >90°: loại.
- Iteration03: mở vùng sửa đủ fan 397033/397043/398668, đạt hướng mặt/giao cắt.
- Iteration04: sửa tính liên tục trường dịch chuyển giữa các đỉnh trùng ở UV split.
  Đây là sửa lỗi kỹ thuật của follow-up, không redesign M01. Vẫn chưa đạt mỹ thuật.

## Kiểm tra file đã lưu và hình học

| Phép kiểm | Iteration04 |
|---|---|
| Vertex / triangle | 292645 / 499762, giữ connectivity và ID |
| Basis và V3 | So với checkpoint mở lại: bằng tuyệt đối |
| UV / ba packed textures | Bằng tuyệt đối checkpoint |
| Face 411680 | normal dot so Basis = 1.0 |
| Mặt ảnh hưởng quay >90° | 0; dot nhỏ nhất .305503 |
| Tam giác suy biến vùng ảnh hưởng | 0 với ngưỡng diện tích 1e-14 |
| Giao cắt không kề trong vùng miệng | Basis 0, V3 5, V3.1 0 |
| Nose preservation mask | 195239 đỉnh, max displacement so Basis = 0 |
| Đỉnh trùng nguồn tại UV | Max chênh tọa độ XYZ sau sửa = 0/0/0 |

BVH kiểm vùng perioral abs(x)<.11, height .275–.40, depth>.18; loại cặp chung đỉnh
và UV split trùng nguồn. Đây là kiểm cục bộ, không phải chứng nhận collision toàn
nhân vật. Đếm hướng mặt dựa tọa độ tam giác thật. Báo cáo máy: evidence/verify04.json.
Không đổi topology hoặc tạo mesh môi/miếng da riêng.

## Projection đo từ mesh thực

| Landmark local Z | V3 | V3.1 |
|---|---:|---:|
| Upper lip center | .265506 | .270209 |
| Cupid trái | .266540 | .269906 |
| Lower volume | .249518 | .253371 |
| Seam giữa | .251016 | .251435 |
| Khóe trái | .244564 | .246626 |
| Khóe phải | .244569 | .246650 |

Đồ thị projection.png lấy giao tuyến tam giác với mặt phẳng x=0 và x=.04, so cả
Basis/V3/V3.1 trong cùng hệ tọa độ. Miệng và mô đỡ ra trước hơn, còn seam chỉ dịch
nhẹ; không phải toàn miệng được tịnh tiến cùng offset. Golden chỉ là reference 2D,
không gán độ sâu 3D giả cho concept. Profile cải thiện độ nhô nhưng không đủ chứng
minh vẻ tự nhiên khi cận cảnh còn lỗi chuyển tiếp.

## Cổng mỹ thuật

| Câu hỏi | Đánh giá |
|---|---|
| Còn cảm giác lõm/móm? | Giảm qua profile và mặt cắt; chưa đủ tự nhiên toàn vùng |
| Mô đỡ quanh miệng tự nhiên? | Có tăng support nhưng gợn phía trên môi: chưa đạt |
| Môi cân đối và liền mặt? | Vẫn native, không ribbon/mảnh vá; tổng thể chưa đạt |
| Khóe mềm và trung tính? | Chưa; còn hõm và contour sắc |
| Nếp ngang V2/V2.1 quay lại? | Không thấy nếp ngang dài kiểu cũ; có lỗi chuyển tiếp khác |
| Môi trên còn sắc? | Có, rõ trong material; chưa đủ mềm |
| Môi dưới đầy tự nhiên? | Đầy hơn V3, không thấy dạng ống; còn cần duyệt tỷ lệ |
| Hai góc 35° thuyết phục? | Projection tốt hơn nhưng chưa đủ để PASS |
| Profile tốt hơn V3? | Độ nhô cải thiện có số liệu; không mặc định mỹ thuật đã đạt |
| Giữ identity? | Giữ head, mắt, mũi; mũi được kiểm bằng tọa độ, không chỉ nhìn |

Đã xem front, hai 35°, profile thật 90°, mouth và clay. Cùng camera/ánh sáng,
exposure, 680×760, Cycles CPU 64 samples, 8 threads, không denoise/paint-over.
Baked pigment/highlight không sửa. Clay không dùng normal map/texture nguồn.
Render native dùng mắt tím gốc trong Blender; không gọi đây là V8 runtime evidence.
V8 code/assets không đổi. Không chạy blink/expression hoặc WebGL2 vì Visual FAIL.
Không có framebuffer, preview V3.1 hoặc physical iPhone PASS.

## Bằng chứng và phục hồi

- evidence/v3-v31-golden.jpg — cùng framing, Golden crop/scale đều.
- evidence/mouth-clay-comparison.jpg — cận cảnh 1:1, không che lỗi.
- evidence/profile-comparison.jpg và projection.png — profile và mặt cắt.
- evidence/six-views.jpg — sáu góc Cycles.
- Editable iteration04: libfile_a501a8480b7c8191863aaf1a389fb245.
- SHA .blend: dac46039732b674d86349409c6f78da12f5d629321bbd318cdc4a5022fcdd4f9.

Chỉ sửa scripts/golden-mouth-v31 và docs/golden-mouth-v31. Nhánh
work/female-golden-mouth-v1-qa, PR #26 giữ OPEN/Draft. Không main/development,
không merge; không gameplay/WebAudio/RoomState/Gauge/Stage/Shop/Catalog/Supabase.
Dừng tại M01. Không promote candidate thất bại; giữ preview V2 và checkpoint V3.

Phép loại trừ bổ sung: xóa custom split normals trong một scene chẩn đoán, render
clay lại (normal-diagnostic.png) vẫn thấy gợn dưới nhân trung. Không phải chỉ texture
hoặc normal map. Không lưu đè .blend bằng scene chẩn đoán. Trường phục hồi/diffusion
hiện tại chưa tạo curvature chuyển tiếp đủ sạch; không sửa bằng tăng projection tiếp.

Tệp bàn giao:
- [M01-Natural-V31-Iteration-04.blend](https://chatgpt.com/library?file_id=libfile_a501a8480b7c8191863aaf1a389fb245&account_id=personal)
- [Golden-Mouth-V31-M01-Evidence.zip](https://chatgpt.com/library?file_id=libfile_a47537e9fb1081919c5c30551be957f3&account_id=personal)
