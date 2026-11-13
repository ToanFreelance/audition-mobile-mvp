# Cyber Blue Top Wearable V1 — SESSION 2

## Checkpoint A — nguồn thật và phương án

Ngày 2026-11-13; baseline `dbfd71c6242a3922233f8460213cd076d036030d`.
Remote HEAD khớp SESSION 1; chưa có PR. Checkout sạch trước sửa. Chỉ TOP, giữ nguyên asset V1.1.

- GLB owner: 4.953.812 byte, SHA-256 `d422159770ee8e9fbc9d78f2f256d5ee988651373cbd211aaa99efd7ecf2bad8`.
- ZIP owner: 5.736.271 byte, SHA-256 `4ef821492096d9facaf166fadb2f6f2c01b364571ac52b80cfb2c6f7cb883868`.
- Tìm thêm được đúng file gốc `Vita-Premium-Cute-V11.blend`, 19.313.996 byte, SHA-256 `138a5b8321bd333e409340be321e483bdef6f2e6bebe5758bc8af6d4d75fed52`.
- GLB có 1 skin / 155 joints, không có animation nhúng. Outfit riêng nhưng áo/váy/giày chung `Street_Bomber_Pleats_Sneakers`: 8 primitive, không UV; 80 component khi import Blender. Không thể gán atlas Cyber Blue vào nhóm này rồi gọi là conversion.
- `Street_Skin` trong GLB bị cắt vùng thân/cánh tay dưới áo. File Blender gốc còn `Vita_Suit` ẩn: 6.423 vertex, 7.732 face da, 155 vertex groups. Da thân 1.163 face, nách trái/phải 400/403, upper-arm trái/phải 187/188 trong vùng audit.
- Cyber Blue top có 8 entry; template `N00_005_01_Tops` + `N00_010_01_OnePiece`, không có mesh xuất sẵn. Ảnh nguồn cho thấy áo khoác dài tay, mở phía trước, hood xanh; V0.4 áo đóng thân ngắn tay không đúng cấu trúc này.

**Root cause:** ba shell rời, bind theo pose đang chạy, UV phong cách hóa và áo cũ không bị che là các vấn đề cấu trúc; slider không giải quyết được.

**Phương án B duy nhất:** dựng lại bề mặt áo từ donor da thật `Vita_Suit`, tạo topology độc lập liên tục qua nách/vai, chuyển skin weights theo bề mặt donor; không dùng box/cylinder.
Binding phải kiểm tra với skin/bind-space GLB chuẩn theo tên bone và inverse-bind; không reset rig avatar.
UV sẽ được author theo panel thân trước/sau/tay/hood, sử dụng texture owner cục bộ; đây là **approximate reconstruction**, không phải canonical VRoid UV hoặc conversion chính xác.
Loại chỉ triangle áo cũ khỏi bản geometry preview riêng, lưu reference cũ để restore; không ẩn cả nhóm vì sẽ mất váy/giày.
Mesh/texture sinh ra chỉ ở file riêng của owner để import cục bộ; không commit binary/texture hoặc phát hành công khai khi quyền phân phối còn chưa rõ.

**A: có nguồn donor khả thi, cho phép một lần dựng thử có giới hạn.**
Audit vùng bề mặt không thay thế QA topology/bind/visual ở B/C. Nếu lần dựng này không đạt các gate đó, ghi blocker và dừng, không thử chuỗi approximation khác.

Audit lặp lại (Blender 4.3.2, không GUI):

```sh
blender --disable-autoexec -b --python scripts/inspect-vita-cyber-blue.py -- \
  --vita-glb /private/Vita-Premium-Cute-V11.glb \
  --cyber-zip /private/Cyber_Blue.zip \
  --vita-blend /private/Vita-Premium-Cute-V11.blend \
  --out /private/cyber-blue-top-audit.json
```

Không thay đổi Hair Studio, Character Catalog, gameplay, RoomState, Supabase hay WebAudio.

## Checkpoint B — một probe, bị loại trước tích hợp

Đã chạy đúng **một** phương án dựng bề mặt ở trên bằng Blender 4.3.2.
Probe được giữ tại `scripts/probe-cyber-blue-top-surface.py`, có nhãn **REJECTED DIAGNOSTIC ONLY** và chặn output trong repository.
Không có binary, texture, ảnh owner hay tọa độ mesh private được commit.

Kết quả kỹ thuật thực đo:

| Kiểm tra | Kết quả |
| --- | --- |
| Bề mặt donor sau crop/weld | 1 component; 4 vòng biên đơn (cổ/gấu/2 cổ tay); 0 cạnh non-manifold ngoài biên |
| Topology probe độc lập | Voxel remesh 8 mm + bề mặt cổ gắn liền; 13.439 vertex, 13.200 polygon; 1 component |
| Trọng số da | Nội suy barycentric từ triangle donor, tối đa 4 ảnh hưởng/vertex; tổng trọng số 0,9999999404–1,0000000447 |
| Bind compatibility | Đủ 155 tên joint; inverse-bind matrix so với GLB V1.1 có sai khác lớn nhất **0,0** |
| Mesh/UV VRoid gốc | Không có; geometry và UV probe đều approximate |
| Ảnh kiểm tra | Đã render và xem front / 35° / side / back bằng Cycles; ảnh chỉ để kiểm tra nội bộ |

**B: FAIL về hình ảnh; không có wearable V1 đạt yêu cầu.**
Các lỗi quan sát cụ thể:
- Hood thực tế trong nguồn là hood áo khoác; probe chỉ tạo vành cổ phẳng, không có thể tích/túi và nếp gấp đúng.
- Form áo bám sát ngực/eo donor như bodysuit, chưa có độ rủ và ease của áo khoác nguồn.
- Mép mở trước và ranh giới panel bị răng cưa sau remesh/cắt mặt.
- UV dùng patch vải từ atlas thực nhưng chọn/mapping sai vùng màu; không tái hiện mảng trắng–đen–xanh và đường cắt trên ảnh BOOTH.
- Chưa có lớp áo đen trong của custom item BodySuit.
- 13.439 vertex chưa tối ưu; đây không phải lý do chính loại probe, ưu tiên vẫn là hình ảnh.
- Chưa xử lý occlusion áo cũ trong runtime và chưa có equip/restore mới: không tích hợp geometry đã fail để giả lập thành công.

### Blocker và dependency tối thiểu

Hai input owner **không thiếu**, donor thân Vita cũng đã tìm thấy và bind đã xác minh. Blocker không phải quyền đọc file hoặc thiếu Blender.
Custom item không có canonical garment topology/UV; phép offset/remesh da giải quyết được sự liên tục và skinning nhưng không tạo được cấu trúc hood, độ rủ và đường may/UV đúng nguồn.
Một lần dựng thử đã chứng minh giới hạn này. Không tiếp tục chuỗi thay tham số hoặc dùng cylinder/box.

Cần **một** trong hai đầu vào:
1. Export riêng tư/được phép của Cyber Blue TOP từ VRoid Studio: VRM/GLB, hoặc XWear kèm đường import thực sự hoạt động, có mesh của đúng hai template, UV/material layer và bind weights; có thể là avatar export chứa top để tách cục bộ.
2. Mesh TOP do artist dựng đúng reference (áo khoác dài tay, mở trước, hood + lớp trong), UV có thể đối chiếu atlas, ở cùng rest space Vita hoặc có rig/bind để chuyển trọng số. Donor `Vita_Suit` hiện có là nền kỹ thuật để artist làm việc; không yêu cầu thay face/base.

Không yêu cầu owner dùng desktop để tiếp tục phiên này. Không dùng avatar khác thay Vita. Quyền phân phối công khai vẫn chưa được xác nhận; asset dẫn xuất chỉ có thể dùng riêng tư theo quyền phù hợp.

## Checkpoint C — không chạy vì B chưa đạt

Không thay route `/tools/vita-wardrobe-lab`; nó vẫn là demo V0.4 đã bị reject.
Không có equip/restore V1 mới để test, không chạy TypeScript/Next.js build, animation/dance QA, Playwright hay deploy Preview mới.
File Blender nguồn chỉ có action `T-Pose` 1 frame, GLB không có clip; **không** gọi đây là animation QA PASS.
Không claim iPhone PASS. Không cung cấp Preview cũ như bằng chứng cho V1.

Validation closeout: audit nguồn thật bằng Blender; kiểm tra topology donor/probe, trọng số và inverse bind; 4 render nội bộ; syntax Python; JSON manifest và diff phạm vi; SHA-256 của GLB/ZIP/BLEND gốc trước/sau không đổi.
Checkpoint A đã push: `b108416e791407e3655f9c6de843c710f64a7274`.
Trạng thái cuối: **BLOCKED — thiếu garment topology/UV đạt chất lượng**, đã lưu chẩn đoán; dừng SESSION 2, không mở SESSION 3.
