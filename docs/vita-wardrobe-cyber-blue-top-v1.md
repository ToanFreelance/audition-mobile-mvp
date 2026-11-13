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

