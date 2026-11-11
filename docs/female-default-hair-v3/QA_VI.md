# Style 04 V3 — checkpoint duyệt mái

**Kết luận mỹ thuật: FAIL ở tiêu chí mái mềm và tự nhiên như concept.** V3 đã giữ được dáng bob Hunyuan, có khoảng hở để lộ chân mày và hai mắt M02. Chân mái nối vào ngôi tốt hơn checkpoint B. Khi nhìn gần, các ngọn ở giữa vẫn mỏng và cong cùng hướng khá đều. Hai mảng tóc qua thái dương còn dày. Mép phía trong gần gáy và một số rãnh hai bên còn gồ, thấy rõ nhất ở bản clay tóc riêng.

## Từ Hunyuan đến V3

| Bước | Tam giác | Thay đổi |
|---|---:|---|
| GLB gốc | 936.744 | Tóc và mannequin liền trong một primitive, dùng chung atlas. Mái giữa lồi, đáy rộng và tù. |
| Checkpoint A | 713.717 | Chọn mặt theo màu tại UV, giới hạn theo vị trí bên trong và kiểm tra liên thông sau khi đối chiếu các đỉnh trùng ở đường nối UV. Giữ mái cũ để có điểm quay lại. |
| Nền tách sau hiệu chỉnh | 715.818 | Khôi phục thêm 2.101 tam giác trên lớp ngoài của tóc trước khi cắt mái. |
| Khối bob giữ lại | 685.908 | Bỏ 29.910 tam giác trong vùng mái giữa. Giữ khối hai bên, đỉnh, gáy, UV và ba texture PBR nguồn. Chỉnh chiều rộng, chiều sâu và độ cao của tóc theo đầu thật. |
| Tóc cuối | 716.084 | 41 lọn mới theo chín nhóm hướng, tổng 30.176 tam giác. Lọn có tiết diện hơi cong, bề rộng, chỗ cong và độ dài riêng. Khoảng hở giữa các ngọn là hình học thật. |

So với V1/V2, phần bob có các lớp uốn vào hàm và gáy rõ hơn, đặc biệt ở góc nghiêng. Bản này dành cho duyệt tóc ở tư thế tĩnh. Tối ưu mobile và nghiệm thu trên thiết bị nằm ngoài checkpoint.

## Kiểm tra đã chạy

- Blender 4.3.2 mở lại tệp fitted cuối. Chữ ký của 11 đối tượng thuộc baseline khớp trước và sau, bao gồm mesh M02, mắt V8, thành phần miệng, UV, topology, custom normals khi có, transform, trạng thái hiển thị và shape key khi có.
- Nhập lại GLB tóc trong scene trống. Có một mesh bob và 41 mesh lọn mái, hai material, bốn ảnh nhúng, tọa độ hữu hạn, UV trên toàn bộ mesh. Ba texture Hunyuan có nội dung nhị phân trùng bản gốc.
- Chạy lại hai script trong repo từ GLB Hunyuan đính kèm và scene V1 có đầu M02/V8. SHA-256 của GLB dựng lại trùng bản giao.
- Dùng Cycles CPU để render. Ảnh tóc riêng lấy từ chính GLB đã xuất, trong scene chỉ còn tóc, camera và đèn. Ảnh fitted dùng đầu thật trong Blender. Clay và lavender đơn sắc được áp lên tóc, giữ material gốc của mặt. Ảnh PBR dùng texture gốc trên khối bob.
- Không thấy mặt, cổ hay tai mannequin nguyên hình trong các góc kiểm tra. Trong góc 35° của tóc riêng, mặt trong gần gáy còn bề mặt lởm chởm. Độ kín của mesh và hiệu năng gameplay chưa được chứng nhận.

## Dựng lại hình học

Dùng Python có NumPy 2.x và Blender 4.3.2. File Blender tham chiếu là `Female-Default-Hair-Style04-V1.blend` có SHA-256 `d8cdbbd9a543a0b6ba9efbd623c3e40d9f9ce2ab07ce770d948f558d9bf9b506`. File này đã chứa presentation Golden Mouth V4 M02 và Golden Eye V8. Hai script kiểm tra hash của đầu vào trước khi áp dụng chỉ số face và mẫu lọn.

```bash
python scripts/female-default-hair-v3/recover_shell.py Female_hair_origin.glb fitted-shell.glb
blender -b Female-Default-Hair-Style04-V1.blend --python-exit-code 1 \
  -P scripts/female-default-hair-v3/build_fringe.py -- fitted-shell.glb output
```

Bộ dựng xuất GLB tóc và scene authoring. File fitted giao riêng có thêm camera và ánh sáng duyệt. Xem danh sách SHA-256, checkpoint và ảnh trong `artifacts.json`.
