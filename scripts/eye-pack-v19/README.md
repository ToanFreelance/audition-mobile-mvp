# Eye Asset Pack V1.9 — quy trình tái tạo và QA

Đây là asset thử nghiệm trên PR #24. Trạng thái nghệ thuật: **PARTIALLY READY / NOT VISUALLY ACCEPTED**. Không dùng cho Character Catalog production.

## Tái tạo asset

Python 3.12, các phiên bản phụ thuộc trong `requirements.txt`.

```bash
python3 -m pip install -r scripts/eye-pack-v19/requirements.txt
python3 scripts/eye-pack-v19/build_pack.py baseline_v18.glb output
python3 scripts/eye-pack-v19/validate_pack.py output/Female_head_EyeSetPack_9_V19.glb output/geometry_validation.json
```

Baseline V1.8 có SHA-256 `68934293d6c8af5581664c94170355b6a7dda7787c168ac1fe111aa4ee3a8aba`; URL và baseline được ghi trong tài liệu `docs/FACIAL_MODULAR_EYE_V1.md`. Không dùng bản GLB khác làm đầu vào.

`build_pack.py` giữ nguyên phần đầu ngoài vùng mắt, tái phân vùng các mảnh bề mặt mắt còn trong HeadBase, thay vùng bridge lỗi bằng vùng mí mới có đường biên chung, dựng bề mặt ocular cong và UV riêng, tạo chín texture sRGB và chín cặp lông mi ribbon có độ cong/độ thuôn thực tế. Mỗi bộ có bốn vai trò trên mỗi mắt: Skin, Lids, Ocular, Lashes. Biểu cảm được ghi trong tọa độ đỉnh của từng bộ.

Scene mặc định chứa Natural và HeadBase sạch. Scene thư viện chứa các bộ khác và bản gốc để so sánh. Runtime đọc cả hai scene một lần, rồi đổi visibility; không tải GLB khi chọn bộ khác.

## Render kiểm tra từ GLB đã xuất

```bash
blender --background --factory-startup --python scripts/eye-pack-v19/render_qa.py -- output/Female_head_EyeSetPack_9_V19.glb output/renders final
```

Blender 4.5.3 LTS; Cycles CPU, 32 samples; không dùng ảnh AI làm render. Script import GLB, render chín bộ/camera mặt/ba phần tư/macro và các trạng thái blink đại diện; sau đó lưu `.blend` với ảnh được pack. `render_manifest.json` ghi SHA-256 của GLB thực tế đã import.

## Runtime và Playwright

```bash
node scripts/eye-pack-v19/runtime_qa.mjs output/runtime
npx playwright test e2e/facial-modular-eye-v1.spec.ts --config=scripts/eye-pack-v19/playwright.config.ts --project=desktop --project=mobile --workers=1
```

`runtime_qa.mjs` tự khởi động Next dev cùng tiến trình kiểm tra để phù hợp môi trường cô lập mạng theo phiên lệnh. Có thể đặt `EYE_QA_ORIGIN` khi kiểm tra một server có sẵn và `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` khi dùng Chromium do môi trường cung cấp.

Trong môi trường có lỗi ghi HTTP cache của Chromium, đặt `EYE_QA_LOCAL_BYTES` cho runtime smoke hoặc `EYE_QA_GLB_BYTES` cho spec. Các tùy chọn này chỉ thay transport bằng **bytes của GLB thật**, không thay mô hình bằng fixture giả. Kết quả phải ghi rõ transport được intercept. `EYE_QA_SOFTWARE_WEBGL=1` bật SwiftShader cho spec. Mobile ở đây là Chromium mô phỏng viewport/touch; không phải Safari hay iPhone vật lý.

## Giới hạn còn lại

- Iris và sclera mới sạch, sáng; khi thu nhỏ, chúng không đọc lại atlas iris/pupil gốc.
- Chưa đạt độ mềm của mí/lông mi và độ giống concept ở tất cả góc. Một số dấu vết lông mi/crease ở vùng da ngoài vẫn đến từ nguồn HY3D/Claude; không gọi đây là lỗi iris shader đã sửa xong toàn bộ khuôn mắt.
- Blink vẫn là biến dạng cục bộ trên bộ đã chọn; pose khép còn dải sclera/iris mỏng và nếp mí, chưa phải rig mí được nghiệm thu.
- 24 cảnh báo tangent-space của glTF liên quan tới các primitive dùng lại material normal-map gốc; 0 lỗi cấu trúc. Không đồng nhất việc pass validator với nghiệm thu nghệ thuật.
- CDN thuộc tài khoản dự án hiện tại, URL không chứa thời hạn; MIME, CORS và checksum đã được kiểm tra. Giữ GLB/source bàn giao để chuyển hosting nếu cần.
