# Vita Female Wardrobe V1 — SESSION 1: khóa nguồn và manifest

Ngày: 2026-11-13 (Asia/Ho_Chi_Minh). Nhánh: `work/vita-wardrobe-tryon-poc-v1`.
Baseline trước phiên: `c703f4be706c630118db7c8d143c771d07fcb5d8`; API không có PR cho nhánh.
Không có checkout/working tree dự án cũ trong workspace; đọc baseline từ GitHub và cập nhật đúng tree đó qua API.

## Kết quả và nguồn dữ liệu

Manifest chính: [manifest.json](../app/tools/vita-outfit-gallery/manifest.json).
[Catalog QA](../app/tools/vita-outfit-gallery/catalog.ts) lấy dữ liệu từ manifest: 3 outfit + 5 accessory.
Catalog cũ có Sakura Encore/Mint Track; hai đề xuất này được bỏ khỏi shortlist đang hoạt động.
13 OUTFIT VROID, Pastel Pink và Varsity chỉ còn là nghiên cứu lịch sử, không tự thêm vào danh sách nữ đã chốt.

| Item / id | Nguồn BOOTH | File hiện có / truy cập | License và blocker |
| --- | --- | --- | --- |
| Sweet Pop Jacket / `sweet-pop-jacket` | [8009784](https://booth.pm/en/items/8009784), vroidlabid | Custom Item; 300 JPY; chưa mua/chưa có file | Listing không có điều khoản đủ rõ cho game; cần binary + license |
| Sweet Girly Coord / `sweet-girly-coord` | [8009838](https://booth.pm/en/items/8009838), vroidlabid | Custom Item; 300 JPY; chưa mua/chưa có file | Cần binary + license |
| Cyber Blue / `cyber-blue` | [5798462](https://booth.pm/en/items/5798462), Pham's Itemshop | **Có ZIP thật owner đã cung cấp**, kiểm tra lại 3 custom item; tải mới BOOTH yêu cầu đăng nhập | Sửa texture được phép, thương mại cần credit; cấm phân phối lại; quyền phát hành mesh dẫn xuất chưa rõ |
| Pink Ribbon Boots / `pink-ribbon-boots` | [5570256](https://booth.pm/ja/items/5570256), Chikaron SHOP | ZIP/custom item; 0 JPY; link tải chuyển đăng nhập; chưa có file | Thương mại/sửa/ngoài VRoid được phép; cấm phân phối lại; cần rõ quyền bundle game |
| Cross-Strap Pumps / `cross-strap-pumps` | **Chưa khóa đúng URL**; hai ứng viên trong manifest | Chưa có file; tên shortlist cũ không có creator/URL | Không tự chọn nguồn; cần xác định đúng listing trước khi tải/mua/chuyển đổi |
| Improved Hairbow / `improved-hairbow` | [5767151](https://booth.pm/en/items/5767151), Miss Aralys Designs | Custom item + ZIP texture; 0 JPY; link tải chuyển đăng nhập; chưa có file | Listing không nêu license đủ rõ |
| RIOT Choker / `riot-choker` | [6702402](https://booth.pm/en/items/6702402), Pham's Itemshop | Custom item/XWear; 0 JPY; link XWear chuyển đăng nhập; chưa có file | Cho sửa/avatar thương mại, credit tùy chọn; cấm phân phối lại; game bundle chưa rõ |
| Fluffy Gloves / `fluffy-gloves` | [6499017](https://booth.pm/ja/items/6499017), Starry Sea | Custom item 4 màu; 200 JPY; chưa mua/chưa có file | [Terms FANBOX](https://skone-star.fanbox.cc/posts/2599427) không đọc được trong phiên |

`downloadableNow=false` cho cả 8 nghĩa là chưa tải mới được từ BOOTH trong phiên này.
Cyber Blue vẫn có `hasSourceFile=true`; các item khác chỉ xác minh listing, không có binary.
Giá/Terms là snapshot quan sát, không phải xác nhận quyền pháp lý hay cam kết checkout thành công.
Các format ngoài Cyber Blue dựa vào listing; chưa inspect gói thật. Sweet Pop/Girly chỉ có Custom Item, không XWear/Unity.

Cross-Strap Pumps có hai listing gần trùng tên: [4473D 4297136](https://booth.pm/ja/items/4297136) hiện 10 màu, asset 300 JPY + license game riêng 5.000 JPY; [双葉くるみ 4011291](https://booth.pm/ja/items/4011291) hiện 15 màu, có sample watermark nhưng cấm phân phối model/commission. Không khớp chắc mô tả cũ “6 màu”; `sourceUrl=null`, giữ `blocked-source-identity`. Fluffy Gloves được đối chiếu bằng mô tả 4 màu; không dùng listing Fluffy VRChat gloves khác.

## Cyber Blue — source có thật, wearable mới chưa bắt đầu

Owner đã gửi ZIP trong chat cũ. Phiên này xác minh lại file 5.736.271 byte, SHA-256:
`4ef821492096d9facaf166fadb2f6f2c01b364571ac52b80cfb2c6f7cb883868`.
ZIP gồm `cyberbluetops` (8 entry), `cyberblueskirt` (7), `cyberblueshoes` (9); meta xác nhận Tops/Bottoms/Shoes.
Không có file GLB/VRM/FBX/XWear sẵn trong ZIP. Hồ sơ [source inspection](vita-wardrobe-cyber-blue-source-qa.md) đã chỉ ra template/texture không có mesh canonical/bind/weights độc lập.
V0.3 và V0.4 đều bị owner reject; V0.4 đã reject trên iPhone, giữ demo cũ để tham khảo.
`wearable3DStatus=source-verified` chỉ xác nhận nguồn; `exactOrApprox=unknown` cho wearable mục tiêu. Lịch sử V0.3/V0.4 vẫn là approximate/rejected.

## Phạm vi và bàn giao

SESSION 1 chỉ sửa manifest/catalog metadata/docs. Không thêm route/card UI mới, không chạy rigging/conversion.
Giữ nguyên Hair Studio, các demo tóc, base V1.1/face/identity, Wardrobe Lab và toàn bộ production runtime.
Không commit ZIP, texture hay mesh của creator. Không mua asset, không đăng nhập BOOTH, không thay đổi main/development.

Validation tối thiểu: parse JSON, kiểm tra 8 ID/field/status/URL và 3+5 phân loại; nạp catalog đã strip TypeScript để kiểm tra export; đối chiếu diff đúng phạm vi.
Không cần full build/Playwright vì không thay UI/runtime. Không claim iPhone PASS.

SESSION 2 đề xuất: **Cyber Blue wearable 3D first**.
Điều kiện đầu vào: ZIP đã có; xác minh workflow lấy mesh/UV/bind/weights phù hợp và quyền sử dụng/phát hành tương ứng trước khi triển khai.
Đây là đề xuất cho phiên khác; SESSION 1 kết thúc sau một commit/push.

