# V3.1 M01 — checkpoint bắt đầu

09/11/2026. Branch work/female-golden-mouth-v1-qa, HEAD đã kiểm b60985ca2cb1b6146355772eedda351f6c2b508d. PR #26 OPEN/Draft.
Blender 4.3.2 /usr/bin/blender. Không sửa V8 (diff rỗng với baseline 1a0ba6e).
Nguồn GLB local upload/Female_anime_origin(6).glb SHA b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90 đã xác minh.
Checkpoint chính m01-v31/input/M01-Natural-V3-Iteration-02.blend đã phục hồi từ libfile_b9f3f69b851881919c97804b45a158ea, SHA e0862f84330901f3cbe1dfa4e9deba47a12e7a8dc3e4c6c3e1091f144acdf0bf khớp.

Chẩn đoán trước sửa: V3 giảm độ nhô cả upper/lower roll so với Basis; vùng khóe vẫn có hõm. Clay xác nhận vấn đề không chỉ do pigment. Cần so depth tương đối với nhân trung và vùng dưới môi, không chỉ cộng offset vào lip center. Giữ chiều rộng/độ cao M01 V3. Chỉ phục hồi một phần mất projection và mô đỡ liên tục. Baked highlight/pigment không sửa ở bước này.

Kế hoạch: key M01_Natural_V31 riêng từ V3; profile hỗ trợ bám độ mất chiều sâu gốc, khóa mũi với vùng bảo toàn rõ; sửa displacement không đều ở seam face 411680; render clay/front/profile trước. Basis/V3/UV/textures giữ nguyên. Chưa PASS, chưa runtime.
