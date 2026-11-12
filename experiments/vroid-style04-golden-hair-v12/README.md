# Vita A · Style 04 — Lavender Layered Bob V1.2

## Đọc bộ duyệt

Mở `review/Style04-V12-Concept.jpg` để đối chiếu ô 04 được chủ dự án cung cấp với bob V1.1 và V1.2. Hai ảnh nhân vật dùng chung máy trực giao, biểu cảm trung tính và ba đèn trắng. Các bảng Angles, GBH, Construction, WebGL2 và Renderers có ảnh gốc PNG đi kèm. Cycles CPU dựng ảnh màu ở 48 mẫu, tắt khử nhiễu để giữ sợi mảnh. Ảnh đất sét và đường dẫn dùng 32 mẫu. Ảnh di động là khung hình thật đọc từ canvas WebGL2 390 × 844.

Để tự đổi tóc, giải nén ZIP, chạy `python -m http.server 8000` tại thư mục có `index.html`, rồi mở http://localhost:8000. Chọn **Tóc → Bob V1.1 / Style 04**. Bản demo dùng Three.js r180 đóng gói kèm giấy phép MIT. GLB giao riêng dùng Style 04 mặc định. GLB trong thư mục review chứa cả hai kiểu và cần bộ chọn hiện đúng một kiểu. Hai GLB dùng chung hình học Style 04.

## Nguồn và phạm vi

- Tệp trực tiếp dùng để tiếp tục là Vita-Premium-Cute-V11.blend, SHA-256 `138a5b8321bd333e409340be321e483bdef6f2e6bebe5758bc8af6d4d75fed52`. Nhánh gốc `work/vroid-premium-cute-anime-v11`, commit `ec7ded7e321638a3e639f461d5228bf38099d1ae`. Giữ nguyên Variant A và bộ Casual Dance V1.1.
- Vita gốc từ VRoid Studio β, SHA-256 `f2bf78f28a24e2f75f5ca0b6c3b646654c394e4b03592dfaa0d0633ef0972b4d`. Mẫu β AvatarSample_3/Vita được pixiv công bố theo CC0. [Tệp nguồn](https://github.com/madjin/vrm-samples/blob/master/vroid/beta/Vita.vrm) · [Điều khoản mẫu](https://vroid.pixiv.help/hc/en-us/articles/360014900113)
- Guide, mesh và atlas tóc Style 04 được tạo cho thử nghiệm. Hình mẫu ô 04 do chủ dự án cung cấp, chỉ dùng cho bảng so sánh. Không đưa mẫu vào vật liệu của model. [GBH Tool](https://github.com/GixoXYZ/BlenderGBHTool) · [VRM Add-on](https://vrm-addon-for-blender.info/en-us/)
- Blender 4.3.2, VRM Add-on 4.10.5 và GBH Tool 2.2.3. Kiểm tra phiên bản từ manifest của bản thực cài. Trình kiểm tra cập nhật của GBH từng truy cập `WindowManager.gbh_update` quá sớm ở chế độ nền. Tắt kiểm tra cập nhật tự động trong preferences rồi mở lại Blender. Các toán tử tạo hình chạy bằng mã và thư viện của add-on.

## Guide, mesh và cách sửa

Checkpoint cũ dùng GBH cho 65 sợi chi tiết, còn các card chính theo hình cắt do Python dựng. Bản giao giữ đường chải và bố cục UV của checkpoint, cho GBH quét tiết diện toàn bộ 178 guide lớp chính. Blender ghi các nhóm độc lập trong `STYLE04 • GBH live regions`. Bật collection này khi chải, ẩn mesh Style04_Cards để nhìn đầu ra trực tiếp. Chọn đúng đối tượng kiểu Hair Curves. Có 45 guide phía sau, 88 ở vùng đỉnh và lớp phủ, 15 ở mái, 30 ở hai bên chia thành hai nhóm. Tắt collection kỹ thuật sau khi chải để xem bản mặc định. Các đường dẫn trước khi chỉnh được giữ trong collection lưu tham chiếu.

1. `bpy.ops.gbh.reload_library`, `gbh.node_group_append` và `gbh.node_group_add_to_object` nạp **GBH Profile Line Hair Cards** và gắn node group thật vào cả năm đối tượng Hair Curves. Geometry Nodes đọc vị trí tâm, lấy bán kính guide, quét profile của GBH, chỉnh độ xoay và bề rộng dọc sợi. Một bước hiệu chỉnh cục bộ ở lớp phủ giúp mép card tránh da mặt. Xem từng modifier, số card và các giá trị đo trong `review/gbh-regions.json`.
2. 65 guide chi tiết giữ node group **GBH Profile Polygon Hair Cards**. Toán tử `gbh.convert_hair(convert_to='MESH')` đã tạo 4.875 tam giác cho lớp này. `review/groom.json` ghi kết quả gọi toán tử. Khoảng 84% số tam giác tóc đến từ hai profile GBH. Lớp lót ngắn 5.320 tam giác dùng mesh sẵn từ checkpoint để che khe nhìn xuyên ở gáy.
3. Tệp có cả guide và mesh đã chốt. Sau khi dịch điểm guide trên năm nhóm card, chạy văn bản `Style04 • Đồng bộ card GBH.py` trong Blender Text Editor để cập nhật mesh xuất, giữ UV và weights. Công cụ đồng bộ hỗ trợ giữ nguyên số điểm và tiết diện. Thay mật độ guide sẽ cần bố trí UV lại. Lớp 65 sợi chi tiết có nguồn riêng và cần chuyển mesh lại qua GBH nếu chỉnh riêng lớp đó.
4. Phép thử dịch một điểm mái 1 mm làm ba đỉnh đầu ra GBH dịch tối đa 1,000002 mm. Hoàn tác trả về đúng vị trí. Chạy đồng bộ lại trên bản cuối rồi mở lại tệp cho sai số 0 mm. Xem `guide-edit-test.json`, `rebake.json` và nhật ký trong ZIP.

## Vật liệu, hiệu năng và giới hạn

Tóc có 22.656 tam giác card GBH chính, 4.875 tam giác sợi GBH và 5.320 tam giác lớp lót, tổng 32.851. Export ghép thành một primitive, một vật liệu và một draw call tóc đo bằng cách ẩn/hiện tóc trong Three.js. Atlas sRGB RGBA 2.048 × 1.024, tám ô sợi có sắc độ đổi dọc chân–ngọn và highlight theo hướng sợi. PBR hai mặt, metallic 0, roughness 0,56, specular factor 0,44, MASK với ngưỡng 0,42. Màu nền và alpha dùng chung atlas. Dùng lọc tuyến tính và mipmap. Ước tính ~10,67 MiB cho atlas với RGBA8 và đầy đủ mipmap, ~46 MiB cho các texture có mặt trong khung hình. Đây là ước tính từ kích thước texture, chưa đo bộ nhớ của GPU iPhone.

GLB mặc định có 50.087 tam giác và 19 định nghĩa vật liệu. Trong cảnh thử, bộ đếm renderer ghi 25 draw call, 51.047 tam giác và 21 material instance. Số của renderer là số thực vẽ trong một khung, khác số hình học lưu trong tệp. Card hai mặt chồng lớp làm tăng số fragment ngay cả khi MASK tránh sắp xếp alpha blend. Có thể tạo LOD bằng cách giảm sợi ngoài và các lớp bên trong. Chưa có LOD, mô phỏng lắc riêng cho tóc mới, phép đo overdraw hoặc thử nghiệm nhiều nhân vật trên thiết bị.

## Kiểm định và đánh giá mỹ thuật

- Đối chiếu trực tiếp với V1.1 bằng hash đỉnh, topology, UV, weights, vật liệu và ảnh nhúng của mặt, tọa độ từng shape key, cấu trúc xương, binding biểu cảm, mapping humanoid và nhóm spring trong Blender. Có 41 morph ngoài Basis, 54 mapping humanoid và 18 nhóm spring của nguồn. GLB/PBR mang skin và morph; đầy đủ metadata và binding VRM nằm trong bản Blender có VRM Add-on. Không xuất VRM mới trong lần duyệt này.
- Bốn mesh của OutfitSlot khớp V1.1 về tọa độ, topology, UV, weights và danh sách vật liệu. glTF Validator báo 0 lỗi và 6 cảnh báo NODE_SKINNED_MESH_NON_ROOT do các mesh có skin nằm dưới node cha. Nhập lại GLB và thử khớp xương đầu đã chạy.
- Chạy xoay xương đầu và so từng đỉnh hai mesh với ma trận mong đợi. Kiểm tra giao da mặt bằng BVH ở tư thế trung tính. `review/validation.json` ghi sai số, khoảng cách gốc tóc tới scalp và kết quả nhập GLB vào cảnh Blender trống. Mẫu gốc trong phép đo bao gồm cả đường dẫn lưu trữ trùng vị trí; 243 là số guide sản xuất độc lập. Kiểm tra này không bao phủ mọi góc cổ hoặc mọi frame nhảy.
- Đổi bob cũ ↔ mới tại neutral/cười/chớp mắt trong phiên WebGL2 đang chạy. So các UUID, weights morph, cùng actor của mixer, thời gian action và số nhóm tóc nhìn thấy. Sáu lần chuyển giữ nguyên trạng thái. Action tiếp tục tiến sau đổi tóc. Xem `wardrobe-qa.json`, `glb-qa.json`.
- **Kỹ thuật GBH, HairSlot và khóa mặt đạt. Mỹ thuật chưa đạt mức Golden.** Độ dài tới cổ, sắc lavender và khoảng mở quanh mắt phù hợp; đường viền phần má giữ gọn. Mái có khoảng hở nhưng vẫn chia thành các đầu nhọn cong khá đều. Hai bên cụp tương đối đồng loạt, lớp ngoài ở gáy còn đặc. Dải sáng trên đỉnh và nhịp vân dọc nổi rõ hơn trong Cycles; WebGL2 cho màu tím sẫm và ít phân tách lớp hơn. Chưa chọn bản này làm tóc mặc định. Chưa kiểm tra Safari/iPhone.

## Tái lập

Từ thư mục thí nghiệm, tạo `out/`, `review/`, `work/`. Cài và bật đúng hai extension ở trên. Đặt `V11_BLEND` và `V11_GLB` thành đường dẫn tuyệt đối tới hai bản V1.1 đã duyệt. Cần Python, NumPy, Pillow, Node.js, Playwright, Three.js 0.180.0 và Chromium có WebGL2. Đặt `THREE_DIR` và `CHROME_BIN` theo máy. Ảnh mẫu của chủ dự án trong gói duyệt được dùng lại khi chạy sheets.py.

```sh
python scripts/atlas.py
blender -b "$V11_BLEND" --python-exit-code 1 -P scripts/build.py
scene=out/Vita-Style04-Golden-Hair-V12.blend
blender -b "$scene" --python-exit-code 1 -P scripts/gbh_regions.py
blender -b "$scene" --python-exit-code 1 -P scripts/finalize.py
blender -b "$scene" --python-exit-code 1 -P scripts/export.py
blender -b --python-exit-code 1 -P scripts/verify.py
blender -b "$scene" --python-exit-code 1 -P scripts/render.py
blender -b "$scene" --python-exit-code 1 -P scripts/technical.py
node scripts/web.cjs
python scripts/sheets.py
```

`update_cards.py` phục vụ checkpoint đầu trong build.py. Sau bước GBH dùng `rebake.py`. Không chạy kiểm thử gameplay hoặc triển khai ứng dụng.
