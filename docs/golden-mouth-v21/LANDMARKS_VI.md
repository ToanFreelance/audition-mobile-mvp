# Landmark M01 và tỷ lệ chuẩn hóa

Golden: ảnh owner 1122×1402, ô M01 góc trái trên. Tọa độ pixel đo thủ công,
sai số khoảng 1–2 px ở môi, 2 px ở đồng tử. Không suy ra độ sâu 3D từ ảnh chính diện.
V2: Cycles front 680×760, orthographic .94, render mouth cùng scale .24.
Đo trên ảnh gốc chưa crop/resize; mọi tỷ lệ chia khoảng cách tâm đồng tử (IPD).

| Landmark ảnh | Golden (x,y) | V2 front (x,y), xấp xỉ |
|---|---|---|
| Đồng tử trái / phải | (156,315) / (276,315) | (243,380) / (437,380) |
| Hai khóe | (195,405) / (239,405) | (308,522) / (373,522) |
| Giữa seam | (217,406) | (340,523) |
| Đáy mũi | (217,378) | (340,480) |
| Cằm | (217,450) | (340,590) |
| Đỉnh vermilion / đáy môi | y≈400 / 414 | y≈515 / 536 |

| Đại lượng | Golden | V2 |
|---|---:|---:|
| Width / IPD | .367 | .335 |
| Upper vermilion height / IPD | .050 ± .017 | .041 ± .010 |
| Lower vermilion height / IPD | .067 ± .017 | .067 ± .010 |
| Vị trí seam trong đoạn đáy mũi–cằm | .389 | .391 |
| Độ nâng khóe so với seam / IPD | .008 ± .017 | .005 ± .010 |
| Aperture | Gần kín, ≤1 px | Gần kín, ≤2 px |

Cupid: hai đỉnh nhỏ, hõm giữa nhẹ; sai số ảnh Golden không cho phép fit đường cong
3D chính xác. Không đặt mục tiêu thay mũi/cằm/đầu để khớp minh họa.
V2 có chiều cao môi tương đối gần Golden; thiếu bề ngang làm khối dưới trông đầy
và môi chúm. Độ nhô phải kiểm tra riêng profile/35°, không đánh đồng chiều cao với depth.

Landmark mesh-local V2 (x, height, depth), IDs giữ nguyên từ GLB:
- Khóe trái 247298 = (-.040195,.335283,.242105).
- Khóe phải 239979 = (.040296,.335113,.241969).
- Seam trung tâm 247593 = (.000284,.334691,.251146).
- Upper roll trái 243576 = (-.007762,.347862,.271968).
- Upper roll phải 243513 = (.008460,.348011,.271887).
- Đáy môi dưới 244284 = (-.000102,.316104,.236329).
- Khối môi dưới 239703 = (-.000810,.323445,.252860).

Upper-roll là landmark bề mặt, không đồng nhất với đường pigment vermilion.
Mục tiêu thử: width/IPD≈.369, không đổi tâm miệng; giảm khối dưới vài phần nghìn
đơn vị model và giữ seam. Các tỷ lệ V2.1 thực tế sẽ lấy từ geometry đã render,
không coi con số mục tiêu là kết quả đạt.
