# SESSION 4B — Gate Blender 5.2 + OpenSew 2

Ngày 2026-11-13 (UTC). **PARTIAL: A/B đạt về chức năng trên avatar mẫu; C bị chặn ở nhận diện rig/đo Vita.** Dừng tại blocker này, không sửa add-on hoặc tạo trang phục Vita.

Repository `ToanFreelance/audition-mobile-mvp`, nhánh `work/vita-wardrobe-tryon-poc-v1`. Remote và local HEAD trước sửa: `974e8e0768e9322f93232657be4a033869fd6372`; working tree sạch, API PR đang mở cho nhánh trả danh sách rỗng. Đã đọc Project Instructions và nghiên cứu modular pipeline hiện có. Chỉ thêm báo cáo này.

## A — Bản portable và khởi tạo

| Hạng mục | Kết quả thực thi |
| --- | --- |
| Blender | **5.2.4 LTS**, build hash `cd5dc428cce1`, build 2026-11-10 01:31:47; đúng nhánh phiên bản 5.2 |
| Archive chính thức | `https://download.blender.org/release/Blender5.2/blender-5.2.4-linux-x64.tar.xz`, 385.047.680 byte |
| SHA-256 | `2fd14c50987426897ba60237ee996edf2b4151f4b1a72a460ca20be58c1d2d86`, khớp file `blender-5.2.4.sha256` của nhà phát hành |
| Dependency | `ldd` giải được các dependency của executable, không có `not found`; dùng thư viện đi kèm archive và thư viện host. Không cần cài gói hệ thống cho các test đã chạy |
| Môi trường chạy | Debian 13.6 x86_64, user 1000; thư mục riêng `/workspace/scratch/dbcd998af236/opensew-compatibility-gate/`; config/scripts/data/extensions/cache/tmp đều user-local |
| Background | `--background --factory-startup --disable-autoexec --threads 2 --python-exit-code 2`; Python xác nhận `bpy.app.background = True`; exit 0, 3,30 giây |
| OpenSew | Repository gốc [MarcelloMorettoni/opensew-2](https://github.com/MarcelloMorettoni/opensew-2), chốt commit **`86b432238464d88e3d2c5e1cf3fbf693f1e51722`** |
| Phiên bản add-on thực | Tên `Clothing Design`, `bl_info.version = (1, 0, 0)`, minimum Blender `(4, 2, 0)`; README tác giả ghi tested on 5.2. Không gọi đây là package version 2.0 |
| Nạp/tắt add-on | Symlink `clothing_design` vào thư mục scripts/addons riêng; `addon_utils.enable` thành công, Scene/Object.cd và operator import_character/add_garment/sew/finalize tồn tại; disable xóa Scene.cd, exit 0, 2,49 giây |

Đã đọc imports, registration, đường nạp avatar, sewing và finalize/weight-transfer trước khi load. Add-on dùng Python/API Blender, không thấy lệnh shell/network/installer trong các module add-on được rà soát. Mã được cấp GPL-3.0-or-later; README assets ghi hai avatar mẫu CC0. Không tải MPFB: avatar đã được bundle, không cần tái sinh chúng. Archive source được lấy theo đúng commit qua GitHub codeload; SHA-256 archive thực là `7e04ba01be64f10c7afb6d596b94dba5e0c5249798eea628feb711c72b08c9c0`.

Trang `www.blender.org/download/` trả HTTP 403; index/archive/checksum trên server download chính thức truy cập được. Đây không chặn đường portable đã thử. Không dùng APT, sudo, Wine/Proton, nâng quyền hoặc thay bảo mật; chỉ một Blender và một OpenSew.

## B — Avatar nam/nữ và đúng một lần may T-shirt

Chạy nguyên bản `tests/test_presets.py` của commit trên, **không thêm `--drape`**: exit 0, **0 failure(s)**, 57,76 giây. Test này nhập cả hai avatar, đo body, kiểm tra figure/neck/pose/feet và tạo đủ 9 preset mỗi avatar, đồng thời kiểm tra tương quan chiều dài seam.

| Avatar mẫu | Chiều cao | Ngực/eo/hông | Cổ | Tay | Kết quả |
| --- | --- | --- | --- | --- | --- |
| Nora / WOMAN | 161 cm | 87/67/92 cm | 32,9 cm | 60° | Import, auto figure, measurement và 9 preset đạt |
| Theo / MAN | 186 cm | 102/80/94 cm | 38,5 cm | 60° | Import, auto figure, measurement và 9 preset đạt |

Đây là 18 lượt **draft pattern**, không phải may 18 trang phục. T-shirt nữ draft có 4 mảnh/10 seam/2.236 đỉnh; nam có 4 mảnh/10 seam/3.083 đỉnh. Không chạy `test_bodies.py`, `test_fit.py` hay bộ drape nhiều trang phục: ngoài smoke test giới hạn, một số cần body được sinh thêm bằng MPFB.

Phép smoke riêng dùng Nora, preset TSHIRT, fit 0,10; gọi **`bpy.ops.cd.sew()` đúng một lần**, sau đó `bpy.ops.cd.finalize()`. Giữ mặc định 25 stitch frame + 50 settle frame; không sửa topology bằng tay hoặc sửa add-on.

| Kiểm tra T-shirt | Kết quả |
| --- | --- |
| Sewing/drape | FINISHED, 83,50 giây; 134 seam vertices welded; tới frame 76; toàn bộ process 90,88 giây, exit 0 |
| Đo xuyên body sau drape | 26/8.302 đỉnh evaluated nằm sâu hơn 4 mm, **0,313%**, dưới ngưỡng 2% của phép kiểm tra tác giả; tọa độ hữu hạn; 0 loose edge |
| Finalize | FINISHED; tự đóng 4 stray holes theo implementation của tác giả; thêm dày 1,5 mm; không còn modifier CLOTH |
| Skin-weight transfer | Armature modifier trỏ đúng `CD_Woman_Rig`; 52 bone vertex groups; **2.102/2.102 đỉnh có trọng số** |
| Chuẩn hóa trọng số | Tổng trọng số mỗi đỉnh trong khoảng 0,999999955–1,000000046; kiểm tra sai số < 1e-4 đạt |

Cảnh báo thực tế: startup in hai dòng `socket(): Operation not permitted`, nhưng các phép thử Blender/add-on đều hoàn tất. Trong lần may có cảnh báo `Modifier: "CD_Cloth", Number of points in cache does not match mesh`; đã lưu nhận xét, không sửa nội bộ hoặc thử may lại. Penetration chưa bằng 0. Chỉ kiểm tra binding/trọng số, chưa thử biến dạng bằng animation sau finalize; chưa render/đánh giá thẩm mỹ hay xuất wearable game.

## C — Vita V1.1 chỉ đọc: blocker compatibility

Tìm được đúng source private đã ghi trong tài liệu dự án; không dùng avatar khác thay Vita:

- `Vita-Premium-Cute-V11.blend`: 19.313.996 byte, SHA-256 `138a5b8321bd333e409340be321e483bdef6f2e6bebe5758bc8af6d4d75fed52`.
- GLB được duyệt: 4.953.812 byte, SHA-256 `d422159770ee8e9fbc9d78f2f256d5ee988651373cbd211aaa99efd7ecf2bad8`.

Mở blend với autoexec tắt. Đo trên **bản sao mesh/data/armature trong scene tạm**, giữ transform và pose; cache đo của OpenSew cũng nằm trong scene tạm. Không save/export. Fingerprint tọa độ/face/weights/body transform/bone rest và pose của đối tượng gốc khớp trước/sau; SHA-256 BLEND và GLB gốc cũng không đổi.

| Hạng mục Vita | Quan sát |
| --- | --- |
| Full-body fitting candidate | Object ẩn `Vita_Suit`, 6.423 đỉnh, **10.614 polygon tổng**: 7.732 polygon material Body_00_SKIN, 2.122 Tops_CLOTH, 760 Shoes_CLOTH. Body fitting phù hợp cần lấy **vùng SKIN** của nguồn này trên bản sao; không chọn toàn bộ object như body trần. Chưa tách geometry trong phiên này |
| Mesh đang thấy | `Street_Skin` chỉ 3.103 đỉnh/4.836 polygon; theo audit nguồn trước, đã cắt vùng dưới trang phục, không phải donor full-body thích hợp |
| Hệ tọa độ/scale | METRIC, scale_length 1; object scale (1,1,1), world transform có xoay 180° quanh Z; world Z khoảng -0,000115 đến 1,675139 m; OpenSew auto-facing trả -Y |
| Rig/pose | `Armature`, 155 bones/155 vertex groups; pose_position = POSE, mọi pose matrix_basis identity, không có action active. Chưa đo góc tay độc lập; không đổi pose gốc |
| Bone nhận được | Neck → J_Bip_C_Neck; Chest → J_Bip_C_Chest; Hip → J_Bip_C_Hips; không nhận waist bone trực tiếp |
| Blocker | **0/8 limb chains được nhận**, `measured_limbs = []`: tên VRoid J_Bip_L/R_* không khớp lookup limb của OpenSew |
| Measurement thử nguyên trạng | Cao 1,67525 m; ngực/eo/hông 57,44/61,54/94,24 cm; cổ 22,46 cm; auto figure = **MAN**. Đây là output chẩn đoán trên bản sao object còn vùng CLOTH/modifier, không phải bộ số đo fitting được chấp nhận |

Dừng khi xác nhận thiếu limb recognition. Không chạy lại trên body đã chỉnh, không ép figure hoặc đổi bone để biến phép đo thành PASS. Hai hạn chế độc lập cần xử lý trong task khác: input skin-only thích hợp và adapter tên bone/vertex-group VRoid. Kết quả hiện tại chưa phân tách mức ảnh hưởng của hai yếu tố lên số đo/figure.

Mapping cần thiết cho adapter tương lai, **chưa áp dụng/chưa kiểm thử**:

| Vai trò OpenSew | Bone Vita bên trái | Bone Vita bên phải |
| --- | --- | --- |
| arm_l / arm_r | J_Bip_L_UpperArm → J_Bip_L_LowerArm | J_Bip_R_UpperArm → J_Bip_R_LowerArm |
| farm_l / farm_r | J_Bip_L_LowerArm → J_Bip_L_Hand | J_Bip_R_LowerArm → J_Bip_R_Hand |
| thigh_l / thigh_r | J_Bip_L_UpperLeg → J_Bip_L_LowerLeg | J_Bip_R_UpperLeg → J_Bip_R_LowerLeg |
| calf_l / calf_r | J_Bip_L_LowerLeg → J_Bip_L_Foot | J_Bip_R_LowerLeg → J_Bip_R_Foot |

Waist/spine cần alias `J_Bip_C_Spine`; vertex-group limb masks cần cùng nhóm UpperArm/LowerArm/UpperLeg/LowerLeg bên L/R. Torso exclusion cũng cần rà các tên VRoid như LowerArm/Little. Chỉ mapping landmark bone chưa đủ; không đổi tên rig production.

## Kết luận thực dụng và validation

Pipeline có cơ sở để authoring pattern, may và bind trang phục mới trên **hai avatar mẫu được hỗ trợ**. Chưa đủ chứng cứ gọi là pipeline modular nam/nữ sẵn cho Audition: Vita chưa đo đúng với add-on nguyên trạng, nam production chưa được thử, chưa có visual/animation/export/mobile validation. **PARTIAL**, riêng fitting Vita **BLOCKED** chờ input/adapter nêu trên.

Validation đã chạy: checksum archive chính thức và source Vita, ldd, Blender background, enable/disable add-on, upstream preset/measurement test, đúng một T-shirt sew/finalize/weight assertion, inspection/measurement Vita chỉ đọc và hash trước/sau. Kiểm tra tài liệu bằng `git diff --check`, diff chỉ thêm một file docs; sau commit đọc lại remote HEAD và diff. Không chạy build/full-project QA cho tài liệu; không claim visual/iPhone acceptance.

Không tạo Cyber Blue/Sweet Pop/Sweet Girly; không sửa face/body/outfit/rig/Hair Studio, Character Catalog, Shop/Inventory, gameplay hoặc Waiting Room. Không commit binary/add-on/private asset, không merge/deploy. Dừng SESSION 4B.
