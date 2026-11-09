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
