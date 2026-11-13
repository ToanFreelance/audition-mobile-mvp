# SESSION 4A — Wine + VRoid Studio capability gate

Ngày: 2026-11-13 (Asia/Ho_Chi_Minh). **BLOCKED tại Step A: đường cài gói hệ thống không có quyền thực thi.**
Repository: ToanFreelance/audition-mobile-mvp; nhánh work/vita-wardrobe-tryon-poc-v1.
Remote HEAD trước sửa: `42b45c9b9453c93494365566498a4bd22d9115ca`, đúng owner chỉ định. PR API trả danh sách rỗng.
Checkout cũ tại local sạch nhưng ở `23c3bfca155dcbedcc45be5a43c8fbfe897788f1`; commit báo cáo được tạo trên tree remote 42b45c9, bảo toàn commit nghiên cứu mới hơn.

## Gate môi trường thực đo

| Hạng mục | Kết quả |
| --- | --- |
| OS/kiến trúc | Debian GNU/Linux 13.6 (trixie), kernel 6.18.57, x86_64 |
| Quyền | uid/gid 1000; /usr, /usr/bin, /var/lib/dpkg, /var/lib/apt/lists không writable |
| Installer được cấp quyền | Không có sudo; không có /usr/local/bin/cloud-agent-packages; không có tool environment_status/request_changes được expose |
| CPU/RAM | nproc và CPU affinity đều 9; RAM host nhìn thấy 9,7 GiB, available 9,1 GiB, swap 0. Không coi là cam kết quota lâu dài |
| Dung lượng | /workspace overlay 63 GiB, khoảng 60 GiB còn trống; /tmp tmpfs 4,9 GiB |
| GPU phần cứng | Không có /dev/dri hoặc /dev/nvidia0 trong executor |
| OpenGL/Vulkan | Có libGLX/libEGL Mesa, libvulkan.so.1 và Mesa DRI gồm swrast; không có glxinfo/vulkaninfo; không có ICD trong các thư mục Vulkan đã kiểm tra. Chưa đo được GL/Vulkan version hoặc render thành công; không khẳng định software rendering bất khả thi |
| GUI | CUA getState trả inventory Linux và Chrome, không có VRoid/Wine hoặc cửa sổ đang mở. Shell không có DISPLAY/socket X11; không dùng điều này để phủ nhận GUI do CUA quản lý |
| Wine | wine/wine64 không có trong PATH; chưa có phiên bản được cài/chạy |
| Workspace | Thư mục task writable nhưng là scratch có thể bị xóa. Không có capability lưu thay đổi vào base image được xác minh; không đảm bảo giữ Wine/prefix giữa các phiên. Báo cáo/log được lưu bằng Git |

## Một đường cài đặt được thử

Chỉ thử đường gói Debian/APT, không emulator/add-on khác. Đã đọc hướng dẫn cài gói của môi trường trước thao tác.
`apt-get --simulate install wine64` báo không tìm thấy gói trong metadata hiện tại.
`apt-get install -y wine64` thất bại, exit code **100**: không mở được dpkg frontend lock, yêu cầu root. `sudo -n -l` thất bại vì sudo không tồn tại.
Log đã khử hostname và không chứa credentials: [vroid-wine-gate-session-4a.log](qa/vroid-wine-gate-session-4a.log).
Không sửa sudo/security/permissions, không escalation, không thêm nguồn package, không cài nhiều đường thay thế. Không tải installer VRoid khi gate môi trường đã fail.

## Trạng thái B/C

| Kết quả yêu cầu | Trạng thái |
| --- | --- |
| Wine version / cài thành công | N/A — chưa cài được |
| VRoid exact installed/running version | N/A — chưa tải/cài/khởi chạy |
| VRoid UI thật render | NOT RUN |
| Character/preset interaction | NOT RUN |
| MCP kết nối/status/preset/restore | NOT RUN; không cài plugin, không mở endpoint |
| Export VRM / garment / GLB | Không thực hiện; ngoài phạm vi gate này |

Đã đọc website chính thức và README/internal-api của brainrom/vroid-studio-mcp. Tác giả ghi VRoid 2.14.0, Unity 6000.0.62f1, Wine 11.18 và BepInEx Unity IL2CPP 6.0.0-be.788; đây là môi trường tác giả, **không phải version đã chạy trong Work**. Internal API ghi VRM export chưa expose/implemented qua command/MCP. Không dùng báo cáo bên thứ ba làm PASS cho host này.

## Kết luận và đầu vào còn thiếu

**BLOCKED do provisioning/quyền cài đặt trong cấu hình hiện tại**, không phải đã chứng minh VRoid crash hoặc không tương thích với Wine.
Cần host có Wine và dependency được provision sẵn, hoặc installer được cấp quyền hợp lệ; sau đó vẫn phải xác minh GL/Vulkan/GUI thực sự render trước khi đánh giá editor/MCP. Không thay bảo mật để vượt gate.
Không dùng Cyber Blue ZIP, Vita private/production assets; không mở hoặc chỉnh model. Không sửa application/runtime/manifest, không merge/deploy, không OpenSew/Blender garment work.
Chỉ thêm báo cáo và log. Validation: đọc lại nội dung/log, kiểm tra liên kết và whitespace; xác minh diff chỉ hai file, commit/push fast-forward có expected SHA, đọc lại remote HEAD.
Dừng SESSION 4A sau checkpoint; không thực hiện Step B/C khi Step A chưa đạt.

Nguồn nghiên cứu:
- https://vroid.com/en/studio
- https://github.com/brainrom/vroid-studio-mcp
- https://github.com/brainrom/vroid-studio-mcp/blob/master/docs/internal-api.md
