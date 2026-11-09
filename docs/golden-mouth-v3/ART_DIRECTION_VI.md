# V3 — đánh giá gốc và chỉ đạo sculpt

Basis gốc: khóe ±.0516, height≈.3454; seam giữa height≈.3346. Khóe nâng khoảng
.0108 đơn vị, tương đương .045 IPD, tạo cười rõ. Width/IPD≈.430 so Golden≈.367.
Cupid source ±.010, height≈.3592, depth≈.272. Lower volume height≈.3190,
depth≈.2543. Biên dưới height≈.3089. Landmark đầy đủ ở controls/validation.

Giữ nguyên curvature má, nhân trung và cằm; giảm overhang môi trên bằng điều
khiển roll riêng, nâng nhẹ khối dưới và biên dưới. Giữ seam sâu riêng để không
làm tràn môi. Không tạo mặt môi từ các tỷ lệ; tỷ lệ chỉ hỗ trợ đánh giá.
Golden có Cupid nhẹ, width≈.367 IPD, seam gần kín và không thấy nụ cười rõ.
Vị trí miệng giữa mũi–cằm của source đã phù hợp, không sửa đầu/mũi/cằm/mắt.

## Lượt 1

Công cụ Laplacian Deform đã thực thi thật. Clay có khối liền, má giữ độ cong,
không có nếp kéo ngang dài kiểu V2. Tuy nhiên nụ cười móc ở hai khóe vẫn rõ.
Di chuyển tâm khóe chưa đổi đủ hướng tiếp tuyến của native smile relief.
Hai mặt nhỏ bên trong seam quay >90° (diện tích gốc ~1.9e-8/5.3e-8, nhỏ hơn
median lip face ~2e-6); không bỏ qua chỉ vì nhỏ. Chưa PASS.

## Lượt correction duy nhất

Không giảm width tiếp. Chỉnh hướng cụm commissure: góc gần 25° theo tiếp tuyến
khóe nhìn từ clay, đưa đầu cuối về gần chiều seam. Thêm guard ở phần seam sâu
để giữ separation, tránh gấp mặt nhỏ. Đây là thao tác quay/đặt cụm đỉnh giải phẫu
với solver Blender lan truyền trên mặt gốc; không dùng field nén V2/V2.1.

Sau correction render đủ góc. Nếu còn pinch/crease hoặc expression không tự nhiên,
dừng Visual FAIL. Không sửa texture để che hình học. Highlight trắng/dải tối baked
sẽ xử lý riêng chỉ khi geometry đạt; hiện texture chưa đổi.

## Kết luận sau correction

VISUAL FAIL. Đã xem đủ sáu góc và crop 1:1 cạnh V2/V2.1. Nếp dài giảm nhưng
hai khóe vẫn lõm nhọn và gợi cười; upper roll chưa đủ mềm. Dừng, không lượt 03.
Albedo emission xác nhận đốm trắng môi dưới và pigment khóe baked; không sửa
texture để che hình học. Còn một mặt seam quay >90° và residual nhỏ sát đáy mũi.
Xem QA_VI.md và surface-audit.json; không promote vào runtime.
