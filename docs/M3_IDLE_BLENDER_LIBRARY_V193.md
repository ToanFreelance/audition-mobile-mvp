# M3 V1.9.3 — thư viện chín động tác Blender

Trạng thái checkpoint: **đã bake 9/9, đang sửa hình ảnh và kiểm tra; chưa nghiệm thu**.
Baseline Git: `4279d57cce5d0dab6d05882c890f69cd5e6706a5` (V1.9.2). Chỉ làm trên
`work/m3-waiting-room-integration-v1`, không merge. Không thay RoomState, CAS,
Realtime, Ready/Start/preload, WebAudio, gauge hoặc timeline gameplay.

Nguồn chính: video chủ sở hữu 910×512, 30 Hz, 2677 hình, SHA-256
`863d368b02d0b3b5280fdba15befd73f0eb98139ed189d80118eb3d53c7e9bdb`.
Đã xem 22 hình phân bố hết mỗi đoạn và các mốc diễn xuất; các hình này là mẫu
để dựng, không phải tập kiểm định độc lập. Tracking/ước lượng 3D V191 không được
đưa vào toolchain Blender. Độ sâu bị khuất vẫn là quyết định dựng hình có kiểm tra.

| Clip | Hình nguồn, bao gồm hai đầu | Thời lượng | Rig | Diễn xuất quan sát / giới hạn |
|---|---|---:|---|---|
| F01 | 0–312 | 313/30 s | Drophunter | Tay trái từ eo lên mở lòng bàn tay, xoay thân, đổi chân rồi trở về; bỏ cặp sách |
| F02 | 348–759 | 412/30 s | Drophunter | Giữ tay phải thấp; tay trái giơ ngắn rồi hạ, nghiêng đầu; bỏ vũ khí |
| F03 | 768–997 | 230/30 s | Drophunter | Dáng thấp rộng, thu chân, vươn thân và hai tay gần tai, quay về dáng thấp |
| F04 | 1020–1251 | 232/30 s | Drophunter | Thu chân, tay trái về ngực, nhìn chếch xuống, mở lại dáng; bỏ vũ khí |
| F05 | 1287–1593 | 307/30 s | Drophunter | Dáng chân hẹp có chiều sâu, xoay thân và đầu chậm; tay trước eo; áo/kiếm che các khớp |
| M01 | 1611–1944 | 334/30 s | Neurohacker | Gục ngủ, cúi cổ/lưng với nhịp thở nhẹ, tỉnh và hồi phục |
| M02 | 1980–2160 | 181/30 s | Neurohacker | Vai/tay trái nâng, tay phải bên eo, chuyển thân và hất đầu; diễn giải không đạo cụ từ gấu |
| X01 | 2198–2440 | 243/30 s | Neurohacker | Tay trái thu ngang eo rồi gần má, đổi hướng đầu/thân; bỏ vũ khí lớn |
| M03 | 2466–2659 | 194/30 s | Neurohacker | Chân so le hẹp, tay trái gần sau hông, tay phải lên trước ngực rồi mở ra |

X01 giữ **mapping kỹ thuật hiện có**, không suy ra giới tính nguồn từ tên hay hình.
Cử chỉ có thể retarget sang Neurohacker, nhưng mức phù hợp phong cách phải được
chủ sở hữu duyệt bằng video. Không tự chuyển pool. M02 chỉ tái dựng nhịp diễn xuất
và bộ phận nhìn thấy; không khẳng định khớp người bên trong bộ đồ gấu.

## Nguồn dựng có thể phục hồi

`scripts/m3-idle/poses_v193.py`: các key toàn thân bằng tay, mốc tiếp đất và
hướng tay theo nhịp nguồn. `blender_library_v193.py`: nhập sáu mesh VRM thật mỗi
rig, 4 IK không kéo giãn, giới hạn khớp/gối/khuỷu, FK hông/lưng/cổ/đầu, bake
quaternion địa phương 30 Hz và xuất rig-map. Không cần MediaPipe.

```sh
blender -b -t 4 -P scripts/m3-idle/blender_library_v193.py -- \
  --assets /private/m3-cache --output /private/v193 --render keys
```

Mỗi thư mục clip có `.blend` đóng gói texture, JSON bake, manifest gồm hash từng
asset, rig-map, pivots từng hình và ảnh front/side. Drophunter có 198 bones/60
tracks; Neurohacker thực tế có 102 bones/50 tracks, không giả định cùng skeleton.
Source video, model và texture riêng tư không đưa vào Git.

## Các cổng đang mở tại checkpoint

- Đã chạy Blender 4.3.2 thực tế cho đủ chín clip; chưa gọi đây là chất lượng đạt.
- Lượt bake đầu F01 có khoảng 9.85 mm lệch chân khi trụ vì dịch hông mới vượt tầm
  chân không kéo giãn. Cần chỉnh pose, không sửa bằng IK runtime đè lên clip.
- Phải hoàn tất render 30 FPS đủ thời lượng, BVH mesh/quần áo/chuyển clip,
  so sánh trước/sau, UI năm người, CI và Preview trước báo cáo cuối.
