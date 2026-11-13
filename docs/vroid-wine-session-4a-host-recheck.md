# Session 4A — tái kiểm chứng host Work

Ngày 2026-11-13, UTC. Kết quả: **BLOCKED tại Bước A**.

HEAD trước sửa được xác minh: `34ea0720aed3f5d7da40ee2d37529c91f9e1f77f`, trên nhánh `work/vita-wardrobe-tryon-poc-v1`. Giữ nguyên báo cáo/lịch sử trước đó; đây là phép đo mới, không phải chạy lại thành công VRoid.

## Môi trường thực đo

| Hạng mục | Kết quả |
| --- | --- |
| OS | Debian GNU/Linux 13.6 (trixie), x86_64 |
| CPU/RAM | nproc = 3; RAM nhìn thấy 9,7 GiB, khả dụng khoảng 9,3 GiB; swap 0 |
| Quyền ngoài sandbox | uid/gid 1000 (agent); CapEff = 0; không có sudo, không có /usr/local/bin/cloud-agent-packages; /usr và /var/lib/dpkg không writable |
| GPU | Ngoài sandbox cũng không tồn tại /dev/dri hoặc /dev/nvidia0 |
| OpenGL/Vulkan | Không có glxinfo/vulkaninfo trong PATH; có các thư viện Mesa DRI gồm swrast. Chưa đo được phiên bản API hoặc khả năng render; không kết luận software rendering bất khả thi |
| Phiên đồ họa | Không có DISPLAY, WAYLAND_DISPLAY, XDG_RUNTIME_DIR hoặc socket /tmp/.X11-unix ở shell; có Xorg. Work báo remote_desktop enabled=true, state=unknown; không có công cụ desktop js/CUA hoặc open_in_codex trong danh sách công cụ phiên này để đánh thức và kiểm tra UI |
| Đĩa/persistence | /workspace trên overlay khoảng 7,9 GiB, trống 7,5 GiB; ghi file task được. Chưa có bảo đảm giữ cài đặt/prefix qua lần thay host; Git remote lưu báo cáo |

Đã đọc kỹ năng cloud-environment-runtime, hướng dẫn packages/networking và cloud-desktop. environment_status xác nhận đúng executor của phiên, observations_current=true, network policy enforced/unrestricted. Không dùng trạng thái mạng để suy ra quyền cài đặt.

## Điểm dừng và bằng chứng

Đường dự kiến duy nhất: gói Debian qua installer được môi trường cấp quyền. Kiểm tra chỉ đọc ngoài sandbox xác nhận không có sudo/helper và không có quyền ghi hệ thống; dừng trước cài đặt theo yêu cầu. Không thử Wine portable, emulator khác hoặc thay cấu hình bảo mật. Việc chạy lệnh kiểm tra ngoài sandbox không cấp quyền root.

```text
$ id
uid=1000(agent) gid=1000(agent) groups=1000(agent)
$ command -v sudo wine wine64 glxinfo vulkaninfo
(không có kết quả)
$ ls -l /usr/local/bin/cloud-agent-packages /usr/bin/sudo
No such file or directory (cả hai đường dẫn)
$ test -w /usr; test -w /var/lib/dpkg
(cả hai không writable)
$ ls -l /dev/dri /dev/nvidia0 /tmp/.X11-unix
No such file or directory (cả ba đường dẫn)
$ cat /proc/self/status
CapEff: 0000000000000000
```

Log trên là trích kết quả kiểm tra của lần này; lệnh cài APT thất bại trong báo cáo trước thuộc lần trước, không được tính là lần thử mới. Clone repo trong sandbox thất bại do không nối được proxy; cùng thao tác ngoài sandbox thành công. Không có từ chối auto-review.

| Yêu cầu | Kết quả lần này |
| --- | --- |
| Wine version / cài đặt thành công | Không có phiên bản; không cài vì gate quyền thất bại |
| VRoid Studio exact version | Chưa tải/cài/chạy; 2.14.0 chỉ là phiên bản tác giả bên thứ ba được người dùng dẫn |
| UI editor render | Chưa kiểm thử |
| Tương tác nhân vật/preset | Chưa kiểm thử |
| MCP status, đổi preset, phục hồi | Chưa kiểm thử; không cài plugin |

Đây là blocker provisioning của host hiện tại, chưa phải bằng chứng VRoid không tương thích Wine. Cần provision Wine/dependency hợp lệ trước; UI và đồ họa vẫn phải được xác minh sau đó. Không coi chạy process là PASS, không giả định MCP export được VRM.

Tham chiếu do người dùng cung cấp (không kiểm chứng lại nội dung web trong lần này):

- https://vroid.com/en/studio
- https://github.com/brainrom/vroid-studio-mcp
- https://github.com/brainrom/vroid-studio-mcp/blob/master/docs/internal-api.md

Chỉ thêm tài liệu; không sửa runtime/model, không dùng Cyber Blue hoặc Vita production assets, không merge nhánh, không làm garment/Blender/OpenSew. Dừng B/C theo gate. Kiểm tra tài liệu bằng git diff --check và xác minh chỉ một file được thêm; không cần test ứng dụng cho thay đổi tài liệu.
