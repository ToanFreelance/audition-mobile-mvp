# Eye Asset Pack V1.9 — báo cáo triển khai và QA

**Trạng thái: PARTIALLY READY / NOT VISUALLY ACCEPTED.** Có đủ chín bộ thật và các chức năng thử nghiệm hoạt động. Chưa đạt điều kiện nghiệm thu mỹ thuật theo concept đã duyệt; không đưa vào Character Catalog production.

## Baseline và phạm vi

- Repo `ToanFreelance/audition-mobile-mvp`, nhánh `work/facial-modular-eye-demo-v1`, PR #24 Draft, base `development`.
- Đã kiểm tra HEAD trước khi sửa: `5a8b3620075cf9606feaa21aefe012631880057e`.
- Đã đọc `docs/PROJECT_INSTRUCTIONS.md`, `docs/FACIAL_MODULAR_EYE_V1.md`, catalog, loader, bộ điều khiển, material và GLB thật từ URL V1.8.
- Route `/tools/facial-modular-eye-v1`. Không thay gameplay, WebAudio, gauge, multiplayer, Waiting Room, Supabase protocol hoặc Character Catalog; không merge.

## Root cause được chứng minh bằng render tách lớp

1. Ocular V1.8 là một vùng phân tách chưa kín: các mảnh bề mặt mắt/iris cũ vẫn thuộc `Head_Base_Protected`. Render HeadBase riêng cho thấy vùng mắt gốc xen vào lỗ phân tách, tạo những mảnh tam giác và vòng răng cưa ở đường tiếp giáp. Đổi texture ocular không thể xóa các mảnh đó.
2. `UpperLidBridge_ISSUE` gồm 220 tam giác ở hai bên là lỗi riêng trên mí. Không coi đây là lỗi limbal ring hay sửa xong chỉ bằng shader.
3. Texture iris V1.8 có sclera xám hồng, vân dày và màu tối; PBR + tone mapping làm độ sáng/saturation xa concept. UV V theo tọa độ cũ cũng đảo vị trí highlight theo chiều dọc so với bản texture.

Bộ QA giữ các render `isolate_head`, `isolate_ocular`, `isolate_bridge`, góc chính diện, ba phần tư và macro để kiểm chứng nguồn lỗi.

## Thay đổi asset và renderer

- Giữ nguyên dữ liệu đầu ngoài vùng mắt. Tái phân vùng 25.379 tam giác quanh mắt để mỗi bộ có vùng da/mí riêng; phần đầu chung giữ 463.223 tam giác. Các đỉnh ở đường cắt ngoài được bảo toàn.
- Loại các mảnh mắt gốc khỏi vùng mí: 7.633 tam giác bên trái và 8.338 bên phải trong vùng tái dựng. Dựng bề mặt ocular cong mới và vùng nối mí, thay bridge lỗi trong đường chạy V1.9. Bản gốc được giữ ở scene thư viện để so sánh.
- Mỗi bộ có 8 node thực tế: L/R × Skin, Lids, Ocular, Lashes; tổng 72 node mới. Mí/bề mặt/lông mi có tọa độ đỉnh riêng; không quy chín bộ về một mesh đổi màu.
- Texture iris/sclera sRGB được vẽ bằng source có thể tái tạo: gradient sạch, viền mỏng, pupil, glint lớn, điểm sáng phụ và đồ họa Star/Heart. Ocular không dùng atlas hay normal map mắt gốc.
- Dùng `KHR_materials_unlit` cho ocular/lông mi. Three.js đặt `toneMapped=false` trên ocular; giữ nguyên exposure và ánh sáng da của scene. Chỉnh nâng cao dùng canvas texture sạch trên đúng mesh đã chọn, không phủ thêm các vòng shader để che nguồn lỗi.
- Lông mi ribbon cong, thuôn về đầu; attribute `_LASH_ROOT` giữ gốc khi đổi độ dài. Skin/lid được giới hạn trong vùng mắt, không tái dựng hàng loạt mặt.
- GLB mới 31.376.604 bytes, SHA-256 `1da1e04c67d3441e7223224830a20aed69e67d5ea6c625025defdd2f9042367f`. Manifest lưu URL CDN, MIME và kết quả CORS/byte verification.
- Default scene hiển thị duy nhất Natural; scene thư viện giữ các bộ còn lại. Loader đọc cả hai một lần rồi đổi visibility. Fetch đang diễn ra được dùng chung khi React StrictMode mount lại; cache key V1.9 chứa SHA mới và xóa cache EyeSet cũ sau khi ghi thành công.

## Chín bộ đã triển khai

| Bộ | Thay đổi thực tế |
|---|---|
| Tự nhiên | Hạnh nhân, nâu mật ong/gold, mí trung tính, mi cong vừa |
| Tươi cười | Độ mở 73%, nâng khóe nhẹ, nâu sáng, mi ngắn hơn |
| Buồn | Độ mở 90%, đuôi mắt hạ, đầu mí nâng, tím hồng |
| Tinh nghịch | Đuôi mắt nâng rõ, xanh ngọc/cyan sáng, mi quét dài |
| Giận dữ | Độ mở 78%, đầu mí hạ, eyeliner dày hơn, đỏ ruby |
| Búp bê | Độ mở 128%, iris lớn hơn, tím pastel, mi dài/cong hơn |
| Thần tượng | Độ mở 116%, sapphire/cyan, glint và các điểm sáng hình thoi |
| Ngôi sao | Nền tím rực, sao vàng có đường nét và điểm sáng riêng |
| Trái tim | Nền candy pink, tim hồng/đỏ có viền và highlight |

## Đánh giá thị giác so với concept

| Tiêu chí | Đánh giá |
|---|---|
| Silhouette/độ mở | Có khác biệt thật giữa các bộ; chưa khớp hoàn toàn độ mềm của mí trong concept |
| Hue/saturation/brightness | Sáng và rực hơn V1.8; có gradient sạch, giữ màu riêng Star/Heart |
| Viền iris/sclera | Không đọc lại pupil/iris cũ; kiểm tra runtime 76% và 85% không lộ vòng iris nguồn |
| Highlight | Đúng phía trên, lớn hơn, có điểm sáng phụ; vẫn đơn giản hơn độ long lanh của concept |
| Lông mi | Có mesh cong/thuôn thật; độ phân nhóm và dáng outer lashes chưa đạt độ mềm như concept |
| Da/mí ngoài | Còn crease/dấu vết lông mi nguồn và khác biệt shading ở một số góc/macro; đây là vấn đề còn mở, không phải đã sửa xong toàn bộ mắt |
| Cảm giác dễ thương | Cải thiện màu/độ sạch; chưa tự nghiệm thu tổng thể tương đương concept |
| Cá tính chín bộ | Có khác biệt geometry/material/highlight; còn cần art pass để đủ mức sưu tầm |

## Validation thực sự chạy

| Kiểm tra | Kết quả / phạm vi |
|---|---|
| Khronos glTF Validator | 0 errors; 24 cảnh báo tangent-space trên các primitive dùng material normal-map nguồn; 60 info, chủ yếu dữ liệu UV/mesh không dùng |
| Geometry/indices/UV | PASS: dữ liệu hữu hạn, indices hợp lệ, attribute đủ số đỉnh, ảnh nhúng decode được, 9 bộ đủ node và default scene không chồng bộ |
| CDN | GET 200; 31.376.604 bytes; SHA trùng bản QA; `model/gltf-binary`; `Access-Control-Allow-Origin: *` |
| TypeScript | PASS `tsc --noEmit` |
| ESLint | PASS cho file ứng dụng thay đổi, 0 errors/0 warnings ở lần chạy cuối |
| Next.js | PASS production build |
| Playwright UI | 8/8 PASS: bốn ca trên desktop và mobile Chromium mô phỏng; dùng GLB thật qua transport intercept trong môi trường hạn chế HTTP cache |
| WebGL runtime smoke | PASS: GLTFLoader thật, chín bộ/8 module, một request GLB, iris 76–85%, hai màu độc lập, None/Dramatic, blink biến dạng/khôi phục rest, reset/camera, sticky 390×844 và Cache Storage |
| GPU | SwiftShader CPU, không phải GPU phần cứng; không gọi đây là QA trên iPhone |
| Blender | Import lại GLB đã xuất; Cycles CPU, 32 samples; chín bộ cận mắt và mặt chính diện, góc trái/phải 28° của năm bộ, macro bốn bộ, blink đại diện và `.blend` pack texture |

Lần chạy spec ban đầu bị chặn bởi thiếu FFmpeg của môi trường, trước khi mở trang. Đã thêm config tập trung `video: off`, chạy lại 8/8 PASS. Không thay cấu hình QA chung. Lần thử Chrome đầy đủ không khởi động do Unix socket bị hạn chế; Chrome headless shell khởi động WebGL2 thành công. Runtime test thay transport CDN bằng bytes GLB thật; xác minh HTTP/CORS/checksum CDN được chạy độc lập.

## Các phần chưa đạt / rủi ro

1. **Chưa được nghiệm thu mỹ thuật.** Mí ngoài và lông mi còn dấu vết nguồn, đường nối/shading và phong cách chưa giống concept đủ cao. Không dùng trạng thái pass kỹ thuật để tự duyệt asset.
2. Blink là prototype biến dạng vùng mắt, chưa phải rig mí độc lập hay facial morph library sản xuất. Các góc 3/4 và biên độ lớn cần owner kiểm tra trực tiếp.
3. Chưa có QA Safari/iPhone vật lý, gesture pinch/touch đa điểm trên thiết bị thật, GPU phần cứng hay memory/performance dài hạn.
4. URL asset cố định được xác minh nhưng vẫn phụ thuộc dịch vụ CDN tài khoản hiện tại; giữ GLB và source để chuyển hosting khi cần.

## Tệp thay đổi

`EyeSetCatalog.ts`, `RealHeadPreview.tsx`, `EyeTextureV19.ts`, `page.tsx`, `FacialEyeLab.module.css`, spec EyeSet, config Playwright tập trung, các script build/render/validate/runtime, source dependency pins, README, manifest/QA và tài liệu EyeSet. Thumbnail trong `public/assets/eye-sets/v19` là crop từ render GLB thật.

Commit, PR status và Preview đúng SHA được ghi trong phần bàn giao cuối cùng. PR giữ Draft và không merge.
