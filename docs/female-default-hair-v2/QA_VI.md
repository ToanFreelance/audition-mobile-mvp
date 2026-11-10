# Style 04 V2 — artistic blockout, VISUAL FAIL

Ngày 10/11/2026, giờ Việt Nam. Phạm vi: khối tóc Style 04 trên mặt thật M02/V8. **Chưa đạt silhouette acceptance. Dừng sau một lượt chỉnh tập trung. Không tiếp tục grooming, shader, WebGL2 hoặc tích hợp.**

## Kết luận mỹ thuật

V2 đã thay các rãnh/strip đều của V1 bằng các khối có đường cong, bề rộng, độ dày và đuôi riêng. Các lớp ôm má có chiều dài khác nhau, phần dưới uốn vào, mái lệch nhẹ. Tuy nhiên **kết quả chưa đáp ứng yêu cầu tóc premium mềm, thoáng và tự nhiên**. Không dùng việc save/export/topology hợp lệ để tuyên bố art PASS.

| Gate | Kết quả tự đánh giá |
| --- | --- |
| Nhận ra bob ngắn ở cổ | Có, nhưng mới là dạng tổng quát |
| Gần silhouette Style 04 | FAIL — khối sau vẫn đặc, khoảng chuyển giữa crown và bên còn cứng |
| Mái feathered, lớp tóc tự nhiên | FAIL — một số khối giống lá/ribbon lớn, độ nhẹ chưa đủ |
| Không lặp cơ học | Cải thiện so với V1, nhưng vẫn thấy cùng ngôn ngữ mặt cắt lenticular |
| Crown tự nhiên | Chân cắt ở lượt đầu được giấu; vẫn thiếu chuyển dòng tóc thuyết phục |
| Đuôi organic | Chiều dài khác nhau, nhưng vài đuôi nhọn và mép nền còn nặng |
| Ôm mặt, không làm mặt tròn | Hai bên đã thu gọn; chưa đủ đẹp để chốt |
| Không clipping rõ | Không tìm thấy giao cắt bề mặt tóc–đầu ở pose kiểm; không thay thế visual gate |
| Bảo toàn mặt | Đã kiểm exact dữ liệu mặt, mắt, miệng, UV và ảnh nguồn |
| V2 đẹp hơn V1 rõ ràng trong clay | Chưa đủ cơ sở kết luận PASS |

## Nguyên nhân V1 và thay đổi phương pháp

V1 dùng cape/rãnh liên tục, 14 lọn mái có nhịp gần đều và các dải đứng hai bên. Khối lớn chưa tạo được dáng tóc đẹp, nhưng đã phủ nhịp chi tiết lặp. Những nét sáng vật liệu làm các dải nổi thành nhựa; 46.676 tam giác không giải quyết silhouette.

V2 bỏ toàn bộ 26 mesh `S04_*` trong **bản sao** checkpoint. Giữ V1 gốc nguyên byte. Tái sử dụng hệ tọa độ đầu, preview M02 + V8 đã đối chiếu, native shape keys và thông tin attachment lịch sử (glTF Y-up; local X = −π/2 khi gắn native head). Không xuất hoặc tích hợp attachment ở phase này.

Khối mới gồm crown/side/nape nền, 5 khối envelope lớn; 7 nhóm mái và 8 lọn bên được đặt bằng các station xyz/width/depth cụ thể. Có xoắn, taper và đường cong riêng từng lọn; không random strand hoặc tăng số strip V1. Bề mặt cắt lenticular này vẫn tạo cảm giác lá/ribbon ở mái: đây là giới hạn thực tế của cách dựng trong phiên, không phải lỗi cần che bằng shader.

## Trình tự và ranh giới dừng

1. Đọc PROJECT_INSTRUCTIONS, kiểm nhánh/HEAD và các source V8/V4.
2. Import GLB thật sau kiểm SHA. Mở V4 và V1; xác minh native đầu của V1 trùng V4. Preview dưới vùng mắt khớp M02 với sai số transform float tối đa khoảng 5,96e-8.
3. Lưu/mở lại checkpoint primary. Render clay front/35° phát hiện chân lọn cắt phẳng và lọn ôm mặt quá nặng. Primary có 3.198 cặp tam giác giao tóc–đầu: chỉ là checkpoint chẩn đoán, không phải bản dùng được.
4. Một lượt chỉnh: taper chân lọn dưới crown, làm mỏng khối, thu envelope, thêm lớp phụ khác chiều dài, đẩy **chỉ tóc** ra ngoài biên đầu thật bằng BVH. Lưu secondary và mở lại.
5. Sửa hướng winding tóc để normal hướng ra ngoài (kiểm kỹ thuật, không thêm lượt chỉnh mỹ thuật). Render lại bản cuối.
6. Đánh giá VISUAL FAIL; dừng hình học, chỉ hoàn tất evidence và phục hồi.

## Bảo toàn và geometry

- GLB nguồn: SHA-256 `b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90`; đã import bằng Blender.
- V4 checkpoint: SHA-256 `153b589728fe54dea3f5088f2cf637541fc29b41fb42afdde743658c2cd35e79`.
- V1 checkpoint giữ nguyên SHA-256 `d8cdbbd9a543a0b6ba9efbd623c3e40d9f9ce2ab07ce770d948f558d9bf9b506`.
- So sánh positions, connectivity, UV, ma trận, material references, toàn bộ stored shape keys của native head/backup; preview M02/V8, iris/sclera và các bộ phận miệng: exact so với V1, native head exact với V4.
- Ảnh packed facial nguồn giữ nguyên. Không scale/slim/sculpt mặt, tai, hàm hoặc mũi.
- Secondary: 21 mesh tóc, 66.576 tam giác evaluated. Đây là độ lấy mẫu surface authoring, **không phải tối ưu runtime hay thước đo chất lượng**. Không tăng density để sửa thẩm mỹ.
- BVH kiểm tóc–đầu trên pose preview, bao gồm tai: xem số cặp trong `evidence/validation.json`. Không kiểm mọi animation, không chứng nhận toàn bộ topology manifold, không xử lý tự giao giữa mọi lọn; overlap giữa lọn là có chủ đích ở gốc nhưng có thể còn lỗi cần xem thêm nếu owner cho làm tiếp.

## Evidence và validation thực chạy

- Blender 4.3.2, Cycles CPU, 64 samples (hai ảnh primary chẩn đoán: 32), denoising OFF. Sáu camera: front, trái/phải 35°, profile 90°, elevated, fringe. Cùng camera và ánh sáng V1/V2.
- Hai chế độ: clay override toàn scene để nhìn khối; lavender đơn giản cho tóc, giữ material mặt. Clay khiến mắt trắng do override, **không phải mất mắt trong asset**.
- V1 được render lại cùng vật liệu đơn giản để so hình học công bằng. Evidence V1 WebGL2/Cycles gốc đã đọc để chẩn đoán; không chạy lại WebGL2.
- Concept chỉ crop/ghép từ sheet owner, không chỉnh mặt hoặc vẽ đè render. So sánh concept không thể là camera 3D tương đương; chỉ V1/V2 dùng camera identical.
- Mở lại cả checkpoint bằng Blender, face signature assertions, BVH contact, dữ liệu hữu hạn; PNG decode/check hash; Python compile và git diff --check.
- Không chạy full QA, gameplay, CI matrix, thiết bị thật, export GLB production hoặc deploy mới theo yêu cầu phase blockout.

## Phạm vi Git và rủi ro còn lại

Nhánh `work/female-default-hair-v1`; parent HEAD `6ad9732c2f920890316418f778673fbbe0ca74ab`. Đầu phiên không tìm thấy PR cho nhánh tóc. Chỉ thêm `scripts/female-default-hair-v2/` và `docs/female-default-hair-v2/`; không sửa runtime, V8/V4, Character Catalog, gameplay hoặc architecture khóa. Không merge.

Commit message: `art(hair): preserve Style 04 V2 blockout and visual-fail evidence`. SHA commit thực tế được cung cấp trong báo cáo bàn giao sau khi ref được kiểm lại, không tự ghi trước vào nội dung commit.

Rủi ro chính còn lại là **mỹ thuật**, đặc biệt mái bản lớn, khối sau dạng vỏ và đuôi chưa nhẹ. Không cần thêm tóc chi tiết trên nền này. Owner cần xem evidence và quyết định hướng tiếp theo; không tự động coi đây là baseline được chấp nhận.

## Artifact đã lưu

- [Editable secondary](https://chatgpt.com/library?file_id=libfile_b1060fccb9a0819186583e22aef772d5&account_id=personal), version 1; SHA `39019739b38aa3630a80e1e2664d4ed4f04a7ba41c2ac654322a414d26d117de`.
- [Review ZIP — 26 PNG gốc](https://chatgpt.com/library?file_id=libfile_735bae31a4c48191ab8a32add49a0a95&account_id=personal).
- [Concept/V1/V2](https://chatgpt.com/library?file_id=libfile_1e99c9bedad88191986cf98f277ba405&account_id=personal).
- Toàn bộ ID/version/hash và lệnh phục hồi: `recovery-manifest.json`. Các ảnh/bundle đã được xác nhận lưu thành công.
