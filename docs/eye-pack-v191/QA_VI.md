# Eye Asset Pack V1.9.1 — báo cáo triển khai và QA

**PARTIALLY READY / NOT VISUALLY ACCEPTED.** Đã tái dựng asset thật, không chỉ chỉnh màu. Bản này cải thiện rõ dáng mắt và phân biệt biểu cảm so với V1.9; độ mềm/phân nhóm mi và chuyển tiếp shading quanh hốc mắt vẫn chưa đủ gần concept để tự đề xuất nghiệm thu hoàn toàn. Owner chưa nghiệm thu V1.9.1.

## Phạm vi và nguồn kiểm tra

- Repository `ToanFreelance/audition-mobile-mvp`, nhánh `work/facial-modular-eye-demo-v1`, PR #24 Draft/open, base `development`; không merge.
- Baseline V1.9 được xác minh tại commit `6c204f60fb83fbcaea622db29bc701a39760ef40`. Checkpoint source V1.9.1: `8676b67cbb29dc0b84964bd3e165281371132ca6`. Commit triển khai cuối là commit chứa bản báo cáo này; mã chính xác được ghi trong báo cáo bàn giao.
- Đọc `docs/PROJECT_INSTRUCTIONS.md`, `docs/FACIAL_MODULAR_EYE_V1.md`; kiểm tra catalog, viewer, GLB/texture và đường tải trước khi sửa.
- Dùng cả ba ảnh owner: A concept đã duyệt, B render V1.9, C ảnh Preview iPhone V1.9. Render lại GLB baseline cùng camera/ánh sáng để so sánh công bằng; không dùng ảnh iPhone cũ làm bằng chứng chạy phiên bản mới.
- Chỉ sửa EyeSet và phần hỗ trợ trực tiếp. Không đổi gameplay, WebAudio, gauge, multiplayer/Supabase, Waiting Room hay production Character Catalog.

## Root cause: vì sao V1.9 sắc và thiếu sức sống

1. **Khoảng mở mắt dùng chung một công thức hạnh nhân.** Đường giữa nghiêng và hai cung trên/dưới chung được biến đổi bằng hệ số mở/độ nâng đuôi; phần lớn bộ không có đường mí được tạo hình riêng. Góc nhọn, cung dưới và quan hệ với mày vẫn gần nhau. Concept cũng có độ xếch ở vài bộ, nên không quy toàn bộ lỗi cho độ nghiêng.
2. **Tỷ lệ iris với khoảng mở còn nhỏ.** Iris V1.9 khoảng 0,030 đơn vị trong mắt rộng khoảng 0,126, để lộ nhiều sclera. Chỉ đổi màu không làm ánh nhìn bớt trơ. V1.9.1 đặt bán kính/tâm theo landmark concept từng bộ, ví dụ Natural khoảng 0,0374, Doll khoảng 0,0458; không phóng cùng một hệ số cho chín bộ.
3. **Đường eyeliner/mi dùng ngôn ngữ quá sắc.** Biên nhọn và sợi mi đều, chĩa ngang làm nhiều bộ đọc thành dữ. Vùng da nguồn ngoài phạm vi cắt V1.9 còn chứa nếp và mảnh mi nguồn, tạo tín hiệu hình ảnh chồng với mi mới. Geometry và texture nguồn phải được phân biệt với iris sạch đã đạt màu.
4. **Quan hệ lông mày chưa riêng theo biểu cảm.** Sad cần nâng đầu mày và hạ đuôi, Angry cần lực ở đầu mày, Doll/Natural cần arch mềm. Chỉ thay ocular không giải quyết được vùng trên khuôn mặt.
5. **Bề mặt ocular nguồn không phù hợp khi mở mắt cao hơn.** Fit không ràng buộc có hệ số cong dọc dương ở cả hai bên (khoảng +0,0111 và +0,0079). Đã fit lại cap lồi có kiểm soát từ bề mặt Claude thật để mí có bề mặt nhất quán khi mở/khép.
6. **Blink V1.9 ép dẹt cả vùng mắt theo khoảng cách.** Chớp mắt nhìn có chuyển động nhưng không phải hai mí che một ocular giữ hình; cần morph riêng sau khi thay hình học.

`UpperLidBridge_ISSUE` vẫn tồn tại ở chế độ xem Claude gốc, nhưng **ẩn trong chế độ EyeSet V1.9**. Nó không phải nguyên nhân đang hoạt động của silhouette V1.9; không tuyên bố đã sửa bridge gốc bằng cách thay map ocular. Bộ ảnh isolation tách Head, Skin, Lids, Ocular, Lashes và bridge gốc ở chính diện/3⁄4 để đối chiếu. Chín atlas iris giữ sạch, không còn dùng lại iris/pupil bake nguồn trên ocular mới; normal map da nguồn không áp lên iris.

## Geometry/UV/material thực sự thay đổi

- Dùng chính đầu Claude V2 có trong GLB V1.9. Giữ nguyên 452.201 tam giác đầu chung ngoài hai vùng mắt từ tổng 488.602 tam giác nguồn. Bản Claude gốc đầy đủ vẫn có trong scene thư viện để rollback.
- Phân vùng cục bộ 36.401 tam giác nguồn. Giữ lớp da ngoài có UV/material nguồn, loại phần ocular/mi/nếp không còn phù hợp ở vùng tái dựng; không sửa hàng loạt mặt.
- Tạo đường mí trên/dưới độc lập bằng landmark concept và nội suy PCHIP. Tái dựng 97 cột, 18 hàng mỗi mí, chung canthus; collar triangulate có ràng buộc nối đúng đường biên da nguồn (267 đỉnh trái, 273 đỉnh phải).
- Fairing độ cao theo metric của từng pose, giữ biên/slope; mí di chuyển theo cap ocular trong vùng che phủ. Không thêm màng, lớp iris shell hoặc shader ring che lỗi.
- Mỗi bộ có tám module thật: trái/phải × Skin/Lids/Ocular/Lashes. 18 hình học mí khác nhau; không dùng cùng một mesh rồi đổi màu. Tổng GLB 84 mesh parts, gồm bản gốc/rollback.
- Eyeliner gắn mép mí, mi bằng dải cong Bézier thuôn và phân nhóm, vị trí gốc/chuyển động theo đúng từng mí. Đây vẫn là stylized ribbon mesh, chưa đạt độ dày/nhóm mi mềm như concept.
- Mày được nắn cục bộ theo từng bộ, có fade về đúng biên gốc và chuyển normal tương ứng; UV nguồn hợp lệ. Hai atlas da mí mới loại dấu iris/mi cũ và không dùng normal map realistic ở vùng tái dựng.
- Giữ **nguyên từng byte cả chín PNG iris V1.9 và material iris**; sclera, gradient, highlight, Star/Heart giữ màu đã cải thiện. Không tăng exposure toàn cảnh. Da giữ tone mapping gốc, ocular unlit giữ màu sRGB.
- 36 mesh mí/mi có hai morph POSITION+NORMAL: `Blink`, `BlinkArc`. Ocular không bị ép dẹt; mí/mi đóng che ocular. Viewer đọc trực tiếp target đã export, đặt native weights về 0 để tránh áp dụng hai lần, rồi áp các slider nâng cao hiện có.

## Thay đổi riêng từng bộ và đánh giá thị giác

Đây là vòng đánh giá riêng sau dựng, so ảnh cùng tỷ lệ; không phải nghiệm thu owner hay ý kiến của một QA viên khác. PASS kỹ thuật không đồng nghĩa PASS thẩm mỹ.

| Bộ | Hình học/biểu cảm đã đổi | Kết luận thị giác |
| --- | --- | --- |
| Natural | Cung trên cong mềm, mở hạnh nhân cân đối, đuôi thanh hơn, iris lớn theo tỷ lệ concept, mày dịu | PARTIALLY READY — hiền hơn rõ; mi và shading mí còn khác concept |
| Joyful | Mí dưới nâng thành cung cười, khoảng mở hẹp theo hai đường mí, mày nâng nhẹ; không scale ngang mắt | PARTIALLY READY — đọc được mắt cười; vùng mí ngoài còn chuyển sáng mạnh |
| Sad | Đuôi hạ có kiểm soát, mí trễ mềm, đầu mày nâng/đuôi hạ, iris tím hồng giữ nguyên | PARTIALLY READY — dịu hơn; sắc thái buồn chưa mạnh và mềm bằng concept |
| Playful | Cung bất đối xứng nhẹ, đuôi nâng ít, iris/gaze lệch theo concept, hai mày hơi khác nhau | PARTIALLY READY — lanh lợi hơn; độ hội tụ ánh nhìn cần owner kiểm tra trên máy thật |
| Angry | Hạ đầu mí/mày, khẩu độ hẹp có lực, eyeliner sắc hơn các bộ khác, ruby giữ nguyên | PARTIALLY READY — biểu cảm giận rõ và riêng; mi còn mảnh/cứng hơn concept |
| Doll | Khẩu độ cao và tròn riêng, iris pastel lớn gần chạm mép trên/dưới, mi hướng cong lên, mày mở | PARTIALLY READY — khác Natural rõ, cute hơn; khối mi chưa đầy như concept |
| Idol | Mở mắt cao/cung mềm, gaze gần trực diện, bố cục iris sapphire giữ nguyên, mày mềm | PARTIALLY READY — sáng và sống động hơn; texture/khối da quanh mắt vẫn mang phong cách Claude |
| Star | Cung mở mềm riêng, tỷ lệ iris tím/sao vàng theo khẩu độ, biểu tượng neo UV iris, blink che cùng ocular | PARTIALLY READY — fantasy rõ; đường mi và hốc mắt chưa giống hoàn toàn |
| Heart | Cung tròn hơn Star, tâm/bán kính iris và đường mí riêng, mày dịu, candy/heart giữ nguyên | PARTIALLY READY — ngọt hơn, có khác biệt hình dáng; chưa đạt độ mềm mi của concept |

Các yếu tố đã cải thiện rõ: silhouette, độ mở, bớt cảm giác dữ mặc định, tỷ lệ iris, phân biệt biểu cảm. Giữ màu/highlight đã đạt V1.9. Còn giới hạn: mi ribbon còn mảnh/nhọn, khối da/độ bóng/nếp ngoài hốc mắt khác nét vẽ phẳng của concept. Khi khép nửa/nhắm kín còn vệt sáng dọc và chuyển sắc gắt ở vùng mí kéo giãn, thấy rõ hơn ở Doll/Heart. **Blink chức năng PASS; chất lượng hình ảnh mí đóng PARTIALLY READY**, chưa được coi là bảo toàn toàn bộ chất lượng mỹ thuật blink. Không che những phần này bằng crop hay ánh sáng khác giữa trước/sau.

## Bằng chứng hình ảnh

- `EyeSet_V191_concept_before_after.png`: chín hàng, ba cột concept / V1.9 / V1.9.1.
- `EyeSet_V191_nine_final.png`: đủ chín bộ, cùng framing và ánh sáng.
- `EyeSet_V191_full_faces.png`: toàn mặt đủ chín bộ.
- `EyeSet_V191_full_face_before_after.png`: sáu bộ Natural/Joyful/Sad/Angry/Doll/Idol, trước/sau.
- `EyeSet_V191_three_quarters.png`: trái/chính diện/phải cho cả chín bộ, ±28°.
- `EyeSet_V191_macros.png`: đủ chín macro mí/iris/canthus.
- `EyeSet_V191_blink_states.png`: mở/khép nửa/nhắm kín trên sáu bộ đại diện; ảnh rời có thêm reopening/restored.

75 PNG cuối được render bằng Blender 4.5.3 LTS/Cycles CPU, 32 samples/denoise, **sau khi import lại GLB SHA `312c0c4f…`**. Camera, ánh sáng, Standard view transform, exposure 0 giữ như baseline. 18 PNG trước được render từ GLB V1.9 thật. Không có ảnh AI-generated hoặc ảnh scene chưa export dùng thay kết quả GLB.

Blender importer bỏ qua morph NORMAL; script QA nạp đúng normal target trong GLB rồi áp theo cùng hai hệ số blink như Three.js. Không sửa geometry sau import để che lỗi. File `.blend` pack ảnh và ghi SHA GLB nguồn trong scene. Bài roundtrip native Blender export/import là kiểm tra riêng, không dùng GLB roundtrip để thay runtime.

## Validation thực sự chạy

| Kiểm tra | Kết quả và phạm vi |
| --- | --- |
| Khronos glTF Validator 2.0.0-dev.3.10 | PASS cấu trúc: 0 errors, 24 warnings tangent-space trên primitive dùng normal map nguồn, 24 infos UV không dùng; không tuyên bố 0 issues |
| Geometry/indices/UV/material/embedded image | PASS; finite, indices trong miền, normal đơn vị, decode đủ 14 ảnh nhúng, không tham chiếu ảnh ngoài |
| Bảo toàn iris/head | PASS; chín PNG iris giống byte V1.9, accessor đầu Claude gốc giữ nguyên, 452.201 mặt đầu chung giữ nguồn |
| Modular identity/đường nối | PASS; 9×8 node, 18 hash hình học mí khác nhau; biên ocular/mí/da khớp trong dung sai 1e-7 |
| Mí và blink | PASS; 18 mí × 5 mức 0/25/50/75/100%, không tam giác gập trong phép chiếu kiểm tra; không cạnh nonmanifold/winding bất thường trên vùng mí |
| Nhắm kín góc nhìn | PASS; 54 phép dò độ sâu (18 mắt × chính diện/±28°), không ocular xuyên vùng trong mí nhắm trong miền test, biên được erosion 2px để tránh nhiễu raster |
| Blender import/export/import | PASS; 84 mesh parts, 36 mesh giữ hai morph targets; export chỉ scene QA để tránh scene rỗng do importer Blender |
| TypeScript | PASS, `npx tsc --noEmit` |
| ESLint | PASS cho ba file viewer/catalog/page và các file JS/TS QA thay đổi |
| Next.js production build | PASS; build của repository, không đổi cấu hình gameplay/build |
| Focused Playwright UI | PASS 8/8, 0 skipped/failed/flaky, JSON report xác nhận; 4 test × mobile/desktop Chromium trên build production, không phải WebKit vật lý |
| WebGL runtime | PASS, 13 nhóm kiểm tra bằng Chromium headless shell/ANGLE SwiftShader, GLB thật; console 0 errors/0 warnings |
| Switching/cache | PASS; đủ chín bộ × 8 module, chỉ 1 GLB request; cache key V1.9.1, reload dùng Cache Storage không fetch lại |
| Điều khiển | PASS trong runtime smoke: iris 76/85%, hai màu độc lập, Star/Heart, None/Dramatic, blink về rest, reset, preset camera, drag, sticky 390×844 và pinch hai touch tổng hợp |
| Asset CDN | PASS HTTP 200, `model/gltf-binary`, CORS `*`, tải về đủ 43.159.064 byte và SHA trùng GLB render |
| Safari/iPhone vật lý | **CHƯA CHẠY** cho V1.9.1; không dùng ảnh C hoặc Chromium để nhận đã PASS |

Các kiểm thử browser dùng byte GLB thật thay transport tải CDN trong môi trường có hạn chế HTTP disk cache lớn; không thay loader/geometry bằng fixture. CDN được tải và checksum độc lập. Screenshot runtime chỉ là bằng chứng cục bộ, không giả làm ảnh owner.

## Asset, cache, nguồn chỉnh sửa và rủi ro

- GLB: `Female_head_EyeSetPack_9_V191.glb`, **43.159.064 bytes**.
- SHA-256: `312c0c4fdf74de9c366258d1442039db12c7c82ffa13d6d4fe407854853d9ac4`.
- URL: https://d2ol7oe51mr4n9.cloudfront.net/user_3Jb86LOyd6RRYonCk2iie6jkL5h/93c65212-1de0-486d-bf4f-9cbf08c58554.glb
- Cache: `audition-eye-set-pack-v191-312c0c4fdf74`. Viewer đọc thêm library scene một lần, chuyển bộ tại chỗ, không tải lại toàn GLB.
- Preview chính thức giữ origin nhánh: https://audition-mobile-mvp-git-work-fa-d54869-toan-freelances-projects.vercel.app/tools/facial-modular-eye-v1
- `.blend` working file và 11 source textures (hai da mí, chín iris giữ nguyên), ảnh gốc tham chiếu, ảnh render/validation được bàn giao riêng; code dựng ở `scripts/eye-pack-v191/`. Không có asset lớn nhúng vào JavaScript hoặc phụ thuộc Supabase Storage mới.
- Pack vẫn lớn cho lần tải đầu qua 4G; cache giảm tải lại, nhưng RAM/GPU/thermal và Safari cache eviction trên iPhone chưa đo. Đây là pack QA tĩnh/local morph, chưa phải rig avatar production.
- Kiểm tra đóng kín/không gập áp dụng cho chín pose mặc định và các góc đã ghi; không bảo đảm mọi tổ hợp slider cực trị. Các preset, tùy chỉnh và rollback gốc vẫn hoạt động trong runtime test.
- Chưa xử lý riêng bridge gốc đang giữ cho rollback; nó không dùng trong các bộ mới. Không tự coi vùng shading cũ ngoài biên cục bộ đã được owner chấp nhận.

Danh sách file chính xác ở `CHANGED_FILES.txt`. PR tiếp tục Draft; không merge, chưa đưa vào Character Catalog production. Chỉ sau khi owner kiểm tra hình ảnh và máy thật mới có thể quyết định nghiệm thu.
