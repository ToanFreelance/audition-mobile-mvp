# Animation Flow V2.2 — pool và shared gameplay preview

Phạm vi: `/tools/animation-flow-qa-v2`, nhánh `work/animation-flow-qa-v2`, PR #19 Draft. Tiếp tục V2.1 `d340f4a`; không merge. Kiểm lại ngày 19/10/2026: development `86c7d9b092880655e1f92d810975acc00cbea1d9` đã thêm Basketball qua PR #21; các helper gameplay được dùng ở đây không đổi so với `4fd4202`. Không đưa thay đổi sân vào nhánh animation.

## Gameplay dùng nguồn sự thật

`gameplay-preview.ts` tạo fixture chỉ trong bộ nhớ và dùng nguyên `MultiplayerGameplayRuntime`, `describeSharedTurn`, `sharedAppearanceAtTurn`, `isSharedFinishRestTurn`, `firstFinishTurn`, `repeatCycleTurns` và `DEFAULT_SOLO_SETTINGS`. Không gửi fixture lên RoomState/Supabase, không sửa manifest production.

Auto Perfect nhập đúng `requiredDirection` của command rồi gọi `handleSpace()` tại target gốc. Miss không nhập; runtime gốc tự xử lý hết window. Catch-up thăm từng target để RAF thưa không bỏ mất Auto input. HIDDEN/REST không yêu cầu choreography mới. SPACE tay chỉ thử visual, không giả lập nhập arrow/chấm điểm; bị chặn trong Finish, rest, hidden và lượt sát Finish để không phá placement đã dự trữ.

| Mốc | Kết quả |
|---|---|
| Ngân sách L1–9 | 1,2,3,4,5,6,6,6,6 = 39 global turns |
| Finish zero-based | 38,62,86,110,… |
| Nghỉ sau Finish đầu | 39,40,41,42; đã thuộc L6 của vòng sau |
| L6 hiển thị lại | 43, source sequenceIndex=4, vị trí 5/6 |
| Finish → Finish | 24 turns, bao gồm bốn lượt nghỉ |
| L6 Perfect | Có thể ẩn lượt kế tiếp; lượt đó vẫn tiêu thụ ngân sách |

Đây là **QA loop tổng hợp AudioContext, tham chiếu shared multiplayer**, không phải bài nhạc thật. Beat lấy từ AudioContext, một turn bốn beat; target đầu tại beat4 là preroll riêng của QA. BPM khóa sau khi phiên Gameplay đã bắt đầu; reset phiên để đổi. Không chọn Music Config, không giả metadata bài hát. Nếu bổ sung bài thật sau này phải dùng BPM_exact/Space Start/config override và actual AUDIO END. Runtime Solo `planAfterFinish()` còn có planner nghỉ/ending phụ thuộc duration, nên không trộn vào lịch shared vô hạn này. Finish không gọi AUDIO END.

## Pool và provenance

16 phrase thường: giữ nguyên sáu V2.1 và thêm mười. Hai Finish riêng, không thuộc shuffle thường. Không đạt mục tiêu 20–30: không tăng số bằng cách thêm take Mickey gần trùng, ballet hoặc floor-work. Cũng chưa đủ quota hip-hop/shuffle; không gán nhãn thể loại không có bằng chứng.

Metadata trong `catalog.ts`: ID, source, URL pin bất biến, window, group, style mô tả, tags/openingGroup, referenceBpm120 giả định, exit/protection và trạng thái duyệt. JSON dữ liệu kiểm thử bổ sung SHA256, sourceScale, entry/exit/range heading, radius/travel và pose samples. Đơn vị heading độ, path theo canonical scale như V2.1; không so trực tiếp số đo V1 khác scale.

Nguồn CMU Graphics Lab → BVH Bruce Hahne/cgspeed → mirror una-dinosauria/cmu-mocap pin `09a07f54f3bbb58797325f009282d0b2048a2871`. [READMEFIRST tại pin](https://github.com/una-dinosauria/cmu-mocap/blob/09a07f54f3bbb58797325f009282d0b2048a2871/READMEFIRST.txt) mô tả conversion, frame0 T-pose hướng +Z và không thêm hạn chế từ bên chuyển đổi. [Điều khoản CMU](https://mocap.cs.cmu.edu/) cho phép dùng nghiên cứu/sản phẩm; không bán lại dữ liệu motion độc lập, kể cả đã chuyển định dạng. Credit: CMU Graphics Lab, NSF EIA-0196217. Không gọi dữ liệu này CC0. Các source94 có index Unknown: label là mô tả silhouette đã xem, không phải xác nhận tên điệu.

## Finish và continuity

Mặc định `finish-arm-accent`: 90_33, 5–6,35s, chỉ phần đứng thế rộng/tay vươn cao sau floor roll; bỏ hoàn toàn phần roll. `finish-spell`: 120_03, 1–2,4s, nhấn mở thân/tay. Cả hai PROTECTED tới cuối accent rồi giữ pose; luân phiên khi cả hai hợp lệ. Chưa phải Finish production được duyệt. Contract `finish-special` production chỉ được dùng trên tab published reference riêng, không ghi đè asset.

Giữ nguyên calibration, radius1,35, score placement, root translation, quaternion blend, seeded bag và sáu window V2.1. Pool mới dùng `placementAtExit()` xét pose tại marker hồi phục, tránh nhận request hợp lệ lúc đầu nhưng bị từ chối khi dancer đã đi tới exit. `canFollowAt()` lọc ordinary phrase ở lượt ngay trước Finish bằng khả năng nối sang một Finish hợp lệ. Đây là look-ahead presentation, không thêm/sửa turn. Không clamp, cancel trajectory hay recenter. Nếu không có ứng viên: ghi telemetry, giữ one-shot/pose, clock vẫn chạy.

Finish event luôn tại target L9; visual có thể đợi safe exit tối đa **2,4 beat trong bộ thử** rồi tiếp tục vào rest. Đây là khác biệt có chủ ý giữa thời điểm gameplay và visual, cần owner duyệt độ nhấn nhạc. Không tự kéo dài lượt. Tất cả 48 Finish được phát trong ma trận; không chỉ kiểm request đã nhận.

## Kiểm thử dữ liệu đã chạy lại

52 focused tests PASS: 13 V2 +22 V2.1 nguyên trạng +17 V2.2. Ma trận mới 120/160 BPM × fade0,15/0,35/1 × seed42/315885701, mỗi kịch bản qua turn113: **1.368 global turns, 696 chuyển visual, 48 Finish**. Mỗi kịch bản thực sự sử dụng đủ16 ordinary phrase; không blocked, không commit bị từ chối; anti-repeat phrase3/source2/group liền trước đạt. Không có level-specific tiny pool; dùng một pool đầy đủ để tránh starvation, chưa gán trọng số level khi chưa có xác nhận độ khó/vocabulary.

Entry ΔXZ=0; anchor[0,0,0]; max radius **1,327399**; hướng trong ±45° ít nhất **88,6046%**, max facing error **83,9021°**. Đây là data validation, không phải foot-contact hay FPS PASS. V2.1 core regression vẫn 900 lượt và bốn fixture giữ số đo baseline; trace mới không phải cùng chuỗi nên không gọi khác biệt max radius là cải thiện nhân quả.

TypeScript PASS; build PASS sau thay cache build cục bộ hỏng bằng build sạch; ESLint0 lỗi/1 warning cũ `_updateStyle` ở CanvasSourcePreview. Không đổi dependency/production configuration.

```sh
ANIMATION_FLOW_BVH_DIR=/path/to/bvh npx playwright test e2e/animation-flow-v2-data.spec.ts e2e/animation-flow-v21-heading.spec.ts e2e/animation-flow-v22-gameplay.spec.ts --project=desktop --workers=1
npx tsc --noEmit
npx eslint lib/animation-flow-v2 app/tools/animation-flow-qa-v2 e2e/animation-flow-v22-gameplay.spec.ts
npm run build
```

## Giới hạn và bàn giao

Các candidate mới được xem bằng projection skeleton và dữ liệu, chưa đủ chứng minh contact/retarget. Sáu V2.1 có owner demo acceptance theo phản hồi, không đồng nghĩa mesh production PASS. Foot sliding/stance change, nhất là thế rộng Finish và Moonwalk, vẫn cần owner WebGL/iPhone. Chưa có nhạc thật, chưa có physical iPhone PASS. Video ghi sân kèm HUD, export schema4 ghi toàn turn/judgement/selection/animation. Bằng chứng browser và deployment được cập nhật sau build Preview READY.
