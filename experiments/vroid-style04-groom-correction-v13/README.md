# Style 04 V1.3 — checkpoint grooming

**ARTISTIC FAIL. Bản bàn giao dừng ở mái, lớp ôm mặt bên trái và vùng đỉnh liền kề.** Sau ba lượt kiểm tra có giới hạn, card đã hẹp hơn nhưng đường chải còn lặp, đỉnh chưa khép đẹp, các đầu nhọn và mặt card vẫn lộ rõ trong ảnh đất sét. Điều kiện mở rộng của chủ dự án chưa đạt. RightSide và Back có đối tượng Hair Curves được đặt tên sẵn với 0 guide. Chưa triển khai các vùng này.

## Xem bằng chứng

| Tệp ảnh | Nội dung |
| --- | --- |
| Style04-V13-Comparison.jpg | Mẫu 04 của chủ dự án, V1.2 bị loại và checkpoint V1.3. Hai nhân vật dùng cùng máy, ánh sáng và biểu cảm |
| Style04-V13-Details.jpg | Trái 35°, cận mái và cận lớp ôm mặt |
| Style04-V13-Groom.jpg | Đường tâm từ Native Hair Curves, mesh đất sét và cùng mesh với vật liệu lavender |
| Style04-V13-Renderers.jpg | Cùng checkpoint trong Cycles và Three.js GLB/PBR |
| Style04-V13-WebGL2.jpg | Đổi V1.1 ↔ checkpoint khi đang cười và khung hình 390 × 844 |

Ảnh PNG gốc nằm trong review. Các ảnh đều dựng từ hình học thật. Bảng mẫu Golden dùng crop ô dưới trái của hình do chủ dự án cung cấp. Cycles CPU, 64 samples, tắt denoise vì bản Blender của môi trường không có OpenImageDenoise, 20 transparent bounces. Ba đèn trắng, orthographic scale 0,445 m cho ảnh chính diện. Bản V1.2 đã được dựng lại ở cùng cấu hình. Không có ảnh hoàn thiện bên phải hoặc sau đầu của V1.3.

## Nguồn và nguyên nhân

Nhánh cha work/vroid-style04-golden-hair-v12 vẫn ở 8a4f59cdf8b7b5f239b84fb4e313a1749396bdb1 khi bắt đầu. V1.1 vẫn ở ec7ded7e321638a3e639f461d5228bf38099d1ae. Đã đọc docs/PROJECT_INSTRUCTIONS.md trên kho và kiểm tra bốn script V1.2 build.py, gbh_regions.py, atlas.py và rebake.py.

Tệp V1.2 gốc có SHA-256 24f0a3920b55a0c3bc3f3cb2b4e5cfe003429eac1bcc318a348e00f108a8ef1c. Đối chiếu gói Review ZIP hiện hành có manifest và SHA trùng khớp. Dùng V1.2 làm cảnh nguồn, giữ V1.1 làm chuẩn khóa mặt và trang phục. SHA-256 của Vita-Premium-Cute-V11.blend là 138a5b8321bd333e409340be321e483bdef6f2e6bebe5758bc8af6d4d75fed52.

V1.2 lấy vector tiết diện từ card dựng trước, tính section_scale theo tỷ lệ bề rộng mục tiêu/bề rộng GBH và áp lại sau bước GBH. Cách này giữ nguyên bề rộng lớn. V1.3 bỏ tham chiếu đó, dựng lại đường chải và các bán kính trên guide. Không nạp hình học card V1.2 vào bộ sinh V1.3. Hình học V1.2 vẫn lưu ẩn để truy nguồn.

Vita bắt nguồn từ bản mẫu VRoid β AvatarSample_3/Vita được pixiv công bố CC0. Tệp gốc đã xác minh ở POC trước, SHA-256 f2bf78f28a24e2f75f5ca0b6c3b646654c394e4b03592dfaa0d0633ef0972b4d. Guide, atlas và card mới được tạo trong thử nghiệm này. [Nguồn Vita](https://github.com/madjin/vrm-samples/blob/master/vroid/beta/Vita.vrm) · [Điều khoản mẫu pixiv](https://vroid.pixiv.help/hc/en-us/articles/360014900113)

## Workflow thực thi

Blender 4.3.2, VRM Add-on 4.10.5 và GBH Tool 2.2.3, kiểm tra trực tiếp bằng manifest bản đang cài. Cả hai add-on yêu cầu Blender từ 4.2. VRM Add-on đang bật khi mở và đối chiếu mapping humanoid, binding biểu cảm, skeleton và spring của nguồn.

Bộ sinh dùng các toán tử thật gbh.reload_library, gbh.node_group_append và gbh.node_group_add_to_object. Các kết quả FINISHED và bốn lần áp profile nằm trong review/groom-checkpoint.json. Node group chính là **GBH Profile Line Hair Cards**. Profile Width đặt 1 cm. Trường radius trên Native Hair Curves điều khiển bề rộng từng guide, biến thiên dọc thân và taper. Geometry Nodes của GBH thực hiện Curve to Mesh. Modifier V13 · Guide center lưu tâm guide; modifier V13 · Strand orientation · no width scaling xoay tiết diện theo tiếp tuyến và pháp tuyến vùng đầu. Modifier cuối chỉ xoay vector tiết diện. Nó không chứa phép kéo bề rộng về card cũ.

| Hair Curves | Guide | Tam giác | Bề rộng giữa sợi trung vị | Ngọn trung vị |
| --- | --- | --- | --- | --- |
| Groom13_Fringe | 58 | 6.032 | 4,675 mm | 0,147 mm |
| Groom13_Crown | 113 | 11.752 | 6,865 mm | 0,210 mm |
| Groom13_LeftSide | 56 | 6.720 | 4,551 mm | 0,136 mm |
| Groom13_Secondary | 24 | 2.688 | 0,478 mm | 0,014 mm |
| Groom13_RightSide | 0 | 0 | Chưa triển khai | Chưa triển khai |
| Groom13_Back | 0 | 0 | Chưa triển khai | Chưa triển khai |

Bề rộng trên đo lại từ đỉnh mesh GBH thực sau khi mở lại tệp, lấy hai mép của mỗi tiết diện ở giữa guide. validation.json có min/p10/median/p90/max tại gốc, giữa, 90% chiều dài và ngọn. Đây là bề rộng hình học, chưa trừ alpha. Đã đo lại mesh V1.2 bằng thuộc tính style04_batch và style04_index, lưu trong v12-measured-widths.json.

| Vùng | V1.2 giữa sợi | V1.3 giữa sợi |
| --- | --- | --- |
| Mái | 14,126 mm | 4,675 mm |
| Đỉnh/lớp phủ | 23,755 mm | 6,865 mm |
| Hai nhóm bên V1.2 / bên trái V1.3 | 11,595–13,779 mm | 4,551 mm |
| Sau đầu | 23,562 mm | Chưa triển khai |

Collection STYLE04 V13 • Native Hair Curves chứa guide gốc, tham chiếu surface Scalp và modifier GBH. Collection STYLE04 V13 • Export mesh chứa bản mesh đã chốt tương ứng từng vùng. Bật collection guide khi cần sửa. Chạy Text Editor V13 · rebake.py để đồng bộ vị trí vào mesh có UV và skin. Công cụ giữ nguyên số điểm và topology; thay mật độ cần tạo lại UV. Nguồn dùng guide ở tư thế nghỉ để chải, mesh xuất có skin 100% tới J_Bip_C_Head.

## Kiểm định đã chạy

- Hash mặt, topology, tọa độ 41 morph, UV, vật liệu và ảnh mặt nhúng, weights, skeleton, mapping humanoid, binding biểu cảm và nhóm spring khớp V1.1. Chi tiết nằm trong face-lock.json.
- Bốn mesh của OutfitSlot khớp V1.1 về đỉnh, topology, UV, weights và vật liệu gán. outfit-lock.json ghi hash từng mesh.
- Dịch một điểm giữa mái 1 mm làm mesh GBH dịch tối đa 0,999998 mm. Hoàn tác cho sai số 0. Mọi mesh vùng đã lưu khớp đầu ra GBH với sai số 0 mm.
- Kiểm tra xoay xương đầu cho sai số lớn nhất 0,000130 mm. BVH báo 0 cặp polygon tóc–da mặt giao nhau ở tư thế trung tính. Chưa kiểm tra một dải biểu cảm/phối hợp cổ đầy đủ.
- Xuất GLB, nhập vào cảnh Blender trống, xác nhận skin, UV, vật liệu và đủ 41 morph. So hai chiều toàn bộ đỉnh tóc xuất/mesh nguồn cho sai số lớn nhất 0,000123 mm. Xem reimport.json.
- glTF Validator báo 0 lỗi, 6 cảnh báo NODE_SKINNED_MESH_NON_ROOT. Nhật ký có thông báo thiếu thư viện Draco; bản giao dùng mesh thường.
- Sáu lần đổi HairSlot giữa lilac-bob và hair-style04-lavender-bob-v13 trong neutral/cười/chớp mắt. Actor, face/skeleton UUID, morph weights và thời gian action 0,37 giây giữ nguyên. Chỉ một kiểu tóc hiện tại mỗi lần. Action tiếp tục tiến sau đổi. Xem wardrobe-qa.json.
- Three.js r180, Chromium dùng ANGLE/SwiftShader, WebGL2, gl.getError bằng 0. Ảnh ghi trực tiếp từ canvas thật. Chưa thử iPhone Safari.

## Vật liệu và chi phí checkpoint

Toàn bộ 27.192 tam giác tóc V1.3 đến từ profile GBH. GLB có tổng 44.428 tam giác và 19 định nghĩa vật liệu. Cảnh runtime ghi 45.388 tam giác, 25 draw call và 21 material instance. Tóc riêng có một primitive, một material và một draw call. Đây là số liệu của checkpoint chưa đủ bob; không dùng chúng để suy ra chi phí kiểu tóc hoàn chỉnh.

Atlas chung RGBA sRGB 2.048 × 1.024, tám ô sợi, alpha MASK 0,42, metallic 0, roughness 0,61 và specular factor 0,40. Dùng lọc tuyến tính và mipmap. Ước tính RGBA8 với mipmap đầy đủ cho tóc là 10,67 MiB, toàn bộ các texture runtime khoảng 46 MiB. Chưa đo VRAM thực, overdraw, FPS hoặc LOD. Đường chải đan chéo và card hai mặt còn nhiều vùng chồng, cần đánh giá lại sau khi có checkpoint mỹ thuật đạt.

Cycles và Three.js đều cho thấy những dải tóc tách rõ. Runtime sáng ít chuyển sắc hơn, mép alpha và khoảng hở ở chân tóc nổi rõ hơn ở cỡ màn hình di động. Nền/đèn trắng dùng để kiểm tra hình khối; bộ đèn và tone mapping giữa hai engine có khác biệt, nên bảng renderer không chứng minh độ khớp màu tuyệt đối.

## Phán quyết

| Tiêu chí | Phán quyết |
| --- | --- |
| Hair Curves thật, chỉnh được | PASS tại checkpoint |
| GBH thật, mesh truy được về guide | PASS tại checkpoint |
| Bỏ bề rộng kế thừa từ V1.2 | PASS |
| Mái mảnh, thoáng và tự nhiên | FAIL về flow và nhịp ngọn |
| Lớp ôm mặt tự nhiên | FAIL, vẫn thành dải rủ lặp |
| Độ sát Golden Style 04 | FAIL |
| Premium Cute Anime | PARTIAL, mặt và màu phù hợp nhưng tóc chưa đạt |
| Khóa mặt, rig, trang phục | PASS |
| HairSlot và GLB nhập/xuất | PASS tại checkpoint |
| Three.js fidelity | PARTIAL |
| iPhone Safari performance | CHƯA KIỂM CHỨNG |
| Tổng thể | PARTIAL về công việc, ARTISTIC FAIL |

## Tái lập và chạy demo

Yêu cầu bản V1.2 .blend và hai tệp V1.1 .blend/.glb đã duyệt. Đặt V12_BLEND, V11_BLEND và V11_GLB thành đường dẫn tuyệt đối. Cần Blender và các add-on đúng phiên bản, Python với Pillow/NumPy, Node với Playwright, Three.js 0.180.0 và Chromium có WebGL2. Đặt THREE_DIR và CHROME_BIN theo máy. GLTF_VALIDATOR trỏ tới package gltf-validator.

```sh
python scripts/atlas.py
blender -b "$V12_BLEND" --python-exit-code 1 -P scripts/groom.py
scene=out/Vita-Style04-Groom-V13.blend
blender -b "$scene" --python-exit-code 1 -P scripts/finalize.py
blender -b --python-exit-code 1 -P scripts/qa.py
blender -b --python-exit-code 1 -P scripts/outfit_check.py
blender -b "$scene" --python-exit-code 1 -P scripts/export.py
blender -b --python-exit-code 1 -P scripts/reimport.py
node scripts/validate_glb.cjs
blender -b "$scene" --python-exit-code 1 -P scripts/render.py
blender -b "$V12_BLEND" --python-exit-code 1 -P scripts/evidence.py
blender -b "$scene" --python-exit-code 1 -P scripts/evidence.py
node scripts/web.cjs
python scripts/sheets.py
```

Trong gói ZIP, chạy python -m http.server 8000 ở thư mục có index.html rồi mở http://localhost:8000. Bộ chọn Tóc đổi bob V1.1 và checkpoint. Thư viện Three.js kèm giấy phép MIT được đóng gói trong vendor. GLB bàn giao riêng hiển thị checkpoint mặc định, GLB review/wardrobe.glb chứa cả hai lựa chọn và cần bộ chọn hiện đúng một kiểu.

Nhánh work/vroid-style04-groom-correction-v13 chỉ có script/evidence nhẹ mới và cấu hình tắt Vercel deployment riêng cho nhánh thử nghiệm. Chưa mở PR hoặc merge.
