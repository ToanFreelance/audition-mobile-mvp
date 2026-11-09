# Golden Mouth V3.2 M01 — Visual FAIL

Ngày 09/11/2026. **Không promote runtime. Dừng sau một lượt sculpt và một lượt
correction tập trung.** V3.2 có mô đỡ đầy hơn V3.1, vùng dưới nhân trung sạch hơn
rõ trong clay, nhưng xuất hiện một mảng gãy độ cong nhỏ dưới khóe phải và khóe
vẫn chưa tròn tự nhiên. Đây là điều kiện loại bắt buộc, dù geometry checks đạt.
Owner chưa chấp nhận V3.2. Giữ checkpoint V3 nguyên vẹn để phục hồi nền không gợn.

## Chuẩn bị và nguyên nhân

Đã đọc PROJECT_INSTRUCTIONS, QA V3/V3.1, source sculpt/refinement và xem đủ sáu
view, clay/cận cảnh, profile và Golden M01. Branch/PR/HEAD kiểm trước sửa:
work/female-golden-mouth-v1-qa, PR #26 OPEN/Draft, HEAD
473e3ca837007afd6fc0ca8bd5ad5de92f4f28fe. Không main/development hoặc merge.

V3.1 lấy positive difference từ tọa độ từng đỉnh Basis−V3 rồi diffusion trên
graph có mật độ không đều và cắt theo mask height. Trường này giữ nội dung không
mong muốn của biến dạng nguồn; vị trí liên tục không bảo đảm gradient/curvature
liên tục. Trong upper support, phần dư của trường V3.1 so fit cubic có p95≈.000849,
max≈.001629 đơn vị model. Đây là chẩn đoán nội dung tần số cao, không phải ngưỡng
mỹ thuật. UV split đã được đồng bộ nhưng gợn vẫn tồn tại khi bỏ custom normals.
Không tái dùng trường V3.1 và không sửa texture/lighting để che geometry.

## Cách thực hiện V3.2

Mỗi lượt mở đúng V3 iteration02 có SHA xác minh; không tiếp tục stack trên V3.1.
Basis và M01_Natural_V3 giữ nguyên, thêm M01_Natural_V32 riêng. Đây là thao tác
bề mặt có kiểm soát bằng Blender Python/shape key, không phải tuyên bố sculpt brush
thủ công hoặc đã đạt artist-level quality.

Trường hỗ trợ là các thể tích tần số thấp có mask C2 (quintic, đạo hàm bậc 1/2
bằng 0 tại biên). Hướng dịch dựa chart normal fit bậc hai trên 1339 mẫu da V3 quanh
môi, giảm thành phần tiếp tuyến để giữ pose. Các vùng upper/lateral/lower được
lưu thành vertex groups. Không cộng một offset Z chung, không diffusion/average
mesh và không tạo dải môi hoặc mặt da thay thế. V3.1 chỉ dùng đo/so sánh.

Lượt 01: đầy hơn và hết gợn nhân trung rõ, nhưng translation-only native seam
repair tạo lõm trên môi dưới, face 412066 đổi hướng ở rìa. Không chấp nhận.
Correction duy nhất: giữ trường support; fit positive affine differential map từ
vòng bề mặt lân cận để tiếp khớp seam. Hai determinant≈.509/.617. Outer commissure
được fit quadratic cục bộ, mask C2, mức chỉnh dưới .00055 đơn vị model; không
average qua seam và không thu hẹp miệng. Đã sửa thêm một lỗi tính liên tục của correction: hard clamp được thay bằng tanh
trơn (iteration03), giữ nguyên control volume/mask. Normal dot nhỏ nhất tăng nhưng
mảng gãy vẫn còn; clamp không phải nguyên nhân duy nhất. Bản cuối sửa geometry
nhưng còn lỗi
curvature nhìn thấy ở khóe phải. Không tiếp tục đổi thông số sau lượt này.

## Độ đầy quanh miệng so V3.1

Chiếu ray lên tam giác thật tại cùng XY, bước .0015 model unit. Không so một số
landmark rồi suy ra thể tích, không gán depth 3D giả cho Golden 2D.

| Vùng mô đỡ | Số mẫu | Mean gain Z so V3.1 | Gain nhỏ nhất | Mẫu ra trước |
|---|---:|---:|---:|---:|
| Trên: abs(x)<.05, .352<h<.366 | 603 | +.001521 | +.000598 | 100% |
| Dưới: abs(x)<.05, .300<h<.316 | 670 | +.001450 | +.000919 | 100% |
| Bên: .050<abs(x)<.072, .318<h<.352 | 616 | +.002236 | +.001641 | 100% |

Đó là gia tăng mô hỗ trợ theo hình chiếu; không gọi tổng tích phân depth là thể tích
mô giải phẫu kín. Mặt cắt x=0/.04/.06 và profile cho thấy vùng quanh môi ra trước
hơn, không chỉ vermilion dày lên. Dữ liệu landmark đầy đủ: evidence/landmarks.json.

Proxy Hessian p95 của trường sửa upper support giảm V3.1≈89.99 → V3.2≈35.29
(1/model-unit). Góc hai mặt kề vùng upper skin p95: V3≈4.07°, V3.1≈17.42°,
V3.2≈6.66°. Không đồng nhất các chỉ báo này với principal curvature hoặc visual PASS.
Góc vùng commissure không cải thiện đồng đều; cận cảnh quan trọng hơn số trung bình.

## Geometry/UV/nose — mở lại file đã lưu

| Kiểm tra | Kết quả iteration03 |
|---|---|
| Source vertices / triangles | 292645 / 499762 |
| Basis so GLB gốc, connectivity, UV | Khớp tuyệt đối |
| V3 key so checkpoint | Tọa độ không đổi |
| Packed textures / material identity | Không đổi |
| Đỉnh khác V3 | 6068, chỉ scope quanh miệng và phục hồi residual mũi |
| Mặt ảnh hưởng quay >90° | 0; minimum normal dot≈.655915 |
| Face 411680 | dot≈.968091, sửa bằng geometry thật |
| Tam giác suy biến vùng ảnh hưởng | 0 tại ngưỡng diện tích 1e-14 |
| Non-adjacent intersection pairs | V3 5 → V3.2 0; không có cặp mới |
| Protected source height>=.378 | 195239 đỉnh, max delta so Basis=0 |
| UV-split coordinate separation XYZ | 0 / 0 / 0 |

BVH scope: abs(x)<.11, .275<height<.40, depth>.18, epsilon 0; loại cặp mặt kề và
đỉnh UV nguồn trùng vị trí. Đây là kiểm vùng miệng, không phải chứng nhận collision
cho toàn nhân vật. Diện tích/hướng mặt lấy từ tọa độ tam giác, không dùng normals
shader để che mặt đảo. Zero đảo/giao cắt vẫn không chứng minh curvature đẹp.

## Cổng mỹ thuật — 11 câu trả lời

| Tiêu chí | Nhận xét từ render thật |
|---|---|
| 1. Còn lõm/móm? | Giảm so V3; mô đỡ ra trước hơn V3.1, chưa đủ tự nhiên toàn vùng |
| 2. Quanh miệng đầy hơn V3.1? | Có, xác nhận bằng ray/cross-section và profile |
| 3. Độ đầy tự nhiên, không phồng? | Không thấy má phồng/mõm lớn; khóe còn lỗi cục bộ |
| 4. Môi mảnh và cân đối? | Giữ tương đối độ nhô V3.1, không dạng ống; upper roll còn rõ |
| 5. Hết gợn nhân trung V3.1? | Hết các gợn/rãnh rõ của V3.1 trong clay; sạch hơn rõ |
| 6. Có nếp ngang mới? | Không thấy nếp ngang dài V2; có mảng curvature lỗi nhỏ dưới khóe phải |
| 7. Khóe tròn tự nhiên? | **Chưa**; termination còn sắc, dưới khóe phải có facet nhỏ |
| 8. Má tiếp liền mô quanh miệng? | Phần lớn liên tục; lỗi cục bộ khóe chưa đạt |
| 9. Profile được hỗ trợ tự nhiên hơn? | Đầy hơn, không thấy duck lips; chưa thể dùng để bỏ qua lỗi cận cảnh |
| 10. Giữ identity? | Có; mũi/upper face kiểm bằng tọa độ chính xác, không redesign |
| 11. Đẹp hơn cả V3/V3.1? | Tốt hơn về support và upper smoothness; tổng thể chưa đủ để PASS |

**Visual FAIL.** Mảng gãy dưới khóe phải còn khi xóa custom split normals và render
clay lại, nên không phải chỉ texture hoặc normal map. Không paint-over/blur/đổi đèn
để che. Không chỉnh tiếp mesh sau correction duy nhất. Không có owner acceptance.

## Bằng chứng thật và runtime

Blender 4.3.2, Cycles CPU, 8 threads, 64 samples, 680×760, Standard view, không
denoise. V3/V3.1/V3.2 được render lại cùng camera, exposure, ánh sáng, scale.
Sáu view: front, trái/phải 35°, true profile 90°, mouth, clay. Golden chỉ crop và
scale đều theo IPD; không warp/vẽ lại. Các crop cận cảnh giữ pixel 1:1.

- evidence/v3-v31-v32-golden.jpg — đối chiếu toàn mặt.
- evidence/mouth-clay-comparison.jpg — môi/material/clay.
- evidence/anatomical-clay-regions.jpg — mô trên, hai commissure và mô dưới.
- evidence/six-views.jpg và profile-comparison.jpg.
- evidence/cross-sections.png, support-depth-difference.png, profiles.json, curvature.json.

Render native dùng mắt tím gốc trong .blend; không gọi đó là V8 runtime evidence.
Golden Eye V8 code/assets diff rỗng so accepted baseline 1a0ba6e4fd8a1a0e76453a2e698fb9fcc5746576.
**WebGL2 V3.2 NOT RUN do Visual FAIL**, không phải renderer BLOCKED. Không có
framebuffer/shader/blink/expression/restoration/buffer-browser PASS mới. Không
hardware-GPU/iPhone Safari PASS. Không route/preview V3.2; V2 preview giữ nguyên.

## Tệp và phục hồi

Chỉ thêm scripts/golden-mouth-v32 và docs/golden-mouth-v32; không public/app/gameplay,
WebAudio, Gauge, RoomState, Stage, Shop, Catalog hoặc Supabase. Không upload GLB gốc.
PR #26 giữ Draft, không merge. Không M02–M09.

Editable iteration03: libfile_b23cc9d3507c8191acda5e4d1ca77fce, 55134315 bytes;
SHA cd53bb6d1fd7d0178300958d47c73511fc253e7a68b8fc57aad5ebd5345401c7.
Đã lưu và mở lại kiểm. V3/V3.1 gốc không bị ghi đè. Lệnh/script ở CHECKPOINT.md.
Bước chưa đạt còn lại là làm mềm anatomy/curvature ở commissure; không tăng thêm
volume hoặc đổi vài hằng số rồi coi là hoàn thành. Giữ V3 làm nền sạch khi tiếp tục.

Tệp bàn giao đã lưu và kiểm đọc:
- [M01-Natural-V32-Iteration-03.blend](https://chatgpt.com/library?file_id=libfile_b23cc9d3507c8191acda5e4d1ca77fce&account_id=personal)
- [Golden-Mouth-V32-M01-Visual-FAIL-Evidence.zip](https://chatgpt.com/library?file_id=libfile_a27e36a3ef248191b4aa00b4f1b7dc21&account_id=personal)
ZIP có 55 mục, PNG gốc/geometry/ray data/logs/reference; CRC đã kiểm. Scripts và
báo cáo nhỏ nằm trong Git. Không giữ tiến độ chỉ ở tệp tạm.
