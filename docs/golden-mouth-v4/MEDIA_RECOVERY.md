# Golden Mouth V4 — phục hồi phần media

Checkpoint ngày 09/11/2026, baseline `0239a5ec9eb28ad6e1d9d4bb19b8da69355e9228`, branch `work/female-golden-mouth-v1-qa`. PR #26 OPEN/Draft, không merge.

Scratch ảnh của phiên trước đã mất. Không sửa M01 hoặc bất kỳ pose V4 nào. Mở lại đúng editable checkpoint `libfile_1bb6d576cea881918e57d5fd45792652`, version 1, filename `Golden-Mouth-V4-MVP-Nine-Presets.blend`, SHA `153b589728fe54dea3f5088f2cf637541fc29b41fb42afdde743658c2cd35e79`.

`recover_media_inputs.py` chỉ đọc key data và original backup, đối chiếu với frozen controls rồi ghi render buffers. Không chạy sculpt, không lưu lại .blend nguồn. Đã mở lại bằng Blender 4.3.2: cả chín pose, Basis và historical keys khớp bit-exact; source face connectivity/UV retained khớp; upper-face mask 195239 vertices có displacement=0. Normal probe M01 sai số float tối đa 7.276e-12.

Source GLB tại `upload/Female_anime_origin(6).glb` đã kiểm lại SHA `b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90`. Không commit GLB. Dùng `/usr/bin/blender` 4.3.2 và Chrome Headless Shell đã có, không cài lại.

```bash
V4_ROOT=/workspace/scratch/e27dffa28e71/mouth-v4
blender --background --factory-startup --threads 8 --python-exit-code 1 --python scripts/golden-mouth-v4/recover_media_inputs.py -- "$V4_ROOT/input/Golden-Mouth-V4-MVP-Nine-Presets.blend" scripts/golden-mouth-v4/frozen-final-controls.npz "$V4_ROOT/delivery"
```

Tiếp theo: render 27 Cycles PNG từ đúng buffers này; chạy `browser_check.mjs` lấy raw diagnostics và 25 ảnh; chạy `make_sheets.py`; kiểm ảnh; lưu raw media và commit grid/diagnostics/report. Đây là checkpoint trước render, chưa tuyên bố media cuối hoàn tất.

## Checkpoint media WebGL2

Đã hoàn tất lần chạy mới: 81/81 PASS, Chrome Headless Shell 157.0.8103.38 / ANGLE Vulkan SwiftShader phần mềm; 25 PNG và full raw JSON đã được tạo. Các grid front/cận/35° và `evidence/webgl-diagnostics.json` được lưu cùng checkpoint này. Không gọi đây là hardware-GPU hoặc physical iPhone QA. Code runtime vẫn đúng bản bd4dbf9; local HEAD lúc bắt đầu browser là 0239a5e, trước commit chỉ thêm công cụ phục hồi media.

Tái xuất package từ buffer phục hồi cho đúng 1597931 bytes / SHA `2548334bd96d6327ea5b56124b65589ae84f8777ac33a34852fe0a8d28b5ca1d`, khớp asset đã deploy. Điều này kiểm luôn normals, interior và chín pose mà không sửa runtime hoặc checkpoint.

Đã xem ba grid WebGL2: M03/M06 mở thật; các góc 35° không lộ cavity/răng ngoài môi. M05/M09 nhẹ hơn Golden, khác biệt nhìn chính diện còn tiết chế và có căng mô nhỏ phía trên môi; giữ nguyên làm giới hạn polish để owner đánh giá. Không sửa pose trong phiên media. Cycles và đóng gói raw media vẫn đang chạy.

## Hoàn tất

Đã render/chụp lại đủ52PNG và ghép7grid. Tất cả PNG decode được, ZIPCRC và hash từng ảnh đúng. Raw archive đã lưu và nhận identity/version thành công: [Golden-Mouth-V4-Cycles-WebGL2-Raw-Evidence.zip](https://chatgpt.com/library?file_id=libfile_359b5b15f2cc8191aeda315c1cce6a17&account_id=personal), `libfile_359b5b15f2cc8191aeda315c1cce6a17`, version0, 23560060bytes, SHA `7628387c018d070f84d503bdf38a974e265bf4856f2047c09fe941fb9b49fc35`.

Đọc QA_VI.md và evidence/media-index.json cho trạng thái bàn giao cuối. Không còn bước phục hồi media bị thiếu. Vẫn chờ owner iPhone visual acceptance cho cả bộ; không tuyên bố physical Safari PASS.
