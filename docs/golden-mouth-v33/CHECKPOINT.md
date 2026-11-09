# M01 V3.3 — checkpoint phục hồi, VISUAL FAIL

**Kết luận cuối phiên:** giữ Refined-02 làm bản thử nghiệm để review; không dùng KKT03 dù tên file có `Final-03`. Upper roll chưa đẹp, artifact khóe phải chưa hết. Dừng sculpt, không WebGL2/deploy. V3.2 và V2 runtime giữ nguyên. Xem [QA_VI.md](QA_VI.md).

Phần ghi nhận ban đầu dưới đây là lịch sử; số đo mask cuối và quyết định mới nhất nằm ở cuối tài liệu.

09/11/2026. Branch work/female-golden-mouth-v1-qa, HEAD đã kiểm e1400d7a578d3307018f977761e298fb461a2cc9. PR #26 OPEN/Draft, base accepted V8. Không merge.
Blender 4.3.2 /usr/bin/blender đang hoạt động. V8 diff rỗng so 1a0ba6e4fd8a1a0e76453a2e698fb9fcc5746576.
Input V3.2 libfile_b23cc9d3507c8191acda5e4d1ca77fce đã phục hồi và hash khớp cd53bb6d1fd7d0178300958d47c73511fc253e7a68b8fc57aad5ebd5345401c7.
GLB upload/Female_anime_origin(6).glb hash khớp b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90; không commit.
Golden: upload/576DB180-B6A4-4EF0-BD99-EE6183F85C1A(3).jpeg, M01 ô trên trái đã xem.
ROOT=/workspace/scratch/e27dffa28e71/m01-v33; input tại ROOT/input/M01-Natural-V32-Iteration-03.blend.

Đã đọc PROJECT_INSTRUCTIONS, QA/CHECKPOINT V3.2, source sculpt/verify; xem Cycles front/35/profile/clay/cận cảnh và Golden.
Ưu tiên mới: giữ môi dưới và perioral fullness V3.2, sửa upper roll/Cupid, rồi mới cân nhắc width.

Định vị artifact: face 398187 cùng các mặt 397282/398287/398285, đỉnh 239233/239234/239235/239237/239338/239339; tâm khoảng (.043,.3217,.2385), các góc mặt kề 64–68°. Sẽ kiểm phần native surface tại đúng vùng này, không smoothing toàn miệng.
Khóa lower central: abs(x)<.042, .282<height<.3335, depth>.19 theo V3.2, 1804 đỉnh. Sẽ mở rộng bảo vệ lower support trong script cuối; lateral chỉ thay đổi tối thiểu để tiếp seam.
Đo sơ bộ: width .090006 / facial width tại mouth height .355402 = .2533; / lower-face width tại h=.30 .276775 = .3252. IPD cần đo cùng rig/reference; không quyết định width bằng một ratio.

Kế hoạch: upper-lip region-only surface refinement, seam/lower/nose locked; geometry và albedo chẩn đoán riêng. Lưu source + blend trước render. Chưa PASS, chưa runtime.

Upper-only iteration01 đã lưu libfile_744ac419d38081919d183fd4e874e870. Lower lock maxdelta=0; fit nhẹ chưa đổi đủ silhouette.
Refined iteration02 đã lưu libfile_641c2f4215248191b41c2dd7a51fa6e4. Upper roll giảm projection nhẹ, Cupid peak hạ nhẹ theo region; không sửa lower. Sửa artifact bằng quadratic skin fit có weighted lower anchors, góc gãy 68.45→47.99°; còn thấy vệt.
Đã thử width probe +5% commissure translation với tâm giữ, không scale toàn mặt. Lower YZ giữ chính xác nhưng X có dịch tối đa .00224. Chọn giữ width vì lợi ích toàn mặt chưa rõ, ưu tiên lower lip owner đã chốt.
Correction kỹ thuật cuối: dùng exact KKT anchor 239338 để fit đi qua đúng đỉnh khóa, thay weighted-only constraint. Kết quả đã render/QA: góc gãy tăng 95.82°, vệt xấu hơn; **loại KKT03**, quay về Refined-02 để bàn giao thử nghiệm.

## Artifact đã lưu và mở lại

| Artifact | ID | SHA-256 | Bytes / trạng thái |
|---|---|---|---|
| Refined-02 | `libfile_641c2f4215248191b41c2dd7a51fa6e4` | `7fdc16e00012f785c76dba9d88700e7139b0e36c85f302d7a0dd0940508bcb8a` | 57,896,132 / **Visual FAIL**, bản thử được giữ |
| Width probe | `libfile_6cd1087efd408191bcac2ef0d2c60676` | `dfb41e006a9d1ae4dd396615254948cc0f2e3e102e7e5c3d1dda602e4732efef` | 57,896,496 / không chọn |
| KKT03, file `Final-03` | `libfile_860ba55bafe48191898fc91846afdad1` | `53189064429af7a374637531746cb2dbdc51e1f17a863d9e8966f6edd5b7bdc1` | 57,892,781 / **bị loại** |

Các file đã được Blender mở lại để render/validation. Refined-02 có keys Basis/V3/V32/V33, 292,645 vertices / 499,762 triangles. Core môi dưới cuối: `abs(X)<.0415, .282<h<.334, depth>.19`, 1,928 đỉnh ΔXYZ=0; lower support `abs(X)<.070, .282<h<.312, depth>.19`, 610 đỉnh ΔXYZ=0. Có 48 đỉnh da lateral ngoài core đổi, tối đa .000838; không tuyên bố toàn bộ lower region bất biến. Chi tiết ở `evidence/verify02.json` và `preservation.json`.

## Lệnh tái lập

Chạy từ root repository. Phục hồi V3.2 theo ID ở trên và kiểm SHA trước. Blender 4.3.2; scene lưu CPU, 64 samples, 680×760, 8 threads, denoising tắt, Standard view transform.

```bash
V33_ROOT=/workspace/scratch/e27dffa28e71/m01-v33
V33_SOURCE='/workspace/scratch/e27dffa28e71/upload/Female_anime_origin(6).glb'
V33_REFERENCE='/workspace/scratch/e27dffa28e71/upload/576DB180-B6A4-4EF0-BD99-EE6183F85C1A(3).jpeg'
V33_INPUT="$V33_ROOT/input/M01-Natural-V32-Iteration-03.blend"
blender --version
sha256sum "$V33_SOURCE" "$V33_INPUT"
blender --background --factory-startup --threads 8 --python-exit-code 1 --python scripts/golden-mouth-v33/inspect_baseline.py -- "$V33_INPUT" "$V33_ROOT/diagnosis"
blender --background --factory-startup --threads 8 --python-exit-code 1 --python scripts/golden-mouth-v33/sculpt_upper.py -- "$V33_INPUT" "$V33_ROOT/upper-01"
blender --background --factory-startup --threads 8 --python-exit-code 1 --python scripts/golden-mouth-v33/refine.py -- "$V33_ROOT/upper-01/M01-Natural-V33-Upper-01.blend" "$V33_ROOT/refined-02"
blender --background --factory-startup --threads 8 --python-exit-code 1 --python scripts/golden-mouth-v33/verify.py -- "$V33_INPUT" "$V33_ROOT/refined-02/M01-Natural-V33-Refined-02.blend" "$V33_SOURCE" "$V33_ROOT/verify02.json"
blender --background --factory-startup --threads 8 --python-exit-code 1 --python scripts/golden-mouth-v33/render.py -- "$V33_INPUT" "$V33_ROOT/v32" front left35 right35 profile upper mouth clay upper_clay
blender --background --factory-startup --threads 8 --python-exit-code 1 --python scripts/golden-mouth-v33/render.py -- "$V33_ROOT/refined-02/M01-Natural-V33-Refined-02.blend" "$V33_ROOT/refined-02" front left35 right35 profile upper mouth clay upper_clay
```

Các phép thử đối chứng đã thực hiện (chỉ tái lập nếu cần):

```bash
blender --background --factory-startup --threads 8 --python-exit-code 1 --python scripts/golden-mouth-v33/diagnose_material.py -- "$V33_INPUT" "$V33_ROOT/albedo-only.png"
blender --background --factory-startup --threads 8 --python-exit-code 1 --python scripts/golden-mouth-v33/width_probe.py -- "$V33_ROOT/refined-02/M01-Natural-V33-Refined-02.blend" "$V33_ROOT/wide"
blender --background --factory-startup --threads 8 --python-exit-code 1 --python scripts/golden-mouth-v33/render.py -- "$V33_ROOT/wide/M01-Natural-V33-Width-Probe.blend" "$V33_ROOT/wide" front mouth clay
blender --background --factory-startup --threads 8 --python-exit-code 1 --python scripts/golden-mouth-v33/verify.py -- "$V33_INPUT" "$V33_ROOT/wide/M01-Natural-V33-Width-Probe.blend" "$V33_SOURCE" "$V33_ROOT/verify-wide.json" --allow-width
blender --background --factory-startup --threads 8 --python-exit-code 1 --python scripts/golden-mouth-v33/repair_exact.py -- "$V33_ROOT/refined-02/M01-Natural-V33-Refined-02.blend" "$V33_ROOT/final-03"
blender --background --factory-startup --threads 8 --python-exit-code 1 --python scripts/golden-mouth-v33/verify.py -- "$V33_INPUT" "$V33_ROOT/final-03/M01-Natural-V33-Final-03.blend" "$V33_SOURCE" "$V33_ROOT/verify03.json"
blender --background --factory-startup --threads 8 --python-exit-code 1 --python scripts/golden-mouth-v33/render.py -- "$V33_ROOT/final-03/M01-Natural-V33-Final-03.blend" "$V33_ROOT/final-03" front left35 right35 profile upper mouth clay upper_clay
python3 scripts/golden-mouth-v33/measure.py "$V33_ROOT/diagnosis/baseline.npz" "$V33_ROOT/verify02.npz" "$V33_ROOT/verify-wide.npz" "$V33_ROOT/albedo-only.png" docs/golden-mouth-v33/evidence/proportions.json
python3 scripts/golden-mouth-v33/make_evidence.py "$V33_ROOT" "$V33_REFERENCE" docs/golden-mouth-v33/evidence
```

Upper-01 cũng đã render `front upper upper_clay clay`. Không cần chạy lại KKT03 nếu chỉ tiếp tục từ Refined-02. File `.blend` tái tạo có thể khác SHA do metadata, nhưng tọa độ và các kiểm tra geometry phải tương ứng.

## Hoàn thành và còn lại

Đã kiểm baseline/source, tạo source/key độc lập, lưu checkpoint trước render, mở lại .blend, chạy Cycles và các kiểm geometry, texture, upper/corner phóng lớn; thử width và loại KKT03. Source/evidence trong Git, Blender artifacts đã lưu riêng.

Chưa đạt upper roll mềm đẹp và commissure liên tục. Lượt tiếp theo cần sculpt tương tác có điều khiển tại các vùng đã định vị; không tiếp tục tự động tăng số lần chỉnh tham số của cách làm hiện tại. WebGL2, shader/blink regression và deploy V3.3 **không chạy do Visual FAIL**. Không có iPhone acceptance.

## Bộ ảnh và dữ liệu gốc đã lưu

[M01-V33-Actual-Cycles-Diagnostics-VISUAL-FAIL.zip](https://chatgpt.com/library?file_id=libfile_6bbca39569308191b8010fae9a79cb01&account_id=personal)

ID `libfile_6bbca39569308191b8010fae9a79cb01`; 58,096,648 bytes; SHA-256 `0d160cd37969b262b7f1f3e02b851eaa4bb75824e114febd33995f500eb38497`. Đã kiểm CRC toàn ZIP và mở kiểm 32 PNG trước upload thành công. Trong ZIP có ảnh raw, baseline/verify geometry NPZ, JSON, logs, Golden owner reference, README và SHA256-MANIFEST. Không có original GLB hoặc script trùng với Git.

Đường dẫn Blender để mở trực tiếp: [Refined-02 — bản thử Visual FAIL](https://chatgpt.com/library?file_id=libfile_641c2f4215248191b41c2dd7a51fa6e4&account_id=personal). Bản đã được mở lại xác thực, không chỉ lưu file chưa kiểm. Source syntax đã compile kiểm; source/report/evidence cần lấy ở commit cuối V3.3 của branch này.
