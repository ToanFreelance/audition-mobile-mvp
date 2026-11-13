# SESSION 4A.1 — Wine rootless và gate đồ họa

Ngày 2026-11-13 (UTC). **BLOCKED tại Bước B: wineserver không tạo được socket trong môi trường thực thi lệnh.** Không cài VRoid.

Nhánh: `work/vita-wardrobe-tryon-poc-v1`. Remote HEAD trước sửa là `5939fbe6a9be18d6155acb214c11604e7c17a5c4`, mới hơn HEAD owner cung cấp `34ea0720aed3f5d7da40ee2d37529c91f9e1f77f`; đã cập nhật checkout bằng fast-forward và giữ nguyên commit mới. Working tree ban đầu sạch; API PR đang mở cho nhánh trả danh sách rỗng. Đã đọc Project Instructions và hai báo cáo 4A trước đó. Phiên này chỉ thêm tài liệu.

## A — Kiểm kê rootless

| Hạng mục | Kết quả thực đo |
| --- | --- |
| OS/quyền | Debian 13.6 (trixie), x86_64, kernel 6.18.57; uid 1000, CapEff = 0; glibc 2.41, bản Debian `2.41-12+deb13u4` |
| Workspace | Ghi/chmod/chạy script user thành công, exit 0; khoảng 59 GiB trống trước tải. Không có bảo đảm giữ thư mục/prefix qua lần thay host |
| Công cụ | dpkg-deb 1.22.22 (amd64); GNU tar 1.35; curl 8.14.1; GNU Wget 1.25.0; có file/readelf/ldd |
| X11 | Có Xorg wrapper, xdpyinfo, xauth và libX11/Xext/Xrandr/Xi/Xrender/xcb/SM/ICE. Không có Xvfb/Xwayland trong PATH; chưa đo phiên bản X server |
| Display của shell | DISPLAY/WAYLAND_DISPLAY không được đặt; không thấy `/tmp/.X11-unix` trong môi trường lệnh |
| Display qua CUA | Mở được Xfce Terminal; quan sát trực tiếp cửa sổ và nội dung terminal. `echo $DISPLAY` trên terminal trả `:0`. CUA có GUI thật; không đồng nghĩa shell có kết nối tới display đó |
| Mesa/OpenGL | Có libGL/libGLX/libEGL Mesa và các DRI, gồm `swrast_dri.so`, `kms_swrast_dri.so`. Không có glxinfo/eglinfo; chưa xác định phiên bản Mesa, OpenGL hoặc renderer thực tế. Metadata dpkg của các thư viện được hỏi không trả phiên bản |
| Vulkan/GPU | Có `libvulkan.so.1`; không thấy ICD trong `/usr/share/vulkan/icd.d` và `/etc/vulkan/icd.d`; không có vulkaninfo hoặc `/dev/dri`. Chưa đo Vulkan API; không coi việc có loader là render được |
| AppImage/FUSE | Không có `/dev/fuse`; có fusermount/fusermount3 nhưng không có unsquashfs. Runtime AppImage đã chọn là ELF x86_64 liên kết tĩnh; giải nén bằng `--appimage-extract` thành công, exit 0, không cần FUSE |

Không chạy APT/sudo, không nâng quyền, không ghi `/usr`, không thay cấu hình bảo mật. Bước A cho phép thử một gói trong thư mục user; chưa phải PASS cho đồ họa.

## B — Một gói portable duy nhất

Nguồn: [PerseidLab/proton-appimage](https://github.com/PerseidLab/proton-appimage), dự án đóng gói cộng đồng, không phải bản phát hành chính thức của Wine/VRoid. Đã đọc README, AppRun và workflow build tại tree `76502e224475b21e51588469035d41001f8e5bd2` trước khi chạy. Workflow đóng gói archive Proton-GE; release ghi nguồn từ `GloriousEggroll/proton-ge-custom`. Không chạy installer script, AppRun hoặc chức năng tích hợp MIME/desktop; chỉ giải nén và gọi Wine đi kèm.

| Thuộc tính | Giá trị |
| --- | --- |
| Release | [GE-Proton11-12-x86_64](https://github.com/PerseidLab/proton-appimage/releases/tag/GE-Proton11-12-x86_64) |
| Asset | `GE-Proton11-12-x86_64-standalone.AppImage`, 497.578.296 byte |
| SHA-256 tải về | `f66283567d025534b32ec10abcd54a8e4177a99cb6d2cb5dce6797683e29c9c0`; khớp digest GitHub release API, không phải xác minh chữ ký độc lập |
| Payload version | `1793687165 GE-Proton11-12` |
| Thư mục thử | `/workspace/scratch/dbcd998af236/rootless-wine-gate/`, ngoài Git repository |
| Dependency ELF | ldd của wine/wineserver x86_64 giải được libc và loader. ntdll.so/win32u.so có trong payload; đường dẫn thư viện của payload được truyền riêng cho phép thử |
| `wine --version` | Exit 0: `wine-11.0 (Staging)` |
| Windows builtin | `cmd /c echo ROOTLESS_WINE_BUILTIN_OK`: exit 1, chưa thực thi được lệnh Windows |
| Cửa sổ Wine | Chưa thử sau blocker; terminal Linux render được không phải bằng chứng Wine GUI |

Phép thử dùng prefix riêng, WINEDLLPATH/LD_LIBRARY_PATH trỏ vào payload, `WINEDEBUG=-all` và `WINEDLLOVERRIDES='mscoree,mshtml='` để không yêu cầu Gecko/Mono. Kết quả nguyên văn:

```text
$ <payload>/files/bin/wine --version
wine-11.0 (Staging)
[exit 0]

$ <payload>/files/bin/wine cmd /c "echo ROOTLESS_WINE_BUILTIN_OK"
wine: created the configuration directory '/workspace/scratch/dbcd998af236/rootless-wine-gate/prefix'
wineserver: socket: Operation not permitted
[exit 1]
```

Đây là lỗi quyền/capability tạo socket do wineserver báo, không phải thông báo thiếu `.so`. Chưa truy vết syscall để kết luận chính sách hoặc loại socket cụ thể. Không có tên thư viện thiếu nào được xác nhận là nguyên nhân của lỗi này. Dừng ngay tại blocker, không thử chạy ngoài sandbox, không thay quyền và không tải thêm dependency hay bản Wine khác.

## C — Không thực hiện do B chưa đạt

| Tiêu chí | Trạng thái |
| --- | --- |
| OpenGL version / renderer name | Chưa đo |
| Vulkan render | Chưa đo; không thấy ICD trong môi trường lệnh |
| llvmpipe / software rendering | Chưa xác minh; có swrast không chứng minh llvmpipe đang chạy |
| Hardware acceleration | Không có GPU device được expose trong môi trường lệnh |
| Cửa sổ Linux / Wine / 3D | Linux terminal quan sát được; Wine chưa chạy được builtin; 3D chưa thử |
| Xvfb user-local | Không tải/cài vì đã gặp blocker wineserver; chưa có bằng chứng Xvfb khắc phục được lỗi này |

## Kết luận và dependency tối thiểu cho lần sau

**BLOCKED.** Rootless extraction và Wine version đã thành công, tiến xa hơn gate APT của phiên trước; thực thi Windows chưa thành công. Chưa đáng tải/cài VRoid trên đường chạy hiện tại. Cần môi trường thực thi được quản trị cấp khả năng IPC/socket mà wineserver yêu cầu, đồng thời có kết nối display quan sát được; sau đó xác minh builtin và renderer thực tế trước khi cân nhắc VRoid. Không yêu cầu owner vận hành desktop và không đề nghị bypass bảo mật.

Chỉ thêm báo cáo này; không commit AppImage/prefix/asset, không đổi runtime/model/catalog, không dùng Vita/Cyber Blue, không MCP/Blender garment, không merge hoặc deploy. Validation tài liệu: `git diff --check`, kiểm tra diff chỉ một file trong docs; sau cập nhật ref đọc lại remote HEAD và diff từ commit gốc. Không chạy build ứng dụng cho thay đổi tài liệu. Dừng SESSION 4A.1 tại checkpoint này.
