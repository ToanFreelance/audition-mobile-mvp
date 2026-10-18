# Animation Flow Demo V2

Route cô lập: `/tools/animation-flow-qa-v2`. Baseline development: `4fd4202d3e89efd6c081318d13ddd9efb18e50f7`.

## Phạm vi

Tooling dùng sáu phrase CMU upright để kiểm tra nối không gian. Không đổi controller production, Character Catalog, asset accepted, published release, Moonlight, stage, gauge, WebAudio gameplay, RoomState hoặc scheduler. Nhánh animation lịch sử không được merge/rebase/cherry-pick.

Gói audit được đọc: `animation-flow-qa-v2(2).zip`, bản mới nhất tìm thấy ngày 18/10/2026; dữ liệu audit V1 được tái hiện bằng BVH pin `09a07f54f3bbb58797325f009282d0b2048a2871` và Three.js 0.180.0.

## Cách thử

1. Mở route, đợi sáu phrase sẵn sàng, bấm **Bắt đầu** để mở AudioContext của riêng demo.
2. Thử 120/160 BPM, fade 0,35/1 beat, bật tự SPACE hoặc SPACE tay/phím Space. Mỗi bốn beat chỉ tiêu thụ một turn mô phỏng. Bộ chọn anti-repeat dùng seed mới khi mở trang/lượt mới; `?seed=20261018` tái lập lựa chọn.
3. Dùng **Phát lại cặp** cho bốn cặp lỗi audit. Cặp floor chờ recovery, không cắt inversion. Fixture không tham gia pool thường. **Thử Moonwalk** phát một phrase trượt riêng, giữ translation có chủ ý.
4. **Xuất JSON** lấy source/phrase, seed, trigger/visual beat, entry error, root, anchor, path length, displacement, các turn boundary và pending policy. **Ghi video sân** dùng MediaRecorder nếu browser hỗ trợ; không ghi tiếng/microphone.
5. Hai tab tham chiếu nam/nữ tải `CharacterActor` và pipeline published/fallback hiện hành, không nhận retarget CMU mới. Controller tham chiếu giữ nguyên 150 ms và tốc độ gốc; số đo CMU không được trình bày như số đo Hips của mesh.

## Không gian

`stable stageAnchor → localized motionRoot → canonical CMU rig`.

- Một canonical hierarchy từ 111_05; child offsets/chiều dài xương không bao giờ hoạt họa hoặc trộn từ subject khác.
- Mỗi phrase tách capture origin, chỉ chuẩn hóa yaw (giữ pitch/roll), scale theo tỉ lệ leg chain; normalize floor theo canonical pose và giữ captured Y. Correction chỉ nâng phần xuyên sàn do khác tỉ lệ. Đây chưa phải contact IK.
- Đường XZ tương đối của source được giữ. Khi đổi, entry đặt đúng root đang hiển thị, không snap về tâm.
- Chọn trong 48 hướng phát, kiểm tra **toàn bộ** path trước khi nhận, với radius 1,35. Hướng ưu tiên đưa exit về vùng trong và giảm đổi heading. Blend convex giữa hai path đã nằm trong đĩa cũng nằm trong đĩa.
- Không hard clamp XZ, không cộng drift vô hạn, không detrend toàn trajectory, không loop raw. Source hết phrase sẽ giữ pose cuối đến request tiếp theo; timeline vẫn tiếp tục.
- Controller tooling sample theo beat tuyệt đối rồi blend pose bằng smoothstep/slerp. Ngắt giữa blend lấy snapshot pose đang hiển thị làm đầu blend mới, tránh pop/reset trọng số. Không sửa CharacterAnimationController production.

## Phrase và tempo

| Phrase | Source | Window giây nguồn | Nhóm | Policy |
|---|---|---|---|---|
| 111-groove | 111_05 | 0,6–3,0 | casual-groove | FREE |
| 141-twist | 141_12 | 0,6–4,4 | twist | FREE |
| 93-charleston | 93_03 | 0,4–3,5 | swing-footwork | BEAT_WINDOW |
| 143-party | 143_35 | 1,0–5,5 | party-arms | FREE |
| 120-mickey | 120_06 | 2,2–5,4 | casual-groove | FREE |
| 85-upright | 85_03 | 10,0–13,5 | upright-break | BEAT_WINDOW |

Mọi `referenceBpm=120` đều có `tempoBasis=testing-assumption`, không phải musical metadata đã xác minh. `localSourceSeconds = elapsedSongBeats × 60/referenceBpm`. Đổi BPM giữ beat liên tục; không tích lũy render delta. AudioContext của demo độc lập hoàn toàn với gameplay. Phiên bản này chưa tự ước lượng tempo CMU.

Phrase windows và exit markers là ứng viên kỹ thuật cần owner visual acceptance, không phải animation production đã được duyệt. Pool chỉ có một Swing/Charleston và không có ballet.

## Chuyển tiếp và shuffle

- FREE: đổi ngay nếu không nằm trong một protected range thực.
- BEAT_WINDOW: đợi marker nguồn kế tiếp; yêu cầu SPACE được ghi nhận ngay.
- PROTECTED: chờ recovery marker; override FREE không phá protection thực. Một pending request; thay target không đẩy deadline lùi mãi. Cặp 85_10 floor bị giữ bảo thủ đến source t≈5,708 giây. Đây là fixture để kiểm cơ chế chờ, chưa phải phép duyệt seamless acrobatic transition.
- TurnCursor xử lý từng boundary bốn beat, kể cả khi render rớt frame. Manual SPACE xử lý các boundary đã đến trước khi phát request tay; không tạo turn bổ sung.
- Shuffle-bag có eligibility refill khi phần bag còn lại không đáp ứng không gian/anti-repeat. Chặn phrase trong 3 lựa chọn gần nhất, source trong 2, nhóm động tác liền trước. Không random frame offset, không bắt buộc lấy phrase không vừa vùng để hoàn thành bag.

## Kiểm chứng dữ liệu đã chạy

`ANIMATION_FLOW_BVH_DIR=<cache chứa BVH đúng pin> npx playwright test e2e/animation-flow-v2-data.spec.ts --project=desktop --workers=1`

Đây là các test không mở browser. Không có cache thì tải đúng nguồn pin. `npm run build`, `npx tsc --noEmit` và ESLint phần mới cũng được chạy. Browser/WebGL phải được báo riêng trong implementation report.

13 test: mapping AudioContext/beat và catch-up turn; giữ travel/offset/one-shot; shuffle 10.000 lượt với seed replay; 8 kịch bản 120/160 BPM × 0,35/1 beat × tự động/ngắt tay; protected coalescing; bốn cặp V1 được tái hiện bằng mixer gốc rồi so với V2.

448 chuyển tiếp ngẫu nhiên đã hoàn tất trong 8 kịch bản: 40 tự động hoặc 72 ngắt tay mỗi cấu hình. Anchor bằng `[0,0,0]`; entry ΔXZ < 1e-6; radius lớn nhất khoảng 1,00863 < 1,35; không request bị từ chối trong các kịch bản seed kiểm tra. Max step XZ khoảng 0,02365 tại bước dữ liệu 1/120 giây, **không phải phép đo FPS/GPU**.

| Cặp | V1 dịch trong fade | V2 entry error | V2 dịch trong fade |
|---|---:|---:|---:|
| 05_04 → 90_32 | 3,83635 | 0 | 0,01837 |
| 93_08 → 90_32 | 2,64544 | 0 | 0,01837 |
| 111_05 → 05_07 | 3,81956 | 0 | 0,04920 |
| 85_10 → 89_03 | 2,11171 | 0 | 0,02058 |

Số đo cùng là đơn vị cảnh nhưng V2 dùng canonical body/floor scale mới; không coi đây là benchmark cùng scale cơ thể. Cột entry error và dịch trong fade là hai đại lượng khác nhau. Cặp Showdown chờ thêm 7,4 beat đến recovery; không được nói là đổi ngay ở SPACE. Dịch V2 còn lại là chuyển động cục bộ có chủ ý, không bị ép bằng 0. Script xuất `test-results/animation-flow-v2/data-validation.json` để review số liệu đầy đủ.

## Giới hạn

- Không retarget CMU vào c1/c4 trong task này. Tab mesh chỉ là reference hiện hành; quaternion-only hoặc BVH chạy đúng không chứng minh retarget PASS.
- Foot/hand-contact và vận tốc chưa được bảo toàn bằng IK/inertialization; đổi heading và tư thế lai có thể vẫn cần tinh chỉnh sau khi xem video/owner test.
- Đã loại raw loop seam bằng one-shot; pose có thể được giữ cuối phrase khi tắt auto hoặc đợi request.
- Không có iPhone hardware acceptance. Không kết luận từ headless tests rằng WebGL hay mobile performance PASS.
- Không tích hợp gameplay hoặc mode production; không đổi development/main.
