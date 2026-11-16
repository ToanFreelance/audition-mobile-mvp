# M3 V1.8 — Chuyển động toàn thân trong phòng chờ

Mốc đối chiếu là commit V1.7 `3b2a9949d65a047ced75d6dbf277d85b7276d5e2`. V1.7 chỉ có hai diễn xuất. Mỗi họ rig phát một clip ở các thời điểm bắt đầu khác nhau. Hai mắt cá giữ nguyên đích nên hông và gối phải bù cho chuyển động phía trên. Trên iPhone, chủ dự án nhận thấy các nhân vật vẫn cứng và thiếu sự khác biệt.

## Nguồn và danh mục

Đã mở lại `Video-test(20261116-031643).mp4`, 910×512, 30 hình/giây. Cột khung hình tính từ 0, lấy cả hai đầu. Một số cảnh hòa hình ở biên. Khoảng dựng là phần đọc được của diễn xuất, có thể ngắn hơn cảnh gốc. Đoạn giữa hai clip trong phòng chờ do hệ thống dựng riêng.

| ID | Khung nguồn | Giây nguồn | Rig | Thế vào, thay đổi và thế ra |
|---|---:|---:|---|---|
| F01 | 0–312 | 0,00–10,40 | Drophunter | Dáng hẹp lệch trước sau. Chân trái thu vào khi mở bàn tay rồi trở lại. |
| F02 | 348–759 | 11,60–25,30 | Drophunter | Hai chân cách nhau, mũi trái mở. Duy trì hai điểm trụ khi tay và ngực đổi hướng. |
| F03 | 768–997 | 25,60–33,23 | Drophunter | Thế thủ rộng, gối thấp. Chân phải bước thu hẹp rồi mở lại. |
| F04 | 1020–1251 | 34,00–41,70 | Drophunter | Thu lần lượt chân phải và trái khi hai tay tập trung gần thân. Mở chân trở lại. |
| F05 | 1287–1593 | 42,90–53,10 | Drophunter | Hai chân gần nhau, lệch chiều sâu. Chân trái mở rồi thu về. Tăng khoảng ngang tối thiểu để hai giày M3 không chồng nhau. |
| M01 | 1611–1944 | 53,70–64,80 | Neurohacker | Dáng nghỉ hơi rũ, hai chân trụ, đầu và ngực hạ rồi hồi lên. |
| M02 | 1980–2160 | 66,00–72,00 | Neurohacker | Chân rộng, hông thấp. Giữ nhịp đổi tải của nhân vật gấu và chuyển bàn tay đang đỡ thiết bị về bên vai. |
| X01 | 2198–2440 | 73,27–81,33 | Neurohacker | Dáng so le hẹp, thân đổi hướng theo thiết bị lớn. Bản M3 mở bàn tay. Chọn Neurohacker để giữ khoảng cách tay với sườn theo rig đã kiểm tra. |
| M03 | 2466–2659 | 82,20–88,63 | Neurohacker | Trụ trái, chân phải co, tay phải đưa ra. Giữ chân giơ ở đầu và cuối clip. Hạ chân trong chuyển tiếp ra khi cần. |

Độ rộng đầu/cuối mỗi clip tính theo khoảng cách ngang giữa hai cổ chân chia chiều cao rig, lần lượt là 0,132 · 0,242 · 0,326 · 0,234 · 0,052 · 0,225 · 0,297 · 0,147 · 0,064. Độ sâu, góc mũi giày, cao độ, độ hạ hông và các khoảng nhấc/đặt chân được ghi tại `components/character/motion/stances.ts`. Chẳng hạn, F03 chuyển chân phải ở giây 1,83–2,34 và 4,65–5,14 của clip. M03 nâng mắt cá phải 0,112 chiều cao và đưa ra trước. Chiều sâu và lực chân trụ là ước lượng từ một góc quay.

## Dựng và hiệu chỉnh

- Giữ các đường cong thân trên đã đo từ nguồn ở F01 và M01. Bảy clip mới được dựng ngoại tuyến bằng Python, OpenCV, MediaPipe Pose và SciPy. Hai cảnh che khuất nhiều dùng mốc ảnh và optical flow cho thân trên. F02, F04 và M03 có thêm mốc cổ tay đọc trên ảnh lưới. Không nhập tệp hoạt họa hoặc xương từ trò chơi nguồn.
- Đọc vector xương từ hai GLB M3 riêng. Phân chuyển động thân qua hips, spine, chest, neck và head. Dùng shoulder, upper_arm, lower_arm, hand và các đốt ngón cho cử chỉ tay trống. Ở F04 và M03, giải hai đoạn tay theo vị trí cổ tay tương đối với vai và chiều dài xương thực, rồi ghi quaternion cục bộ. Bản thử đầu giữ hướng cánh tay nhưng đặt cổ tay quá thấp. V1.8 dùng lại dữ liệu rig của lượt Blender trước. Phần sửa đường cong và giải IK lần này thực hiện bằng Python/SciPy và Three.js.
- Hệ thống IK chân lấy chiều dài hai đoạn chân và đế giày từ actor đã lắp đồ. Các đoạn trụ giữ đích cố định trong tọa độ actor. Trong đoạn vung, đích đi theo quỹ đạo có độ cao, đổi hướng và nghiêng mũi giày. Khi giày gần mặt sàn, giới hạn độ nghiêng theo độ cao và bán kính mesh. Đầu gối và hông điều chỉnh theo khoảng với thực tế. Kỹ thuật này vẫn dùng IK để tạo đường vung giữa các điểm tiếp xúc.
- Đọc thế chân hiện hành khi kết thúc hoặc nhận yêu cầu đổi. Nếu thế không khớp, chuyển tải hông, di chuyển từng giày, tiếp đất và ổn định trước clip sau. Khi rời M03, chân giơ có thể hạ trước khi chân trụ thay chỗ. Khi vào M03, chân trụ ổn định trước pha nâng. Thân trên hòa giữa hai tư thế trên cùng mixer. Bản thử có giao cắt tay phải với túi quần ở F05 → F01 và M02 → M01. Đã sửa đường vòng của cánh tay riêng cho hai cặp. Đã thử nhiều đích mắt cá M03 và điều chỉnh hướng nâng chân để ống chân không cắt gấu quần cargo.
- Mỗi actor có túi xáo riêng theo phòng và participant, chỉ chứa clip tương thích. Ưu tiên phần tử chưa bị actor khác phát hoặc chuẩn bị phát, tránh lặp liền. Khi số lựa chọn còn lại trong túi bị giới hạn, các actor vẫn có thể trùng clip. Khi phát lại có chủ đích ở QA, hai action của cùng clip có thể hòa qua điểm nối trên cùng mixer. Runtime không tạo đồng hồ gameplay, không đổi slot.
- Chỉ route QA có bảng chọn nhân vật, clip, phát lại, ngẫu nhiên, yêu cầu chuyển, camera, tốc độ và chẩn đoán. Telemetry hiển thị chân trụ, pha chuyển động, tọa độ và sai số mắt cá. Các đỉnh và tam giác trang phục được kiểm ngoại tuyến. Runtime chỉ lấy số đo giày lúc lắp actor.

## Kết quả hình ảnh và hình học

Ở góc chính diện có thể phân biệt F03 rộng và thấp với F05 hẹp, M03 giữ một chân giơ với M01 đứng hai chân. Ở góc nghiêng thấy độ sâu của bước chuyển, góc gối và khoảng giữa tay và hông. M02 giữ vai cao nhưng khác rõ về khối lượng và tỷ lệ so với nhân vật gấu. Tóc, quần áo và quán tính thiết bị của nguồn không được mô phỏng. X01 có mốc tay bị che, F04 có động tác gần mặt, và M03 có chiều sâu chân khó đọc. Đây là các cảnh cần ưu tiên khi so video ở tốc độ thường.

Đã lấy mẫu 30 Hz trên hai actor thật với áo, quần và giày mặc định của fixture. Chín clip có 2.437 mẫu. Ba mươi hai cặp chuyển có hướng có 2.113 mẫu. Kiểm giao tam giác sau khi biến dạng, phân vùng theo xương có trọng số lớn nhất. Trong vùng được kiểm, số mẫu có giao giữa bàn tay/cẳng tay/cánh tay ngoài với thân, áo, quần là 0. Số mẫu có giao giữa hai giày, hai cẳng chân, hai đùi, giày với cẳng chân đối diện hoặc cẳng chân với quần là 0. Vùng nối vai có giao với áo ở 1.386 mẫu và với thân ở 1.097 mẫu. Kiểm vùng vai gồm cả phần tiếp giáp giải phẫu. Không thể suy ra mọi tam giác ở nách hoặc mọi tổ hợp trang phục đều sạch từ phép kiểm này.

Khi xem gần M03, da lộ qua đùi phải của quần cargo và chỏm tay áo logo. Thử các mức nới 8–35 mm trên mesh. Chốt tối đa 15 mm theo pháp tuyến tại vùng cần sửa, thuần theo trọng số xương ở ống tay; quần dùng hình dạng hiệu chỉnh tăng dần khi chân phải nâng. Hiệu chỉnh chỉ thuộc bản sao đồ đang mặc trong phòng chờ. Ảnh trước và nghiêng ở 3,5 giây của M03 cho thấy các mảng da từng xuyên mặt ngoài đã được che phủ bởi vải sau khi sửa.

Phép kiểm bổ sung riêng cho mặt trong áo/quần vẫn ghi nhận giao hình học giữa đùi với phần quần bao quanh ở 4.548/4.550 mẫu và giữa cánh tay với vùng tay áo ở 1.987/4.550 mẫu. Đây là vùng mặc chồng, khác với việc tay xuyên ngực hoặc hai chân xuyên nhau. Không khẳng định trang phục hoàn toàn không giao mesh. Người duyệt cần xem đường may vai, gấu quần và mặt ngoài ở tư thế cực trị trên iPhone.

Sai số khoảng cách mắt cá trụ lớn nhất 2,87 × 10⁻¹⁰ đơn vị actor. Cao độ thấp nhất của mesh giày ở mỗi mẫu so với sàn actor nằm trong khoảng 6,56 × 10⁻¹¹ đến 7,05 × 10⁻¹⁰. Đây là kết quả của lần sửa cuối, bao gồm giới hạn nghiêng giày khi vào M03. Phép đo này không đánh giá độ mềm mại hoặc trọng lượng cơ thể bằng cảm quan.

## Kiểm tra và phạm vi

- TypeScript, production build, 12 bài Playwright logic. Hai mô phỏng ngẫu nhiên chạy 480 giây cho mỗi họ rig. Kiểm đủ túi, chống lặp, lựa chọn khi có actor khác, cả hai chiều chuyển, thử phát lại đủ chín clip, cổ tay tại mối nối, chân trụ khi đổi vị trí/yaw/scale, trì hoãn chuyển khi đang vung, định danh actor và chặn M3 khỏi gameplay.
- Đã render Chromium với mesh thật ở fixture nữ, nam và năm người. Fixture đổi READY rồi NOT READY và so ID ba runtime. Trong môi trường render single-process, mở context kế tiếp từng làm trình duyệt đóng trước khi chạy test nam. Đã chạy lại test nam trong tiến trình riêng. Asset được đọc từ cache đúng URL. Kiểm connection ở mức định danh, chưa chạy mất mạng rồi nối lại bằng hai thiết bị trong phòng thật.
- Lint toàn dự án còn hai lỗi `no-use-before-define` của `reconcileParticipants` trong WaitingRoomStage3D. Đã chạy ESLint trên chính nội dung V1.7 và xác nhận cùng hai lỗi.
- Video bàn giao gồm nguồn cạnh góc trước/nghiêng của từng clip, ví dụ chuyển thế có chủ đích, phát ngẫu nhiên và phòng năm người ở viewport 390×844. Bản dựng từng khung hình thể hiện timing. Chưa đo FPS, bộ nhớ hay nhiệt trên GPU iPhone.
- Giữ Character Catalog, snapshot Creator, actor cloning và mixer theo participant. M3 chỉ dùng trong phòng chờ với `lobbyReady=true`, `runtimeReady=false`. Không sửa RoomState, READY, CAS, Realtime hay clock.

Trên iPhone, xem cả hai thư viện ở 1× và để phòng năm người chạy qua nhiều lượt đổi. Xem trọng lượng của M02, tay F04/X01, độ co chân M03, bàn chân F05 khi khép, đường may vai và quần lúc chuyển. Thử READY và khôi phục kết nối trong phòng thật với diện mạo đã lưu. Chủ dự án quyết định độ tự nhiên, độ mượt và mức giống nguồn.
