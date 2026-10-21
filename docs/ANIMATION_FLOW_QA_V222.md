# Animation Flow V2.2.2 — Flare liên hoàn trong REST

Phạm vi: `/tools/animation-flow-qa-v2`, nhánh `work/animation-flow-qa-v2`, PR19 Draft/unmerged. Kiểm tra ban đầu: work `ba69d9b7c7d2fb6c9eb039fc1a9d63514ad37da1`, development `abdf8d9c2e5da3ac403397cc8ca54ecbf526d781`. Giữ nguyên16 ordinary phrase, hai Finish cũ, canonical CMU, gauge và gameplay production. Đây vẫn là QA loop AudioContext tổng hợp, không có bài nhạc/Music Config thật.

## Binary chủ dự án gửi và provenance

Đọc trực tiếp `upload/kabal_flair(1).glb`, không thay bằng asset khác. SHA256 `8b30f4f26d80a0939b5556d12bb1f40b4f69268504bff716efe4060242bc4b4c`,6.570.588byte, glTF Binary2.0, Sketchfab12.67.0.66node,1mesh,1skin/58joint,1material/3image;28.098vertex,147.876index=49.292triangle. JOINTS_0/WEIGHTS_0 có4influence; joint index1–56, weight sum0,999999877–1,000000108. Đây là kiểm tra dữ liệu mesh/skin, chưa phải render skin PASS.

Một animation `mixamo.com`,1giây,80channel LINEAR. Rotation có31key0–1s theo lưới30Hz; một số translation đã giảm key nên khoảng cách lớn nhất0,766667s. Các channel hữu hạn và target node hợp lệ. Native Hips endpoint delta `[0.0000080466,0.0000114441,0.0000061989]` theo đơn vị nguồn; max local-quaternion seam0,560600° (không suy từ silhouette giống nhau). Sau chuyển rig/floor: root seam≈0,000005372scene unit; root quaternion≈0,0000123°. JSON ghi wrist/foot/toe riêng.

Metadata ghi **Kabal_Flair — kehel**, [trang nguồn](https://sketchfab.com/3d-models/kabal-flair-d001bbb3ba2b40909af9a71383afffdb), [CC BY4.0](https://creativecommons.org/licenses/by/4.0/). Trang nguồn cũng xác nhận credit/CC Attribution và nhân vật Kabal từ Mortal Kombat3. Credit, license link và thay đổi có trong UI, JSON và tài liệu. Metadata của uploader không chứng minh đã giải quyết mọi quyền nhân vật gốc; không đưa mesh/texture Kabal vào ứng dụng hay Character Catalog. Runtime chỉ dùng bản trích animation/bind hierarchy từ đúng binary trên; source SHA giữ nhận dạng bất biến. Chưa duyệt phát hành production.

Tái tạo extraction: `node scripts/animation-flow/inspect-flare.mjs /path/to/kabal_flair.glb`. Output229,7KB ở`public/qa/animation-flow-v2/flare-source.json`, không chứa mesh/texture. Không tự tải file khác từ Sketchfab.

## Chuyển rig hẹp, cùng một dancer

`flare-source.ts` map bone bằng tên giải phẫu, không chép quaternion theo array index. Inverse bind nguồn làZ-up; hai scene-axis node triệt tiêu nhau, animation thực tếY-up. Kiểm tra inverse-bind Hips sauRx−90° còn sai số<0,01°, tương ứng canonical Hips identity/+Z trước. Không áp thêmRx−90° vào animation đãY-up. Scale lấy ratio hai đoạn chân nguồn/canonical,0,0125257279scene unit/source unit; không đoán mét/cm từ tên file.

World frame nguồn và child-axis offset thật hiệu chỉnh các đoạn xương canonical có offset xiên; intermediary CMU zero-offset giữ hierarchy. Damped CCD nhỏ trên tay giảm trượt do tỷ lệ vai/cánh tay khác nhau, dùng contact phase từ chiều cao palm/finger nguồn; twist cổ tay được giữ. Chỉ sáu joint tay được lọc tuần hoàn67ms để tránh singularity khi tay thẳng. Không lọc chân/hông hay bỏ rootXZ. Chu kỳ dùng Catmull tuần hoàn trên quaternion cùng hemisphere, normalize, giữ các vòng quét chân. Bind/rest calibration và các unmapped helper/ENDSITE được export.

Toàn bộ ordinary→Flare→ordinary dùng cùng38bone CMU, stageAnchor/motionRoot/actor hiện có; không đổi model/rig giữa chừng. Không có bằng chứng retarget Flare lên mesh nữC1/namC4. Hai reference tab published vẫn độc lập.

## Presentation và thời gian

`FinishPresentation` nhận deadline từ`GameplayPreview.resumeBeatAfterFinish()`: tìm các turn REST qua`describeSharedTurn`, tính target qua`targetSpaceMs` và manifest thật trong bộ nhớ. Không dùng timer, magic offset, command hoặc score mới. Mỗi global turn vẫn4beat; Finish không gọi AUDIO END.

`finish-flare` mặc định khi nguồn/placement hợp lệ:

- **FLARE_ENTRY1,85s**: hai bước setup có nhấc chân trong0,75s, tối đa0,5scene unit hướng vào workspace; reverse crouch→stand CMU85_03:18–18,7s trong0,7s, rồi hand/leg contact bridge0,4s. Không snap hoặc reset tới tâm. Step được ghi telemetry; nguồnXZ trong Flare/get-up vẫn giữ.
- **FLARE_LOOP**: source1s, phase vào0,7 tại vùng có foot support. Số vòng đầy đủ=`round(remainingSeconds−3.35)`, rate=số vòng/thời gian loop, chỉ nhận0,85–1,15× và≥2vòng. Không giả BPM âm nhạc của GLB hoặc kéo1vòng thành nhiều giây.
- **FLARE_DISMOUNT1,4s**: gather bridge0,5s về crouch đã thử tương thích; chạy authored rise0,7s; settle0,2s. Cuối vòng được phanh tại contact phase, không tiếp tục xoay ở trạng thái đầu gối/hand bridge không tương thích.
- **READY_FOR_L6** từ0,1s trước targetL6. Pose đứng đạt trước đó khoảng0,3s. CommandL6 dùng pose đang hiển thị và fade người dùng chọn. NếuL6 không có thành công hợp lệ, living idle cũ nhận presentation sau target; không tạo dance command giả.

Entry được bake từ pose thực ở safe exit; fade nội bộ0,001beat chỉ làm handoff, còn chuyển đứng→sàn nằm trong entry1,85s. Đây không phải kéo mọi crossfade để che lỗi. Fade0,15/0,35/1beat vẫn dùng cho ordinary/L6 và so sánh. General one-shot, FREE/BEAT_WINDOW/PROTECTED và hai Finish cũ giữ contractV2.2.1.

Full root path phải≤1,345 (margin trước1,35) và joint envelope≤1,79 trên sân demo bán kính1,8. Placement Flare giữ yaw của dancer ra, không tìm heading360° để tối ưu du lịch. Chỉ floor-phase này không áp cone upright lên projected Hips yaw: roll/inversion nguồn không phải random placement quay lưng. Entry/exit giữ hướng đứng tương thích, normal vẫn dùngV2.1. Không clampXZ hoặc triệt trajectory từng frame.

Nếu thiếu nguồn, không đủ budget/rate, root path hoặc body envelope không vừa: ghi`flareAttempts` lý do, dùng deterministic Finish cũ nếu hợp lệ. Không đẩy deadline. `Replay Flare Finish` reset phiên riêng, normalbeat4→Flare→dancebeat24; hai Finish cũ có control so sánh. BPM bị khóa khi Gameplay/Finish Replay đang chạy để giữ rate đã lập kế hoạch.

| Mốc default | Absolute turn | Target beat QA |
|---|---:|---:|
| L9 Finish đầu |38|156|
| REST thuộcL6 |39/40/41/42|160/164/168/172|
| L6 visible, sequenceIndex4 |43|176|
| Finish lần2 → L6 |62 →67|252 →272|
| Finish tiếp |86/110|348/444|

|120/160 BPM, không bị safe-exit delay|120|160|
|---|---:|---:|
| Tổng budget20beat |10s|7,5s|
| Loop |7vòng/6,65s|4vòng/4,15s|
| Rate |1,052632×|0,963855×|
| Entry kết thúc beat |159,7|160,933333|
| Bắt đầu dismount beat |173|172|
| READY beat |175,8|175,733333|

Các Finish sau cộng96beat; L6budget đã chứa REST, khoảng cách Finish24turn. Đây là shared multiplayer reference; không trộn duration-dependent Solo ending planner.

## Kiểm chứng và giới hạn

Kết quả cuối được ghi trong gói QA. Test cũ không sửa để che regression. Ma trận mới có normal RAF và sparse catch-up cho mọi120/160×fade0,15/0,35/1; consume target gameplay trước, rồi sample final pose đúng đường UI. So sánh cả history entry poses, phase deadline, shared turns và pose cuối. Thêm ba seed315885701/20261019/7, manual protection, budget thất bại, body boundary rejection, fallback rõ ràng, Miss/Perfect và AUDIO END.

Đã chạy lại trên implementation commit `e6fa338cb6d33ea5d6e6a5c4cbe04883c16dee9f`: **69/69 regression cũ (1,4phút)** và **9/9 testV2.2.2 (45,5s)**. Tổng78case đều đã kiểm, không phải full-project QA. Ma trận6dense+6sparse qua119turn/phiên,48Finish;6phiên seed bổ sung qua hai Finish,12Finish đều nhận Flare. Trong6trace dense seed42, đủ16ordinary/phiên,24Finishkhông fallback, requested=scheduled visual start156/252/348/444, entryΔXZ0. Repeated Finish vẫn38/62/86/110; REST39–42; L6visible43. Các test source/near-boundary chủ động kiểm rejection an toàn.

Số đo cuối seed42: max root1,304238<1,35; joint envelope1,576960<1,79; max3Droot step/60Hz0,048785; minjointY≈−2e−16≈0; max joint angular velocity2.119,73°/s(source foot/entry, screening<2.500 để loại flip cấp180°/frame). Near-floor wrist/foot displacement proxy lớn nhất0,204723unit với ngưỡngY<0,04: **không phải contact PASS**, gồm vùng sweep/transfer. CCD source reach residual khoảng0,0803unit; contact/mặt bàn tay và chân cần WebGL/owner. Vòng seam periodic pose0, sai khác vận tốc hai phía đo riêng<2°/s; không dùng mức peak tốc độ toàn phrase thay cho seam test.

Prep performance trong Node đo khoảng72–176ms ở lần trace này; đó không phải thời gian iPhone. Browser còn phải đo draw-submission delay riêng. Test mới đã bắt6ca pelvis/leg geometry quá nhanh trong setup0,5s; tăng riêng setup hai bước lên0,75s và kiểm Y reach của chân còn plant, giữ deadlineL6. Không nới ngưỡng2.500 để giấu lỗi. Đoạn85_10:4,45–5,4s được loại vì roll/heading/finger rotation không hợp get-up ở đây; dùng85_03 crouch không inversion. Một thử nối nguồn tiếp tục chuyển động trong gather bridge đã lộ angular spike, không đưa vào bản này.

TypeScript đạt; ESLint0error/1warning cũ (`_updateStyle`) ởCanvasSourcePreview, đã chạy lại sau commit. Build sạch cục bộ đạt đủ route sau đổi cache hỏng; lỗi cache ban đầu không phải lỗi source. Vercel build implementation commit trên READY, deployment `dpl_739my2Mv5a96n671pPfcJMeLHioB`; alias nhánh được đối chiếu trỏ đúng deployment này. Commit bàn giao chỉ bổ sung tài liệu, không đổi source đã test.

Loop seam pose/velocity được đo riêng khỏi tốc độ source-authored foot sweep. Contact/floor, envelope và joint speed chỉ là proxy canonical skeleton; không chứng minh lực chống tay, bàn chân trượt ít hay anatomical/mesh quality bằng mắt. Đặc biệt hand reach residual có thể khoảng0,08scene unit trước lọc; cần owner xem WebGL. Entry reverse authored crouch và procedural bridge còn là ứng viên thử nghiệm, không phải entry/dismount mocap chuyên biệt được duyệt.

Export schema6 phân biệt performance seconds với GLB loop time0–1; ghi plan, completed/planned loop, remaining beat, setup step, root/body envelope, rejection và source hash. `visualStartBeat` là mixer/sampler commit đã lập lịch. `preparationWallMs` và`firstRenderedBeat/renderDelayBeats` của browser là phép đo khác (draw submission sau renderer, không phải thời điểm photon trên màn hình); không gọi delay0 trên dữ liệu là bằng chứng pixel lên màn hình tức thì.

## Browser thực tế và bằng chứng bàn giao

Chrome cloud ở160BPM/fade0,35/seed42 chạy từ L1 tới absolute83, qua hai Finish38/62 và L6resume43/67. Export JSON thật có84turn, hai Flare được nhận,4vòng mỗi performance; sample `FLARE_LOOP` cho thấy completedLoops0/1/2/3 ở cả hai chu kỳ, rồi dismount/ready và ordinary mới đúng deadline. Video browser720×840 cóHUD và dài126,096s. Đây là **canvas2d-projection** doWebGL bị vô hiệu hóa; không dùng thời lượng video để khẳng địnhFPS/BPM thiết bị. HUD tại absolute83 khớp cả hai nhãn; beat-boundary khác được đặt tên riêng trongReplay.

| Finish absolute | Requested / scheduled start | First draw submission | Delay beat / giây ở160BPM | Prep CPU |
|---|---:|---:|---:|---:|
|38|156 /156|157,284233|1,284233 /0,481587s|162,4ms|
|62|252 /252|254,939622|2,939622 /1,102358s|151,2ms|

Không gọi hai hàng trên là visual-timing PASS. Sparse RAF/cloud draw và synchronous pose preparation vẫn có thể làm bỏ qua một phần entry trên màn hình; scheduled sample liên tục không bảo đảm frame được hiển thị liên tục. Một phiên cloud trước cũng đo delay1,82–2,30beat. Cần đo lại bằng WebGL/iPhone; không sửa timeline hoặc kéoREST để che độ trễ. Đây là rủi ro trình bày quan trọng còn mở.

Nút `Replay Flare Finish` đã chạy phiên reset riêng, Flare ởbeat4 và ordinary tại24; JSON và video được lưu. Video Replay gồm ba lần nhấn reset có chủ ý khi thử chụp phase, không phải ba Finish của một phiên gameplay. Hai lần chờ locator phase để chụp đúng khoảnh khắc bị timeout, nên không giả ảnh đó là loop screenshot; ảnh loop được trích từ video browser thật và gắn tên rõ. Contact sheet/video có tiền tố`data-` là tái hiện JSON bằng phép chiếu offline, **không phải browser/WebGL**. Gói bàn giao có raw source-vs-CMU, hai chu kỳ ở120/160, các frame entry/loop/dismount/L6, browser JSON/video, bốn JSON regression cũ và summary metrics.

TrướcV2.2.2, Finish cũ chạy accent ngắn→0,5beat hold→thu chân→standing idle trongREST. Nay Flare dùng1,85s entry→7vòng ở120 hoặc4vòng ở160→1,4s dismount→ready0,1s trướcL6. Không vào idle sau vòngFlare đầu. Hai Finish cũ vẫn cho so sánh, giữV2.2.1. Bốn fixtureV2 cũ vẫn entryΔXZ0 và fade travel0,018365/0,018365/0,049204/0,020575; không đổi đơn vị skeleton để tạo so sánh giả.

### Tệp thay đổi củaV2.2.2

- `lib/animation-flow-v2/flare-source.ts`: named bind/world-frame adaptation và arm contact proxy.
- `lib/animation-flow-v2/flare-performance.ts`: nguồn cyclic, setup/entry/dismount, deadline budget và full-body bounds.
- `lib/animation-flow-v2/engine.ts`: handoff prepared performance, dự đoán safe-exit pose, kiểm full path.
- `lib/animation-flow-v2/finish-presentation.ts`: stateFlare, fallback, draw telemetry; giữrecovery cũ.
- `lib/animation-flow-v2/gameplay-preview.ts`: pure shared deadline lookup.
- `lib/animation-flow-v2/session-choreography.ts`: lựa chọn Finish mặc định và deterministic fallback.
- `app/tools/animation-flow-qa-v2/AnimationFlowV2.tsx`: load source, replay/control/HUD/export schema6.
- `public/qa/animation-flow-v2/flare-source.json`: animation-only từGLB đã pinSHA.
- `scripts/animation-flow/inspect-flare.mjs`: extraction/inspection tái lập.
- `e2e/animation-flow-v222-flare.spec.ts`: regressionFlare mới, không sửa test cũ.
- Tài liệu này. Không sửa production, catalog16ordinary hayhaiassetFinish cũ.

Sân preview ổn định: https://audition-mobile-mvp-git-work-an-ec325b-toan-freelances-projects.vercel.app/tools/animation-flow-qa-v2?seed=42

Owner iPhone cần kiểm cả120/160, ba fade, hai Finish liên tiếp, setup step, đổi tay chống, seam, chân quét, gather/đứng dậy vàL6vào đúng43. Background/foreground và SPACE tay không được đổi turn. Kiểm sprite CMU ở đây; physical iPhone, WebGL contact và accepted-mesh Flare vẫn cần nghiệm thu riêng.
