# Golden Mouth V3 M01 — VISUAL FAIL

Ngày 09/11/2026. **Dừng sau một lượt sculpt và một lượt sửa có mục tiêu.** V3
không được đưa vào runtime. Owner chưa chấp nhận V1, V2, V2.1 hoặc V3.

V3 giữ khối môi liền mặt và giảm rõ nếp ngang dài của V2, nhưng hai khóe vẫn
lõm nhọn, có dáng móc của nụ cười gốc. Môi trên còn gờ sáng/khối roll rõ; môi
dưới bớt nhô nhưng biểu cảm chưa thả lỏng. Width gần Golden không giải quyết
được những lỗi này. Không kết luận V3 đẹp hơn V2.1 về tổng thể.

## Nguyên nhân và phương pháp thực tế

Đã đọc chỉ dẫn dự án, QA/source V2 và V2.1; xem clay, material, cận cảnh, Golden.
GLB gốc có lip roll và độ lồi môi thật, khóe nâng khoảng .0108 đơn vị so seam.
V2 nén ngang/dọc làm căng vùng đỡ quanh miệng. V2.1 thêm relaxation nhưng khóe
vẫn bó và xuất hiện chuyển tiếp da chưa tự nhiên. V3 không dùng tọa độ của hai bản đó.

Mỗi lượt V3 import mới GLB đúng SHA, rồi dùng **Laplacian Deform thực của Blender**
với cụm điều khiển giải phẫu: Cupid, upper/lower center và lateral, commissure,
seam, philtrum/labiomental pins. Modifier đã bind/solve; không chỉ sinh môi bằng
hàm width/thickness. Bản solver gồm tam giác native, giữ biên và differential detail.
Các điểm trùng tại UV split được gom ở bản solver; mesh đầu thực không weld/cắt.
Displacement được chuyển về đúng ID nguồn và lưu thành `M01_Natural_V3` riêng.

Đây là chỉnh bề mặt native bằng landmark/modifier trong Blender, **không phải
sculpt brush thủ công**. Bản solver ẩn `AUTHORING_ONLY_LaplacianSurface` và các
marker được giữ để chỉnh sửa; chỉ `node_0` được render. Không ghép da/môi mới.

Lượt 1: 14 cụm, 1.385 boundary pins; clay còn nụ cười móc. Lượt sửa duy nhất:
quay cụm commissure ±25° theo tiếp tuyến quan sát được, hạ tâm khóe và thêm bốn
guard ở seam sâu. Không giảm chiều rộng thêm; không stack lên lượt 1.
Kết quả vẫn giữ relief khóe quá sắc. Solver bảo tồn cấu trúc gốc chưa đủ để
tái tạo chỗ kết thúc môi mềm; một mặt nhỏ trong seam đổi hướng quá 90°.

## Hình học, UV và vật liệu

| Phép kiểm thực tế | Kết quả và giới hạn |
|---|---|
| Nguồn | SHA-256 `b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90` |
| Native mesh | 292.645 đỉnh / 499.762 tam giác, ID/connectivity giữ nguyên |
| Basis và UV | Mở lại file lưu, so trực tiếp với GLB: khớp tuyệt đối; max UV difference = 0 |
| Shape keys | Chỉ `Basis` và `M01_Natural_V3`; Basis gốc không đổi |
| Đỉnh thay đổi | 5.956; displacement tối đa .0141565 đơn vị model |
| Tam giác bị ảnh hưởng | 11.311; không có mặt suy biến dưới ngưỡng diện tích 1e-14 |
| Cảnh báo mặt đổi hướng | **1**: face 411680, IDs 246960/247541/247548; normal dot −.043537 |
| Diện tích mặt cảnh báo | Gốc 1.8871e-8 → V3 7.8462e-8; nhỏ nhưng không bỏ qua |
| Thay đổi góc giữa mặt kề | p95≈3.99°, p99≈9.81°, max≈114.86°; cảnh báo curvature cục bộ |
| Texture | Cả ba packed image có bytes SHA giống texture nhúng GLB |
| Material | Giữ material/UV gốc; không sửa pigment, roughness hoặc normal map |
| Giới hạn bảo toàn gần mũi | Vùng probe height>.38, abs(x)<.02, depth>.28 có 135 đỉnh dịch, tối đa .0002203; không được coi toàn bộ mũi bất biến tuyệt đối |

`surface-audit.json` có tọa độ landmark thực, thành phần dịch theo normal/tangent,
area ratio và chỉ báo curvature rời rạc. Đây không phải chứng minh bề mặt đẹp hoặc
không tự giao. Chưa làm kiểm tra self-intersection toàn diện. Không ghi Geometry PASS
tổng thể khi còn mặt seam quay quá 90°.

Clay bỏ toàn bộ albedo/normal-map/roughness nguồn vẫn lộ hõm khóe và gờ upper roll:
đây là vấn đề hình học, không thể chữa bằng texture. Render albedo emission mới
loại hoàn toàn ánh sáng/specular/normal map vẫn còn đốm trắng môi dưới và pigment
đậm ở hai khóe. Những chi tiết đó baked trong base color; chúng làm lỗi hình học
dễ thấy hơn. Không bẻ mesh để xóa pigment. Không sửa texture khi geometry chưa đạt.
Phép chẩn đoán không lưu đè material trong .blend.

## Tỷ lệ và reference

Golden M01 nguyên bản 1122×1402, ô trên trái. Đồng tử (156,315)/(276,315),
khóe (195,405)/(239,405), seam (217,406), đáy mũi (217,378), cằm (217,450).
Sai số đo khoảng 1–2 px ở môi, 2 px ở đồng tử. Golden không cung cấp depth 3D.

| Đại lượng | Gốc | V2 | V2.1 | V3 thực | Golden |
|---|---:|---:|---:|---:|---:|
| Width / IPD | .430 | .335 | .369 | .374 | ≈.367 |
| Độ nâng landmark khóe / IPD | .045 | ≈.002 | — | −.004 | ≈.008 ±.017 |
| Depth khối môi dưới | .25435 | .25286 | .25006 | .24952 | Không suy ra từ ảnh |

Ở V3: Cupid surface peak → seam ≈.0666 IPD; seam → lower-border landmark ≈.0804.
Các điểm bề mặt này không đồng nhất biên vermilion/pigment. Tọa độ trung tâm
miệng, mũi/cằm và tỷ lệ đầu không được ép theo minh họa. Quan trọng: landmark khóe
đã hạ nhưng phần tiếp tuyến lân cận vẫn gợi cười, nên chỉ đo hai đầu là không đủ.

## Cổng mỹ thuật — 10 câu trả lời

| Câu hỏi | Đánh giá qua render thật |
|---|---|
| 1. Miệng liền tự nhiên với mặt? | Liền về bề mặt, nhưng termination khóe chưa tự nhiên: chưa đạt toàn bộ |
| 2. Có vùng mặt bị cắt/vá? | Không thấy vùng cắt phẳng/miếng vá kiểu V1 |
| 3. Môi có khối 3D thuyết phục? | Có thể tích native, không dây/ribbon; tỷ lệ và roll vẫn cần chỉnh |
| 4. Khóe mượt, hợp giải phẫu? | **Không**: hai hõm còn sắc, có pinching |
| 5. Hết nếp ngang nhân tạo? | Nếp dài kiểu V2 giảm rõ; còn termination/gấp ngắn sắc ở khóe |
| 6. Môi dưới đúng tỷ lệ? | Bớt nhô nhưng khối/contour chưa tinh tế như Golden |
| 7. Môi trên mềm, không gờ sắc? | **Chưa**: Cupid/roll còn gờ sáng rõ trong clay và material |
| 8. Trung tính, thả lỏng? | **Không**: còn cảm giác cười nhẹ/giữ môi |
| 9. Đẹp ở front và cả hai 35°? | Chưa đủ thuyết phục ở front; 35° vẫn lộ contour cứng |
| 10. Gần Golden hơn V2/V2.1 rõ rệt? | Một số điểm tốt hơn, nhưng chưa có cải thiện tổng thể đủ để PASS |

Nhận diện đầu/mũi/cằm vẫn tương tự khi xem render; không có nhân vật thay thế.
Tuy nhiên, solver có residual nhỏ ở vùng sát đáy mũi như bảng trên; mask hiện tại
chưa bảo đảm khóa tuyệt đối toàn bộ mũi. Đây là hạn chế cần sửa trước khi nghiệm thu,
không phải lý do để thay tiếp hình học sau giới hạn hai lượt. **VISUAL FAIL**
vẫn là kết luận. Không có owner acceptance. Không thử lượt thứ ba hoặc M02–M09.

## Render và phạm vi QA

Blender **4.3.2**, Cycles **CPU**, 8 threads, 64 samples, 680×760, Standard view,
không denoise/retouch. Sáu góc: front, trái/phải 35°, profile, mouth và clay.
Các bản 3D dùng cùng camera, exposure và hai đèn area như V2/V2.1. Golden crop,
scale đều theo IPD, căn đồng tử; không warp hoặc vẽ lại. Cận cảnh có crop 1:1.

- [Original/V1/V2/V2.1/V3/Golden](evidence/original-v1-v2-v21-v3-golden.jpg)
- [Sáu góc V3](evidence/v3-six-views.jpg)
- [So clay](evidence/clay-comparison.jpg)
- [Cận cảnh V2/V2.1/V3](evidence/v2-v21-v3-enlarged.jpg)
- [Chẩn đoán albedo](evidence/albedo-diagnostic.jpg)

Native .blend giữ mắt gốc. Bộ so sánh cuối dùng buffer V8 xuất ngoại tuyến từ
module Three.js hiện có để render Cycles; không thay file mắt và không phải WebGL2.
Diff `public/qa/female-golden-eye-v8` so accepted baseline
`1a0ba6e4fd8a1a0e76453a2e698fb9fcc5746576` rỗng. Node export đã assert vùng mắt
và 5.956 đỉnh miệng không giao nhau. Đây là kiểm tra dữ liệu, không phải browser QA.

**WebGL2 V3: NOT RUN do Visual FAIL**, không phải renderer bị BLOCKED.
Không kiểm shader/framebuffer, blink/expression, switching/restoration hoặc buffer
identity trong browser cho V3. Không có hardware GPU/iPhone Safari PASS.
Không có preview V3 mới. Route `/qa/female-golden-mouth-v2/index.html` giữ nguyên V2.

## Checkpoint và giới hạn tiếp theo

Nhánh `work/female-golden-mouth-v1-qa`, PR #26 OPEN/Draft, không merge.
Chỉ thêm/sửa `scripts/golden-mouth-v3/` và `docs/golden-mouth-v3/` trong task này.
Không sửa public/src, gameplay, WebAudio, RoomState, Gauge, Catalog, Stage, Shop.
Không commit GLB gốc hoặc upload Supabase.

- Baseline bắt đầu: `99067f2b6db54fb03e5346ba3b64ceef2f6a8cc0`.
- Import/recovery: `6419422a832e62c445774eb280e5f663f335e8c6`.
- Sculpt lượt 1: `f96f5bc1893344fe53496b5e6368271c70041ae7`.
- Correction trước render: `80cc366d5394648360bb87d460cd08ae5b632d1c`.
- Editable iteration 02: `libfile_b9f3f69b851881919c97804b45a158ea`, đã mở lại.
- [Blender iteration 02](https://chatgpt.com/library?file_id=libfile_b9f3f69b851881919c97804b45a158ea&account_id=personal).
- [PNG gốc, dữ liệu hình học và logs](https://chatgpt.com/library?file_id=libfile_ed16bfefbdb4819195efc026a60a0647&account_id=personal): ZIP đã kiểm CRC, 51 mục, 28.787.334 bytes.

Xem [CHECKPOINT.md](CHECKPOINT.md) cho hash, lệnh và cách tái tạo. Dữ liệu sparse
ở `experimental/` chỉ là bằng chứng thử nghiệm; không dùng làm asset runtime.

Giới hạn thực tế: solver landmark hiện tại chưa điều khiển đủ tinh tế chỗ tiếp
giáp khóe/roll để đạt mỹ thuật yêu cầu. Bước tiếp phù hợp là sculpt tương tác
với kiểm soát cục bộ trực tiếp, có artist chỉnh anatomy và seam rồi xem lại clay
nhiều góc. Hai lượt này không chứng minh mọi workflow headless đều bất khả thi,
nhưng không có cơ sở để tiếp tục đổi vài hằng số và tuyên bố đạt chất lượng.
