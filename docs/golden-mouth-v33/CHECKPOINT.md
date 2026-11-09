# M01 V3.3 — checkpoint ban đầu, chưa acceptance

09/11/2026. Branch work/female-golden-mouth-v1-qa, HEAD đã kiểm e1400d7a578d3307018f977761e298fb461a2cc9. PR #26 OPEN/Draft, base accepted V8. Không merge.
Blender 4.3.2 /usr/bin/blender đang hoạt động. V8 diff rỗng so 1a0ba6e4fd8a1a0e76453a2e698fb9fcc5746576.
Input V3.2 libfile_b23cc9d3507c8191acda5e4d1ca77fce đã phục hồi và hash khớp cd53bb6d1fd7d0178300958d47c73511fc253e7a68b8fc57aad5ebd5345401c7.
GLB upload/Female_anime_origin(6).glb hash khớp b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90; không commit.
Golden: upload/576DB180-B6A4-4EF0-BD99-EE6183F85C1A(3).jpeg, M01 ô trên trái đã xem.
ROOT=/workspace/scratch/e27dffa28e71/m01-v33; input tại ROOT/input/M01-Natural-V32-Iteration-03.blend.

Đã đọc PROJECT_INSTRUCTIONS, QA/CHECKPOINT V3.2, source sculpt/verify; xem Cycles front/35/profile/clay/cận cảnh và Golden.
Ưu tiên mới: giữ môi dưới và perioral fullness V3.2, sửa upper roll/Cupid, rồi mới cân nhắc width.

Định vị artifact: face 398187 cùng các mặt 397282/398287/398285, đỉnh 239233/239234/239235/239237/239338/239339; tâm khoảng (.043,.3217,.2385), các góc mặt kề 64–68°. Sẽ kiểm phần native surface tại đúng vùng này, không smoothing toàn miệng.
Khóa lower central: abs(x)<.042, .282<height<.3335, depth>.19 theo V3.2, 1804 đỉnh. Sẽ mở rộng bảo vệ lower support trong script cuối; lateral chỉ thay đổi tối thiểu để tiếp seam.
Đo sơ bộ: width .090006 / facial width tại mouth height .355402 = .2533; / lower-face width tại h=.30 .276775 = .3252. IPD cần đo cùng rig/reference; không quyết định width bằng một ratio.

Kế hoạch: upper-lip region-only surface refinement, seam/lower/nose locked; geometry và albedo chẩn đoán riêng. Lưu source + blend trước render. Chưa PASS, chưa runtime.
