# M3 Waiting Room Idle V1.8.1

Bản để chủ dự án duyệt trên iPhone. HEAD đối chứng là `16b36acc0147e6e8e1cf1bb1205539c7290a362b`. Hai video đã mở là `Video-test(20261116-031643).mp4` (nguồn 89,23 s) và `Video-test(20261116-121906).mp4` (1.225 khung hình, bản quay iPhone khoảng 40,83 s). Đã trích ảnh cùng thời điểm từ nguồn và bản V1.8, theo dõi đổi trụ, độ cao tay, gập gối, giữ và thu động tác. Trong bản quay điện thoại, vùng giữa sân sau giây thứ ba có khoảng 28% cặp hình liền nhau chênh dưới 0,3 mức xám trung bình. Cả khoảng giữ tư thế lẫn nén video đều ảnh hưởng số đo này.

## Chỉnh diễn xuất

V1.8 dừng hai action trong lúc chuyển thế. Phần tay đi từ dáng tĩnh này sang dáng tĩnh kia trong lúc chân bước. Vị trí bàn chân thay đổi nhưng độ hạ hông và hướng gối chưa phản ánh đủ mức chịu tải. Riêng F03, cách lấy hướng từng đoạn tay từ ảnh làm mất độ co khuỷu của dáng thủ. M03 đưa mắt cá ra trước tới 22,2% chiều cao rig.

| Clip | Giây nguồn | Thay đổi |
|---|---|---|
| F01 | 0–10,40 | Đổi tải trước khi mở lòng bàn tay, hạ hông và thu vai khi tay trở về. |
| F02 | 11,60–25,30 | Đổi trụ nhỏ, ngực xoay rồi bàn tay theo sau. |
| F03 | 25,60–33,23 | Hạ trọng tâm khi thủ, mở hướng gối theo mũi giày. Hai cổ tay ở gần mặt thay cho ngang ngực. Ở 27,47 s chuẩn bị chuyển trụ, 28,63–29,10 s nâng tay và thân, khoảng 30,70 s nén lại rồi thu về. |
| F04 | 34,00–41,70 | Phối hợp nhún và xoay thân qua các bước. Sửa hướng cánh tay phải để cẳng tay qua phía trước áo. |
| F05 | 42,90–53,10 | Giữ thế hẹp, hông chuyển tải trước khi chân trái mở rồi khép. |
| M01 | 53,70–64,80 | Ngực gập thêm lúc thả đầu, duy trì khoảng giữ và cho vai mở khi hồi. Tách đường tay khỏi túi cargo. |
| M02 | 66,00–72,00 | Hông xuống sâu hơn trong clip. Khi rời dáng thấp, gối trụ duỗi bớt trước bước. Khối lượng của nhân vật gấu vẫn khó thể hiện trên rig người. |
| X01 | 73,27–81,33 | Thân xoay theo cử chỉ tay trống, giữ khoảng cách cổ tay với hông. Thiết bị che một phần quỹ đạo nguồn. |
| M03 | 82,20–88,63 | Trụ trái, chân phải co ra sau, tay trái gần thắt lưng. Khoảng 83,70 s hạ tải trước cử chỉ, 84,53–85,83 s mở và giữ tay phải, từ khoảng 86,80 s thu về. Đích mắt cá phải cuối cùng là (−0,068 ngang, −0,082 sâu, +0,041 cao) theo chiều cao. |

Dùng Blender 4.3.2 chạy Python ở chế độ nền. Script polish.py lấy track V1.8 và độ dài xương từ VRM của từng họ. Các F-Curve Bézier khóa theo thời điểm nguồn điều khiển chuyển tải, pitch, roll, yaw và mục tiêu cổ tay. F03 giải hai đoạn tay với cực khuỷu hướng ra ngoài. M03 dựng lại đường tay trái và giữ cử chỉ tay phải từ nguồn. Xương đòn, tay và cổ tay đáp ứng độ xoay của ngực ở các thời điểm khác nhau. Bake quaternion trong hệ glTF rồi rút khóa dư. Đầu vào là thư mục clip V1.8 riêng, thư mục tài sản chứa family/body/family.vrm và thư mục xuất. Có thể chạy lại theo lệnh trong đầu script. Dữ liệu MediaPipe/OpenCV của lượt trước là nền. Độ sâu, lực trụ và một phần cổ tay được suy ra từ ảnh đơn góc.

Ở góc nghiêng F03 đã thấy gối gập khi thủ và duỗi khi tay lên. M03 bớt dáng ngồi trên ghế vô hình. Bản thử nâng chân phải 10,3% chiều cao giao ống chân với gấu quần ở 65/65 mẫu. Đã hạ và đưa chân ra sau, mở hướng gối, kiểm lại cả lúc vào và ra. Bản thử vẫn lộ mảng da sau vai nam khi tay giơ. Tia qua vùng này ở M03 giây 2,6 cho thấy da trước mặt vải khoảng 2–3 mm. Đã thêm độ rộng riêng vùng sau vai trên bản sao áo logo, rồi render lại cùng góc. Độ chớp của tay vẫn cần duyệt ở 1×. Trên tám track thân và tay, tốc độ góc cực đại F03 tăng từ 180 lên 285°/s, gia tốc cực đại tăng từ 2.871 lên 3.207°/s². M03 giữ đỉnh tốc độ khoảng 133°/s nhưng gia tốc cực đại tăng từ 3.008 lên 5.031°/s² ở tay trái. Các giá trị lấy sai phân 30 Hz, không phải phép đo lực.

## Chuyển thế và phạm vi runtime

Ghi pose cùng vận tốc cục bộ khi rời clip. Giữ độ lệch pose ban đầu so với clip mới, tiếp diễn vận tốc cũ trong một khoảng ngắn rồi triệt dần. Clip đến tăng tốc trong 0,42 s cuối và tiếp tục từ thời điểm đã phát. Hông, cột sống, cổ, xương đòn và tay dùng cùng tín hiệu tải chân trụ. Mỗi bước có 0,31 s chuẩn bị, pha vung và khoảng ổn định 0,29 s. Gối hướng theo thế chân. Clip đứng hai chân đợi qua tiếp đất và ổn định trước khi nhận yêu cầu ngắt. Khi rời M03, chân giơ hạ trước khi đổi chân trụ.

Giữ túi xáo theo participant, bộ chọn tương thích, mixer và clone theo actor. M3 chỉ có lobbyReady, runtimeReady vẫn false. Đồng hồ gameplay, READY và dữ liệu phòng giữ nguyên.

## Kiểm hình học, render và giới hạn

Trên mesh thật mặc bộ đồ mặc định, kiểm tam giác đã skin ở 30 Hz trong 2.446 mẫu clip và 2.666 mẫu của 32 cặp chuyển khác ID, bắt đầu từ đầu clip. Không ghi nhận giao giữa cẳng tay/bàn tay với thân, áo hoặc quần, giữa hai giày, hai đùi, hai ống chân, hoặc giữa ống chân và quần. Phần nối cánh tay/vai với thân và tay áo, đùi với quần có giao hình học. Chưa quét mọi biến thể tủ đồ hoặc mọi thời điểm yêu cầu chuyển. Dịch ngang lớn nhất mỗi khung của các đỉnh trong 4 mm dưới cùng của đế khi trụ là 1,55×10⁻⁸ trên nữ và 3,09×10⁻⁷ trên nam theo đơn vị actor. Cao độ đế thấp nhất −4,98×10⁻⁹. Phần cổ giày có thể biến dạng theo cẳng chân.

Video so sánh ghép nguồn, chính diện V1.8, chính diện và nghiêng V1.8.1 ở tốc độ 1×. Sáu cặp quay riêng gồm F05↔F03, M01↔M03, F04→F01, M02→M01. Video phòng năm người 390×844 có ba M3 và hai actor cũ, cùng thế hệ scene và cùng ba runtime qua các lần đổi. Hai nhân vật ngoài cùng bị cắt một phần ở preset này. Video phòng lấy khung từ Chromium với đồng hồ dựng hình, phần phát được 13,2 s của bản ghi đã được khôi phục sau khi lần đóng container MP4 bị gián đoạn.

TypeScript và build production chạy thành công. Playwright logic gồm 13 bài, có hai lượt mô phỏng 480 s, chống lặp, thay đổi formation, pose nối, chân giơ hạ và định danh. Smoke nữ và nam render thật chạy đạt. Lượt local đầu của fixture năm người hết hạn 100 s khi mới tải xong hai actor. ESLint toàn dự án vẫn báo hai chỗ gọi reconcileParticipants trước khai báo, đã chạy lại trên nguyên tệp ở HEAD V1.8 và thấy cùng lỗi.

Vòng vẽ phòng chờ giữ phần dư giữa các lần rAF và bỏ khoảng thời gian tab bị ẩn. Mục tiêu mặc định 30 hình/s, có thể thử 60 trên QA bằng cadence=60. Đo thời gian cập nhật M3, gửi lệnh vẽ, P95 khoảng vẽ và thời gian bị bỏ bởi giới hạn delta 100 ms. SwiftShader đo CPU và thời gian gửi lệnh, chưa có phép đo GPU iPhone. Chủ dự án cần xem lại F03, M03, nhịp tay, hạ chân, vai áo và các lần chuyển ở tốc độ thường trên thiết bị thật.

Lượt chạy riêng fixture năm người đạt sau 47 s, kiểm 5 actor, đổi READY rồi NOT READY, định danh ba runtime giữ nguyên, scene generation 1 và drift bằng 0 ở lần lấy mẫu cuối. Tổng 16 bài có lượt chạy đạt. Profiling thực với ba M3 hoạt động trong phòng năm người cho P95 khoảng vẽ 366,7 ms ở cả hai mục tiêu. Ở 30/60, trung bình cập nhật ba M3 là 0,36/0,46 ms, gửi lệnh vẽ là 7,25/6,54 ms. Cả 110/119 khoảng vẽ lần lượt đều trễ ngưỡng 1,5 lần chu kỳ mục tiêu. Giới hạn delta làm mất 26,87/25,50 s trong hai cửa sổ đo. Đổi mục tiêu 60 chưa giải quyết nghẽn của môi trường render phần mềm.

Video duyệt 1×:

- [F03 và M03, nguồn và hai phiên bản](https://chatgpt.com/library?file_id=libfile_370c8065d57c8191a49bd68298e24e35&account_id=personal)
- [Năm clip nữ](https://chatgpt.com/library?file_id=libfile_875849593bbc8191b85e5d7e96e0f550&account_id=personal)
- [Bốn clip nam](https://chatgpt.com/library?file_id=libfile_d1d511c8454c81918fdd0d20db300745&account_id=personal)
- [Sáu chuyển thế](https://chatgpt.com/library?file_id=libfile_2d9489234d5481919db0d9a01b5a36e7&account_id=personal)
- [Phòng năm người](https://chatgpt.com/library?file_id=libfile_acfcfe293ca081918894f6f0115af400&account_id=personal)
