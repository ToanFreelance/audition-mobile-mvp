# Golden Mouth V3.3 — M01 Natural: VISUAL FAIL

Ngày 09/11/2026. Bản thử nghiệm được giữ để kiểm tra là **Refined-02**, shape key `M01_Natural_V33`. Môi trên mềm hơn một phần nhưng chưa đẹp, vẫn có cảm giác gờ nổi; vệt tam giác dưới khóe phải vẫn nhìn thấy trong clay. Không đưa V3.3 vào runtime. Không có owner acceptance.

## Baseline và phạm vi

- Repository `ToanFreelance/audition-mobile-mvp`; branch `work/female-golden-mouth-v1-qa`.
- HEAD đầu phiên: `e1400d7a578d3307018f977761e298fb461a2cc9`. PR #26 OPEN/Draft; không merge.
- Input: V3.2 iteration 03, `libfile_b23cc9d3507c8191acda5e4d1ca77fce`, SHA-256 `cd53bb6d1fd7d0178300958d47c73511fc253e7a68b8fc57aad5ebd5345401c7`.
- Original GLB SHA-256 `b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90`; đã kiểm lại, không commit GLB.
- Đã đọc PROJECT_INSTRUCTIONS, V3.2 QA/CHECKPOINT và source; mở checkpoint đúng hash, xem render thật và Golden M01.
- Chỉ sửa scripts/docs V3.3. Golden Eye V8 giữ nguyên so baseline `1a0ba6e4fd8a1a0e76453a2e698fb9fcc5746576`. Không sửa các hệ thống sản phẩm hoặc preset khác.

## Chẩn đoán nguyên nhân

**Môi trên:** gờ sáng rõ cả trong clay không texture/normal map. Render albedo bằng emission làm phần lớn gờ trắng phía trên biến mất: hình dạng bề mặt và phản xạ ánh sáng đóng vai trò chính. Một số màu tối ở khóe và đốm sáng môi dưới nằm trong base color. Vì vậy không làm biến dạng geometry để xóa toàn bộ pigment, cũng không sửa texture để che gờ. Texture/material gốc được giữ nguyên.

**Khóe phải:** phát hiện trực tiếp trên geometry tại các face `397282/398187/398287/398285`, vertices `239233/239234/239235/239237/239338/239339`, gần local `(0.043, 0.3217, 0.2385)`. Hai mặt 397282/398187 có góc giữa normal khoảng 68.45° ở V3.2. Một vùng rất hẹp tiếp giáp đỉnh được bảo vệ làm phép fit khó giữ đồng thời độ cong và anchor. Đây là lỗi bề mặt thật, không phải chỉ custom normals.

**Cảm giác miệng nhỏ:** width/IPD gần Golden không giải quyết được cảm nhận toàn mặt. Khóe tối, chìm và vermilion bị viền cứng làm silhouette hữu dụng kém mềm. Đã thử rộng hơn có kiểm soát, không mặc định tăng width là lời giải.

## Thực hiện thực tế

Blender **4.3.2**, `/usr/bin/blender`, headless; native mesh `node_0`. Không cắt da, không mesh môi rời, không thay topology.

1. **Upper-01:** tạo key từ tọa độ V3.2; fit quadratic một lượt trong tangent chart cục bộ của upper surface, hàng xóm không đi qua seam. Displacement theo normal nhỏ, falloff C2. Lower và upper face được khóa. 707 đỉnh đổi, tối đa khoảng 0.000239 đơn vị model. Kết quả quá nhẹ.
2. **Refined-02 — bản thử được giữ:** giảm crest môi trên nhẹ, hạ hai đỉnh Cupid và làm nông dip bằng vùng riêng; không nén toàn miệng. Fit bề mặt da tại đúng artifact bên phải với anchor có trọng số, giới hạn displacement. Tổng 842 đỉnh khác V3.2; tối đa 0.001076. Giảm góc gãy xuống **47.99°**, nhưng vệt vẫn hiện trong clay. Môi trên chưa đạt Golden.
3. **Width probe:** dịch mô lateral kèm commissure thêm 5%, tâm giữ cố định; không scale cả miệng hoặc cả mặt. Chiều cao/projection môi dưới giữ, X lateral thay tối đa 0.002235. Lợi ích ở render toàn mặt chỉ vài pixel và chưa rõ về thẩm mỹ; không chọn vì chưa đủ lý do thay width môi dưới owner thích.
4. **KKT03 — bị loại:** thử fit qua exact anchor 239338. Góc giữa hai mặt kề tăng thành **95.82°**, render xấu hơn. Không dùng làm kết quả chọn, dù tên file chứa `Final-03`. Giữ riêng để không mất dấu thất bại.

Không tiếp tục nhân số lần chỉnh hằng số. Các phương pháp headless cục bộ đã thử chưa tạo được upper roll và commissure có chất lượng mong muốn. Lượt tiếp theo cần điều khiển sculpt tương tác chính xác tại upper roll/khóe; không nên coi Refined-02 là bản đã hoàn tất.

## Bảo toàn môi dưới và độ đầy V3.2

Mask đo theo tọa độ V3.2, trục local `(X, height, depth)`:

| Vùng khóa | Điều kiện | Số đỉnh | Max ΔXYZ |
|---|---|---:|---|
| Lower core | `abs(X)<.0415, .282<h<.334, depth>.19` | 1,928 | 0 / 0 / 0 |
| Lower support | `abs(X)<.070, .282<h<.312, depth>.19` | 610 | 0 / 0 / 0 |
| Upper support | `abs(X)<.075, .365<h<.378, depth>.20` | 285 | 0 / 0 / 0 |
| Lateral support | `.060<abs(X)<.085, .300<h<.360, depth>.20` | 370 | 0 / 0 / 0 |

Trong vùng lower rộng hơn, **48 đỉnh da lateral ngoài core** có đổi để sửa artifact, tối đa 0.000838; không tuyên bố toàn bộ nửa dưới bất biến. Vùng môi dưới chính và hỗ trợ dưới khóa chính xác. [So sánh clay](evidence/lower-lip-clay.jpg), [bản đồ displacement](evidence/lower-preservation-map.png), [số liệu](evidence/preservation.json).

## Tỉ lệ miệng–mặt

| Chỉ số | V3.2 | Refined-02 | Probe +5% |
|---|---:|---:|---:|
| Width, model units | 0.090006 | 0.090006 | 0.094506 |
| Width / IPD | 0.3750 | 0.3750 | 0.3938 |
| Width / facial width tại h=.334 | 0.2533 | 0.2533 | 0.2659 |
| Width / lower-face width tại h=.30 | 0.3252 | 0.3252 | 0.3415 |
| Nose→seam / nose→chin, mốc xấp xỉ | 0.3752 | 0.3752 | 0.3752 |

IPD 0.24 lấy từ eye center ±.12 của metadata V8, không sửa mắt. Mouth landmarks 247298/239979; seam landmark 247593. Facial width đo giao tuyến triangle/plane, chỉ mặt trước depth>.05. Mốc nose/chin h=.386/.25 lấy từ front render, sai số khoảng 2 pixel; không phải ranh giới giải phẫu chính xác.

Golden M01: pupil (156,315)/(276,315), corner (195,405)/(239,405), nose (217,378), chin (217,450); width/IPD≈0.3667. Sai số mốc 1–2 pixel. Không suy ra chiều sâu 3D từ Golden. Proxy vermilion theo màu trong albedo cho width≈0.0915, có thể chứa pigment lateral; không phải segmentation giải phẫu. [Định nghĩa và số đo đầy đủ](evidence/proportions.json).

**Chọn giữ width V3.2**, dựa trên render đối chứng và ưu tiên bảo toàn môi dưới, không phải chỉ vì ratio gần Golden. Mức độ cân đối toàn mặt chưa được coi là đã giải quyết.

## Geometry QA thực chạy trên file mở lại

| Kiểm tra Refined-02 | Kết quả |
|---|---|
| Vertices / triangles | 292,645 / 499,762 |
| Basis, vertex correspondence, connectivity và UV so GLB | Bất biến chính xác |
| Keys Basis / V3 / V3.2 so checkpoint | Bất biến chính xác |
| Packed textures / danh tính material | Giữ nguyên |
| Vùng upper face/nose theo Basis h≥.378 | 195,239 đỉnh, Δ=0 |
| Coordinate separation ở UV split | 0 / 0 / 0 |
| Affected face quay >90° so Basis | 0; minimum normal dot 0.672513 |
| Affected degenerate triangles | 0 |
| Local non-adjacent intersection pairs | V3.2=0; Refined-02=0; mới=0 |

Phạm vi intersection: native perioral `abs(X)<.11, .275<h<.40, depth>.18`, bỏ cặp chung đỉnh hoặc trùng tọa độ UV. Đây là kiểm tra cục bộ, không tuyên bố chứng minh không giao nhau cho toàn model. Xem [verify02.json](evidence/verify02.json).

Góc 95.82° ở KKT03 là **góc giữa hai mặt kề**, không phải số face quay >90° so Basis. Hai phép đo khác nhau. Refined-02 đạt các kiểm tra topology/orientation ở trên nhưng **không đạt tính liên tục bề mặt nhìn thấy**.

## Cổng mỹ thuật độc lập

| Câu hỏi | Đánh giá trên render thật |
|---|---|
| 1. Môi trên mềm và tự nhiên hơn? | Chỉ cải thiện nhẹ; chưa đạt. |
| 2. Cupid tinh tế, đẹp? | Bớt nhọn nhưng vẫn cứng; FAIL. |
| 3. Upper lateral mượt? | Chưa đều tại kết thúc khóe; FAIL. |
| 4. Hết cảm giác gờ nổi? | Chưa; FAIL. |
| 5. Miệng cân với mặt? | Chưa chứng minh cải thiện rõ. |
| 6. Tăng width có ích? | Probe không có lợi ích đủ rõ; không chọn. |
| 7. Môi dưới được bảo toàn? | Core/support Δ=0, hình khối giữ; có sửa da lateral như nêu trên. |
| 8. Perioral fullness V3.2 còn? | Các support mask giữ chính xác; không thấy mất độ đầy chung. |
| 9. Artifact khóe phải hết? | Chưa; FAIL. |
| 10. Hai khóe tròn tự nhiên? | Còn sắc/chìm; FAIL. |
| 11. Không tái xuất ripple V3.1? | Không thấy dải ripple mới rõ phía trên; artifact khóe vẫn tồn tại. |
| 12. Không có nếp ngang dài mới? | Không thấy trở lại nếp V2. |
| 13. M01 neutral? | Không thêm smile; còn cảm giác hơi căng ở upper/corners. |
| 14. Rõ ràng đẹp hơn V3.2? | Không; VISUAL FAIL. |

Danh tính nhân vật giữ nguyên; không có da cắt phẳng hoặc lip ribbon mới. Những điểm này không bù được lỗi upper roll và commissure.

## Render thật và giới hạn bằng chứng

Cycles **CPU**, 8 threads, 64 samples, 680×760; front/left−35°/right+35°/profile90°/upper/mouth/clay/upper_clay. Rerender V3.2, Refined-02 và KKT03 bằng cùng scene/camera/đèn/exposure; clay material override loại texture và normal map. Không denoise bổ sung, blur, paint-over hoặc ảnh sinh AI. Sheet chỉ crop/resize có ghi rõ; ảnh raw được giữ riêng. Golden chỉ crop/scale đồng đều theo IPD, không warp.

- [Tám góc Cycles](evidence/cycles-views.jpg).
- [Upper V3.2 → V3.3 → Golden](evidence/upper-lip-comparison.jpg).
- [Toàn mặt / width probe / Golden](evidence/face-proportion-comparison.jpg).
- [Mouth material và clay](evidence/mouth-clay-comparison.jpg).
- [Khóe phải phóng lớn, gồm bản bị loại](evidence/right-commissure-clay.jpg).

Các render Cycles này dùng **mắt tím native trong GLB**, không phải bằng chứng runtime V8 mắt vàng. Mã/asset Golden Eye V8 không đổi. **Không chạy WebGL2 V3.3, shader/blink/expression regression hoặc deploy** vì art gate FAIL; không có preview iPhone V3.3. V2 preview giữ nguyên. Không tuyên bố SwiftShader/hardware GPU/iPhone Safari PASS.

## Bàn giao

Source và evidence nằm trong `scripts/golden-mouth-v33/`, `docs/golden-mouth-v33/`; [CHECKPOINT.md](CHECKPOINT.md) ghi lệnh và artifact phục hồi. `.blend` Refined-02 đã lưu, mở lại và xác thực; width probe và KKT03 lưu riêng. Không thay V3.2 bằng bản thất bại. Cần owner xem bằng chứng; không suy diễn acceptance từ technical checks.

- [Editable Refined-02 — Visual FAIL](https://chatgpt.com/library?file_id=libfile_641c2f4215248191b41c2dd7a51fa6e4&account_id=personal).
- [32 PNG gốc, geometry data, log và manifest](https://chatgpt.com/library?file_id=libfile_6bbca39569308191b8010fae9a79cb01&account_id=personal). ZIP 58,096,648 bytes, SHA-256 `0d160cd37969b262b7f1f3e02b851eaa4bb75824e114febd33995f500eb38497`, CRC/PNG đã kiểm.
