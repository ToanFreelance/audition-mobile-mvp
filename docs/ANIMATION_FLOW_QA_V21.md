# Animation Flow V2.1 — hướng khán giả và liên tục heading

Phạm vi: chỉ `/tools/animation-flow-qa-v2`, tiếp tục PR #19 Draft. Baseline GitHub đã kiểm lại: development `4fd4202d3e89efd6c081318d13ddd9efb18e50f7`, work `50e0f59ef7f860a3fe290c254247cea649d5e046`, historical `a22e0435ef7767ddb3a33d599aeb42fc1bded3b4`. Không merge/rebase/cherry-pick, không sửa production.

## Nguyên nhân và calibration

`SourceFlowEngine.placement()` V2 tối ưu 48 yaw toàn vòng bằng `peak + end*1.5 + angle*.045`. Căn root XZ đúng không đồng nghĩa hướng thân đúng. Quỹ đạo và root quaternion cùng nhận yaw placement nên tối ưu vị trí có thể xoay dancer khỏi khán giả. Ngoài ra, window 85_03 cũ chứa nhiều vòng xoay nguồn; 143_35 cuối window bắt đầu bước quay một phần tư vòng.

`heading.ts` xác nhận riêng canonical CMU từ 111_05: up × (RightUpLeg − LeftUpLeg) = +Z; hướng toe đồng thuận 0,999964, đường vai 0,999346. Đây là calibration có chủ ý cho hierarchy này, không suy luận mọi rig có front +Z. Hierarchy không khớp sẽ báo lỗi. Mũi tên vàng chiếu hướng root +Z; mũi tên xanh là hướng sân cố định từ camera ban đầu `[2.65,1.9,3.7]`: **35,610852°**. Orbit chỉ đổi camera, không ghi lại stage-front. Vai/torso vẫn được phép twist độc lập.

Quy ước: nội bộ radian; JSON độ; `atan2(x,z)`, góc dương từ +Z đến +X, up +Y. Sai khác góc wrap trong ±180°. Dãy heading nguồn được unwrap ở 60 Hz; heading runtime unwrap theo mẫu render, không được dùng để suy ra đầy đủ số vòng khi browser bỏ frame.

## Thuật toán

1. Giữ nguyên canonical scale, chuẩn hóa origin/yaw nguồn, local translation và hierarchy stageAnchor → motionRoot → rigRoot. Không recenter, clamp XZ hay triệt quỹ đạo.
2. Core thử 48 hướng cách 7,5° cộng hướng khớp chính xác outgoing và hướng căn giữa toàn dải heading của phrase. Toàn path phải nằm trong radius **1,345** (biên an toàn bên trong 1,35).
3. Entry lệch stage-front tối đa 60°; toàn phrase tối đa 85°; chênh outgoing→incoming entry tối đa 45°. ±45° cho toàn phrase sẽ loại 120-mickey (dải nguồn gần 102°); 85° vẫn loại placement quay lưng, giữ bước xoay có chủ ý. Đây là ngưỡng QA thử nghiệm, chưa nghiệm thu mỹ thuật.
4. Dự trữ khoảng trống ở mốc bốn beat: radius tại mốc **và cuối phrase** không quá `max(1.05, currentRadius−0.1)` với transition thường. Chỉ loại placement, không sửa path. Điểm chọn: `2*rmsFacing + 3*exitFacing + .3*entryAngle + peakRadius + endRadius + 2*boundaryRadius`; góc tính radian. Ưu tiên hướng tại lượt sau giúp tránh cạn lựa chọn.
5. Giữ seeded shuffle-bag và cửa sổ anti-repeat nguyên bản. Facing/spatial là eligibility bổ sung. Không có ứng viên thì giữ one-shot/pose cuối, ghi lý do; không tạo hay chờ thêm gameplay turn. Không cam kết mọi seed đều luôn có ứng viên.
6. Pose và root XZ vẫn fade đúng số beat UI. Riêng quaternion Hips được phép hòa lâu hơn khi entry-offset cần: `max(requestedFadeBeats, 1.5*abs(entryDeltaDeg)/270 * max(180,BPM)/60)`. Với delta ≤45°, phần hòa bổ sung tối đa 0,75 beat; ở 120 BPM tương đương 0,375 s, ở 160 BPM 0,28125 s. Chỉ áp dụng khi cần; không kéo dài mọi fade, phrase clock hoặc turn. Đây là ngân sách **thành phần offset entry**, không phải trần tốc độ xoay tổng của motion nguồn.
7. Quaternion slerp đường ngắn, smoothstep. Ngắt blend chụp pose/quaternion đang hiển thị; recovery pending được đánh giá đúng tại dueBeat trước khi commit. FREE/BEAT_WINDOW/PROTECTED giữ nguyên; protection không bị UI FREE bỏ qua.
8. Fixture cặp lỗi cũ giữ placement V2 và được gắn `fixture-spatial-only` để so sánh không gian cùng scale. Không tính chúng vào facing PASS. Moonwalk ngoài pool vẫn giữ translation và có thể bị từ chối nếu không đủ không gian/hướng.

## Window experimental

| Phrase | Window nguồn V2.1 (s) | Heading nguồn sau chuẩn hóa | Thay đổi |
|---|---:|---:|---|
|111-groove|0,6–3|−70,75…0°|Giữ bước quay/di chuyển|
|141-twist|0,6–4,4|−39,08…45,36°|Giữ twist nhanh|
|93-charleston|0,4–3,5|−23,73…13,95°|Giữ|
|143-party|1–5|−5,21…6,22°|Cắt 0,5 s cuối trước bước quay, V2 tới 5,5 s|
|120-mickey|2,2–5,4|−47,88…53,90°|Giữ|
|85-upright|18–20|−32,84…44,25°|Thay window 10–13,5 s có dải unwrap −183,96…244,71° bằng bước đứng đi/về|

Không thay accepted assets; window và marker vẫn là ứng viên kỹ thuật cần xem WebGL/owner. Tempo 120 của CMU vẫn là giả định thử nghiệm.

## Đo trước/sau và hồi quy dữ liệu

So sánh 50 lượt, seed 20261018, 120 BPM, fade 0,35 beat, 120 Hz, cùng canonical scale **0,0700840845722579**; dùng pool/window của từng phiên bản (đây không phải ablation chỉ riêng placement):

| Chỉ số | V2 baseline | V2.1 |
|---|---:|---:|
|Mẫu hướng trong ±45° stage-front|27,2083%|91,1583%|
|Mẫu hướng quá 90°|50,5333%|0%|
|Lệch hướng lớn nhất|179,9914°|71,8724°|
|Chênh entry heading lớn nhất|172,5°|44,1174°|
|Bước heading giữa mẫu lớn nhất|132,5115°|5,4512°|
|Root radius lớn nhất|1,008622|1,315612|
|Số chuyển / entry ΔXZ|50 / 0|50 / 0|

Radius ngẫu nhiên tăng so với V2 nhưng vẫn trong 1,35; không tuyên bố mọi độ di chuyển đều giảm. Root heading chiếu XZ cũng có thể nhạy với nghiêng thân; không đồng nhất bước heading với quaternion rotation 3D.

Browser trên commit trung gian `d5bb239` phát hiện seed 315885701 hết ứng viên sau 16 chuyển: 111-groove đi tiếp sau boundary tới radius 1,265, còn 120-mickey bị chặn bởi group anti-repeat. Bản chốt kiểm thêm endpoint trong continuation reserve; giữ nguyên anti-repeat và path. Seed lỗi đã được thêm vào toàn ma trận hồi quy, không thay seed để che lỗi.

35 test tập trung PASS: 13 test V2 nguyên trạng + 22 test V2.1. Ma trận 120/160 BPM × 0,15/0,35/1 beat × seed 20261018/42/315885701: **900 chuyển**, 50 mỗi kịch bản, đủ sáu phrase mỗi kịch bản, không blocked, ít nhất ba phrase spatial/facing hợp lệ tại mỗi boundary trước anti-repeat. Tỷ lệ chính diện ≥88,2111%; max radius 1,315612; bước quaternion 3D ≤8,924° ở 120 Hz. Test V2 auto/manual thêm 354 chuyển, max radius 1,344320. Đã test interruption, full-turn không hợp lệ, sát biên, calibration/orbit-reference, nguồn quay có chủ ý, BPM/turn/protection. Tập seed này không chứng minh mọi chuỗi vô hạn.

| Cặp fixture | V2 entry / V2.1 entry | V2 fade travel / V2.1 fade travel |
|---|---:|---:|
|05_04 → 90_32|0 / 0|0,018365319 / 0,018365319|
|93_08 → 90_32|0 / 0|0,018365319 / 0,018365319|
|111_05 → 05_07|0 / 0|0,049204481 / 0,049204481|
|85_10 → 89_03|0 / 0|0,020575297 / 0,020575297|

Không dùng scale V1 làm benchmark đồng nhất với canonical V2/V2.1. Stage anchor giữ [0,0,0]; không invalid loop do one-shot; turn boundary đúng 4,8,12,….

Chạy lại với BVH pin trong catalog đã tải vào thư mục:

```sh
ANIMATION_FLOW_BVH_DIR=/path/to/bvh npx playwright test e2e/animation-flow-v2-data.spec.ts e2e/animation-flow-v21-heading.spec.ts --project=desktop --workers=1
npx tsc --noEmit
npx eslint lib/animation-flow-v2 app/tools/animation-flow-qa-v2 e2e/animation-flow-v21-heading.spec.ts
npm run build
```

TypeScript/build PASS; ESLint không lỗi, một warning `_updateStyle` đã có trong CanvasSourcePreview. JSON test ở `test-results/animation-flow-v2` và `test-results/animation-flow-v21`; export browser schema 3 ghi calibration, heading wrap/unwrap, heading blend, angular rates, rejection counts/position/beat và selectionEvents.

## Giới hạn nghiệm thu

Tốc độ twist nguồn 141_12 có thể ~562°/s tại reference120; tổng tốc độ heading trong blend đo đến ~864°/s tại160. Không sửa twist theo từng frame để ép mặt nhìn camera. Ngân sách entry-offset 270°/s không phải tuyên bố mọi motion dưới270. Root-quaternion blend riêng có nguy cơ contact/foot sliding; chưa contact IK, cần xem chân và thân trên WebGL, đặc biệt fade0,15 và nguồn141.

Gate A: dữ liệu spatial PASS trong phạm vi thử. Gate B: heading/timing/đa dạng dữ liệu PASS; độ tự nhiên thị giác còn chờ WebGL/owner. Gate C: không có accepted mesh retarget hoặc iPhone PASS. Reference c1-casual-grace/c4-casual-boy vẫn chạy pipeline riêng; CMU stick skeleton không chứng minh chất lượng mesh.

Browser/deployment và gói evidence được ghi trong báo cáo bàn giao sau khi preview build mới READY. Owner nên kiểm trên iPhone thật: 120/160 BPM, fade0,15/0,35/1; auto40–50 lượt, SPACE tay khi đang fade, xoay camera rồi trả về, quan sát hai mũi tên/đầu gối/bàn chân. Export JSON và video khi có đoạn không tự nhiên. Chưa tích hợp gameplay production.
