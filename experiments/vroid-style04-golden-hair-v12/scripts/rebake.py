"""Cập nhật 178 card từ guide GBH hiện hành, giữ nguyên UV, rig và lớp lót.
Chạy trong Blender sau khi chỉnh guide. Bản đang mở chỉ được lưu khi người dùng chọn Save.
"""

import bpy
import numpy as np


def rebake():
    collection = bpy.data.collections["STYLE04 • GBH live regions"]
    mesh = bpy.data.objects["Style04_Cards"].data
    attributes = mesh.attributes
    ids = np.array([a.value for a in attributes["style04_batch"].data])
    indexes = np.array([a.value for a in attributes["style04_index"].data])
    before = np.array([v.co[:] for v in mesh.vertices], dtype="f")
    output = before.copy()
    was_hidden = collection.hide_viewport
    group = bpy.data.node_groups.new("Đọc mesh từ GBH", "GeometryNodeTree")
    group.interface.new_socket(
        name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry"
    )
    info = group.nodes.new("GeometryNodeObjectInfo")
    group.links.new(
        info.outputs["Geometry"], group.nodes.new("NodeGroupOutput").inputs[0]
    )
    data = bpy.data.meshes.new("Trung gian")
    proxy = bpy.data.objects.new("Trung gian", data)
    bpy.context.scene.collection.objects.link(proxy)
    proxy.modifiers.new("Đọc GBH", "NODES").node_group = group
    try:
        collection.hide_viewport = False
        for obj in collection.objects:
            if "style04Batch" not in obj:
                continue
            sel = ids == obj["style04Batch"]
            info.inputs["Object"].default_value = obj
            bpy.context.view_layer.update()
            evaluated = proxy.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
            coords = np.array([v.co[:] for v in evaluated.vertices], dtype="f")
            if len(coords) != np.count_nonzero(sel):
                raise ValueError(
                    "Số đỉnh đã thay đổi. Cần tạo lại UV cho nhóm " + obj.name
                )
            output[sel] = coords[indexes[sel]]
        mesh.vertices.foreach_set("co", output.ravel())
        mesh.update()
    finally:
        bpy.data.objects.remove(proxy, do_unlink=True)
        bpy.data.meshes.remove(data)
        bpy.data.node_groups.remove(group)
        collection.hide_viewport = was_hidden
    return float(np.linalg.norm(output - before, axis=1).max()) * 1000


if __name__ == "__main__":
    print("Độ dịch lớn nhất của mesh xuất (mm)", rebake())
