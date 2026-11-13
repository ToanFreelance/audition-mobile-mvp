# SESSION 4B.2 — Sửa phép đo cổ Vita/OpenSew

Ngày 2026-11-13 (Asia/Ho_Chi_Minh). **PASS cho measurement gate trên bản sao SKIN Vita V1.1 ở rest pose.** Không tạo/draft/simulate garment, không merge/deploy.

Nhánh `work/vita-wardrobe-tryon-poc-v1`; remote/local HEAD trước sửa `c1c91c358d951ab5df34b3eeecee2198c331f46e`, working tree sạch; API PR đang mở cho nhánh trả rỗng. Đã đọc Project Instructions, báo cáo 4B/4B.1 và script hiện có. Dùng lại Blender **5.2.4 LTS / cd5dc428cce1** và OpenSew commit **86b432238464d88e3d2c5e1cf3fbf693f1e51722**, không cài lại toolchain.

## Root cause và contour giải phẫu

`neck_girth()` upstream quét từ neck landmark lên thêm 0,13 m; mật độ angular sector ≥ 90% không chứng minh giao tuyến kín. Trên Vita, phép cũ vẫn trả **20,074151 cm** từ vùng hở gần Z 1,451771 m. Không dùng giá trị này làm vòng cổ hợp lệ và không sửa source OpenSew.

Vùng quét mới được xác định từ **J_Bip_C_Neck.head → J_Bip_C_Head.head** trong world space: Z **1,391770959–1,466325164 m**. Shoulder landmark thấp hơn ở Z 1,349550486 m. Quét 64 vị trí nội suy trong shaft và thêm midpoint giữa các event Z của boundary vertices: tổng **69 mặt cắt**. Không đưa offset Z hoặc chu vi đoán tay vào thuật toán chọn.

- **43 mặt cắt kín liên tiếp** trong khoảng Z **1,392917947–1,439944445 m**; các interval giữa boundary events cũng được thăm dò. Mỗi mặt cắt có một component duy nhất, bao trục cổ theo phép point-in-ring.
- **26 mặt cắt hở**, mỗi mặt cắt có 2 endpoint, 0 branch; cả 2 endpoint nằm trên geometric boundary của mesh. Khoảng cách endpoint tới boundary tối đa **1,2932e-7 m**.
- Kiểm tra mỗi mặt cắt ở precision **1 µm, 10 µm và 100 µm**, giữ nguyên quyết định kín/hở. Đây là biên hở thật, không phải sai số section; không weld/patch mesh.

Chọn vòng nhỏ nhất trong dải kín có **hai hàng xóm kín**, và kiểm tra chênh lệch hàng xóm không quá ngưỡng 10% hiện có. Kết quả nằm trong shaft, dưới biên vùng mặt đầu tiên Z 1,440500140 m, phía trên chân cổ; không chọn contour vai/trapezius hoặc vùng mặt.

| Z world (m) | Chu vi contour SKIN (cm) | Graph |
| --- | --- | --- |
| 1,420445653 | 21,200383 | Kín |
| **1,421592641** | **21,182293** | **1 component, 28 node, degree 2, 0 endpoint, 0 branch** |
| 1,422739629 | 21,192408 | Kín |

Chu vi chọn chính xác **0,2118229254396848 m**. Cả ba precision cho cùng chu vi tại vị trí chọn. Hai mặt cắt lân cận lệch tối đa **0,085405%**, thấp hơn 10%; không đổi threshold để đạt PASS.

## Override dùng được cho OpenSew

Thêm `closed_neck_measurement(avatar, skin, rig, audit)` trong `scripts/inspect-vita-opensew.py`. Khi scope active, `avatar.neck_girth(m)` cho đúng bản sao Vita **tính lại giao tuyến thật**, yêu cầu một vòng kín bao trục rồi trả tổng độ dài edge; không chỉ gắn số vào JSON. Các body khác dùng hàm cũ. Context manager phục hồi function reference gốc trong finally.

Các consumer `_draft_top` và hoodie của OpenSew gọi `avatar.neck_girth(m)` qua cùng module `library.avatar`. Validation gọi chính accessor chung `library.avatar.neck_girth(m)` và nhận **0,2118229254396848 m**, khớp measurement. Chưa gọi các hàm tạo pattern/garment. Để sử dụng về sau, scope `vroid_aliases(...)` và `closed_neck_measurement(...)` phải bao quanh bước đo/consumer của bản sao rest; không cần sửa upstream hay skeleton.

## Bảng số đo hoàn chỉnh và hồi quy

| Đại lượng | SESSION 4B.1 | SESSION 4B.2 |
| --- | --- | --- |
| Extent cao SKIN (cm) | 163,946086 | 163,946086 |
| Ngực (cm) | 67,330233 | 67,330233 |
| Eo (cm) | 50,947044 | 50,947044 |
| Hông (cm) | 71,598781 | 71,598781 |
| Cổ (cm) | 20,074151 — INVALID | **21,182293** |
| Upper arm L / R (cm) | 21,925155 / 21,925566 | 21,925155 / 21,925566 |
| Forearm L / R (cm) | 21,430099 / 21,429953 | 21,430099 / 21,429953 |
| Thigh L / R (cm) | 37,282761 / 37,282734 | 37,282761 / 37,282734 |
| Calf L / R (cm) | 43,098838 / 43,098895 | 43,098838 / 43,098895 |

8/8 chain vẫn đúng bone/bên/chiều dài; mask vẫn 0 mẫu arm/head/hand/finger lọt vào torso. Extent cao là phạm vi SKIN, không tính vùng CLOTH/giày đã loại; không scale lại body. Auto figure WOMAN chỉ là heuristic, không dùng để quyết định PASS.

Một validation pass, hai lần đo force/cold-cache: delta lớn nhất = **0,0 m**. Delta hồi quy cao/ngực/eo/hông so với 4B.1 = **0,0 m**. Cross-check với contour SKIN thật: ngực lệch **0,947%**, eo **2,505%**, hông **1,323%**, cổ **0%**; tất cả contour kín và qua threshold **10% không đổi**. Không nới các điều kiện kiểm tra lặp lại/mapping/masking cũ.

## Validation, file thay đổi và giới hạn

- Task A contour inspection: **11,47 giây, exit 0**; sau đó đúng một validation pass đầy đủ: **11,36 giây, exit 0, PASS**.
- Hash trước/sau của **13 file** khớp: BLEND/GLB được duyệt, binary Blender và 10 file Python OpenSew. BLEND SHA-256 `138a5b8321bd333e409340be321e483bdef6f2e6bebe5758bc8af6d4d75fed52`; GLB `d422159770ee8e9fbc9d78f2f256d5ee988651373cbd211aaa99efd7ecf2bad8`.
- Fingerprint body/rig gốc, tọa độ/weights SKIN và skeleton **155 bones** giữ nguyên. Lookup tables và override neck đều được restore bằng kiểm tra object/function identity.
- Kiểm tra AST Python, diff/whitespace và chỉ hai file trong checkpoint. Cảnh báo socket startup không ngăn Blender hoàn tất; không chạy build/full-project QA.

File thay đổi: `scripts/inspect-vita-opensew.py` và tài liệu này. Tái lập bằng lệnh trong báo cáo 4B.1; thêm `--neck-inspection-only` nếu chỉ cần Task A. JSON chi tiết chỉ là metadata private, không commit mesh/asset/source Vita.

Giới hạn còn lại: biên hở vùng mặt và lỗ gần tay vẫn tồn tại, không được sửa; gate này áp dụng riêng source Vita đã hash, rest pose và OpenSew commit đã pin. Chưa kiểm chứng garment fit, animation, export, hình ảnh hoặc iPhone. Không thay Hair Studio/catalog/gameplay/Supabase/RoomState/WebAudio. **PASS chỉ cho measurement checkpoint**; commit/push rồi dừng SESSION 4B.2.
