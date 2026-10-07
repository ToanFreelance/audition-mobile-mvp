# Animation Library Acquisition + Style Curation V2

## Kết quả và phạm vi

Mở rộng thư viện **SOURCE ONLY**, không retarget Meshy và không tích hợp runtime.
Tám Astra Moonlight Normal giữ nguyên. Không chạy Astra V2.2, DeepMotion hoặc
thử lại composite Mixamo đã bị từ chối. Không sửa gameplay, Character Catalog,
Waiting Room, RoomState, clock, Finish, gauge, sequenceCounts hay Stage.

Nhánh: `work/character-rig-animation-v1`.
Starting remote HEAD: `c06cd325da47f3c6fcb2eb9db843331dc640bb20`.
Scratch khi tiếp tục đã trở về V1 HEAD `98fb667…`; đồng bộ fast-forward an toàn
đến remote trước khi sửa. Các file V2 tạm không còn nên phục hồi tooling và
quyết định từ checkpoint review, tải lại đúng nguồn pinned và tái tạo preview.
Không coi đường dẫn/file cũ bị mất là deliverable đã bàn giao.

| Chỉ số | Kết quả |
| --- | ---: |
| Take V1 giữ nguyên | 112 |
| Take V2 bổ sung | 41 |
| Tổng source kiểm tra | 153 |
| Byte-unique | 148 |
| Take retained | 73 |
| Retained từ V1 / V2 mới | 58 / 15 |
| Nhóm choreography theo phân loại bảo thủ | 64 |
| Explore, chưa retained | 34 |
| Reject | 46 |

**73 file không đồng nghĩa 73 choreography độc lập.** 64 nhóm gộp các role
partner và variant đã nhận diện; đây là editorial grouping, không phải chứng
minh mọi cặp còn lại khác nhau. Không dùng repeated takes để tuyên bố 80 motion.
So với 16 Normal mạnh trước đây, pool tăng đáng kể, nhưng bao gồm backup,
utility, partner và Special — không phải 73 solo Normal dùng ngay.

## Coverage style-first

| Style | Retained |
| --- | ---: |
| Pop / Casual | 8 |
| Social / Swing / Latin | 14 |
| Modern / Stage | 13 |
| World / Folk | 12 |
| Street / Break / Boss | 17 |
| Party / Reaction | 9 |

Pop mới đạt 8, dưới mục tiêu 15–20. Không gán Robot locomotion, hopscotch hay
wave thành dance chỉ để bù quota. Có 9 ứng viên role `finish`; role này không
thay style, không tạo semantics gameplay. 11 take REQUIRED partner tách khỏi
solo Normal; Salsa chủ yếu thành cặp 60/61, Lindy 93_06 còn thiếu xác nhận
counterpart nên chưa duet-ready.

- Status retained: A 19, B 21, SPECIAL 14, PARTNER 11, UTILITY 8.
- Energy: LOW 11, MEDIUM 39, HIGH 15, CLIMAX 8.
- Partner: NONE 62, REQUIRED 11.
- Floor: STANDING 43, LOW 18, HAND_SUPPORTED 3, INVERTED 6, FLOOR_SPIN 3.
- Retarget risk: LOW 1, LOW_MED 15, MED 20, MED_HIGH 16, HIGH 17, VERY_HIGH 4.

Các thông số này là đánh giá curation, không phải đo contact lực hay readiness
trên target. `style-summary.json` là bảng đếm tạo từ catalog; có thêm travel và
rejection reasons. Non-retained chưa chốt energy/floor/risk dùng UNASSESSED,
không bịa độ chắc chắn. `modeHints` chỉ là metadata tái sử dụng.

## Nguồn mới và danh sách giữ lại

41 nguồn mới được tải từ cùng pinned CMU, không thêm licensing surface:

```
85_01 85_02 85_06 85_07 85_15
87_01 87_03 87_04 87_05
88_01 88_02 88_05 88_06 88_07 88_08 88_10
89_03 89_04 89_05
90_02 90_08 90_09 90_11 90_14 90_19 90_29 90_32 90_33
111_02 111_04 111_16 111_37 120_03 120_04 120_15 120_21
141_16 141_22 142_20 142_21 143_31
```

15 nguồn mới retained:
`85_01, 85_06, 88_06, 88_07, 88_08, 88_10, 89_03, 90_14, 90_32,
90_33, 111_02, 111_04, 111_16, 111_37, 120_03`.

Toàn bộ 73 IDs, description, grade, lý do, provenance nằm trong `retained.json`;
`new-v2-candidates.json` tách đủ 41 mới, kể cả Explore/Reject. Không tuyên bố đã
kiểm tra hết hàng nghìn CMU recordings; các mixed-action dài của subject 15
chưa chọn. Nguồn ngoài CMU để follow-up, không mua/tạo tài khoản/bypass/đóng gói.

## Duplicate và rejection

5 exact pairs (SHA và Git blob trùng):
`93_03=103_03`, `93_04=103_04`, `93_05=103_05`, `93_06=103_06`, `93_08=103_08`.
Chỉ giữ bản 93 trong retained.

4 probable near-duplicates bị loại: `49_12→49_17`, `49_14→49_17`,
`90_31→90_30`, `85_02→85_01`.

Các family giữ variant/role nhưng đếm một choreography:

- Mickey dance: 120_05 / 120_06 / 120_07.
- Casual steps: 111_05 / 113_04.
- Upright break: 85_03 / 85_11.
- Salsa: 60_01+61_01, 60_03+61_03, 60_05+61_05, 60_12+61_12.
- Side-by-side Charleston: 93_04 / 93_05.

Similarity proposals dùng 64 mẫu thời gian, joint positions tương đối root,
chuẩn hóa reference height và hướng hông ban đầu. Không DTW; không tự động
reject từ threshold. Phase/speed khác nhau và các pose đơn giản có thể gây
false positive. `similarity-proposals.json` giữ kết quả để review, không phải
chứng nhận semantic duplicate.

Reject chủ yếu TOO_SIMILAR; ngoài ra DUPLICATE, EXCESSIVE_TRAVEL, NOT_DANCE,
LOW_CHOREOGRAPHIC_VALUE, PROP_DEPENDENCY, POOR_MOBILE_READABILITY và
SEVERE_ANGULAR_ARTIFACT. `rejected.json` giải thích từng take; raw vẫn lưu để
audit, không xóa hoặc sửa V1.

## Bằng chứng visual / kỹ thuật đáng chú ý

- `120_15`: raw samples 5→6 có tay từ ngang hạ đột ngột, RightArm 87,85°.
  Loại khỏi retained, vẫn cung cấp MP4 và ảnh lân cận để thấy lỗi; không smooth
  che lỗi hoặc gán thành reaction đẹp.
- `88_05`: đo lại root envelope 3,43 reference-body heights trong 1,233s,
  RightUpLeg 161,07°. Sửa ghi chép tạm cũ 13 heights; giữ quyết định Reject.
- `85_04`, `85_14`, `89_03`: max thigh rotation gần 175–180°/sample;
  FK vị trí quanh bước nhảy không luôn đổi lớn nhưng twist có thể phá Meshy.
  Vẫn là source SPECIAL thú vị, **VERY_HIGH**, không target-ready.
- `60_01` có toe/foot angular discontinuity; `61_05` có hand orientation step.
  Partner poses không được dùng như solo Normal.
- `90_30` có foot/toe warning dù silhouette squat/kick rõ.
- `90_32`: Moonwalk khoảng 6,02s, root envelope 2,745 body heights. Đây là
  travel có chủ ý; later retarget không được khóa chân đến mất glide.
- `94_*`: nguồn có description Unknown, suy style từ subject context Indian.
  Không đặt tên truyền thống cụ thể, không tuyên bố finger mudra được capture.
- `49_*`: một số phrase hold-heavy; B thay vì ép thành A/casual groove.

25 batch contact sheets phủ 148 nguồn byte-unique; mỗi nguồn có contact sheet
16 poses. Review trước và lượt phục hồi dùng keyposes/silhouette, ảnh chi tiết
và 2 sheet native-frame neighborhoods. **Không tuyên bố đã xem realtime toàn bộ
MP4, không đánh giá textured Meshy ở task này.** Owner cần xem video ứng viên
quan trọng và quyết định bước tiếp theo.

## Preview / package

`index.html`: 73 retained, filter style và nút MP4/BVH/contact.
`explore.html`: 34 nguồn chưa retained.
`rejected.html`: 46 loại với lý do.

108 MP4 full-take: 73 retained + 34 Explore + 1 rejected diagnostic (120_15),
640×480, 30 fps. Mọi contact/MP4 lấy FK từ raw; chỉ bỏ sample T-pose đầu ở
preview. Không loop, ép độ dài hoặc smooth source. Camera oblique cố định
theo bounds toàn take; chuyển động travel lớn có thể nhìn nhỏ hơn và đã cảnh
báo. Raw 120,00048 fps theo header .0083333, đơn vị không khẳng định metric.
Không có ground-contact force, skin deformation hoặc Meshy render ở đây.

Lượt kiểm tra cuối phát hiện cache MP4 thiếu moov atom ở 60_09, 90_09 và
120_03. Đã tạo lại từ BVH; writer ghi file tạm, decode kiểm tra, fsync rồi đổi
tên. Cache lỗi giữ riêng ngoài package. Publisher kiểm tra lại từng MP4,
không dựa vào log render cũ để tuyên bố thành công.

ZIP chứa raw BVH, catalog JSON/CSV, counts, retained/new/rejected lists,
provenance, checksum, 148 contact sheets, 25 batch sheets, 2 diagnostic sheets,
108 MP4, overview 12 POC, scripts/tests và review HTML. Giải nén rồi mở
`index.html`; không thay demo ứng dụng `/tools/character-rig-qa`.

## 12 đề xuất retarget POC tiếp theo — CHƯA retarget

| Nhóm | Source | Giá trị đại diện |
| --- | --- | --- |
| Pop | 111_05 | Casual compact, baseline shoulders/feet |
| Pop | 90_32 | Moonwalk, chủ ý glide/travel |
| Social | 93_03 | Solo Charleston, nhịp chân |
| Social | 60_03 + 61_03 | Cặp Salsa, spacing/contact |
| Modern | 05_04 | Arabesque/back bend, spine/balance |
| Modern | 05_07 | Jeté/turn, leg lift/airborne |
| World | 94_13 | Arm-led upright phrase |
| World | 90_30 | Low squat/kick và toe warning |
| Street | 85_03 | Upright break, biên độ lớn |
| Street | 90_33 | Wide-leg roll, hỗ trợ vai/hông |
| Finish | 85_05 | Handstand kicks, đảo người |
| Finish | 88_08 | Crouch/backward hand flip, entry/recovery |

Đây là 12 case, 13 source files vì Salsa cần hai role. Không chỉ chọn take dễ.

## Provenance / licensing

CMU → cgspeed MotionBuilder-friendly BVH → `una-dinosauria/cmu-mocap`, pinned
tree `09a07f54f3bbb58797325f009282d0b2048a2871`. Bảo toàn READMEFIRST/mirror
README/index/tree và notices. READMEFIRST phân phối lại bằng chứng CMU cho
phép dùng research/commercial và converter không thêm hạn chế. Đây không phải
legal clearance mới; mirror code license không thay quyền motion-data.
Credit CMU và NSF EIA-0196217 theo notice nguồn. Không dùng điều khoản của nguồn
ngoài để hợp thức hóa dữ liệu chưa rõ quyền.

## Validation và tái tạo

Publisher chỉ tạo ZIP sau khi source SHA256/Git blob, catalog schema, link HTML,
full MP4 decode và duration tolerance <0,07s PASS; ZIP CRC kiểm tra sau đóng gói.
`validation.json`, `unit-tests.txt`, `SHA256SUMS.json` ghi bằng chứng thực chạy.
14 unit tests gồm 4 V1 và 10 V2: FK/parser, selection, blob hash, explicit
curation coverage, partner policy, duplicates, rejection reasons, cấm auto
production acceptance, normalized signature, CSV nested-field regression.
Không chạy application build/TS/browser E2E vì chỉ thêm Python/docs offline.
Không claim UI E2E PASS; review index có static link validation.

```sh
export PYTHONDONTWRITEBYTECODE=1
python scripts/animation-library/curate_v2.py prepare --v1 V1_DIR --out V2_DIR --tree CMU_TREE_JSON
python scripts/animation-library/review_decisions_v2.py --out V2_DIR
python scripts/animation-library/curate_v2.py diagnostics --out V2_DIR
python scripts/animation-library/curate_v2.py videos --out V2_DIR
python -m unittest discover -s scripts/animation-library -p 'test_*.py'
python scripts/animation-library/publish_v2.py --out V2_DIR --repo REPO_DIR
```

Reuses `acquire.parse_bvh`, `preview.draw_pose`, `quality_audit.audit` unchanged.
Dependencies: NumPy, SciPy, Pillow, ffmpeg/ffprobe. Generated assets outside Git.
Only four new offline Python files and this report; no app architecture changes.
V2 retained status is source curation, not source legal certification, automatic
production acceptance, complete foot-contact QA or a promise of easy retargeting.
