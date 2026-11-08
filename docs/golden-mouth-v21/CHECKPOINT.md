# V2.1 — checkpoint thử nghiệm, chưa visual acceptance

Baseline b9be09dfee1de8203bd1edfa9c4629ec2d7596b4. Chẩn đoán đã commit tại
 e3a415df1a5f8b9e9060c6fa9417d1b9f6d5e5c6. PR #26 giữ Draft, không merge.
Blender `/usr/bin/blender` 4.3.2; Cycles CPU, 8 threads, không denoise.
GLB SHA-256 b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90.
V2 gốc nguyên vẹn: Library libfile_8c7edd0bc63c8191880baca7a6cb33a7;
SHA .blend ab955143c51caaf5ecbd9d5a509660c619687e53a40828633e476ebbb0b26ca5.

Lệnh tái tạo lượt mới nhất:
```
blender --background --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v21/refine_m01.py -- \
 --checkpoint /path/M01-Native-V2-Iteration-02.blend \
 --output /path/iteration-04 --iteration 4 --render mouth clay left35 right35
```

Mỗi lượt bắt đầu từ đúng V2 iteration 2, tạo key mới bên cạnh Basis và V2.
Không cộng dồn biến dạng của lượt thất bại. Vertex groups mô tả các vùng sửa.

- V21 iteration 01: FAIL, graph trên đỉnh split UV + averaging không bảo toàn
  độ dốc gây gợn; 55 tam giác đổi hướng >90°. Đã loại khỏi tích hợp.
  .blend đã lưu: libfile_28d3f447e6048191bf34a22493b56fe7.
- V21 iteration 02: FAIL, virtual weld giữ vertex IDs nhưng averaging còn gây
  gợn và seam pin chưa khóa đúng; 8 tam giác đổi hướng. Script lưu riêng rejected_graph_iteration02.py.
- V21 iteration 03: 0 tam giác đảo; chuyển sang local quadratic relaxation
  theo vị trí thực để không lệch bởi mật độ tessellation. Vẫn FAIL mỹ thuật vì
  vùng đỡ bị kéo và đường chuyển tiếp rõ. Script lưu rejected_curvature_iteration03.py.
- V21 iteration 04: giữ nguyên tọa độ má V2, sửa roll nhỏ hơn, chỉ relaxation
  ngoài khóe; đang đánh giá, chưa cho phép runtime.

Không thay route public, V8 hay module gameplay. Chưa chạy WebGL2 V2.1.
Các file .blend không commit; script + validation + ảnh vừa phải commit trên work branch.

Iteration 02 .blend: libfile_b4041c35f5f4819197fa25cc7a664a4f.
Iteration 03 .blend: libfile_eb7709f2d1b48191ae8f1948037dc2af.
Cả hai đã lưu thành công; không dùng làm baseline của lượt sau.
Iteration 04: 292645 vertices / 499762 triangles, 0 tam giác đổi hướng >90°,
5132 đỉnh khác V2, 6025 khác Basis; UV/connectivity giữ nguyên.
Hiện tại cần hoàn tất sáu góc với V8 trước quyết định gate cuối.

Xuất mesh V8 để render Cycles (đây KHÔNG phải kiểm thử WebGL2):
```
node scripts/golden-mouth-v2/export_comparison.mjs source.glb /path/three.module.js \
 /path/iteration-04/m01-native.json.gz /path/v21/comparison-runtime
cp /path/v21/comparison-runtime/v2.json /path/v21/comparison-runtime/v21.json
ln -s /path/iteration-04/M01-Native-V21-Iteration-04.blend /path/v21/checkpoint.blend
blender --background --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v21/render_comparison.py -- /path/v21 \
 v21:front v21:left35 v21:right35 v21:profile v21:mouth v21:clay
```
