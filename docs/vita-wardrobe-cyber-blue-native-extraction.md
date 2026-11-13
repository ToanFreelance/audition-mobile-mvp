# Cyber Blue native garment extraction — SESSION 3

Ngày: 2026-11-13 (Asia/Ho_Chi_Minh). **BLOCKED tại Step A.**
Nhánh `work/vita-wardrobe-tryon-poc-v1`; remote/local HEAD trước sửa: `676fb7d15fa0dc582c6bb1771919c9a1384229fc`. Working tree sạch; API không có PR cho nhánh.

## Chuẩn bị và nguồn thật

Đã đọc `PROJECT_INSTRUCTIONS.md`, [SESSION 2](vita-wardrobe-cyber-blue-top-v1.md), [source inspection](vita-wardrobe-cyber-blue-source-qa.md), hai script audit/probe. Không chạy lại voxel-remesh.

| File private hiện có | Byte | SHA-256 khớp trước/sau |
| --- | ---: | --- |
| Vita V1.1 GLB | 4.953.812 | `d422159770ee8e9fbc9d78f2f256d5ee988651373cbd211aaa99efd7ecf2bad8` |
| Cyber_Blue.zip | 5.736.271 | `4ef821492096d9facaf166fadb2f6f2c01b364571ac52b80cfb2c6f7cb883868` |
| Vita-Premium-Cute-V11.blend | 19.313.996 | `138a5b8321bd333e409340be321e483bdef6f2e6bebe5758bc8af6d4d75fed52` |

GLB thực có 1 skin/155 joints và `Street_Bomber_Pleats_Sneakers`. Top trong ZIP có 8 entry, group `TransferableGroupType.N00.Level1.Tops`: meta/transferables/group/base/thumbnail, không có garment GLB/VRM/FBX xuất sẵn.
Đã mở BLEND bằng Blender `--disable-autoexec -b`, chỉ đọc mesh/rig: `Vita_Suit` 6.423 vertex, rig 155 bones. Không save hoặc export.

## Step A — kiểm tra thực tế

| Công cụ/kiểm tra đã chạy | Quan sát |
| --- | --- |
| Python platform, /etc/os-release | Debian GNU/Linux 13.6, Linux x86_64 |
| CUA getState; Sky list_apps/list_windows | Inventory Linux truy cập được; có Blender; không có VRoid Studio hoặc cửa sổ VRoid |
| shutil.which trong PATH | Không có VRoidStudio, VRoidStudio.exe, vroidstudio |
| Runtime tương thích/VM trong PATH | Không có wine, wine64, proton, steam, qemu-system-x86_64, virsh, flatpak |
| Scan tên trong root cài đặt thông dụng, tối đa 4 tầng | Không thấy VRoid installer/executable trong /opt, /usr/bin, /usr/local/bin, desktop entries và thư mục download |
| /usr/bin/blender --version; đọc BLEND gốc | Blender 4.3.2 hoạt động và mở source thành công |
| Trang tải VRoid chính thức | Windows/macOS/iPad; không liệt kê bản Linux |

**Blocker:** không có executable VRoid Studio và không có runtime Windows/macOS được xác minh để chạy editor trên host này. Không có remote Windows/macOS editor session được công cụ hiện tại cung cấp.
Đây là giới hạn cấu hình đã kiểm tra, không phải khẳng định VRoid tuyệt đối không thể chạy bằng mọi cách trên Linux. Không suy ra thiếu GUI từ DISPLAY của shell: inventory CUA/Sky đã truy cập được.

| Thao tác native | Trạng thái thực tế |
| --- | --- |
| Khởi chạy VRoid Studio GUI | Chưa chạy: không tìm thấy executable |
| Import cyberbluetops.vroidcustomitem / Wear now | NOT RUN |
| Mặc top trên model VRoid tạm | NOT RUN |
| Export VRM/XWear | NOT RUN |
| Mở export mới trong Blender / tách top / đối chiếu rest-space | NOT RUN; Step B không bắt đầu |

Tài liệu chính thức xác nhận quy trình import custom item/xuất outfit thành XWear qua editor; không chứng minh editor hoạt động ở Work. Không có headless VRoid CLI nào được chạy/xác minh. Không tải/cài thử chuỗi Wine/Proton/VM, không dựng mesh thay thế.

## Kết quả và dependency tối thiểu

- Không trích xuất được native Cyber Blue top; không có bằng chứng mới về topology/UV/material/skinning native. 155 bones nêu trên thuộc Vita, không chứng nhận garment Cyber Blue.
- Không có garment inspection artifact mới. Probe approximate SESSION 2 vẫn bị reject, không được dùng làm output native.
- Cần một trong hai: môi trường Work/remote Windows hoặc macOS với VRoid Studio GUI hoạt động; hoặc một export VRM riêng tư, được phép, của avatar đang mặc đúng Cyber Blue top, giữ hood/sleeves/outer/inner layer, UV/material và skin. Top-only XWear chỉ đủ khi có đường import XWear được xác minh.
- Không yêu cầu owner thao tác desktop hay gửi lại các file nguồn đang có.
- Chỉ thêm hồ sơ này; không sửa asset/scripts/manifest/Lab/Hair Studio/Character Catalog/gameplay. Không commit binary/texture/ảnh hoặc deploy.
- Validation: inventory/PATH/OS, hash và đọc nguồn thực, Blender mở BLEND, đối chiếu nguồn chính thức, liên kết docs và git diff --check. Không có build/QA wearable/iPhone PASS.
- Dừng sau commit/push Step A và xác minh remote HEAD; không làm Step B hay phương án dựng khác.

## Nguồn chính thức đã đọc

- https://vroid.com/en/studio
- https://vroid.pixiv.help/hc/en-us/articles/900002217186-Operating-environment-requirements-required-specifications
- https://vroid.pixiv.help/hc/en-us/articles/7467455312409-How-to-import-and-export-custom-items
- https://vroid.pixiv.help/hc/en-us/articles/38729525846809-How-to-convert-costumes-and-accessories-made-in-VRoid-Studio-to-XWear
