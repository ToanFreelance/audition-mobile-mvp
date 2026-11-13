# SESSION 4B.1 — Adapter OpenSew cho Vita V1.1

Ngày 2026-11-13 (Asia/Ho_Chi_Minh). **BLOCKED tại measurement gate: contour cổ do OpenSew chọn không kín.** Adapter đã nhận đủ 8/8 limb chains; không coi auto figure WOMAN hoặc số đo lặp lại là bằng chứng cổ hợp lệ. Dừng, không tạo garment.

Nhánh `work/vita-wardrobe-tryon-poc-v1`; remote/local HEAD trước sửa `d62af8231b42f54aad4b7002de49d50bde2e7929`, working tree sạch, API PR đang mở cho nhánh trả rỗng. Đã đọc Project Instructions và báo cáo 4B. Dùng lại Blender **5.2.4 LTS / cd5dc428cce1**, OpenSew commit **86b432238464d88e3d2c5e1cf3fbf693f1e51722**; không nghiên cứu/cài lại toolchain.

## A — Bản sao SKIN và giới hạn bề mặt

Source BLEND đúng SHA-256 `138a5b8321bd333e409340be321e483bdef6f2e6bebe5758bc8af6d4d75fed52`; GLB được duyệt đúng `d422159770ee8e9fbc9d78f2f256d5ee988651373cbd211aaa99efd7ecf2bad8`. Cả hai giữ nguyên hash sau phiên.

Script sao chép object/data/armature vào scene tạm, xóa riêng mặt không thuộc material `Body_00_SKIN` trên bản sao. Không vá lỗ, remesh, thay kích thước hoặc save/export geometry. Bản sao bỏ modifier presentation không phải ARMATURE để kiểm tra mặt da rest gốc. Tọa độ và từng trọng số vertex còn lại được đối chiếu chính xác theo source vertex ID. Fingerprint body/rig gốc trước/sau khớp; giữ nguyên **155 bones**.

| Kiểm tra | Kết quả |
| --- | --- |
| SKIN giữ lại | **4.648 đỉnh / 7.732 mặt** |
| Loại khỏi bản sao | 2.122 mặt Tops_CLOTH + 760 mặt Shoes_CLOTH; không đưa object Face vào Body_00_SKIN |
| Hệ tọa độ | METRIC, scale_length 1; scale (1,1,1); world transform xoay 180° quanh Z; auto-facing **-Y**, L/R được kiểm tra theo trục side |
| Extent SKIN | Z = 0,035678 đến 1,675139 m; chênh cao **1,639461 m**. Khác extent object có áo/giày của 4B do loại vùng CLOTH, không scale lại body |
| Kiểm tra bề mặt | 58 mặt cắt thăm dò tại torso, cổ thấp và 3 vị trí/đoạn tay/chân đều kín; 0 geometric nonmanifold edge |
| Tính liên tục | So khớp seam trùng tọa độ ở độ chính xác micromet chỉ để chẩn đoán, không weld mesh |

**58 probe kín chỉ là điều kiện để thử measurement, không chứng nhận toàn bề mặt kín.** Có ba boundary component:

| Vùng biên hở | Bằng chứng world-space |
| --- | --- |
| Vùng mặt, gần J_Adj_R_FaceEye | 38 điểm biên; Z 1,440500–1,666642 m, X -0,093387–0,092546 m |
| Gần J_Bip_R_Hand | 7 điểm biên; X -0,525752–-0,523261 m, Z 1,342801–1,354089 m |
| Gần J_Bip_L_Thumb1 | 7 điểm biên; X 0,519935–0,522796 m, Z 1,325000–1,349773 m |

Các probe giữa forearm chưa bị các lỗ nhỏ gần bàn tay chặn. Tuy nhiên phép đo cổ thật ở C đi cao hơn probe cổ thấp và chạm vùng biên hở phía mặt; vì vậy input SKIN này **chưa phù hợp cho bộ số đo hoàn chỉnh theo thuật toán OpenSew nguyên trạng**.

## B — Adapter tối thiểu, không đổi skeleton

`vroid_aliases()` là context manager trong script: mở rộng bốn bảng lookup/mask của `clothing_design.avatar` trong process, giữ fallback cũ và phục hồi đúng object bảng gốc trong finally. Không sửa file OpenSew hoặc đổi tên production bone.

| Chuỗi | Bên trái | Bên phải |
| --- | --- | --- |
| arm | J_Bip_L_UpperArm → J_Bip_L_LowerArm | J_Bip_R_UpperArm → J_Bip_R_LowerArm |
| farm | J_Bip_L_LowerArm → J_Bip_L_Hand | J_Bip_R_LowerArm → J_Bip_R_Hand |
| thigh | J_Bip_L_UpperLeg → J_Bip_L_LowerLeg | J_Bip_R_UpperLeg → J_Bip_R_LowerLeg |
| calf | J_Bip_L_LowerLeg → J_Bip_L_Foot | J_Bip_R_LowerLeg → J_Bip_R_Foot |

Thêm alias neck/chest/waist/hip: `J_Bip_C_Neck`, `J_Bip_C_Chest`/`UpperChest`, `J_Bip_C_Spine`, `J_Bip_C_Hips`. Limb masks dùng đúng group UpperArm/LowerArm/UpperLeg/LowerLeg tương ứng L/R; torso exclusion bổ sung LowerArm, Little và J_Adj_, giữ các mask arm/hand/finger/head có sẵn.

Kết quả: **8/8 chain đúng tên, đúng bên và đúng chiều dài từ bone head; 8/8 có limb profile hữu hạn**. Upper-arm side projection L +0,108680 m, R -0,108680 m. Tổng 69.092 mẫu SKIN; torso giữ 45.734 mẫu, **0 mẫu mang nhãn arm/head/hand/finger lọt vào torso**, không rơi vào fallback toàn body. Từng limb có 2.413–5.242 mẫu group phù hợp, vượt mức tối thiểu 20 của OpenSew. Các bảng lookup được restore thành công.

## C — Số đo, lặp lại và đối chiếu độc lập

Một focused validation pass, gồm hai lần đo force/cold-cache trên cùng bản sao để kiểm tra lặp lại. Delta lớn nhất của chiều cao, các vòng và chiều dài limb = **0,0 m**; tất cả hữu hạn/dương, thứ tự hip < waist < chest < shoulder < neck nhất quán. Không ép WOMAN hoặc thay số đo. Cột 4B lấy từ kết quả lịch sử đã ghi, không chạy lại object có CLOTH.

| Đại lượng (cm) | SESSION 4B, chưa hợp lệ | SKIN + adapter lần này | Đối chiếu đường cắt SKIN thật |
| --- | --- | --- | --- |
| Extent cao | 167,525 | 163,946 | Khớp bounding extent SKIN |
| Ngực | 57,436 | 67,330 | Contour kín 67,974; lệch 0,947% |
| Eo | 61,540 | 50,947 | Contour kín 49,702; lệch 2,505% |
| Hông | 94,244 | 71,599 | Contour kín 72,559; lệch 1,323% |
| Cổ | 22,459 | **20,074 — INVALID** | Contour **hở**, không có chu vi kín để xác nhận |

Auto figure thay MAN → WOMAN chỉ được ghi nhận như heuristic, không tham gia quyết định PASS. Các vòng ngực/eo/hông được đối chiếu với giao tuyến tam giác thực trên mesh SKIN, không dùng bán kính suy diễn để tự xác nhận lẫn nhau. Ngưỡng sai lệch profile 96 bin/16 sector so với contour kín đặt trước khi chạy là 10%; không đổi ngưỡng sau kết quả.

**Blocker chính xác:** `neck_girth()` chọn Z = **1,451770959 m**. Ở đây `slice_ok(min_cover=0.90)` của OpenSew vẫn trả true, nhưng graph giao tuyến thực **không tạo vòng kín**. Tổng chiều dài đoạn hở khoảng 18,303 cm không phải chu vi cổ hợp lệ. Số 20,074 cm từ profile không được chấp nhận, dù nó lặp lại ổn định. Không sửa scan cổ, ghép Face, vá mesh hoặc chọn số thay thế sau khi phát hiện blocker.

## Tái lập và validation

File thay đổi: `scripts/inspect-vita-opensew.py` và tài liệu này. Script chỉ ghi JSON metadata do caller chọn, kiểm tra hash source và module avatar trước khi chạy; không chứa asset/geometry private.

```bash
/tools/blender-5.2.4/blender --background --factory-startup --disable-autoexec \
  --threads 2 --python-exit-code 2 --python scripts/inspect-vita-opensew.py -- \
  --vita-blend /private/Vita-Premium-Cute-V11.blend \
  --opensew-root /tools/opensew-2-86b432238464d88e3d2c5e1cf3fbf693f1e51722 \
  --output /private/vita-opensew-audit.json
```

Đường dẫn trên là placeholder cho binary/input thực. Bỏ `--opensew-root` để chỉ kiểm tra A. Đã chạy A (5,18 giây, exit 0) và đúng một validation pass B/C (10,10 giây, **exit 2 có chủ đích do gate BLOCKED**, JSON vẫn ghi đầy đủ). Lỗi kết thúc: `RuntimeError: BLOCKED: số đo chưa qua cross-check; không tạo garment`. Cảnh báo socket startup giống 4B không ngăn test. Kiểm tra AST Python, hash input trước/sau, bảo toàn tọa độ/weights/rig, closed sections, masks, repeatability và diff/whitespace. Không chạy build/full-project QA hoặc claim iPhone/visual acceptance.

**BLOCKED** cho mục tiêu số đo Vita hoàn chỉnh. Cần một phương án neck measurement có giới hạn giải phẫu và kiểm tra contour kín, hoặc input fitting riêng có contour tương ứng hoàn chỉnh, được xác minh trong task tiếp theo. Không cần đổi skeleton 155 bones để giải quyết blocker này. Phiên này không thử cách sửa thứ hai, không tạo garment/character geometry mới, không sửa Hair Studio/catalog/gameplay/RoomState/WebAudio; không commit private asset, không merge/deploy. Commit/push checkpoint rồi dừng.
