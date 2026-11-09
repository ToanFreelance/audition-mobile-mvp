# Golden Mouth V4 — manifest phục hồi ban đầu

Ngày 09/11/2026. Owner chấp nhận **tạm thời M01 V3.3 Refined-02** cho MVP; không sửa tiếp M01. Visual FAIL V3.3 giữ nguyên là lịch sử, không còn là lý do chặn mở rộng preset.

- Branch: `work/female-golden-mouth-v1-qa`; HEAD kiểm đầu phiên `d4d6e681f00be31f8fd5f8246a8d9b2d51451c22`.
- PR #26 OPEN/Draft, base Golden Eye V8 `1a0ba6e4fd8a1a0e76453a2e698fb9fcc5746576`. Không merge.
- M01 checkpoint: `libfile_641c2f4215248191b41c2dd7a51fa6e4`, SHA `7fdc16e00012f785c76dba9d88700e7139b0e36c85f302d7a0dd0940508bcb8a`, key `M01_Natural_V33`; đã phục hồi và kiểm hash.
- Source GLB: `upload/Female_anime_origin(6).glb`, SHA `b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90`; đã kiểm hash, không commit GLB.
- Golden: `upload/576DB180-B6A4-4EF0-BD99-EE6183F85C1A(3).jpeg`, đã xem đủ chín ô.
- Blender 4.3.2 `/usr/bin/blender`; headless hoạt động. Workspace root `/workspace/scratch/e27dffa28e71/mouth-v4`; input `input/M01-Natural-V33-Refined-02.blend`.

Catalog đã kiểm từ V1: `natural`, `soft-smile`, `bright-smile`, `playful-smirk`, `cute-pout`, `surprised`, `shy`, `idol-smile`, `blow-kiss`. Giữ ID, không dùng geometry patch V1.

Đang làm A: kiểm native seam để xác định có thể mở môi mà giữ topology hay cần giải pháp tối thiểu. Giữ native volume, không cắt ellipse. Sau đó dựng M03/M06, lưu và render trước khi mở rộng nhóm B. Chưa tuyên bố preset mới PASS.

V8 giữ ba slot morph mắt với semantics hiện có. Khi tích hợp miệng phải tránh thay đổi code V8; các delta miệng dùng chung source Basis, không cộng full M01 với full preset khác. Không tạo actor/load GLB lại khi đổi preset.

Đã đọc PROJECT_INSTRUCTIONS, báo cáo V2/V3.3 và source rig mắt/miệng. Phạm vi chỉ facial QA, không gameplay/catalog/Supabase.

## Checkpoint A prototype — chưa qua art/geometry gate

Seam fan đã sửa theo orientation nhất quán: thêm 95 vertices, rewire 188 faces, giữ nguyên 499762 tam giác, xóa 0 mặt da. M01 source prefix và Basis giữ chính xác.

Đã save và mở lại/render prototype. Artifact `libfile_e620b536fb048191a161f798798f55db`, SHA `17eedfa65160d39630a03eb9019f0bf271f999117af9915d5c82d8edf08e3018`, 63059749 bytes. Đây là prototype chưa PASS, không phải bản hoàn chỉnh.

M03 có opening/răng thật nhưng vùng khóe còn kéo mạnh. M06 hiện hình thoi và kéo mô quanh nhân trung; cần sửa silhouette O và chuyển tiếp mô đỡ trước khi mở rộng. Không coi prototype là MVP PASS. Đã lưu render failure để đối chứng.

## A3 — cavity prototype đã phục hồi được, còn lỗi lining

Artifact `libfile_52eef0c822e0819192b2676feb909a4d`, SHA `baae646af193c10e898f118b6b76bbdfa09b209256cf7cb33f6c840a809e013e`; đã mở lại/render và validate. M01 bất biến. Native Laplacian Deform trên mô đỡ, 7699 vertices trong bản sao authoring, không thay da runtime. Normal transport theo rotation bề mặt sửa discontinuity do thay normals theo mask.

Validation A3 phát hiện M03 47 / M06 52 cặp giao cắt tại nếp scan bên trong môi; chưa PASS. A4 dùng correction dọc seam liên tục giảm còn 22/49. Đang unroll đúng strip inner-lining geodesic <.006, giữ seam và outer lip làm biên; không smoothing da/môi ngoài, không đổi M01. Cần xác minh giao cắt bằng BVH trước nhóm B.

## Checkpoint A — giải pháp cuối đã qua geometry và render MVP

Native scan không có aperture. Giữ toàn bộ tam giác dẫn tới folded lining tự giao nhau; unroll harmonic thử nghiệm cũng không đạt, không dùng trong pipeline cuối. Giải pháp tối thiểu là bỏ 555 triangles ở dải nội môi cách seam geodesic <.001, không thay da/môi ngoài. Giữ đúng 292645 vertices, Basis và toàn bộ tọa độ M01; các mặt còn lại giữ connectivity/UV nguồn. Outer mesh chung còn 499207 triangles; một boundary loop manifold 137 vertices nối cavity thực. Không thêm vertices da hoặc dùng patch ellipse.

M01/M03/M06 đã mở lại validate: zero face >90°, zero degenerates, zero local non-adjacent intersections, UV split separation=0, nose=0. Renders front/cận/35/clay thật xác nhận opening/teeth. M01 chỉ có thay đổi topology nội môi, không sculpt lại; volume/coordinates giữ nguyên.

Hai pose M03/M06 đã đóng băng tuyệt đối trong `scripts/golden-mouth-v4/validated-open-controls.npz` (sparse absolute coordinates, không delta chồng M01). Có thể phục hồi bằng `sculpt_support.py --reuse-controls` từ Git; không cần giữ file NPZ lớn ở scratch. Nhóm B dùng đúng pose này.

## Nhóm B — đủ chín shape keys đã lưu trước QA đắt

A validated: `libfile_57beccc7ad6c8191b56a24f764cd2c2c`.

B editable đủ M01–M09: `libfile_baa4be84aea881919725caefd5384a1f`, SHA `9346c7b52bfa484ca3533fc43ad7eec44794450e9059a935c82323319e0f53d8`, 79,388,575 bytes; đã mở lại kiểm keys/positions/UV. Native geometry gate PASS cả 9: zero faces >90°, degenerates, UV-split separation và local non-adjacent intersections; nose h>=.378 bất biến. M03/M06 reuse bit-exact từ A4 qua frozen controls.

Đang render grid chín miệng, mouth/clay và 35° bằng Cycles CPU. Đang kiểm nội thất riêng; chưa tuyên bố art/runtime/81-combo PASS. Chưa có route V4 hoặc iPhone preview.

## Bản bàn giao MVP đã khóa trước WebGL2

Bản mới nhất: `libfile_1bb6d576cea881918e57d5fd45792652`, filename `Golden-Mouth-V4-MVP-Nine-Presets.blend`, version 1. SHA `153b589728fe54dea3f5088f2cf637541fc29b41fb42afdde743658c2cd35e79`, 108170836 bytes. Đã mở lại kiểm Basis/V3/V32/M01 bit-exact, packed images/materials và driver một weight cho cả 9. Float eval sai số tối đa 1.863e-9; dữ liệu key lưu chính xác. Collection ẩn `V4_Original_Source_Backup` chứa đủ original 292645 vertices/499762 triangles và UV.

Native chính: 292645 vertices/499207 triangles, cố định cho 9 pose, 555 face nội môi bỏ có chủ đích; không thay da mặt/môi ngoài. Cavity cuối là bowl concave riêng, margin nằm sau môi và parent head, không cố kéo fan qua boundary scan gấp. Đã kiểm all 9 cavity, teeth và tongue: zero tự giao/cắt da/thành phần crown. Tooth gap nhỏ và arch M08 thấp hơn để tránh chạm môi.

M05/M09 chọn intensity .50/.60 của bản LP điều chỉnh, làm preset đầy đủ trước export, không blend cộng M01 ở runtime. Nhẹ hơn Golden, còn độ căng nhân trung nhỏ; phần polish để sau MVP. Không dùng direct-pout/corrective-smooth/inner harmonic thử nghiệm. Bảy pose còn lại giữ nguyên khi sửa hai pose này.

Dữ liệu chính xác để phục hồi: `scripts/golden-mouth-v4/frozen-final-controls.npz` (absolute coordinates 7950 vertices x9; M01 vẫn từ checkpoint gốc). `recover_delivery.py` đã so sánh positions/faces/UV bit-exact với bản delivery.

Asset web: 1597931 bytes, SHA `2548334bd96d6327ea5b56124b65589ae84f8777ac33a34852fe0a8d28b5ca1d`. Head có 9 target CPU sparse one-hot relative original Basis để giữ đúng 3 GPU morph controls V8. Interior có 9 GPU targets riêng. Đổi miệng không gọi eye API, không tạo actor/nạp GLB lại. V8 code/assets giữ nguyên.

Cy­cles CPU 48 samples, 8 threads, denoising tắt: đủ grid front 9, mouth 9, clay 5 và 35° 4. Mắt trong Cycles là native tím. WebGL2/81-combo và Vercel hiện **PENDING**, chưa tuyên bố PASS hoặc physical iPhone acceptance.
