# F01 Blender V1.9.2 — bản thử hình ảnh, chờ chủ dự án duyệt

Chủ dự án đã bác hình ảnh V1.9.1. F01 được dựng lại trên armature Drophunter 198 xương trong Blender 4.3.2, từ 23 tư thế mốc của nguồn 0–312. Hông, vai, ngực, đầu, tay và chân thuộc cùng action. Cặp xách trong nguồn không có trong bộ đồ M3 hiện tại. Chiều sâu và tâm khớp dưới trang phục là ước lượng.

## Nguyên nhân và quyền ghi xương

Bản trước chỉ bake phần thân trên. Sau mixer, runtime cộng dịch hông, khôi phục đùi/cẳng chân/cổ chân rồi gọi solveFoot từ stances.ts. Vì vậy chân không được dựng đồng bộ cùng đường tay. Bộ nhận dạng còn gán tay mang cặp vào mặt/tóc. Điểm chiếu 2D tốt hơn chưa giải quyết được dáng gối gập và cảm giác diễn xuất.

F01 mới dùng motionOwner=blender-full-body. Trong toàn bộ 313 khung biểu diễn, chỉ mixer ghi các track hông và quaternion. Phần sau mixer chỉ đo vị trí chân. Các clip còn lại dùng cơ chế hiện hành. Đoạn nối clip có chủ sở hữu riêng là bridge/IK, dùng vị trí giày đã bake làm đầu/cuối. Đoạn F01 → F02 mở tay phải sớm hơn để tránh quần.

## Dựng và xuất

    blender -b -t 4 -P scripts/m3-idle/blender_f01_v192.py -- --assets CACHE --output OUTPUT --render keys

Nhập sáu VRM hiện hành, dùng một skeleton cho thân, mắt, áo, quần, giày và tóc. Hai chuỗi IK tay và hai chuỗi IK chân có pole, giới hạn quay và tắt stretch. Thêm các khóa F-curve cho lòng bàn tay, hông, ngực, vai, cổ, đầu và ngón tay. Giữ chiều dài xương. Khi xuất, liên hợp ma trận pose/rest của Blender sang hệ trục glTF, tính rotation cục bộ theo parent, chuẩn hóa quaternion và dấu liên tục. Mỗi track lấy mẫu 30 Hz, đủ 313 khung, thời lượng 10,433333 giây.

Blender scene, ánh xạ rig, ảnh nguồn và dữ liệu kiểm tra được giao riêng. Bộ Cycles CPU render tư thế mốc. Màu và ánh sáng của Cycles khác Three.js, hình học được đối chiếu trên từng khung.

## Nhịp và tiếp xúc

| Khung | Diễn xuất | Chân |
|---|---|---|
| 0, 30, 60, 80 | Đứng giữ, tay trái trước thắt lưng, tay phải bên cặp | Hai chân |
| 92, 100, 106 | Chuẩn bị, tay trái nhấc và mở | Phải trụ, trái dịch 96–109 |
| 112, 119, 128 | Xoay thân, mở lòng bàn tay, hông chuyển sang trái | Trái trụ, phải dịch 109–125 |
| 140, 172, 200, 224, 230 | Giữ bàn tay mở, chuyển động nhỏ cổ tay và đầu | Hai chân, hông lệch trái |
| 238, 243, 249, 255 | Hạ tay theo cung, quay thân trở lại | Trái trụ, phải về 245–257 |
| 262, 268 | Đưa tay về thắt lưng, ổn định hông | Phải trụ, trái về 257–272 |
| 290, 312 | Khép diễn xuất và giữ | Hai chân |

Thời điểm tiếp xúc suy ra từ đế giày trên hình, sai số khoảng ±3 khung. Chiều cao bước và độ sâu là lựa chọn dựng hình. Đã sửa hai khung thiếu chân trụ ở bản thử nội bộ trước khi xuất bản bàn giao.

## Các cổng kiểm tra

A đạt về truy cập nguồn và rà tư thế. B đạt về chạy Blender, rig thật và action toàn thân. C còn mở về độ giống diễn xuất. D được kiểm bằng video nguồn cạnh mesh M3 và góc nghiêng đủ 313 khung. E cần kết quả test đúng commit bàn giao. F chờ chủ dự án xem iPhone.

Các số đo, trạng thái CI, đường dẫn Preview và hạn chế cuối cùng được ghi trong báo cáo bàn giao. Không dùng các kiểm tra số học để tuyên bố nghiệm thu nghệ thuật.
