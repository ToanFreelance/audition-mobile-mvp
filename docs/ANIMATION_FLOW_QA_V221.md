# Animation Flow V2.2.1 — Finish recovery và HUD

Tiếp tục `work/animation-flow-qa-v2`, PR19 Draft, route `/tools/animation-flow-qa-v2`. Baseline được kiểm lại: work `60de721928a30bf7c23a4c364c4d337b55914896`; development `86c7d9b092880655e1f92d810975acc00cbea1d9`. Không đưa branch lịch sử hoặc thay đổi production vào đây.

## Nguyên nhân

`SourceFlowEngine.time()` clamp source time tại duration; đó vẫn là contract one-shot của Lab. Hai Finish chỉ dài1,35/1,4 giây nguồn. V2.2 không có visual consumer sau khi Finish kết thúc, trong khi runtime đúng đắn không phát dance command trong REST; vì vậy pose cuối bị giữ tới L6. Không phải lỗi scheduler.

HUD cũ dùng `TurnCursor.index + 1`. Cursor này đếm cả boundary preroll của QA; tại gameplay absolute42 nó có index43 rồi cộng1 thành44. `previewTurnCounter()` nay lấy thẳng `GameplayPreview.snapshot().current.absoluteTurn`, hiển thị0-based; preroll là dấu—. Trong Lab, counter riêng ghi `BEAT BOUNDARY (0-based)`.

## Luồng trình bày

`SessionChoreography(engine,seed,true)` bật `FinishPresentation`; API mặc định không bật để giữ đường one-shot và regression V2.2 độc lập. UI Gameplay và Replay Finish bật luồng mới, Lab vẫn one-shot. Mọi deadline được xử lý theo beat AudioContext được truyền vào, kể cả catch-up RAF; không tạo timer, input, judgement hay global turn.

1. Chờ actual Finish commit ở safe exit; telemetry ghi requested beat và actual visual start.
2. Chạy đủ accent của hai candidate hiện có, giữ pose thêm0,5beat:0,25s ở120BPM,0,1875s ở160BPM.
3. Chuyển trọng lượng/thu chân bằng nguồn CMU83_01. Window wide3–4,05s; narrow3,65–4,05s.
4. Standing tail83_01:4,05–5,2s lặp nhẹ trong REST. Chỉ idle này đóng seam: loại net driftXZ nhỏ, ease0,3giây cuối về entry pose nguồn. Không sửa clip thường hoặc quay về identity/T-pose.
5. Command hợp lệ ở L6turn43 chọn dance từ pose đang trình bày; hủy deadline idle tương lai. REST/HIDDEN không chọn ordinary phrase. Manual SPACE không thay thế Finish/recovery/idle.

### Handoff bàn chân

Blend trực tiếp Finish→83_01 đã được đo có dịch chuyển foot gần sàn khoảng0,56scene unit; không chấp nhận cách đó. `recovery-alignment.ts` tạo một đoạn handoff0,6giây nguồn từ pose thực tế. Dùng IK hai khớp trên cùng rig canonical, giữ chiều dài xương và hướng gập gối từ pose; hạ tay bằng slerp tới authored entry. Correction nhỏ giữ contact; nếu foot target lệch>0,08unit, dùng hai bước ngắn lệch pha với lift0,09unit để chân được nhấc trước khi đổi vị trí. Sau đó chạy nguyên bước thu chân nguồn. Đây là adapter hẹp cho recovery của demo, không phải framework retarget production.

Thử cả bản gốc và mirror của bước thu chân; chỉ nhận biến thể có toàn root trajectory nằm trong radius1,35 và nối được sang idle. Entry rootXZ vẫn0 so với pose hiển thị, không recenter. Telemetry của transition ghi mirror, rootShiftLocalXZ, leadInSeconds và maxEntryFootAdjustment. `sourceTime` trừ lead-in nên vẫn chỉ báo window thật.

Idle giữ heading thực tế để không xoay bàn chân đang plant. Vì không đưa thêm yaw, entry idle dùng giới hạn toàn phrase85° thay vì ép lại cone entry60°; toàn path vẫn≤85°. Normal/Finish giữ nguyên giới hạn V2.1. Recovery/idle không cần reserve endpoint1,05 cho một bước dance dài kế tiếp, nhưng radius cứng1,35 vẫn kiểm trên toàn path. Floor correctionY chỉ áp dụng recovery/idle và blend ra khỏi chúng, không clampXZ.

Trước Finish đã biết, selection ưu tiên ordinary phrase có safe-exit trễ≤0,35beat tại judgement kế tiếp, giữ seeded bag và anti-repeat; fallback chỉ dùng phrase vẫn hợp lệ nếu pool sớm không đủ. Không cắt protected phase hoặc đổi event time. Độ trễ actual phải xem trong JSON, không suy từ request đã nhận.

## Nguồn và giới hạn

Giữ16ordinary và2Finish, không thêm vào normal pool.83_01 được index CMU ghi “large sidestep to right”; chỉ lấy closing step/standing tail. Cùng mirror una-dinosauria/cmu-mocap, pin `09a07f54f3bbb58797325f009282d0b2048a2871`, URL `data/083/83_01.bvh`; credit CMU Graphics Lab/NSF EIA-0196217, BVH conversion Bruce Hahne. Dùng điều khoản đã ghi trongV2.2; không tuyên bốCC0.77_02standing và82_08 đã được xem nhưng không dùng vì stance/entry kém khớp hơn tail của83_01.90_33sauaccent vẫn mở chân rộng;120_03các phần giữa là lunge/torso twist, không dùng nguyên take làm recovery.

Hai Finish giữ nguyên window và intent. `finish-arm-accent` cần owner duyệt lại thế chân rộng và tốc độ thu chân; `finish-spell` cần kiểm độ đọc accent. IK/contact proxy không chứng minh mesh, foot contact hay anatomical quality bằng mắt. Chưa có iPhone acceptance cho bản sửa này.

## Regression và bàn giao

Lịch production không sửa: Finish38/62/86/110; REST39–42 thuộcL6; visible43sequenceIndex4; cadence24turn, mỗi turn4beat; chỉ AUDIO END kết thúc gameplay. Test cũ V2/V2.1/V2.2 được giữ; test mới bao phủ120/160 ×fade0,15/0,35/1 ×seed42/315885701, cả hai Finish, sparseRAF, manual, idle dài, seam, floor, knee, entry và HUD.

17test mới đã đạt trên12scenario:1.368globalturns,48Finish/recovery,1.014transition gồm idle; không thiếu Finish hoặc recovery/idle bị từ chối. Cả48Finish có requested=visualstart:156/252/348/444beat, delay0 (V2.2 tối đa2,4beat ở ma trận cũ). Hold chính xác0,5beat. Các con số là kết quả của hai seed đã thử, không cam kết mọi seed/UI override đều không có safe-exit delay.

Max root radius1,338545<1,35; entryΔXZ0; anchor[0,0,0]; max facing deviation83,9021° trên cả phiên; max root step3D0,035819/60Hz; floor minimum−3,3e−16≈0; max knee flexion131,915°. Contact proxy liên tục cao nhất0,060316unit, còn rủi ro cần xem bằng mắt. Proxy: foot/toe landmark trong0,01unit sàn canonical được tính là gần contact; đây là phép sàng lọc, không phải lực tiếp xúc. Ngưỡng0,01 là đơn vị cảnh theo body scale1,65, không tự quy đổi thành bằng chứng vật lý iPhone.

TypeScript/build đạt, ESLint0lỗi/1warning có sẵn ởCanvasSourcePreview.52test cũ đã đạt; lần chạy69test chung đầu tiên lộ6ca seed315885701 không vào idle do cone entry60°. Đã sửa bằng kiểm tra recovery→idle và tiếp tụcheading không đưa yaw mới.17test mới sau sửa đạt; lần chạy cuối toàn69 và browser được ghi tiếp ở mục dưới.
