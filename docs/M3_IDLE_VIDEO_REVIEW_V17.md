# M3 Waiting Room Idle V1.7 — bản để chủ dự án đánh giá trên iPhone

Nhánh `work/m3-waiting-room-integration-v1`. Mốc so sánh `82156755e1e8de57210741bde29ee596737edd1c`. Chủ dự án đã bác V1.6 sau khi xem trên iPhone.

## Nguồn và lựa chọn

Đã mở trực tiếp `Video-test(20261116-031643).mp4`, 910×512, 30 fps, 89,233 giây. SHA-256 tệp bắt đầu bằng `8acc76d64689`. Bản `030955` và bản đính kèm `042134` có hash khác. Khi so 90 ảnh thu nhỏ cách nhau một giây với bản 031643, sai khác tuyệt đối trung bình tương ứng khoảng 0,025 và 0,009 mức màu trên thang 255. Cùng nội dung tuyển chọn ở các mẫu này. `042128` là bản quay phòng chờ dọc 16,85 giây. Dùng bản 031643 để dựng.

| Đoạn nguồn (giây, gần đúng) | Quan sát và quyết định |
|---|---|
| 0–11 | Nữ tóc hồng đổi hướng nhìn, mở tay phía phải màn hình, hạ tay và trở về hông. Tay cầm túi có thể thả lỏng. Chọn cho Drophunter. |
| 11–25 | Nhân vật tóc sáng giữ vật dài ngang thân. Bỏ vật sẽ làm mất lý do giữ hai bàn tay ở vị trí này. |
| 25–32 | Nhân vật áo đỏ ở thế thủ rộng, đổi vị trí trên màn hình. Ít phù hợp với lượt thử giữ tiếp xúc chân. |
| 32–42 | Nhân vật tóc xanh, váy sáng, có vũ khí lớn. Silhouette phụ thuộc cả trang phục và vũ khí. |
| 42–53 | Nhân vật tóc đen xoay người theo hiệu ứng sáng. Góc nhìn và vật thể che một phần tay. |
| 53–65 | Nam tóc tối, quần rộng. Ngẩng nhẹ, gục đầu, giữ lâu rồi hồi lại. Tay không cần cầm đạo cụ để đọc được động tác. Chọn cho Neurohacker. |
| 65–72 | Nhân vật lớn với thiết bị trên vai. Khối lượng vai và tỷ lệ tay khác đáng kể. |
| 72–80 | Nhân vật mang thiết bị, góc nhìn từ sau, tay thường bị khuất. |
| 80–89,23 | Nhân vật áo khoác với chân nâng và tay đưa ra. Cần nghiên cứu riêng điểm rơi và thăng bằng một chân. |

### Timing sheet

| Khung nguồn / thời gian | Dấu hiệu nhìn thấy | Ánh xạ M3 |
|---|---|---|
| Nữ 0–84 / 0–2,8 s | Giữ hông lệch, tay phải màn hình gần hông, thân không đứng thẳng đối xứng | Hông dịch, vai lệch, tay cử chỉ ở trước hông |
| 84–117 / 2,8–3,9 s | Đầu/thân bắt đầu xoay, khuỷu mở, tay đi lên nhanh | Mốc pixel của khuỷu, cổ tay, đầu ngón và mũi độc lập |
| 117–225 / 3,9–7,5 s | Bàn tay mở, thay đổi hướng ngón, vẫn nhìn về phía bàn tay | Cẳng tay xoay, giới hạn biên độ cổ tay, lồng ngực xoay theo trục vai |
| 225–265 / 7,5–8,83 s | Tay hạ qua hông, thân còn xoay, tay mới thu lại | Giữ nhịp hạ này trong clip, hiệu chỉnh độ sâu trước áo |
| 265–312 / 8,83–10,40 s | Trở về dáng nghỉ ban đầu | Nối cuối chu kỳ trong 20 mẫu cuối |
| Nam 1611–1656 / 53,70–55,20 s | Nhìn ngang, ngẩng nhẹ trước khi gục | Giữ đoạn chuẩn bị đầu vòng |
| 1656–1689 / 55,20–56,30 s | Đầu và ngực hạ, tóc che mặt | Đo chuyển vị chi tiết tóc khi mũi khuất, chia độ cúi giữa ngực, cổ và đầu |
| 1689–1875 / 56,30–62,50 s | Giữ tư thế cúi, chuyển động nhỏ | Duy trì quỹ đạo đã lọc qua đoạn giữ |
| 1875–1944 / 62,50–64,80 s | Ngẩng đầu, ngực hồi, dừng lại | Hồi về tư thế đầu trong vòng 11,10 giây |

Đây là các cửa sổ biên tập. Nguồn chuyển cảnh, không cung cấp mốc loop chính thức. Điểm nhìn thấy trên ảnh, thời điểm và hướng chuyển động màn hình là quan sát. Độ sâu, phân bố trọng lượng, xoay quanh trục cẳng tay và tư thế các ngón là suy luận cho rig M3.

## Cách dựng và nguồn gốc clip

V1.6 chia sẻ một giá trị quintic giữa tất cả kênh trong mỗi khoảng pose, với tốc độ về 0 ở cả hai đầu khoảng. Bàn tay gắn vào các đích tương đối với vai. Một số pose giữ nguyên gần như toàn thân. Clavicle và chest không có track riêng. Việc giải IK 30 lần/giây ở lúc khởi tạo diễn lại chính những đường đó.

V1.7 dùng MediaPipe Pose 0.10.21 và OpenCV 4.11 trên từng frame nguồn. Phép thử trực tiếp cho thấy lỗi đảo vai ở nam và nhận nhầm tay cầm túi ở nữ. Bộ dựng lọc mẫu đảo vai, bám các đặc điểm ảnh bằng optical flow Lucas–Kanade thuận/ngược giữa những mốc đã kiểm tra, rồi lọc nhiễu theo thời gian. Dùng quỹ đạo ảnh và tỷ lệ riêng của hai rig để giải hướng xương, giới hạn độ sâu và phân bổ xoay cẳng tay. Tay cầm túi được diễn lại ở trạng thái thả. Ngón tay có độ gập khác nhau theo từng đốt. Không có dữ liệu mocap đa camera, rig game nguồn, clip mua ngoài hoặc mô phỏng vải/tóc.

Đã nhập cả hai GLB nguồn vào Blender 4.3.2 để xác nhận armature. Việc dựng và bake quaternion thực hiện bằng Python/SciPy. Browser dùng Three.js cho cả preview thử đoạn ngắn, render góc trước/nghiêng và playback cuối. So thử cách đưa trực tiếp ước lượng pose vào bộ dựng với cách hiệu chỉnh mốc bị che và giới hạn cổ tay. Ở bản thử nữ, phép chiếu pháp tuyến bàn tay gần suy biến gây bước xoay 149°/frame. Đã thay bằng xoay cẳng tay và giới hạn góc cổ tay. Các vòng thử tiếp theo sửa khuỷu vung ra, bàn tay chạm hông, ngón xuyên viền áo và cánh tay áp vào thân khi hồi.

Mã dựng `scripts/m3-idle/reconstruct.py` nhận đường dẫn video, thư mục chứa `drophunter.glb`, `neurohacker.glb` (hai body VRM gốc từ URL của assembler, định dạng GLB), và thư mục đầu ra. Clip lưu các mốc thời gian và quaternion cục bộ đã giảm mẫu theo sai số. Web chỉ tạo track và bind UUID xương vào mixer của clone. Thời điểm bắt đầu lấy từ hash room/participant trên toàn vòng.

## Rig, chuyển động và tiếp xúc

| Đặc điểm | Drophunter | Neurohacker |
|---|---:|---:|
| Xương | 198 | 102 |
| Cánh tay / cẳng tay trái, đơn vị VRM | 0,202 / 0,170 | 0,183 / 0,214 |
| Đùi / cẳng chân trái | 0,318 / 0,417 | 0,341 / 0,447 |
| Vòng / mẫu kể cả frame khép vòng | 10,40 s / 313 | 11,10 s / 334 |

Đã kiểm tra hierarchy và offset bind của từng rig. Xương tay trái dọc +X, hướng mũi chân +Z, lòng bàn tay ở bind hướng −Y. Chuỗi hông → spine → chest → upper_chest → neck/head và shoulder → upper_arm → lower_arm → hand → ngón dùng tên sanitised của GLTFLoader khi bind. Độ rộng vai và chiều dài xương khác nhau. Các VRM quần áo do assembler kiểm tra thứ tự xương và ma trận inverse bind. Vẫn dùng chân IK sau mixer và giữ hướng mắt cá trong hệ tọa độ actor, kể cả khi thay đổi vị trí, yaw và scale của formation.

Đã dùng BVH trên tam giác thật sau skinning ở mỗi mẫu 30 Hz, cho bộ mặc định và bộ áo/quần thay thế của từng rig. Các tam giác chi được chọn theo xương có trọng số cao nhất ở ba đỉnh. So hai bàn tay gồm ngón, cẳng tay, nửa ngoài bắp tay với da thân, phần thân áo và quần. Cả bốn cấu hình cuối có 0 frame giao cắt trong những cặp đã nêu. Vùng gốc bắp tay/khớp vai vẫn tiếp xúc với tay áo và, ở nam, vùng nối da; test ghi riêng vùng này. Mặt chuyển tiếp có trọng số hỗn hợp, điểm nằm hoàn toàn trong khối kín và các thời điểm giữa hai mẫu chưa được phép thử tam giác chứng minh. Đã đối chiếu render đầy đủ ở hai góc để xem các đường viền áo thực sự.

## Đối chiếu hình và giới hạn

- **Nữ.** Ở ~3,7 s tay đã lên và mặt đã xoay về phía tay. V1.6 ở cùng thời điểm vẫn gần tư thế nghỉ. Trong V1.7 tay hạ qua hông ở ~8,1 s trước khi thu về. Ở góc nghiêng, bàn tay nghỉ còn cách áo một khoảng. M3 xoay hông ít hơn và dáng chân hẹp hơn nguồn.
- **Nam.** Ở 55 s nguồn, V1.6 đã cúi rõ trong khi V1.7 còn ở nhịp chuẩn bị. Ở khoảng 62 s, V1.7 còn cúi cùng nguồn; V1.6 đã hồi gần thẳng. Góc nghiêng cho thấy độ cong phân bố từ ngực lên cổ. Độ rũ hai vai và chuyển động tóc của nhân vật nguồn rõ hơn M3.
- **Đường cong.** Đã kiểm tra bước quay, vận tốc và sai phân vận tốc ở 30 Hz. Đỉnh nữ ở cổ tay khi hạ nhanh, khoảng 419°/s (14°/frame, gia tốc sai phân cực đại khoảng 4.620°/s²). Nam khoảng 44°/s ở đầu, gia tốc cực đại khoảng 471°/s² ở cánh tay. Đây là mô tả chuyển động, không phải ngưỡng thẩm mỹ.
- **Chân.** Trong rig thật tại tỷ lệ gốc, độ lệch mắt cá lớn nhất khoảng 1,67×10⁻¹⁰ nữ và 1,0×10⁻¹¹ nam. Mắt cá là điểm đo. Render cho thấy giày giữ trên mặt sàn ở hai góc. Nguồn không xác định chính xác phân bố lực dưới lòng bàn chân.

Video đối chiếu chạy 1×, có đồng hồ nguồn và đồng hồ clip, dựng lại V1.6 từ đúng HEAD trước. Nam V1.6 lặp sau 10,2 s, V1.7 lặp sau 11,1 s. Render sạch gồm cả trước và nghiêng với đầu và giày trong khung. Phòng 5 người quay riêng trên route sketch, viewport 390×844. Bản offline theo frame để so timing, không đo tốc độ GPU iPhone.

## Xác minh và nghiệm thu

TypeScript, production build và 11 test logic đã chạy trên checkout. Gồm vòng lặp ở 30 Hz và góc cổ tay giữa các mẫu, giữ chân khi thay đổi formation, profile theo catalog, chặn gameplay M3, identity READY/connection. Ba fixture browser đều đã đạt khi chạy trên Chromium. Nữ và năm người đạt trong lượt chạy chung. Tiến trình Chromium single-process cục bộ đóng khi tạo context thứ hai; chạy lại nguyên test nam trong browser mới đã đạt. Asset được đọc từ bản cache đúng URL. Test năm người đổi góc nhìn sang guest và bấm READY rồi NOT READY, đối chiếu ID runtime. Chạy kiểm tra lint trên Stage3D trước và sau cho cùng hai lỗi no-use-before-define của reconcileParticipants. Phần thay đổi Stage3D chỉ bổ sung ID vào telemetry có sẵn trên route QA.

Tiêu chí chốt trên iPhone thật: xem ít nhất hai vòng mỗi nhân vật ở tốc độ thường; so sự phối hợp mắt/đầu/vai/bàn tay, nhịp lên/xuống, chỗ nối vòng, giày và đường viền áo/quần. Xem phòng năm người và kiểm tra READY/khôi phục kết nối trong phòng thật với diện mạo đã lưu. Chỉ chủ dự án chốt độ tự nhiên và độ mượt trên thiết bị. M3 vẫn lobbyReady=true, runtimeReady=false.
