# Golden Mouth V4 — chín preset MVP

Ngày 09/11/2026. Owner **chấp nhận tạm thời M01 V3.3 Refined-02** và yêu cầu dừng chỉnh M01 để mở rộng MVP. Quyết định này được áp dụng; báo cáo Visual FAIL V3.3 giữ nguyên như lịch sử.

**Đã hoàn thành triển khai M01–M09, Blender editable, gói morph, selector QA và WebGL2 thực 81/81.** Phiên tiếp tục đã phục hồi đúng checkpoint, chạy lại WebGL2 và lưu đủ 27 PNG Cycles, 25 PNG WebGL2, 7 grid và full diagnostics. Bộ ảnh gốc đã được kiểm decode/CRC/SHA và lưu thành artifact tải được. Chưa có owner acceptance cho cả bộ hoặc kiểm thử iPhone vật lý.

## Dùng bản nào

- [Blender MVP đủ chín preset](https://chatgpt.com/library?file_id=libfile_1bb6d576cea881918e57d5fd45792652&account_id=personal): `Golden-Mouth-V4-MVP-Nine-Presets.blend`, version 1, 108,170,836 bytes.
- SHA-256: `153b589728fe54dea3f5088f2cf637541fc29b41fb42afdde743658c2cd35e79`.
- Trong Blender: object `node_0` → custom property `MouthPreset`: 0=M01, …, 8=M09; -1 cho Basis. Drivers đặt đúng một weight. Không bật các key lịch sử V3/V32 cùng bộ chọn.
- Collection ẩn `V4_Original_Source_Backup` chứa đầu nguyên vẹn, đủ 499,762 triangles và UV nguồn, để đối chiếu/phục hồi.
- Không dùng các prototype A/B trước sửa nội thất hoặc thử nghiệm direct-pout/corrective-smooth thay bản này.
- [Preview branch ổn định](https://audition-mobile-mvp-git-work-fe-563419-toan-freelances-projects.vercel.app/qa/female-golden-mouth-v4/index.html). Chọn GLB gốc trong Tệp; model được đọc cục bộ, không upload máy chủ. Deployment có bảo vệ có thể cần link chia sẻ mới hoặc đăng nhập Vercel.

## Catalog đã thực hiện

ID giữ theo catalog có sẵn, không đổi Character Catalog sản phẩm.

| Mã | ID | Biểu cảm |
|---|---|---|
| M01 | natural | Tự nhiên, giữ tọa độ Refined-02 |
| M02 | soft-smile | Mỉm cười mềm, khóe cong lên |
| M03 | bright-smile | Cười mở rộng, khoang/răng/lưỡi thật |
| M04 | playful-smirk | Cười lệch có chủ đích |
| M05 | cute-pout | Chu môi nhẹ, có projection và khe môi nhỏ |
| M06 | surprised | Aperture O, không răng, có khoang/lưỡi |
| M07 | shy | Nhẹ, tiết chế, góc miệng và width riêng |
| M08 | idol-smile | Nụ cười mở vừa, hàng răng thấp hơn M03 |
| M09 | blow-kiss | Hẹp và nhô hơn M05 |

M05/M09 chốt ở intensity authoring .50/.60 của pose mạnh hơn, để giảm nếp kéo nhân trung. Đây là tọa độ target hoàn chỉnh được lưu trước export; runtime vẫn chỉ chọn một target, không cộng M01. Hai pose nhẹ hơn Golden; phần fidelity còn lại được hoãn. Bảy pose khác giữ nguyên trong lượt sửa này.

## Nguyên nhân và giải pháp topology tối thiểu

Nguồn GLB là scan khép kín: không có boundary edge trong vùng miệng. Kéo hai môi mà giữ màng gấp kín sẽ kéo da chắn aperture hoặc tạo giao cắt trong nếp scan nội môi.

Đã thử tách seam mà giữ mọi tam giác; phát hiện giao cắt thật ở folded lining. Giải pháp cuối bỏ **555 triangles ở dải geodesic 1 mm trong nếp nội môi**, giữ mọi vertex ID và toàn bộ bề mặt môi/da ngoài còn lại. Không cắt ellipse lớn, không tái tạo da phẳng, không tạo môi rời.

| Thành phần | Kết quả |
|---|---|
| Source vertices | 292,645, giữ đủ |
| Source triangles | 499,762 |
| Topology native dùng chung 9 pose | 499,207 triangles |
| Triangles nội môi bỏ | 555 |
| Vertices da/môi mới | 0 |
| Tọa độ Basis, V3, V3.2 và M01 lưu | Bit-exact so checkpoint khóa |
| Full original topology | Giữ nguyên trong collection backup |
| UV/packed images/material head | Giữ nguyên |

Con số trên là native head trước phần contour topology đã được V8 chấp nhận; runtime V8 vẫn có các boundary vertices của chính V8. Miệng không thêm vertex da và không thay module mắt.

M01 **không sculpt lại tọa độ**. Topology nội môi chung có thay đổi nêu trên; không mô tả toàn bộ topology M01 là chưa đổi. Nút so đầu gốc trong runtime dùng geometry GLB nguyên vẹn, không dùng mesh đã bỏ dải nội môi.

## Authoring và nội thất

Blender **4.3.2**, headless, /usr/bin/blender. Vùng upper/lower lips và commissures được điều khiển riêng trên bề mặt M01; mô đỡ dùng native Laplacian Deform trong bản sao authoring cục bộ. Bản sao này không trở thành skin patch trong runtime. Có kiểm orientation trên vị trí thật.

Nội thất là bốn mesh parent vào head: bowl concave, hàng tám răng bevel, gum và tongue. Bowl cuối có margin nằm sau aperture; không kéo radial fan qua boundary scan gấp. Răng có khe nhỏ và M08 dùng arch thấp/hẹp hơn để tránh chạm môi. Phần này thay bowl prototype có tự giao và răng M08 chạm môi.

Không đổi base color, normal map hoặc roughness nguồn để che geometry. Normals native được vận chuyển theo biến dạng. Clay dùng normal hình học và material override không texture/normal map.

Cycles CPU: 48 samples, 8 threads, denoising OFF, 680×760. Đã render 9 front, 9 mouth, 5 clay và 4 góc 35°. Các render Cycles dùng mắt tím native; **không gọi là V8 runtime evidence**. WebGL screenshots dùng Golden Eye V8 thật.

## Morph và runtime

- Một shared Basis là GLB gốc; delta mỗi preset = full pose − original Basis.
- Gói nén `public/qa/female-golden-mouth-v4/mouth-targets.bin.gz`: **1,597,931 bytes**, SHA-256 `2548334bd96d6327ea5b56124b65589ae84f8777ac33a34852fe0a8d28b5ca1d`.
- 8,326 indices runtime, gồm vị trí và normal lân cận. Frozen author controls lưu 7,950 indices thay đổi so M01; hai số đo có phạm vi khác nhau.
- Head đánh giá chín target **CPU sparse one-hot** khi chọn preset. Cách này giữ nguyên ba GPU controls và semantics của V8; không thêm chín GPU mouth slots vào head.
- Interior meshes có chín GPU targets riêng. Các target buffer cố định, chỉ đổi weights/visibility.
- Không tạo actor, geometry object hay load GLB lại khi đổi preset. Không sửa code/assets V8.
- Không thay gameplay, clock, multiplayer, Stage, Catalog, Shop hoặc Supabase; không upload GLB gốc.

## Validation thực chạy

Các file [native validation](evidence/final-validation.json), [interior validation](evidence/final-interior-validation.json) và [checkpoint audit](evidence/final-checkpoint-audit.json) đã được lưu trước gián đoạn.

- Cả 9: zero face quay quá 90° so Basis, zero degenerate, zero non-adjacent self-intersection trong perioral scope đã ghi.
- UV split coordinate separation = 0.
- Source-local height≥.378: 195,239 vertices, displacement=0.
- Packed images/head material identity và các key cũ khớp sau mở lại.
- Drivers 9/9 one-hot; key data đúng tuyệt đối. Sai số Blender evaluated coordinates lớn nhất khoảng 1.863e-9.
- Cavity/teeth/tongue đang hiện: zero self-intersection và body intersection trong kiểm tra. Gum kiểm parenting/visibility; tiếp xúc root thuộc cấu trúc dental, không tuyên bố đã chạy cùng phép BVH riêng cho gum.
- Đã dựng lại positions/faces/UV từ `frozen-final-controls.npz` và so bit-exact với delivery.

BVH chỉ kiểm perioral scope, không phải chứng minh collision-free toàn model hoặc mọi blend liên tục. MVP chuyển preset rời rạc; không cung cấp tween/viseme chưa kiểm.

### WebGL2 thực — 81/81 PASS

Code runtime: `bd4dbf9ecc8bde1ab2ac3ed1b0a1c7ab9bf957c0`. Lần chạy mới bắt đầu trên HEAD `0239a5ec9eb28ad6e1d9d4bb19b8da69355e9228`; runtime giữ nguyên. Full raw diagnostics và grid của lần mới đã được commit tại `a4b050d80e2dd4cd318232749dfbda1becc02b42`.

Chrome Headless Shell **157.0.8103.38**, Three.js **0.180.0**, ANGLE/Vulkan **SwiftShader phần mềm**. Đã load GLB thật, link/chạy shader và đọc framebuffer; không phải Node mock. CDN được route đến cùng package r180 cục bộ trong test.

Mỗi cell được render với blink=.6, eye neutral=.4; eye weights [.36,.4,.24]. Ma trận tổng hợp từ assertions của lần chạy thật:

| Mắt | M01 | M02 | M03 | M04 | M05 | M06 | M07 | M08 | M09 |
|---|---|---|---|---|---|---|---|---|---|
| natural | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| joyful | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| sad | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| playful | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| angry | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| doll | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| idol | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| star | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| heart | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

Kết quả đã quan sát:

- Mouth framebuffer checksum không đổi khi đổi eye style.
- Mouth selection giữ nguyên eye state, gaze, blink và ba weights.
- Actor, head geometry và position/normal/index array identity ổn định.
- Original-Basis-relative position error=0 tại runtime.
- GLB loads=1; extra preset requests=0.
- Chín chương trình link thành công; không page/shader/WebGL errors.
- Original restoration khớp SHA positions/normals/index GLB, đủ 292,645 vertices / 499,762 triangles.
- Đã chụp 9 front, hai phía 35° cho M03/M05/M06/M09, cận miệng, original và layout 390×844.
- Không hardware-GPU PASS, không physical iPhone Safari PASS, không benchmark FPS.

Lần đầu bị gián đoạn chỉ giữ [stdout](evidence/webgl-console-observed.log) và [summary](evidence/webgl-observed-summary.json). Phiên tiếp tục đã chạy lại thật và lưu [full raw JSON 81 cell](evidence/webgl-diagnostics.json), [log mới](evidence/webgl-rerun.log), [grid chín miệng](evidence/nine-webgl-front.jpg), [cận môi](evidence/webgl-mouth-closeups.jpg) và [hai phía 35°](evidence/webgl-three-quarter.jpg). Các hash từng cell thuộc lần chạy mới, không dựng lại từ summary cũ.

## Mỹ thuật MVP và giới hạn

Nhóm cười mở, O, cười nhẹ và cười lệch có silhouette riêng; M05/M09 còn gần M01 khi nhìn chính diện. Không có skin patch phẳng hoặc lip ribbon mới. M03/M06 mở thật; M03/M08 có răng nằm trong head. Các góc 35° WebGL đã xem không lộ lỗ hở ngoài aperture hoặc răng nổi rời.

Đây là **ứng viên MVP để owner duyệt**, không phải tuyên bố artist fidelity hoàn thiện. Còn upper roll/khóe kế thừa M01, nếp kéo vùng nhân trung khi pucker (rõ hơn ở cận M09), M05/M09 nhẹ hơn Golden và hàng răng còn đều. Nhìn chính diện, M05/M09 có khác biệt khá tiết chế so M01; projection rõ hơn ở góc 35°. Không tuyên bố cả chín silhouette đã được owner chấp nhận. Không tiếp tục sửa M01 hoặc kéo dài vòng polish trong milestone này.

## Trạng thái cổng nghiệm thu

| Cổng | Kết quả | Giới hạn |
|---|---|---|
| Phục hồi source / M01 / frozen poses | PASS | Tọa độ và gói re-export bit-exact |
| Native geometry cả 9 pose | PASS trong scope đã kiểm | 555 face nội môi bỏ có chủ đích; không kiểm mọi blend liên tục |
| Cavity / răng / lưỡi | PASS trong scope đã kiểm | Gum chỉ kiểm attachment/visibility |
| WebGL2 81 tổ hợp | PASS, SwiftShader phần mềm | Không phải hardware GPU |
| Mỹ thuật cả bộ V4 | CHỜ OWNER DUYỆT | M01 chỉ được chấp nhận tạm thời; M05/M09 còn tiết chế, M09 có nếp nhân trung thấy ở clay |
| iPhone Safari vật lý | CHƯA KIỂM | Ảnh 390×844 là layout Chromium |

Không gọi bộ V4 là đã được owner chấp nhận hoặc production-ready. Không sửa thêm M01 trong phiên bàn giao media.

## Bộ ảnh thực đã hoàn tất

- [Chín miệng — WebGL2 với Golden Eye V8](evidence/nine-webgl-front.jpg).
- [Chín miệng — Cycles CPU, mắt native tím](evidence/nine-cycles-front.jpg).
- [Chín cận miệng Cycles](evidence/nine-cycles-mouth.jpg).
- [Clay M03/M05/M06/M08/M09](evidence/clay-critical.jpg).
- [Cycles góc 35°](evidence/cycles-three-quarter.jpg).
- [WebGL2 hai phía 35°](evidence/webgl-three-quarter.jpg).
- [WebGL2 cận khoang/răng/môi](evidence/webgl-mouth-closeups.jpg).

[Golden-Mouth-V4-Cycles-WebGL2-Raw-Evidence.zip](https://chatgpt.com/library?file_id=libfile_359b5b15f2cc8191aeda315c1cce6a17&account_id=personal) chứa **52 PNG nguyên bản** (27 Cycles +25 browser), log Cycles và `RAW_SHA256.json` với hash/kích thước từng ảnh. ZIP 23,560,060 bytes, SHA `7628387c018d070f84d503bdf38a974e265bf4856f2047c09fe941fb9b49fc35`; đã verify decode mọi PNG, CRC ZIP và hash bytes trong archive. Không có GLB gốc trong gói.

Grid chỉ crop/resize đồng nhất và gắn nhãn; raw PNG giữ nguyên. Denoising tắt. Không warp, paint-over hoặc ảnh AI. Đã xem cả bảy grid và ảnh phóng lớn M01/M03/M09 để ghi đúng các giới hạn mỹ thuật, không che nếp còn lại.

## Preview và phục hồi sau gián đoạn

Lần đầu môi trường dừng sau test trước đóng gói ảnh. Phiên tiếp tục kiểm scratch đã mất media, khôi phục đúng `.blend` MVP v1 từ artifact, so SHA rồi render/chụp lại. Không sculpt lại hay thay pose. [Recovery read-only](evidence/media-recovery.json) xác nhận chín key, Basis, historical keys, retained faces/UV khớp tuyệt đối. Tái xuất cả gói morph cho đúng bytes/SHA `2548334b…`, kiểm luôn normals và nội thất.

[Kiểm tra media và locked scope](evidence/media-verification.json) ghi bảy file V8 khớp accepted baseline, bốn file preview V2 khớp trước V4, runtime không thay so bd4dbf9. Deployment `dpl_VBuxBZFrLjBXQZrEdVcsHqAdfk3w` tại commit a4b050d đã READY; HTML/manifest của stable branch trả 200, đủ chín nút/style và đúng package SHA. Commit chỉ thêm media/tài liệu sau đó không thay runtime. Không gọi HTTP check hoặc screenshot 390×844 là iPhone Safari PASS.

[Preview ổn định](https://audition-mobile-mvp-git-work-fe-563419-toan-freelances-projects.vercel.app/qa/female-golden-mouth-v4/index.html): mở trên iPhone, chọn GLB gốc trong Tệp. Model đọc tại thiết bị, không upload. Link chia sẻ protection mới được gửi ngoài Git khi cần.

## File thay đổi và bước tiếp theo

Triển khai V4 chỉ trong `scripts/golden-mouth-v4/`, `docs/golden-mouth-v4/`, `public/qa/female-golden-mouth-v4/`. Phiên media chỉ thêm `recover_media_inputs.py`, `package_media.py`, tùy chọn `--webgl-only` cho `make_sheets.py`, recovery/report và ảnh/diagnostics. Không đổi nine poses, M01, rig/runtime, V8, V2 hoặc gameplay.

Đọc [CHECKPOINT.md](CHECKPOINT.md) và [MEDIA_RECOVERY.md](MEDIA_RECOVERY.md) để tái lập từ `.blend` cuối; không chạy lại các thử nghiệm sculpt bị loại. Editable source, frozen controls và morph package đã lưu. Bộ raw ảnh cũng đã lưu; phần media bị thiếu ở lần trước đã hoàn tất.

Branch `work/female-golden-mouth-v1-qa`; PR #26 tiếp tục OPEN/Draft, không merge. Bước tiếp theo là owner xem đủ chín preset trên iPhone và quyết định chấp nhận MVP hoặc chỉ định polish cụ thể. Không bắt đầu milestone khác tự động.
