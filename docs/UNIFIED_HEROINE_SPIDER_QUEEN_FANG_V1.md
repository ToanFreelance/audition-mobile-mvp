# Spider Queen Fang V1 — QA độc lập trên Unified Heroine

**Scope:** Thử accessory mặt 3D Premium/rare, lấy cảm hứng art direction từ item răng nanh Audition. Thiết kế riêng; không dùng mesh/texture của Audition VTC.

## Asset thật

- Unified Heroine GLB và skeleton giữ nguyên.
- Asset: public/characters/unified-heroine-v1/spider-queen-fang-v1-47366a109f16.glb
- Blender 5 source generator: scripts/unified-heroine-v1/build_spider_queen_fang.py
- 17 mesh riêng (2 nanh men ngọc cong, gold collars, viền kim loại, đường gloss, micro-filigree, violet gems).
- 5 materials; hai mesh nanh có UV. Kích thước binary ~113 KB. GitHub lưu 6 phần payload gzip/base64 + Blender generator; Node materializer tạo GLB thật trong prebuild/predev, không cần Blender trên Vercel.
- Parent head bone: J_Bip_C_Head, mounted once from rest pose; không recreate actor hay AnimationMixer.
- Anchor VRoid source coordinates [0,1.350,-0.104] m, đo từ FaceMouth indexed triangles (X ±0.0226 m, Y 1.3418..1.3707, Z -0.1021..-0.0594).
- Cache trong runtime sau tải đầu tiên; unequip chỉ ẩn mesh, trang bị lại không gửi request GLB mới.
- Optional Fang Smile test dùng facial morph A ở influence 0.18; không chiếm WebAudio clock hoặc dance mixer.
- Vercel static hashed URL, cache immutable; không có Supabase Storage fetch.

## Visual & technical QA

- Bản sculpt đầu tiên bị từ chối nội bộ vì nanh dài và jewel quá lớn.
- Bản tinh chỉnh có nanh khoảng 14.5 mm, gold microfiligree và gemstone nhỏ gần môi; không chạm cằm trong bản Mouth Macro QA.
- Chạy Blender reimport, GLTFLoader WebGL, Mobile DPR2, 3/4 camera, mouth morph, Dance + Premium outfit/hair, actor identity, teardown, retry/equip.
- Chỉ xác nhận pass cho các bài test thực sự đã chạy. Visual acceptance trên iPhone vật lý thuộc owner; không gọi asset này là commercial premium final.
- Đây là rigid head-bone attached accessory, không phải môi/đồ vật skinned weight morph hoàn chỉnh, nên cần kiểm tra expression / viseme clipping kỹ.

## Scope protection

Chỉ sửa isolated Unified Heroine QA route, Blender builder, GLB asset, CDN headers và báo cáo. Không thay Supabase, gameplay, Waiting Room, WebAudio, global turns, gauge, Character Catalog production. Không merge PR #24.

