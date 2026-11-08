# Golden Mouth V2 — M01 Natural

Ngày kiểm tra: 2026-11-08. Phạm vi: M01, trang QA riêng. **Chờ owner duyệt iPhone; không production-ready, không merge.**

## Kết quả và nguyên nhân

V1 dùng ellipse cắt 9.430 tam giác vùng miệng, thay bằng skin fit và vòng môi procedural.
Các ràng buộc topology không đo được chất lượng hình khối; môi nổi thành dải mỏng,
vùng quanh miệng mất độ cong của đầu gốc. V2 bỏ hoàn toàn phương pháp này.

V2 import GLB nguyên bản bằng Blender và chỉnh chính bề mặt môi đã có trong
shape key `M01_Natural_EXPERIMENTAL`. Không xóa/thêm tam giác, không ghép mesh
da/môi, không dùng ellipse thay vùng mặt. Đây là **controlled surface deformation
bằng Blender Python**, không phải tuyên bố sculpt brush thủ công.

Nguồn đính kèm `(6)` khớp SHA-256 của `(5)` trong yêu cầu:
`b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90`.
Import thật: **292.645 vertices / 499.762 triangles**. Blender **4.3.2** có sẵn,
background smoke test PASS; không sử dụng hay giả nhận bản 4.5.3.

## Thực hiện

- Thu bề ngang môi bằng proportional falloff, giảm độ cong khóe cười gốc.
- Nén nhẹ chiều cao môi trên, giữ Cupid's bow và thể tích môi dưới.
- Giảm rất nhẹ độ nhô môi dưới; giữ surface transition sang nhân trung/cằm/má.
- Iteration 1 khóe trễ và môi hơi chúm; đã lưu riêng, không chọn làm kết quả cuối.
- Iteration 2: hạ khóe ít hơn, môi trên mềm và trung tính hơn. Đây là bản bàn giao.
- 6.025 đỉnh đổi; 11.465 tam giác tiếp giáp vùng chỉnh nhưng **không đổi connectivity**.
- Không đổi UV, base-color, normal/roughness textures hay material identity.
  Pigment môi gốc đi theo native UV; không còn pigment cũ bị bỏ lại trên patch.
- Giữ mọi đỉnh ngoài vùng support chính xác. Không có nonfinite vertex hoặc mặt
  vùng chỉnh đổi hướng quá 90°; dot nhỏ nhất 0,79034. Đây là check kỹ thuật,
  không dùng thay cho visual review.
- Export sparse delta và split normals từ Blender evaluated mesh. Đã assert
  thứ tự vertex importer khớp GLB. Gói nén khoảng 173 KiB; không commit GLB gốc.

## Bằng chứng Cycles

Blender Cycles **CPU**, 8 threads, 40 samples native iteration; 64 samples ở
comparison runtime, denoising OFF. Cả nguồn và kết quả có front, trái 35°, phải
35°, profile, mouth close-up và clay. V1 được render lại từ chính buffer của rig
V1, với **cùng camera, tỉ lệ, ánh sáng** như Original/V2.

- `evidence/original-v1-v2-golden.jpg`: nguồn → V1 → V2 → crop Golden M01.
- `evidence/clay-comparison.jpg`: source/V1/V2 không texture/makeup.
- `evidence/v2-six-views.jpg`: đủ sáu góc, V2 cùng mắt V8.
- `evidence/original-six-views.jpg`: source dưới cùng điều kiện.

Golden chỉ crop/rescale theo khoảng cách đồng tử, không vẽ lại. Khác biệt tỉ lệ
đầu/cằm của artwork vẫn hiện rõ; không biến dạng reference để làm kết quả trông
giống hơn. Original giữ mắt gốc; V1/V2 cùng module Golden Eye V8.

## Cổng chất lượng thị giác nội bộ

| Câu hỏi | Kết luận sau xem render thực |
|---|---|
| Mặt còn trông bị cắt phẳng? | Không thấy mảng phẳng thay thế như V1. Độ cong da gốc còn hiện trong clay/profile. |
| Môi giống dây/ống/dải gắn ngoài? | Không; cả hai môi có native volume và chuyển tiếp vào da. |
| Đường ghép patch? | Không có patch; không thấy seam mới quanh môi. |
| Thể tích môi hòa vào mặt? | Có; vẫn giữ rãnh môi dưới và liên kết nhân trung. |
| Giữ danh tính nhân vật? | Có về geometry: đầu/mũi/mắt ngoài vùng chỉnh không thay. |
| Chính diện thuyết phục? | Đủ để owner review M01; không còn khuyết điểm chính của V1. |
| Hai góc 35° thuyết phục? | Môi không nổi rời khỏi mặt; không thấy lỗ/đường vá. |
| Tiến gần Golden? | Có về nét khép miệng trung tính; chưa khớp hoàn toàn độ mảnh, màu và tỉ lệ. |
| Tốt hơn V1 rõ rệt? | Có, nhất là clay: không còn môi dạng dải đặt trên mặt phẳng. |

**Internal integration gate: PASS có giới hạn, chỉ để owner review.** Không phải
chứng nhận nghệ thuật cuối cùng. Không phát triển các preset tiếp theo.

## WebGL2 thực

Chrome Headless Shell **157.0.8103.38**, ANGLE Vulkan **SwiftShader** phần mềm.
Không phải GPU phần cứng, không phải iPhone Safari. `/usr/bin/chromium` lỗi
ProcessSingleton `socket() EPERM`; headless shell chạy được. Playwright URL v151
trả về HTML 195 bytes; tải bản headless shell thật từ Chrome for Testing chính thức.

Đã load GLB thật qua file input, chạy shader Three.js r180 thật, đọc framebuffer
và chụp canvas front/35° hai bên/cận môi/đầu gốc; không thay bằng Node mock.

Regression thực: **18 lựa chọn (9 mắt × M01/miệng gốc)**, giữ nguyên toàn bộ eye
state và blink/expression weights `[0.36, 0.4, 0.24]` khi đổi miệng. Giữ đúng
**3 morph slots V8**, geometry ID và 1 lần nạp GLB. So đầu gốc phục hồi POSITION
và NORMAL đúng SHA-256 raw buffer; vertex/triangle count khớp nguồn.

Các program shader đã LINK thành công; framebuffer có biến thiên pixel; GL error
0, không console/page error. `evidence/webgl-regression.json` là full regression.
Sau đó chỉ cân lại ánh sáng trắng trung tính và kiểm tra framebuffer/restore một
lượt riêng; báo cáo ghi scope riêng, không tính lượt này như thêm 18 tổ hợp.

Ánh sáng đầu tiên làm tối môi trên cả ở nguồn. Một thử fill quá mạnh làm mặt nhạt;
không dùng bản đó làm screenshot bàn giao. Bản cuối giảm ambient/fill, giữ thể tích
quan sát qua Cycles clay; không sửa texture hoặc dựng geometry mới để che lỗi.
Không khẳng định Three.js và Cycles pixel-identical; hai renderer diễn giải light/
material khác nhau. PNG các lần thử được lưu cùng evidence để kiểm tra lại.

Golden Eye V8 source/asset không đổi so với `1a0ba6e4fd8a1a0e76453a2e698fb9fcc5746576`.
`scripts/golden-eye-v8/verify.mjs` PASS, bao gồm chớp mắt, biểu cảm, gaze, 30 switch,
original restore và dispose. Vùng mouth/eye deformation giao nhau **0 đỉnh**.

## Còn hạn chế

- Môi dưới vẫn hơi đầy hơn Golden; môi nhỏ và sắc tố/khóe gốc còn đậm ở cận cảnh.
- Chuyển tiếp hai khóe còn một nếp ngang nhẹ từ phép biến dạng/native surface.
  Không phải patch seam, nhưng owner cần xem trên iPhone trước khi chốt.
- Hình dạng đầu gốc khác artwork; task này không đổi đầu/mũi để ép giống concept.
- Normal/roughness textures gốc được giữ; không claim đã re-bake bộ texture hoàn chỉnh.
- V8 profile eye appearance là baseline hiện có, không chỉnh trong task miệng.
- Chưa kiểm tra GPU/iPhone thật, FPS/thermal/VRAM/Safari; không báo các mục đó PASS.
- Chưa có open-mouth cavity, dental rig, M03/M06 hay các preset khác.

## File và phạm vi thay đổi

`scripts/golden-mouth-v2/`: sculpt, export runtime comparison, Cycles render,
browser QA và hướng dẫn tái tạo.

`public/qa/female-golden-mouth-v2/`: trang M01 riêng, native-mouth module và sparse
geometry package. Giữ nguyên route V1 để không thay đổi bằng chứng đã từ chối.

`docs/golden-mouth-v2/`: checkpoint, báo cáo, contact sheets và diagnostics.
Không đổi gameplay, WebAudio, Gauge, RoomState, multiplayer, catalog, Stage, Shop,
Supabase hoặc bất kỳ source/asset Golden Eye V8 nào.

## Phục hồi và iPhone

Editable `.blend` iteration 2 đã lưu thành công:
`libfile_8c7edd0bc63c8191880baca7a6cb33a7`, `M01-Native-V2-Iteration-02.blend`,
51.719.297 bytes. Iteration 1: `libfile_40c4cab9ef148191bb33f527c5b42aab`.
Các checkpoint đã đẩy: `0ce41ffb`, `c0733dbf`, `8ac89060`, `5e9f02ef`.
Lệnh đầy đủ và asset paths trong `scripts/golden-mouth-v2/README.md`/`CHECKPOINT.md`.

Nhánh: `work/female-golden-mouth-v1-qa`, PR **#26 Draft**, không merge.
Route mới: `/qa/female-golden-mouth-v2/index.html`.
Trên iPhone: chọn GLB gốc trong Tệp, so M01/miệng gốc, xoay trái/phải, xem cận môi,
đổi mắt và thử chớp mắt, rồi so toàn bộ đầu gốc. Chỉ owner mới quyết định chấp nhận M01.
