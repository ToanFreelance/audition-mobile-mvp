# Vita · Lavender Layered Bob, Style 04

POC Blender độc lập cho Audition Mobile MVP. Mở tệp .blend ở camera Portrait. Collection STYLE 04 chứa bốn mesh xuất. GROOM chứa ba bộ Hair Curves và modifier Geometry Nodes còn chỉnh sửa được. REFERENCE chứa tóc Vita nguyên bản. Khi so sánh, tắt hai collection tóc mới rồi bật REFERENCE ở cả viewport và render. Lớp HairBack trong Body thuộc Vita và được bảo toàn.

## Dữ liệu và công cụ

- Tải đúng [Vita.vrm từ kho bản mẫu](https://github.com/madjin/vrm-samples/blob/master/vroid/beta/Vita.vrm). Tệp gốc dài 14.359.044 byte, SHA-256 `f2bf78f28a24e2f75f5ca0b6c3b646654c394e4b03592dfaa0d0633ef0972b4d`. Header glTF 2.0, độ dài nhị phân khớp header, extension VRM đời 0.x, exporter VRoidStudio-0.8.1. Nguồn không khai báo trường specVersion. Metadata ghi Vita, CC0, Everyone, commercial Allow.
- pixiv công bố CC0 cho β Ver AvatarSample_3. [Điều khoản tiếng Anh](https://vroid.pixiv.help/hc/en-us/articles/360014900113) · [Bản tiếng Nhật nêu tên Vita](https://vroid.pixiv.help/hc/ja/articles/360014900113).
- Blender 4.3.2. Cài bản ZIP extension từ disk qua CLI Blender. [VRM Add-on 4.10.5](https://github.com/saturday06/VRM-Addon-for-Blender/releases/tag/v4.10.5) · [GBH Tool 2.2.3](https://github.com/GixoXYZ/BlenderGBHTool/releases/tag/v2.2.3).
- GBH báo lỗi ở luồng kiểm tra cập nhật tự động khi Blender headless đóng WindowManager. Sau khi tắt automatic_update_check trong Preferences, các lần dựng và xuất cuối kết thúc bình thường. Ba lượt giao Geometry Nodes và ba lượt chuyển thành mesh đều trả FINISHED. Xem groom.json cùng các log trong gói review.
- Cycles CPU, 720 × 800, 96 mẫu, Khronos PBR Neutral. Denoiser OpenImageDenoise không có trong bản Blender này, nên tắt denoising cho các ảnh cuối. So sánh ghép từ PNG cùng camera trực giao, biểu cảm nghỉ và bộ ba đèn area.
  
## Dựng lại

Lệnh dưới đây chạy từ thư mục chứa README này. Hai ZIP extension chính thức nằm trong work. Các tệp ảnh, scene và binary được tạo ngoài mã ứng dụng.

```sh
mkdir -p out work review
curl -fL https://raw.githubusercontent.com/madjin/vrm-samples/master/vroid/beta/Vita.vrm -o out/Vita-Original.vrm
echo 'f2bf78f28a24e2f75f5ca0b6c3b646654c394e4b03592dfaa0d0633ef0972b4d  out/Vita-Original.vrm' | sha256sum -c -
blender -b --command extension install-file work/vrm.zip -r user_default --enable
blender -b --command extension install-file work/gbh.zip -r user_default --enable
blender -b --python-exit-code 1 -P scripts/import_vita.py
python3 scripts/atlas.py
blender -b work/imported.blend --python-exit-code 1 -P scripts/groom.py
python3 scripts/interchange.py
blender -b out/Vita-Style04-Hair-POC-V1.blend --python-exit-code 1 -P scripts/fit.py
blender -b out/Vita-Style04-Hair-POC-V1.blend --python-exit-code 1 -P scripts/render.py
blender -b --python-exit-code 1 -P scripts/check.py
blender -b --python-exit-code 1 -P scripts/export_render.py
python3 scripts/compare.py
```

Python ngoài Blender dùng NumPy và Pillow. Script so sánh sử dụng bộ chữ DejaVu Sans. Các ảnh render đơn lẻ là PNG trực tiếp từ Blender. Trong cảnh tác giả, đường dẫn tóc nằm ở tư thế nghỉ. Bốn mesh xuất dùng Armature modifier, trọng số 1.0 trên J_Bip_C_Head. Tóc cũ có skin riêng và được ẩn. Bản GLB dùng lại định nghĩa vật liệu glTF của Vita cùng ảnh nhúng gốc cho mặt và thân. Tóc dùng ba vật liệu sợi và một atlas RGBA 2048 × 1024 có ngưỡng alpha 0,40 ở GLB.

## Kết quả

219 dải tóc ở ba lớp chính và các lọn thái dương. 1.088 đường sợi có tổng cộng 31.552 điểm trước khi thông qua GBH Profile Polygon Hair Cards. Phần dải lớn dùng bề mặt định hướng UV. Sợi nhỏ là mesh tạo bởi GBH từ đường dẫn. Bốn mesh tóc có 338.747 tam giác trong GLB. Dữ liệu đủ cho phép thử hình dáng, chưa có LOD hoặc phép đo hiệu năng điện thoại.

Giá trị băm của tọa độ, topology, toàn bộ tọa độ shape key, trọng số xương và UV của Face và Body khớp giữa cảnh vừa nhập và cảnh hoàn thiện. Các slot vật liệu, 155 xương cùng quan hệ cha con, ánh xạ humanoid và binding biểu cảm cũng khớp. Mỗi bản Blender/GLB được thử xoay đầu 17° tại 168 điểm tóc. Sai số lớn nhất dưới 0,00025 mm. BVH tìm thấy 0 cặp polygon giao giữa bốn mesh tóc và phần Face_00_SKIN ở tư thế nghỉ, bao gồm tai. Khoảng cách gần nhất giữa 1.088 chân sợi và lớp HairBack là 0,332–0,349 mm.

GLB nhập lại trong cảnh trống, còn 41 facial morph target và 155 xương. Ảnh 10 hiển thị chính GLB sau khi nhập. Bộ shader glTF của Vita dùng KHR_materials_unlit nên màu da trong ảnh kiểm tra sáng hơn Cycles với MToon. GLB không lưu ngữ nghĩa preset VRM và spring bone. Bản VRM tùy chọn đã được xuất và nhập lại qua VRM Add-on, giữ nguyên binding biểu cảm, ánh xạ humanoid và 18 nhóm spring cũ. Kiểu tóc mới gắn cứng vào đầu và chưa có vật lý riêng. Dữ liệu VRM xuất là mẫu trao đổi; tệp .blend là bản để chỉnh groom.

Khronos glTF Validator báo 0 lỗi và 19 cảnh báo. Có 13 cảnh báo runtime tự tạo tangent cho vật liệu nguyên bản và 6 cảnh báo node skinned mesh có cha. Kết quả chi tiết ở khronos.json. Không kiểm tra gameplay, không chạy QA dự án hoặc triển khai game.

## Đánh giá tạo hình

Góc trước giữ được khoảng mở quanh mắt và má. Phần thái dương tạo đường cong về cổ và lộ màu tóc tối hơn ở lớp trong. Ở góc nghiêng, độ tách sợi hiện rõ nhất ở phần mái; đỉnh đầu và các dải phía sau còn đi khá đều. Một số đuôi bên vẫn nhọn. Tóc đã bớt cảm giác mảng đặc so với Vita gốc; mắt, chất da và họa tiết má của Vita vẫn cho ấn tượng anime rõ. POC kỹ thuật đạt. Mức bám concept bán hiện thực còn một phần và cần chủ dự án duyệt từ ảnh.

## Kiểm tra Three.js độc lập

Three.js 0.180.0 và GLTFLoader đã tải GLB thật vào Chromium Headless Shell 141 với SwiftShader, tạo context WebGL 2.0 và vẽ xong khung hình. gl.getError() trả 0. Ảnh 11 là screenshot trình duyệt, ánh sáng riêng của cảnh Three.js. Tóc có màu dịu hơn, vài sợi mái mảnh có răng cưa ở độ phân giải này. Thống kê draw của renderer có thể tính thêm lượt vẽ hai mặt trong suốt. Chưa đo FPS trên iPhone. Chromium hệ thống lần đầu không khởi động được do socket của ProcessSingleton; bản Headless Shell chạy thành công. Có thể chạy lại scripts/webgl.cjs với Playwright, CHROME_BIN trỏ tới headless shell, và gói three 0.180.0 giải nén vào work/three.
