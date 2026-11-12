# Vita · Premium Cute Anime V1.1

Mở ảnh Vita-V11-Comparison trong review để đối chiếu A với trang phục mới. Ảnh Swaps chụp ba thời điểm khi cùng nhân vật đang cười. Outfits chụp hai lựa chọn trên cùng nhân vật trong WebGL2. Renderers đối chiếu hai định dạng với Cycles. PNG có đủ góc trước, trái 35°, nghiêng phải, sau, toàn thân, màn hình dọc 390 × 844, hai tư thế nhảy và ba biểu cảm.

## Nguồn và thiết kế

Dùng trực tiếp Vita-Premium-Anime-V1-A.blend, SHA-256 773752a0c4f78d50af8b8935055c1af6518fff7176aa21f41bdc0d0c7ecb372a. Nhánh cơ sở work/vroid-premium-anime-visual-poc-v1, commit 9f8a69d956ef54f59510427367ff67adcc47e2b9. [Nguồn Vita](https://github.com/madjin/vrm-samples/blob/master/vroid/beta/Vita.vrm), SHA-256 f2bf78f28a24e2f75f5ca0b6c3b646654c394e4b03592dfaa0d0633ef0972b4d. Mẫu β AvatarSample_3 do pixiv công bố theo [CC0](https://vroid.pixiv.help/hc/en-us/articles/360014900113). Bomber, áo lót, nẹp, chữ thêu CLUB, túi viền, váy xếp ly, tất, sneaker và nơ được dựng cho thử nghiệm này. Quần bảo hộ dùng một phần topology thân Vita. Tóc lob được phát triển từ bản sao hình học bob A. Gói duyệt có bản quyền MIT đi kèm các thư viện Three.js và three-vrm. Không sử dụng asset trang phục tải ngoài.

Trang phục Vita có cả mesh rời lẫn hoa văn trên texture thân. Bộ casual dùng vùng da lộ riêng, lược bỏ bề mặt bên dưới lớp vải và thay các vùng họa tiết sci-fi. Mặt A dùng chung cho mọi tổ hợp. Bảng màu gồm lavender, kem, tím mận, hồng phấn và chi tiết champagne. Váy dùng gradient trọng số liên tục giữa hông và hai đùi, bên trong có quần bảo hộ. Bob bỏ cụm tai điện tử. Lob kéo dài phần tóc hai bên và sau gáy, giữ nguyên liên kết xương tóc.

## Hợp đồng đổi món trong thử nghiệm

| Slot | Mã | Nội dung |
|---|---|---|
| CharacterBase | vita-a | Face, Scalp và rig dùng chung suốt phiên |
| HairSlot | lilac-bob / swept-lob | Hai mesh độc lập, chung rig, texture lavender được tái sử dụng |
| OutfitSlot | vita-stage / lilac-club | Bộ cũ gồm quần áo và phần thân tương ứng. Bộ mới gồm mesh thời trang, phần da lộ riêng và quần bảo hộ |
| HeadAccessorySlot | rose-bow / off | Mesh riêng gán 100% cho xương đầu. off ẩn món này |

Đọc cosmeticSlot và cosmeticId từ extras của node. Chỉ bật các node con thuộc mã đã chọn trong slot. Giữ nguyên đối tượng mặt, skeleton và các trọng số morph đang chạy. Harness đã thực hiện sáu lượt đổi khi giá trị nụ cười bằng 1 và so cả UUID mặt, UUID skeleton, toàn bộ mảng morph trước/sau. Đây là chuyển giữa các mesh đã nạp sẵn. Chưa thử tải món theo yêu cầu, gắn skeleton của tệp ngoài hoặc đồng bộ nhiều người. Với model hiện tại, phần Scalp dùng chung có 394 tam giác. Kiểu tóc hở hoặc cạo sát có thể cần cơ chế chọn mũ da đầu riêng.

Tệp GLB/VRM bàn giao chứa bộ đồ mặc định. Toàn bộ lựa chọn nằm trong tệp Blender và review/wardrobe.glb. Để xem bản tương tác từ ZIP, giải nén, chạy máy chủ HTTP tĩnh tại thư mục có demo.html, mở demo.html và dùng ba bộ chọn. Tất cả thư viện cần để đổi món đã nằm trong ZIP. Có thể đặt hai tệp bàn giao vào out để mở demo.html?mode=glb hoặc demo.html?mode=vrm.

## Kết quả và giới hạn

- Khuôn mặt ĐẠT. Thử mở lại cả hai cảnh và đối chiếu từng mảng tọa độ băm SHA-256, topology, trọng số, 42 mảng Basis / shape key, toàn bộ cấu trúc xương, mapping humanoid và binding biểu cảm. 155 xương, 54 ánh xạ humanoid, 41 morph, 15 nhóm biểu cảm và 18 nhóm spring bone. Xem face-lock.json và validation.json.
- Tóc và nơ đi theo đầu. Khi xoay 0,27 rad, sai số lớn nhất về khoảng cách đến tâm đầu dưới 0,00008 mm. Kiểm tra chuyển động đùi tác động đến quần và cụm trang phục. Kiểm tra trực quan tư thế nghỉ, nhấc gối và vươn tay. Chưa thử toàn bộ thư viện vũ đạo hoặc va chạm động.
- Trang phục ĐẠT cho POC. Silhouette bomber ngắn, váy xếp ly và sneaker đọc được ở khung dọc. Form tay áo còn tròn đều, sneaker hơi vuông và da trên tay chân ít biến thiên. Gấu váy đi theo đùi ở động tác nhấc gối. Soi lại dưới các chuyển động mạnh trước khi chốt chất lượng sản xuất.
- Cycles chạy CPU 24 mẫu, ánh sáng trắng, camera trực giao, Khronos PBR Neutral. Cặp A/V1.1 dùng cùng thông số. Three.js r180, three-vrm 3.4.4, Chromium headless 141 SwiftShader, xuất sRGB và NeutralToneMapping. Cả hai định dạng qua kiểm tra WebGL2. Ưu tiên GLB/PBR trong bản thử vì còn đọc được bóng nếp vải. VRM/MToon sáng và phẳng hơn. Tóc/mi dùng lại alpha cutout theo vật liệu gốc. Ảnh thật có trong review, cùng kết quả smoke cho từng định dạng.
- Nghệ thuật nhân vật ĐẠT cho hướng Premium Cute. Đổi món ĐẠT trong phạm vi nạp sẵn. Rig/biểu cảm ĐẠT. WebGL2 ĐẠT sơ bộ với GLB/PBR; mức tương đồng MToon chỉ đạt một phần. iPhone Safari, FPS, nhiệt và 5 người CHƯA XÁC MINH.
- Mỗi tệp mặc định có 29.620 tam giác và 20 định nghĩa vật liệu. Hai mesh tóc chọn một, mỗi mesh 11.276 tam giác. Phần trang phục mới có 8.306 tam giác gồm cả phần da eo dựng kèm, cộng 550 tam giác của quần bảo hộ. Nơ có 1.108 tam giác. 4.836 tam giác da lộ thuộc nhóm trang phục nhưng được tính riêng. Blender và WebGL2 đã nhập lại cả hai bản xuất.
- WebGL2 ghi nhận GLB 28 draw call, 30.580 tam giác gửi vẽ và 22 instance vật liệu; VRM 25 draw call, 30.962 tam giác gửi vẽ và 21 instance vật liệu. Số tam giác gửi vẽ có thể lớn hơn hình học do một số vật liệu vẽ thêm lượt. Texture RGBA8 kèm mip ước tính 43,3 MiB cho GLB và 46,3 MiB cho VRM dựa trên kích thước nguồn. Số liệu không gồm framebuffer, atlas nội bộ, món ẩn trong bộ đổi đồ hoặc chi phí driver. Năm bản GLB cùng cấu hình có thể tương đương khoảng 140 draw call và 152.900 tam giác gửi vẽ mỗi khung, riêng phần nhân vật. Khoảng 217 MiB texture nếu mỗi nhân vật giữ bản sao riêng. Khối lượng thực phụ thuộc chia sẻ texture và món đang chọn.
- Khronos Validator báo 0 lỗi ở cả hai tệp. GLB có 7 cảnh báo về mesh skinned có parent. VRM có 13 cảnh báo gồm tên extension kiểu cũ và việc dựng tiếp tuyến. Kết quả kiểm tra ngữ nghĩa VRM lấy từ import thực và thử biểu cảm. Blender báo còn 0,028 MB khi thoát sau lần import VRM trong phép kiểm tra.
- Hạng mục chủ dự án cần duyệt là phom bomber và váy ở khung dọc, chiều dài bob/lob cạnh má và độ sáng da trong ảnh WebGL2.

## Tái lập

Blender 4.3.2, VRM Add-on 4.10.5. Từ thư mục thí nghiệm, tạo out, review, work; đặt VITA_A trỏ tới tệp A và VITA_SOURCE tới Vita-Original.vrm hoặc polished.vrm của V1 (bảng alpha gốc). Cần Python, Pillow, numpy, Node.js, Playwright. THREE_DIR trỏ đến three 0.180.0, VRM_JS đến three-vrm.module.min.js 3.4.4, CHROME_BIN đến Chromium có WebGL2.

~~~sh
blender -b "$VITA_A" --python-exit-code 1 -P scripts/build.py
blender -b "$VITA_A" --python-exit-code 1 -P scripts/render.py
blender -b out/Vita-Premium-Cute-V11.blend --python-exit-code 1 -P scripts/render.py
blender -b out/Vita-Premium-Cute-V11.blend --python-exit-code 1 -P scripts/export.py
python scripts/alpha.py
blender -b --python-exit-code 1 -P scripts/verify.py
node scripts/web.cjs
node scripts/validate-format.cjs
python scripts/sheets.py
~~~
