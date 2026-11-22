# Eye Asset Pack V1.9.1 — tái dựng dáng mắt trên Claude V2 thật

Đọc `docs/eye-pack-v191/QA_VI.md` trước khi nghiệm thu. Trạng thái mỹ thuật là **PARTIALLY READY / NOT VISUALLY ACCEPTED**; concept owner đã chốt, không có concept mới.

## Nguồn và kết quả

- Đầu vào V1.9: URL và SHA trong `docs/eye-pack-v19/asset-manifest.json`.
- Đầu ra V1.9.1: URL, SHA và các thông số từng bộ trong `docs/eye-pack-v191/asset-manifest.json`.
- Reference A: bảng concept owner 1122×1402; các landmark trong `PROFILES` lấy từ ảnh này. Sad, Doll, Heart có điều chỉnh nhỏ để chuyển sang bề mặt 3D.
- Reference B: contact sheet GLB V1.9 owner cung cấp; đồng thời render lại baseline bằng cùng script/camera với bản sau.
- Reference C: ảnh iPhone owner, dùng phân tích cảm giác sắc/lạnh và tỷ lệ mắt trên toàn khuôn mặt. Đây là ảnh V1.9, không phải bằng chứng iPhone chạy V1.9.1.
- Giữ nguyên từng byte chín PNG iris V1.9 và material tương ứng. Tạo mới geometry mí, ocular, mi; nắn cục bộ vùng mày/da nguồn. Không thay nhân vật bằng đầu giả.

## Dựng và kiểm tra

Python 3.11+, Blender 4.5.3 LTS, Node theo repository. Dùng môi trường Python riêng nếu cần:

```bash
python3 -m pip install -r scripts/eye-pack-v191/requirements.txt
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 scripts/eye-pack-v191/build_shapes.py V19.glb output
python3 scripts/eye-pack-v191/validate_pack.py output/Female_head_EyeSetPack_9_V191.glb V19.glb output/geometry_validation.json
```

`validate_pack.py` không có đối số `quick` sẽ dò 54 góc mắt nhắm và 90 tổ hợp mí/trạng thái. Dùng `quick` chỉ khi lặp dựng, không thay thế QA cuối.

Khronos glTF Validator dùng npm package `gltf-validator@2.0.0-dev.3.10` (cài riêng, không thêm dependency runtime):

```bash
node scripts/eye-pack-v191/validate_gltf.mjs output/Female_head_EyeSetPack_9_V191.glb output/gltf_validation.json
blender --background --python scripts/eye-pack-v191/blender_roundtrip.py -- output/Female_head_EyeSetPack_9_V191.glb roundtrip
blender --background --python scripts/eye-pack-v191/render_qa.py -- V19.glb before before
blender --background --python scripts/eye-pack-v191/render_qa.py -- V19.glb isolation isolate
blender --background --python scripts/eye-pack-v191/render_qa.py -- output/Female_head_EyeSetPack_9_V191.glb after final
python3 scripts/eye-pack-v191/contact_sheets.py before after concept.jpeg output/manifest.json qa public/assets/eye-sets/v191
```

Render `final` gồm 75 PNG, từ GLB **đã export rồi import lại**: chín cận mắt, chín toàn mặt, chín macro, 18 góc 3/4 và 30 trạng thái blink. Script lưu `.blend` đã pack texture, ghi SHA nguồn vào scene. `before` tạo 18 PNG. `isolate` tạo 14 PNG tách lớp V1.9 ở chính diện và 3/4. Contact sheet không retouch, không tăng exposure và không đổi crop giữa hai cột GLB.

Blender 4.5 importer không nạp morph NORMAL. Script QA đọc đúng NORMAL target từ GLB, áp dụng cùng POSITION/BlinkArc cho ảnh blink; không sculpt lại hoặc sửa hình học sau import để tạo bằng chứng. Vòng export/import Blender chỉ là bài kiểm tra riêng, không dùng file đã ghép các scene đó thay GLB runtime.

## Kiểm thử viewer

```bash
npx tsc --noEmit
npx eslint app/tools/facial-modular-eye-v1/EyeSetCatalog.ts app/tools/facial-modular-eye-v1/RealHeadPreview.tsx app/tools/facial-modular-eye-v1/page.tsx scripts/eye-pack-v191/runtime_qa.mjs scripts/eye-pack-v191/validate_gltf.mjs scripts/eye-pack-v191/playwright.config.ts
npm run build
PLAYWRIGHT_WEB_SERVER=1 EYE_QA_SOFTWARE_WEBGL=1 EYE_QA_GLB_BYTES=/absolute/output/Female_head_EyeSetPack_9_V191.glb PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/absolute/chrome-headless-shell npx playwright test e2e/facial-modular-eye-v1.spec.ts --config=scripts/eye-pack-v191/playwright.config.ts --workers=1
EYE_QA_LOCAL_BYTES=/absolute/output/Female_head_EyeSetPack_9_V191.glb PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/absolute/chrome-headless-shell node scripts/eye-pack-v191/runtime_qa.mjs /absolute/runtime-qa
```

Trong môi trường hạn chế ghi HTTP disk cache lớn, hai biến `EYE_QA_*BYTES` chỉ thay transport bằng byte GLB thật. GLTFLoader, Three.js, material, morph, Cache Storage và WebGL vẫn chạy thật. Kiểm tra URL CDN, MIME, CORS và SHA được làm độc lập. Không coi bài test Chromium/SwiftShader hay viewport 390×844 là QA Safari/iPhone vật lý.

Không đưa GLB 43 MB vào bundle hoặc Git. Chỉ thumbnail WebP nhỏ ở `public/`; asset, `.blend`, texture nguồn và bộ ảnh QA là các file bàn giao riêng. Không tích hợp Character Catalog production, không merge PR #24.
