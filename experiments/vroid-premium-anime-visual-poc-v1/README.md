# Vita — hai phương án anime cho Audition Mobile

Mở ảnh Comparison trước, sau đó xem Expressions và Renderers trong review/. Ba khuôn mặt chính diện lần lượt là Vita gốc, A và B. Camera trực giao 0,425 m, biểu cảm trung tính, ánh sáng và quản lý màu giống nhau. Các PNG riêng gồm góc trái 35°, nghiêng phải, toàn thân, khung dọc 390 × 844 và ánh sáng trắng trung tính. Tư thế toàn thân có hạ tay để đọc trang phục. Cycles CPU 48 mẫu, Khronos PBR Neutral, ba đèn diện tích 21/9/18 W. Ảnh kiểm tra trung tính dùng hai đèn trắng 15 W, tắt đèn viền.

## Nguồn và công cụ

[Vita beta](https://github.com/madjin/vrm-samples/blob/master/vroid/beta/Vita.vrm), 14.359.044 byte, SHA-256 f2bf78f28a24e2f75f5ca0b6c3b646654c394e4b03592dfaa0d0633ef0972b4d. Metadata Vita CC0 khớp [điều khoản mẫu của pixiv](https://vroid.pixiv.help/hc/en-us/articles/360014900113). Dùng bản lưu của POC trước, Blender 4.3.2, VRM Add-on 4.10.5. Tóc VRoid nguyên gốc. GBH không tham gia thử nghiệm này.

## Chất liệu và hình học

A giữ nguyên vị trí đỉnh, toàn bộ shape key, UV, topology và trọng số. Xử lý họa tiết neon má trong texture, thêm sắc ấm ở má và chuyển sắc nhẹ ở sống mũi, môi hồng trầm, chân mày và viền mắt tông mận, lòng trắng ấm. Hai mống mắt đồng bộ màu hổ phách với vân hướng tâm và điểm sáng. Tóc lilac có dải sáng theo chiều tóc. Trang phục giữ nguyên đường cắt, dùng tím than và viền champagne. Độ nhám Principled của tóc 0,43, da 0,72, tròng mắt 0,30, các phần còn lại 0,58. Cường độ normal tóc 0,22 và da 0,12. Bản Blender có vật liệu Studio và các vật liệu dự phòng. VRM dùng MToon, GLB dùng glTF PBR.

B dùng cùng vật liệu A. Phép biến dạng mềm thu vùng mắt, thu nhẹ hai bên hàm, kéo cằm, nâng khối mũi và khóe môi. Lòng trắng giảm 7,21% chiều rộng, 16,66% chiều cao. Mống mắt giảm 15,50% chiều cao. Dịch chuyển đỉnh Basis lớn nhất 6,744 mm. Tính biến dạng riêng trên từng tọa độ đích của cả 41 shape key, bảo toàn thứ tự đỉnh và hiệu chỉnh pháp tuyến. Để hoàn tác riêng tỷ lệ mặt trong B, gán dữ liệu mesh “Vita Face · A · original proportions” cho đối tượng Face. Kiểm tra phục hồi chính xác Basis và 41 key. Ba mesh có tổng cộng 26.130 tam giác, gồm mặt 3.150, thân 11.008, tóc 11.972. Giữ 16 vật liệu.

## Kiểm tra độc lập

- ĐẠT mỹ thuật cho POC. A giữ vẻ trẻ, mắt tròn và dễ đối chiếu Vita. B cho đôi mắt bớt tròn, hàm gọn và biểu cảm trưởng thành hơn ở góc chính diện lẫn 35°. Chọn B cho hướng hình ảnh, giữ A làm chuẩn kỹ thuật. Mái dày và phụ kiện tai mèo còn đậm chất Vita, má sáng ở chính diện. Dáng áo còn thiên về sân khấu khoa học viễn tưởng.
- ĐẠT rig và biểu cảm. Nhập lại B.vrm vào Blender mới, đối chiếu 155 xương, 54 ánh xạ humanoid, 15 nhóm biểu cảm, 18 nhóm spring bone. Sai số bề mặt lớn nhất dưới 0,000122 mm cho trung tính, vui, chớp mắt, mở miệng A và ngạc nhiên. Dữ liệu động lực học được bảo toàn ở mức cấu trúc.
- ĐẠT xuất/nhập. Khronos glTF Validator báo GLB 0 lỗi/3 cảnh báo và VRM 0 lỗi/17 cảnh báo. Xem từng mã trong review/validator-*.json. Các cảnh báo liên quan đến mesh skinned có parent, quy ước extension cũ và tiếp tuyến. Các ngữ nghĩa riêng VRM được kiểm tra thêm bằng import VRM.
- ĐẠT sơ bộ WebGL2. Three.js r180, three-vrm 3.4.4, Chromium 141 với SwiftShader. Hai định dạng tải độc lập, dùng sRGB, thử 5 trạng thái mặt và quay đầu 0,23 rad. Đỉnh kiểm tra dịch 19,535 mm, khoảng cách tới tâm đầu được bảo toàn, không có lỗi GL. Sửa khe tóc GLB bằng alpha MASK theo nguồn. Với VRM, chuyển lớp áo trên sang BLEND, tắt ghi chiều sâu lớp trong suốt và viền hull cũ. Vai hiển thị da ở cả hai góc kiểm tra. MToon phẳng hơn, má ấm hơn Cycles. GLB có bóng tối sâu hơn. Cần xem từng bộ trang phục dưới ánh sáng sân khấu thật.
- iPhone Safari và hiệu năng di động CHƯA XÁC MINH. Ảnh dọc chỉ xác nhận bố cục. Chưa thử clip nhảy, động lực học khi nhảy hoặc nhân vật nam.

## Khả năng mô-đun

| Thành phần | VRoid Studio, dự án .vroid | Blender | Audition / Three.js |
|---|---|---|---|
| Tóc | Tạo và trao đổi custom item tương thích | Tách Hair001 và nhận diện cả phần HairBack trong Body, gắn đầu, remap spring | Cần quy tắc tháo/lắp, ánh xạ xương và collider |
| Mắt | Đổi màu, texture hoặc preset | Thay texture theo UV, phối lại mí và blink nếu đổi hình mắt | Đổi màu qua material riêng từng nhân vật. Đổi hình cần bộ morph tương thích |
| Miệng | Chỉnh cấu hình mặt trong dự án nguồn | Giữ topology và sửa toàn bộ shape key bị ảnh hưởng | VRM có binding biểu cảm. GLB cần ánh xạ tên và trọng số morph |
| Quần áo | Custom item theo mẫu tương thích | Nhiều slot chung Body. Khi tách phải xử lý vùng da ẩn và trọng số | Cần gắn đúng skeleton, che thân và kiểm tra xuyên khi nhảy |
| Nhảy, nam/nữ | Xuất từng avatar humanoid | Chuẩn hóa rest pose, trục, tỷ lệ và ánh xạ | Có thể dùng chung đường nạp humanoid. Cần thử retarget, bàn chân và xoắn khớp trên từng vóc dáng |

Studio cần dự án nguồn .vroid để tiếp tục chỉnh bằng công cụ gốc. Tệp VRM xuất là dữ liệu trao đổi. Kết quả thực nghiệm chỉ bao gồm avatar nữ Vita.

## Tái lập

Chuẩn bị thư mục work, review, out cùng cấp scripts; đặt nguồn đúng hash vào work/Vita-Original.vrm. Cần Blender đã bật VRM Add-on, Python có numpy, scipy, Pillow. Đặt gói three-vrm 3.4.4 đã giải nén tại work/three-vrm, đặt THREE_DIR trỏ tới gói three r180 và CHROME_BIN trỏ tới Chromium của Playwright. Thực thi từ thư mục chứa scripts.

~~~sh
python scripts/make.py
for v in original A B; do VITA_VARIANT="$v" blender -b --python-exit-code 1 -P scripts/studio.py; done
for v in A B; do
  blender -b "out/Vita-Premium-Anime-V1-$v.blend" --python-exit-code 1 -P scripts/outline.py
  VITA_VARIANT="$v" blender -b "out/Vita-Premium-Anime-V1-$v.blend" --python-exit-code 1 -P scripts/neutral_expression.py
done
blender -b out/Vita-Premium-Anime-V1-B.blend --python-exit-code 1 -P scripts/export.py
python scripts/exchange.py
blender -b --python-exit-code 1 -P scripts/verify.py
node scripts/web.cjs
python scripts/sheets.py
~~~
