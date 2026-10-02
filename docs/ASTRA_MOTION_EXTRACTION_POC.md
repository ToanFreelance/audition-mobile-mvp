# Astra Space-by-Space Motion POC — offline, chưa được chấp nhận

## Phạm vi và kết luận

Nhánh: `work/character-rig-animation-v1`. Base: `f64334a1632e4e8be6febb93b75f1f53e9567992`.

Đã chạy video → crop → pose 2D/3D → temporal solve → IK trên hai skeleton Meshy thật → bake GLB → render QA. Không dùng DeepMotion, không dùng animation giả hay proxy rig, không sửa runtime.

**POC FAIL / chưa đủ điều kiện nghiệm thu ba motion.** Clip ngắn chỉ chứa hai motion có biên kết thúc quan sát được và 8 frame mở đầu motion thứ ba. Hai motion đầu có bước chân/xoay người nhận ra được, nhưng tay/đầu và chi tiết chiều sâu chưa đủ trung thực để tự nhận production-ready. Structural PASS không đồng nghĩa visual PASS; owner vẫn quyết định nghiệm thu.

Phiên tiếp tục phải khôi phục repo và dựng lại các artifact vì thư mục tạm trước đó không còn. Không dùng số liệu cũ để chứng nhận file mới.

## Nguồn và boundary

Nguồn thực chạy: `Video-test(20261001-000233).mp4`.

- SHA-256: `2053019b214366a12f9c507e2ee2157c267db3ce7d693796f89e37a7b592568b`.
- 910 × 512, 30 fps, 281 video frames, 9,366667 giây usable video; audio dài hơn một chút.
- Đây là sân bóng rổ, **không phải** sân biển của video Spain/Moonlight `aKq04-9_oT0` đã đối chiếu.
- Bản full dự kiến `XZvLqpfM1eo` không tải được sau các lần thử (HTTP 502). Không xác nhận được full-source offset hay điểm kết thúc Space #3.
- Chọn dancer ngoài cùng bên trái, áo sọc nâu/quần tối; crop cố định `[x=155,y=170,w=190,h=235]`, thêm một hàng padding để mã hóa YUV420 thành 190×236. Giữ đủ đầu, tay và chân.
- Frame 12 có năm player lanes, tâm X xấp xỉ 250/350/450/550/650 px; thêm một actor tiền cảnh X≈385 che các lane giữa. Chọn lane 1.
- Decode và đo HUD từng frame. ROI `[204,187,99,31]`, HSV magenta, ngưỡng 200 pixel, rising edge và khoảng cách tối thiểu 60 frame; tái xác nhận onset `[4,138,273]`.
- Đã xem contact sheets tổng thể và các frame sát hai phía của từng boundary. Boundary ở đây là judgement onset quan sát được; không có telemetry để xác nhận độ trễ event animation bên trong game.

| Clip | Frame production, đầu bao gồm/cuối loại trừ | Giây trong clip ngắn | Độ dài quan sát | Solver padding | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| audition-space-001 | [4,138) | 0,133333–4,600000 | 4,466667 s | [0,144) | Có hai biên judgement |
| audition-space-002 | [138,273) | 4,600000–9,100000 | 4,500000 s | [132,279) | Có hai biên judgement |
| audition-space-003 | [273,281 EOF) | 9,100000–9,366667 | 0,266667 s | [267,281) | **Fragment; không biết semantic end** |

HUD 107 BPM và khoảng cách onset xấp xỉ 8 beat theo tốc độ ghi hình. Playback speed chưa được xác minh. Không ép cắt đôi theo giả định 4 beat, không nối nhiều Space thành một clip, và không thay đổi contract runtime `1 global turn = 4 beats`. Chưa gán `dance-01…dance-08`.

Start/end pose có ảnh riêng trong artifact: #1 từ đứng quay trước sang tay gần đầu; #2 từ pose tay gần đầu sang hai tay trước mặt/thân hơi thấp; #3 reset về đứng rồi mới bắt đầu bước. Frame transition ở ngoài production chỉ dùng làm padding cho solver, không gộp thành animation semantic khác.

## Stack pose và reconstruction

MediaPipe Pose Landmarker Heavy (`mediapipe==0.10.21`) chạy VIDEO trên CPU; crop phóng 2× trước inference. Model SHA-256: `64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b`.

Lượt đầu crop không phóng/threshold thấp bắt nhầm thân ở frame 148–153. Lượt được giữ lại phát hiện 274/281 frame; thiếu `[0,148,149,150,151,152,153]`, không thay dữ liệu thiếu bằng pose giả. Raw NPZ giữ NaN, bản JSON dùng null. Năm frame đầu bị loại khỏi observation fit vì acquisition transient; production frame đầu dùng extrapolation lân cận. Khoảng 148–153 được fit theo thời gian, nên tư thế tay bị che vẫn có sai lệch rõ.

3D là world landmarks monocular kết hợp tối ưu batch theo thời gian: minimize observation error có confidence weight cộng second-difference penalty. Lambda XYZ = 4/4/20; image XY = 3. Chuyển sang glTF Y-up, hip-centered, camera pitch giả định −10°. Không có ground-truth depth; không tuyên bố đây là reconstruction metric chính xác. Không gọi chuỗi pose 2D độc lập là mocap 3D đã hoàn thành.

## Target-owned IK và root/foot

- Nam dùng đúng 28-joint runtime rig; Nữ đọc và giải riêng đúng 66-joint rig. TPOSE **v2** chỉ kiểm tra reference/clean bind; không dùng v1, không thay mesh bằng TPOSE asset.
- Đọc rest hierarchy, world matrices, bone axes và chiều dài từng chain riêng biệt.
- Pelvis và torso dùng body targets; phân bố orientation lên ba spine joints.
- Tay/chân dùng analytical two-bone positional IK và bend-pole. Hinge flexion giới hạn 3–155°.
- Bone orientation dùng hai trục: solved chain direction và bend-plane normal; chuyển qua bind-frame của chính target. Có continuous normal transport và giới hạn correction twist 8°/frame. **Không copy quaternion từ source skeleton, không dùng swing-only cross-skeleton retarget**.
- Hands giữ local bind theo forearm; head theo torso; chưa reconstruct ngón tay, palm twist, heel/toe articulation.
- Root X theo pelvis trong ảnh; root Z không tích phân nên không drift trước/sau. Root Y theo chân thấp nhất, có hạ pelvis khi planted leg vượt reach.
- Contact được suy luận từ độ cao/vận tốc ankle; khóa contact run ≥3 frame, blend release 3 frame. Đây là inferred constraint, không phải chứng minh foot skating bằng ground truth. Grounding này có thể làm mất một phần aerial bounce.
- Bake 30 Hz thành animation channels trên target nodes. Endpoint hold một frame để duration khớp khoảng video nửa mở; không lấy frame Space kế tiếp vào clip trước.
- Chỉ append animation/accessors/BIN mới; nguyên khối BIN cũ, node hierarchy, geometry, skin weights, inverse binds, UV, PBR textures và clip Running/Walking được giữ nguyên và so sánh byte-level.

## QA và giới hạn

Hai GLB parse được, finite keyframes, quaternion chuẩn hóa (sai số norm tối đa khoảng `5,96e-8`), target nodes hợp lệ, thời gian tăng nghiêm ngặt, không có scale channel mới.

| Chỉ số | Nam | Nữ |
| --- | --- | --- |
| Joints | 28 | 66 |
| Bind/inverse-bind rest error lớn nhất | 1,92e-7 | 1,52e-7 |
| Weight-sum error lớn nhất | 1,79e-7 | 1,79e-7 |
| Root range X/Y/Z toàn đoạn (m) | 0,661 / 0,162 / 0 | 0,628 / 0,155 / 0 |
| Angular step lớn nhất Space 001 | 39,62°/frame | 37,98°/frame |
| Angular step lớn nhất Space 002 | 21,85°/frame | 21,85°/frame |

Root X bao gồm bước ngang có trong nguồn, không phải locomotion tích lũy. Space 001 còn angular warning; quaternion normalized không loại trừ chuyển động giật. Sample skinning 1.024 vertices/primitive ở mọi keyframe finite; không thay thế quan sát toàn mesh.

Blender 4.5.3 Cycles CPU render từ **chính exported GLB**. FPS phải được đặt **trước glTF import** để seconds→frame không lệch 24/30 fps. Preview đích 384×448 mỗi nhân vật; video so sánh Source | Nam | Nữ 1152×510, 30 fps. Kiểm tra bằng contact sheets ở các key pose và frame rủi ro; không giả nhận owner visual acceptance.

Mẫu QA không thấy mesh nổ, torso collapse hay limb-length scaling. Cả Nam và Nữ vẫn sai gesture tay trong vùng che khuất, góc đầu, độ crouch/bounce và một số hướng elbow/wrist. Nữ giữ nguyên fuller finger hierarchy nhưng không có finger performance. Foot locking giữ ankle ở inferred stance, chưa bảo đảm heel/toe contact hoặc không trượt xoay.

**Blocker chính:** thiếu nguồn #3; pose acquisition dưới HUD; depth/bend/palm ambiguity từ một góc nhìn. IK và GLB packaging chạy được nhưng không tự sửa thông tin quan sát sai.

Thay thế nhỏ nhất tiếp theo: cung cấp được phần tiếp theo của đúng nguồn (không cần owner tự cắt), và thay riêng backend pose/temporal-3D bằng solver chịu occlusion tốt hơn, có reprojection constraints. Giữ ingest, boundary metadata, crop, target IK, QA và packaging. Không âm thầm chuyển sang thao tác DeepMotion thủ công.

## Reproduce

Tất cả output ở ngoài repository. Cần các file nguồn gốc, model Heavy chính thức và Blender 4.5.3; không commit binary.

```bash
python3 -m venv /tmp/astra-poc-venv
/tmp/astra-poc-venv/bin/pip install -r scripts/astra-motion-poc/requirements.txt
/tmp/astra-poc-venv/bin/python scripts/astra-motion-poc/run_pipeline.py \
  --source /absolute/Video-test\(20261001-000233\).mp4 \
  --male /absolute/Nam_co_ban_MESHY_TEXTURED_RIG_v1.glb \
  --female /absolute/Nu_co_ban_MESHY_TEXTURED_RIG_v1.glb \
  --reference-rigs /absolute/Nam_MESHY_DEEPMOTION_CUSTOM_TPOSE_v2.glb /absolute/Nu_MESHY_DEEPMOTION_CUSTOM_TPOSE_v2.glb \
  --pose-model /absolute/pose_landmarker_heavy.task \
  --blender /absolute/blender \
  --out /absolute/astra-poc-output
python -m unittest discover -s scripts/astra-motion-poc -p 'test_*.py' -v
```

Model: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task

API tham chiếu: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/python

Pipeline cố ý hash-gate đúng source/crop đã review. Video mới cần boundary/crop review mới, không coi detector ROI hard-coded là general-purpose catalog ingest. Backend contract: `raw_pose.npz` image `(N,33,5)` và world `(N,33,3)`, hoặc `temporal_targets.npz` points `(N,33,3)` glTF Y-up, image normalized `(N,33,2)`, confidence `(N,33)`, fps. Adapter backend mới phải giữ anatomical left/right và semantics này.

## Repository safety và validation

Chỉ thêm `scripts/astra-motion-poc/`, tài liệu này và `docs/motion-sources/astra-poc-space-001-003.json`. Không sửa Character Catalog, Waiting Room, participant avatar mapping, WebAudio, gauge, Finish, sequenceCounts, Stage Catalog hay gameplay architecture. Không merge main/development, không tạo PR tự động.

Đã chạy: ffprobe + decode mọi frame, HSV onset assertions, pose inference mọi frame, temporal solve, hai target solves, GLB preservation/skin/keyframe/skinning QA, Blender import/render, bốn unit tests IK/basis/roll/reach, compileall và git diff whitespace check. Không chạy app build/E2E vì không có runtime code thay đổi. Chi tiết kết quả render/decode và commit cuối nằm trong báo cáo bàn giao artifact.
