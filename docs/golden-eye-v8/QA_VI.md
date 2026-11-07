# Golden Eye V8 — báo cáo triển khai và kiểm tra

Ngày: 07/11/2026 (Việt Nam). Trạng thái: **đã triển khai bản QA; chưa owner acceptance, chưa WebGL/iPhone acceptance**.

Nhánh: `work/female-golden-eye-v8-qa`, tách từ HEAD V7.1 đã xác minh `ae50342ad8c90a311dfed38f18deea3a37178ed7` của `work/female-origin-eye-rig-v3-qa`. Route mới: `/qa/female-golden-eye-v8/index.html`. Không sửa V7.1, không merge.

## Nguyên nhân V7.1

1. Iris được chiếu tại tâm cố định ±0.119, z=-0.509; không có tham số gaze hoặc nhãn cầu/iris riêng. Vì vậy Tinh nghịch không nhìn ngang.
2. `vEyeLocal=position` lấy tọa độ trước morph. Shader vẽ lên bề mặt bị morph cùng mí; iris/pupil chịu biến dạng của mesh chung, không phải một cụm mắt độc lập.
3. Bộ morph dùng trường Gaussian mí trên/dưới; Búp bê chủ yếu mở chiều dọc, không kiểm soát viền mở mắt, độ rộng và độ sâu. Cười thay đổi quá ít nên biểu cảm gần như Tự nhiên.
4. Mask dựa trên hue của texture gốc và một vùng pupil cleanup không thay toàn bộ bề mặt mắt. UV bị clamp ở biên; pigment, glint và phần nền cũ có thể còn sót, gây viền/vòng sáng và méo artwork.
5. SVG iris V7 là artwork tái dựng. V8 trích đúng chín iris từ Golden Iris được gửi, chỉ crop/resize; không tạo concept hay vẽ lại biểu tượng.
6. Nút so sánh V7.1 chỉ tắt shader iris, vẫn giữ morph mí. V8 khôi phục nguyên geometry, index, material và chân mày gốc.

## Đối chiếu chín kiểu

| Kiểu | Vấn đề quan sát ở V7.1 | Điều chỉnh V8 và kết quả Blender | Còn cần owner duyệt |
|---|---|---|---|
| Tự nhiên | Iris méo theo bề mặt; vòng sáng mạnh, dáng mắt gốc hơi tam giác | Iris hổ phách cong riêng, viền mắt cân hơn, dùng highlight gốc của Golden Iris | Độ mở và tỷ lệ lòng trắng/iris; sắc da và ánh sáng Safari |
| Tươi cười | Hầu như giống Tự nhiên, chưa có mí dưới cười | Mí dưới nâng thành cung; đồng tử còn rõ; sửa độ sâu để không xuyên chân mi | Mức độ vui và độ cong khóe ngoài so với Golden |
| Buồn | Tím iris nhưng đầu mày chưa thể hiện đủ nỗi buồn | Nâng đầu mày, hạ đuôi mày và làm dịu mí trên; lavender | Đầu mày V8 còn sắc hơn nét mềm trong concept |
| Tinh nghịch | Gần như nhìn thẳng | Hai cụm iris/pupil/highlight xoay cùng -0.25 rad quanh Z cục bộ, nhìn sang phải màn hình; mí lệch nhẹ | Hướng nhìn trên iPhone, độ rõ ở chính diện và 36° |
| Giận dữ | Mí bị ép và artwork biến dạng | Siết đầu mày, mí trên xéo; iris ruby độc lập, không bị kéo theo mí | Cường độ giận và độ mềm của chân mày |
| Búp bê | Mắt cao, iris bị kéo lên/méo dọc | Mở rộng cả viền dưới và thành trong, iris tròn riêng; cân vị trí quanh z=-0.512 | Độ tròn/ngây thơ và tỷ lệ iris đúng Golden Head |
| Thần tượng | Họa tiết tái dựng, iris kéo dọc | Iris sapphire từ nguồn đã duyệt, họa tiết lấp lánh thẳng; viền mở tròn hơn | Sắc xanh/độ sáng trên Safari |
| Ngôi sao | Sao và viền iris chịu phép chiếu lên bề mặt chung | Sao vàng năm cánh nằm giữa iris cong, đúng chiều, không kéo dọc trong render | Độ rõ sao khi zoom và xoay trên iPhone |
| Trái tim | Artwork méo và vòng sáng quanh tim | Trái tim đầy đủ, đúng chiều, giữa iris hồng; không bị cắt trong render chính diện | Màu/độ bóng và góc nhìn iPhone |

## Thay đổi kỹ thuật và file

- `public/qa/female-golden-eye-v8/index.html`, `qa.js`: trang riêng, chín preset, chọn GLB trên thiết bị, chính diện/36°/zoom, so sánh toàn bộ model gốc. Không có Strength slider, không tải lại GLB khi đổi kiểu.
- `eye-rig.js`: mesh ocular cầu cong và iris cap riêng; quay conjugate gaze thật bằng transform 3D; UV cố định trên cap, sRGB + vật liệu MeshStandard với emissive nhỏ.
- `eye-rig.json`, `eye-patch.bin.gz`, `eye-boundary.json.gz`: cắt biên aperture trên mesh gốc, nội suy thuộc tính ở biên, chín pose landmark cố định. 9.909 tam giác gốc được thay/cắt, 4.503 vertex biên được thêm; 59.182 vertex thuộc vùng pose (bao gồm vertex biên).
- `approved-iris-atlas.webp`: chín crop từ Golden Iris, 384×384 mỗi tile, khoảng 188 KiB. Gói bổ sung geometry nén khoảng 2,3 MiB; không chứa GLB gốc 44,7 MB.
- `scripts/golden-eye-v8/`: bộ tạo patch, kiểm tra geometry, chuẩn bị/render Blender, hướng dẫn tái tạo.
- `docs/golden-eye-v8/evidence/`: ảnh thực tế và đối chiếu.

Giữ nguyên mesh đầu/texture gốc để so sánh. Chỉ clone dữ liệu làm việc trong bộ nhớ; không ghi đè file người dùng. Kiểm SHA-256 trước khi áp patch để không làm hỏng model khác cùng tên. Không truy cập Supabase; không đổi gameplay, Waiting Room, RoomState/CAS, Realtime, WebAudio, Gauge, Finish, Character/Stage Catalog.

## Các vòng kiểm hình học thực tế

- Render đầu tiên phát hiện sphere che chân mi dưới ở Tươi cười. Đã sửa độ sâu mí để ôm mặt cầu, thay vì chỉ dịch theo trục dọc.
- Render 36° phát hiện sphere đầy đủ nhô ra ở thái dương/khóe ngoài vì GLB scan không có hốc kín. Đã giới hạn bề mặt sclera theo aperture từng preset; iris vẫn xoay độc lập theo mặt cầu.
- Đã render lại chín kiểu chính diện và hai góc 36° Tinh nghịch/Búp bê bằng Blender CPU Cycles. Đây là geometry/pose/UV của bản QA, không phải concept hoặc mắt 2D dán lên ảnh.

## Kiểm tra đã chạy

- JavaScript syntax: `qa.js`, `eye-rig.js` — PASS.
- Python syntax của script — PASS.
- Node + Three.js 0.180.0: SHA nguồn, chín pose hữu hạn, index hợp lệ, iris/sclera hướng ra trước, hai iris cùng yaw, dịch gaze >0.02 đơn vị, so sánh khôi phục geometry gốc, 30 lần chuyển tái sử dụng geometry, dispose — PASS.
- Tạo lại patch từ GLB: hai file gzip bit-identical — PASS.
- Blender 4.3.2, Cycles CPU, 96 samples: 9 chính diện + 2 góc 36° — đã render và xem trực tiếp.
- **WebGL thực tế: BLOCKED.** Cloud Chrome trả `GL_RENDERER = Disabled` và `Error creating WebGL context`; local Chromium lỗi tạo socket, không được nâng quyền. Không có bằng chứng compile GPU, FPS, tương tác WebGL hoặc Safari/iPhone PASS.
- Không chạy full gameplay QA, không tuyên bố đã chạy TypeScript toàn repo. Vercel build/deployment được kiểm riêng khi triển khai.

## Giới hạn và iPhone acceptance

Đây là rig mắt tách riêng và biến dạng vùng mí có ràng buộc landmark; không phải sculpt/retopo toàn bộ đầu bằng tay. Nét mi, nếp mí và texture da baked của GLB gốc vẫn giới hạn độ giống concept. Blender dùng ánh sáng/tone mapping khác Three.js; ảnh Blender không đảm bảo màu và specular trùng Safari. Chưa kết luận giống 100%.

Owner cần kiểm:

1. Chọn GLB gốc trong Tệp; model nạp thành công, không treo/mất WebGL.
2. Chín kiểu có dáng và cảm xúc đúng; ưu tiên Cười, Tinh nghịch, Búp bê.
3. Tinh nghịch nhìn sang phải màn hình bằng cả hai mắt, không lé/wink; xoay 36° không lộ iris/sclera ngoài hốc.
4. Búp bê tròn cả viền, iris không treo cao; kiểm góc 36° và zoom.
5. Sao/tim đầy đủ, đúng chiều; highlight không cháy quá mức.
6. Chuyển kiểu không nạp lại GLB; nút so sánh trả về cả mí và chân mày gốc; zoom/rotate/load lại hoạt động.

Chỉ owner mới chốt visual acceptance. Không merge.
