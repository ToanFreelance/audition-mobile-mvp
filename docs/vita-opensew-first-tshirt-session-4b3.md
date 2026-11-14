# SESSION 4B.3 — Một T-shirt OpenSew thật trên Vita

2026-11-14 (Asia/Ho_Chi_Minh). **BLOCKED / ART BLOCKED.** Đã tạo đúng một T-shirt native, may/finalize và render thật đủ bốn góc. Kết quả không đạt chất lượng mặc: armhole trái Vita bị hở lớn, sleeve cuộn/sụp khỏi vai. Không thử dựng lại hoặc tạo biến thể.

Nhánh `work/vita-wardrobe-tryon-poc-v1`, remote HEAD trước sửa `babb601b1394c3f7af0f8ce762bda3cdd5d4165c`, không có PR mở cho nhánh. Local sạch nhưng là snapshot cũ `23c3bfc`; đã fast-forward về remote. Toolchain tạm bị mất sau thay workspace; khôi phục đúng archive Blender 5.2.4 và OpenSew commit 86b432238464d88e3d2c5e1cf3fbf693f1e51722, checksum khớp báo cáo 4B, không nghiên cứu/thử phiên bản khác. Đã đọc Project Instructions, ba báo cáo 4B–4B.2 và adapter.

## Các gate độc lập

| Gate | Kết quả | Giới hạn |
| --- | --- | --- |
| DRAFT | **PASS về cấu trúc** | 4 panel/10 seam liên thông; hữu hạn, không suy biến; chiều dài seam qua tolerance upstream 4% + nửa resolution. Chưa chứng minh sẽ may đẹp |
| SEW | **FAIL về chất lượng seam** | Một lần sew và finalize đều FINISHED; automatic gate sơ bộ qua. Render sau đó xác nhận armhole/sleeve bị hở và sụp, nên bác kết quả sewing |
| SKINNING | **PASS về binding/weights** | 1.447/1.447 đỉnh có weights chuẩn hóa, ARMATURE modifier trỏ đúng bản sao rig Vita 155 bones. Chưa thử animation/deformation ngoài rest pose |
| VISUAL | **FAIL** | Không chấp nhận mặc dù process hoàn tất và mesh không có edge >2 face |

## A — Số đo và draft native

Giữ `vroid_aliases` và `closed_neck_measurement` active xuyên suốt drafting/sewing, profile WOMAN được chọn rõ ràng. Không thay số đo bằng số đoán tay. Một lần `cd.add_garment(preset='TSHIRT')`, ease mặc định upstream **8%**.

| Số đo SKIN | cm |
| --- | --- |
| Extent cao | 163,9461 |
| Ngực / eo / hông | 67,3302 / 50,9470 / 71,5988 |
| Cổ theo contour kín | 21,1823 |

| Panel | Rộng × cao trong mặt phẳng pattern (cm) | Đỉnh / mặt |
| --- | --- | --- |
| Front | 39,4715 × 48,6150 | 558 / 504 |
| Back | 39,4715 × 48,6150 | 562 / 510 |
| Sleeve L / R, mỗi panel | 30,3516 × 26,3373 | 226 / 195 |

Native draft parameters: neck half-width 2,3601 cm, neckline front/back depth 7,5/2,2 cm; shoulder half-span 13,3349 cm, shoulder drop 5,5 cm; armhole depth 22,6462 cm và curve length 38,6553 cm. Hai shoulder seam dài khoảng 10,9118 cm mỗi bên. Sleeve cap half-seams 18,2289/18,3701 cm so với armhole half-seams khoảng 17,7015 cm; qua tolerance của test upstream. Assembly ban đầu **1.572 đỉnh / 1.404 mặt**, bounds khoảng **67,7954 × 25,3559 × 50,7096 cm**. Những kiểm tra số này không bảo đảm vai/armhole vẫn giữ đúng vị trí sau drape.

## B — Một lượt may/finalize

`cd.sew()` đúng **một lần**, 32,36 giây; 25 stitch + 50 settle frame mặc định. Finalize chạy thành công bằng native OpenSew; không primitive/voxel/remesh hoặc sửa garment bằng tay. Tổng process gồm bốn render và private save: **99,72 giây, exit 0**.

- Mesh finalize: **1.447 đỉnh / 1.409 mặt**, 90 boundary edges, 0 edge có >2 face, 0 loose edge. Boundary count không chứng minh các lỗ đều là neckline/hem/cuff đúng thiết kế.
- Transfer tạo 155 bone-named vertex groups; 1.447/1.447 đỉnh có trọng số; tổng weight min/max **0,9999999566 / 1,0000000412**, sai số < 1e-4. Số group không có nghĩa mọi group đều mang weight khác 0.
- Body penetration sau finalize: **42/11.428 đỉnh evaluated sâu hơn 4 mm = 0,3675%**; độ sâu lớn nhất **30,893 mm**. Phép gần-surface normal/BVH trên body có biên hở là thống kê gần đúng, chưa kiểm tra triangle/triangle liên tục. Tỷ lệ dưới 2% không đủ để kết luận wearable đạt.

## C — QA bốn render thật

Đã xem `front.png`, `35-degree.png`, `left.png`, `back.png`: Cycles CPU, 800×1000, 24 samples. Scene tạm giữ bản sao Face/Scalp/Hair_Bob/Ribbon với geometry/material nguồn; không sửa identity. `Street_Bomber_Pleats_Sneakers` không được link vào scene render để bỏ áo/váy/giày chung object; giữ shorts riêng. Các panel phẳng ẩn render. Fabric mới màu xanh, roughness 0,85, không dùng texture BOOTH.

Lỗi nghệ thuật còn lại:

- Armhole **trái Vita / bên phải ảnh trước** hở lớn, sleeve cuộn lên và rơi khỏi vai; silhouette bất đối xứng rõ ở front/35°/left/back.
- Vai/nách không chuyển tiếp thành áo liền mạch; vùng lưng có nếp ngang lớn, side profile và gấu loe/cứng.
- Cổ áo gấp thành gờ đứng, chưa giống neckline T-shirt sạch; áo bó/ngấn và phồng không đều.
- Vùng tím trên fitting body/shorts vẫn lộ. Chưa có occlusion trình bày sạch; không nhầm mọi vùng tím thành geometry tay áo cũ — source Body SKIN cũng giữ appearance nguồn.
- Fabric đơn giản nhìn được dưới studio light nhưng thiếu chi tiết vải; không thể cứu lỗi geometry/seam. Source shader phát cảnh báo `shader_nodes_inline.cc:1361` khi render; cả bốn ảnh vẫn xuất thành công, không sửa shader nguồn để che lỗi.

Root cause hiện xác nhận ở mức kết quả: native arrange/sew/finalize chưa duy trì armhole/sleeve phù hợp trên Vita dù draft seam lengths và measurements hợp lệ. Chưa cô lập một lỗi cụ thể trong solver/pinning/weld; không quy kết hoặc sửa internals bằng suy đoán. **Measurement PASS không kéo theo garment/visual PASS.**

## Artifact, tái lập và validation

Private bundle bàn giao chứa bốn PNG thật, `vita-tshirt-private.blend`, `qa.json`, log và report; chỉ lưu private cho owner, không GitHub/Preview. Blend lưu scene thử riêng, source file được duyệt không bị overwrite. `qa.json` giữ kết quả automatic gate sơ bộ và verdict manual review tách biệt.

Tái lập: Blender 5.2.4 `-b --factory-startup --disable-autoexec --threads 2 --python-exit-code 2 --python scripts/vita-opensew-tshirt-gate.py -- --vita-blend /private/Vita-Premium-Cute-V11.blend --opensew-root /tools/opensew-2 --output-dir /private/session-4b3`. Script cần `inspect-vita-opensew.py` cùng thư mục. VISUAL mặc định PENDING_REVIEW, bắt buộc xem ảnh, không tự động PASS.

Validation thực chạy: hash archive/toolchain, hash source BLEND trước/sau và fingerprint body/rig gốc khớp; GLB gốc SHA-256 vẫn `d422159770ee8e9fbc9d78f2f256d5ee988651373cbd211aaa99efd7ecf2bad8`; AST Python; các assertion draft/weight/topology/penetration; xem bốn ảnh; diff/whitespace. Không claim animation hoặc iPhone PASS; không chạy full-project QA/build vì không sửa app.

Chỉ thêm `scripts/vita-opensew-tshirt-gate.py` và tài liệu này. Không sửa adapter đã đạt, upstream, source geometry/outfit/rig/Hair Studio/Character Catalog, Shop/Inventory, gameplay/Supabase. Không commit binary/private asset, không merge/deploy. **BLOCKED / ART BLOCKED**, commit/push và dừng SESSION 4B.3.
