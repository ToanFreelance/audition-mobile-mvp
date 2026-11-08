# Golden Mouth V1 — triển khai và bằng chứng QA

Ngày 08/11/2026. **Bản QA đã triển khai; chờ owner nghiệm thu hình ảnh trên iPhone.**

Nhánh: `work/female-golden-mouth-v1-qa`, tách từ Golden Eye V8 HEAD đã kiểm tra
`1a0ba6e4fd8a1a0e76453a2e698fb9fcc5746576`. PR #25 tại thời điểm kiểm tra: OPEN,
Draft, chưa merge. Owner đã xác nhận baseline mắt trong yêu cầu này.
Route mới: `/qa/female-golden-face-v1/index.html`.

## Nguyên nhân và giới hạn của model gốc

GLB đính kèm có SHA-256
`b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90`, khớp nguồn
của Golden Eye V8. Một primitive: 292.645 đỉnh, 499.762 tam giác; không có morph
miệng, khoang miệng/răng/lưỡi riêng. Nụ cười khép được tạo bởi relief bề mặt và
pigment/highlight môi baked trong texture. Chỉ đẩy đỉnh hoặc đặt một mesh miệng
lên trước mặt sẽ giữ lại nụ cười cũ, không cho khoang mở thật.

Đã kiểm vùng môi trên/dưới, khóe ở khoảng ±0,052 local X, tâm quanh local
Z=-0,335; philtrum phía trên, da quanh miệng và vùng đỡ cằm phía dưới. Không thay
mũi, vị trí mắt, má ngoài vùng patch, đường viền hàm hay nhận diện đầu gốc.

## Giải pháp

- Cắt **9.430 tam giác gốc** quanh miệng tại ellipse cố định; giữ phần tam giác
  ngoài cut bằng nội suy barycentric UV/normal. Có 570 điểm biên được ghép chính
  xác với da gốc. Cut miệng không trùng cut mắt.
- Retopology cục bộ: patch môi/da 3.200 đỉnh, 6.144 tam giác, một topology cho cả
  chín kiểu; biên ngoài bất động. Khoang lõm có đáy kín, tám răng trên bo cạnh
  nằm trên cung răng, lưỡi là geometry riêng bên trong.
- Xóa pigment môi cũ khỏi một texture da cục bộ khoảng 768², tiếp màu da từ vùng
  xung quanh. Texture mới là màu da, **không chứa hình miệng mở/răng**. Tất cả
  aperture, lip roll, răng và khoang được tạo bởi geometry thật.
- Normal da được tiếp nối từ imported normals để tránh đường shading tròn ở
  biên scan; normal môi lấy từ geometry. Các morph có position và normal riêng.
- Natural là basis; tám relative GPU morph targets bất biến trên các mesh miệng.
  Đổi preset đổi trọng số; chuyển lựa chọn 280 ms. Animation 3,2 giây đi từ pose
  đã chọn → Natural → pose đã chọn, không tạo mesh/buffer mỗi frame. M01 minh
  họa Natural ↔ Soft Smile. Tắt auto trả về đúng pose được chọn.
- Đây là **retopology cục bộ bằng code và hiệu chỉnh theo render**, không phải
  tuyên bố sculpt tay trong Blender. V1 có hỗ trợ da quanh môi/cằm trong patch;
  chưa phải rig xương hàm/mandible hoàn chỉnh.
- Gói dữ liệu morph nén khoảng 1 MB; dùng lại toàn bộ asset mắt. Không có chín
  GLB đầu riêng, không commit/upload GLB gốc, không dùng Supabase.

## Chín kiểu và đối chiếu hình ảnh

Tất cả render dùng **Natural Golden Eye V8**, iris hổ phách. M07 không ép mắt buồn
hoặc đổi chân mày; M09 không ép mắt khép. Điều này cố ý giữ độc lập mắt–miệng.

| ID | Kiểu | Hình học/khác biệt chính | Giới hạn so với Golden |
|---|---|---|---|
| M01 | Tự nhiên | Miệng nhỏ, gần ngang, khóe không nâng | Đường môi còn rõ hơn nét mềm trong concept |
| M02 | Mỉm cười | Rộng hơn M01, hai khóe nâng, khép môi | Độ đầy/ánh bóng cần owner duyệt trên Safari |
| M03 | Cười rạng rỡ | Mở rộng, khoang sâu, cung răng trên và lưỡi | Khoang tối hơn concept, chưa có gum/chi tiết nha khoa đầy đủ |
| M04 | Tinh nghịch | Hai khóe biến dạng lệch, không xoay cả mesh | Góc nâng khóe cần owner duyệt |
| M05 | Chu môi | Miệng nhỏ, cupid bow, môi nhô phía trước | Viền môi chưa mềm/tròn hoàn toàn như Golden |
| M06 | Ngạc nhiên | Aperture O cao, vòng môi 3D, khoang kín | Hỗ trợ cằm cục bộ; chưa có toàn bộ xương hàm |
| M07 | Ngại ngùng | Nhỏ, căng, khóe hơi hạ, lệch nhẹ | Không thêm blush; cảm xúc tổng thể phụ thuộc mắt được chọn |
| M08 | Thần tượng | Độ mở nhỏ hơn M03, răng nhìn thấy | Độ bóng và độ đầy môi còn khác concept |
| M09 | Hôn gió | Hẹp hơn M05, contour đầy hơn, nhô sâu hơn | Chưa thêm hiệu ứng tim; chuyển động là pursing 3D, không gesture tay |

Bằng chứng:

- [Chín kiểu thực tế](evidence/nine-mouths.jpg).
- [Từng ô Golden đối chiếu render](evidence/golden-comparison.jpg).
- [Năm góc 3/4 36°](evidence/three-quarter.jpg).

Blender 4.3.2, Cycles CPU, 96 samples, không denoise. Script xuất trực tiếp
position/index/UV/color/normal sau morph từ **rig Three.js thật**, rồi Blender
render các buffer đó. Không dùng concept được vẽ lại hoặc một rig giả thay thế.
Blender có cách diễn giải vật liệu/ánh sáng khác Three.js/Safari.

Các vòng sửa sau khi xem ảnh: bỏ bề mặt phồng dạng tròn ở patch; tiếp nối custom
normal da; sửa khoảng cách môi–răng; khép đáy khoang; sửa sai lệch nhỏ ở biên
stitch; tăng độ đầy môi và làm dịu môi trên, đặc biệt M02/M05/M09.

## Độc lập mắt và miệng

Không sửa bất kỳ file nào trong `public/qa/female-golden-eye-v8/`.
`eyePresetId`, `mouthPresetId`, checkbox mắt và checkbox miệng là trạng thái riêng.
Mouth module không import/call API mắt. Nó chỉ thay index của vùng miệng trong
working head khi cài đặt, rồi chạy bằng mesh/morph riêng. Không thêm target vào
ba morph targets mắt, không sửa atlas, gaze, blink, contour/mày hoặc calibration.

Đổi miệng không gọi `setStyle` mắt, không sửa checkbox, không tải GLB. Đổi mắt
không gọi `setPreset` miệng. `GLTFLoader.parseAsync` chỉ nằm trong handler chọn
file. Nút original khôi phục geometry gốc của eye rig và ẩn toàn bộ mouth rig.
Dispose miệng trước mắt để hoàn lại index, sau đó dispose model gốc.

## Kiểm tra thực sự đã chạy

| Kiểm tra | Kết quả / phạm vi |
|---|---|
| SHA GLB và baseline HEAD/PR | PASS |
| `verify.mjs`, Node + Three.js 0.180.0 + GLB thật | PASS: 81 tổ hợp, chuyển miệng giữ toàn bộ eye state, chuyển mắt giữ toàn bộ mouth state |
| Blink/expression + mouth cùng lúc | PASS tại trọng số/morph thực: cả chín mắt × chín miệng |
| Trả static pose | PASS tại API trọng số; checkbox UI đã audit code, chưa tương tác trên GPU browser |
| 30 vòng đổi mắt/miệng | PASS: geometry IDs và số đối tượng cố định; không phải phép đo VRAM trên iPhone |
| Buffer/index/morph position+normal | PASS: finite, đúng count và index hợp lệ |
| Stitch/cavity/topology | PASS: biên khớp <1e-6, outer ring bất động, không có triangle suy biến trong patch/khoang, chín pose khác nhau |
| Original/dispose | PASS: geometry gốc và hash vị trí giữ nguyên, rig được tháo sạch |
| Rig mắt V8 regression có sẵn | PASS với GLB và Three.js thật |
| JS/Python syntax, DOM selector/control IDs | PASS: 9 nút mắt, 9 nút miệng, IDs không trùng, đủ control |
| Render thật | 9 chính diện + 5 góc 3/4; đã xem và đối chiếu |
| WebGL shader/browser/FPS/touch | **BLOCKED / chưa PASS**: Chromium lỗi `socket() failed: Operation not permitted` trước khi mở trang |
| iPhone vật lý | **CHƯA TEST**; owner quyết định acceptance |

Kết quả máy: `evidence/node-qa.json`, `evidence/eye-v8-regression.json`,
`evidence/topology-check.txt`. Có `browser_check.mjs` để chạy kiểm tra UI thực khi
có Chromium WebGL; trong môi trường này browser chưa khởi chạy được. Không coi
Node/Blender là bằng chứng shader compile hoặc Safari PASS. Không chạy full QA
app, không đổi gameplay/WebAudio/RoomState/Gauge/Finish/Stage/Shop/inventory.

## File mới

- `public/qa/female-golden-face-v1/index.html`, `qa.js`: Preview portrait, GLB cục
  bộ, hai bộ chọn, animation độc lập, camera mặt/mắt/miệng/front/3⁄4, original,
  debug IDs, ảnh Golden gốc.
- `mouth-rig.js`, `mouth-rig.json`, `mouth-rig.json.gz`, `mouth-skin.webp`,
  `golden-mouth-reference.jpg`: module và dữ liệu compact, reference gốc.
- `scripts/golden-mouth-v1/`: build, verify, topology check, browser regression,
  xuất/render geometry, tạo comparison sheets và README tái tạo.
- `docs/golden-mouth-v1/`: báo cáo và bằng chứng.

## Rủi ro và checklist iPhone

Chưa khẳng định giống Golden hoàn hảo. Rủi ro còn lại: màu/specular/normal morph
trên Safari; GPU morph shader và VRAM; đường nối da ở ánh sáng/góc khác; độ mềm
viền môi, khóe miệng, độ che răng và lưỡi trong các pose trung gian; iOS context
loss khi GLB gốc lớn được nạp lại. Rig nguồn-specific chỉ nhận đúng SHA đã kiểm.

1. Mở Preview, chọn GLB gốc từ Tệp. Không có upload model.
2. Tắt auto mắt/miệng để so sánh chín pose tĩnh, đặc biệt M01/M02/M07 và M05/M09.
3. Thử Angry + Soft Smile, Doll + Cute Pout, Star + Blow Kiss, Sad + Bright Smile,
   Heart + Surprised. Các ID, iris và checkbox phải được giữ độc lập.
4. Chạy chớp mắt, biểu cảm mắt và animation miệng đồng thời; tắt từng checkbox,
   kiểm preset tĩnh trở về đúng và không giật/méo/nháy mất mặt.
5. Kiểm front + 3/4 + zoom miệng: môi không nổi rời, không hai miệng, không lộ lỗ
   xuyên đầu, răng chỉ hiện khi mở, môi che răng đúng.
6. Bật/tắt original; đổi kiểu 30 lần; nạp lại GLB, kiểm không treo/mất WebGL.

Không merge. Trạng thái commit/PR/Preview xác minh sau triển khai được ghi trong
phản hồi bàn giao và mô tả Draft PR; không tự nhận owner acceptance.
