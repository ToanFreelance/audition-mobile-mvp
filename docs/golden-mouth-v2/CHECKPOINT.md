# Golden Mouth V2 — checkpoint 0: import nguồn

Ngày: 2026-11-09 (Asia/Ho_Chi_Minh). Chỉ M01; chưa đạt visual gate.

- Nhánh: `work/female-golden-mouth-v1-qa`; PR #26 OPEN/Draft, base Golden Eye V8.
- HEAD kiểm tra trước sửa: `3ff6acce9b10d2ac0fc514a55213f6d923742d54`.
- GLB đính kèm `(6)` có SHA-256 đúng nguồn `(5)` yêu cầu:
  `b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90`.
- Blender có sẵn `/usr/bin/blender`, **4.3.2**, background smoke test PASS.
  Không tải/công bố sử dụng 4.5.3. 4.5.3 là bản ưu tiên, không phải bản đang chạy.
- Import thật PASS: **292645 vertices / 499762 triangles**.
- Một mesh `node_0`; UV, base color, normal map, metallic/roughness được import.
- Mesh-local Blender: X ngang, Y lên, Z ra trước; mesh transform xoay X 90°.
- V1 cắt mặt, fit skin bằng đa thức, dùng vòng radial tạo môi. V2 không dùng pipeline này.
- Script hiện tại lưu Basis/M01 shape key có cùng topology; chưa áp sculpt.
- Không sửa bất kỳ file Golden Eye V8, route V1 hay gameplay nào.

## Tái tạo

```bash
blender --background --factory-startup --threads 8 --python-exit-code 1 \
  --python scripts/golden-mouth-v2/sculpt_m01.py -- \
  --source '/path/Female_anime_origin.glb' --output /path/m01-work \
  --render front mouth clay
```

Đường dẫn phiên này: nguồn `/workspace/scratch/e27dffa28e71/upload/Female_anime_origin(6).glb`;
output `/workspace/scratch/e27dffa28e71/m01-work`.
Source GLB không được commit. Khôi phục source từ tệp owner, xác minh SHA trước chạy.

## Còn lại

Xem source texture/clay; định vị native vermilion và commissure; sculpt trong shape key;
lưu .blend và evidence cho từng iteration có ý nghĩa; kiểm tra đủ sáu góc cùng original;
chỉ chạy tích hợp WebGL2 sau khi qua visual gate. Chưa có kết quả V2/preview/owner acceptance.
