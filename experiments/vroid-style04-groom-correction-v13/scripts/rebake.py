"""Đồng bộ từng mesh checkpoint với Geometry Nodes GBH hiện hành, giữ UV/rig."""

import bpy


def evaluated_mesh(obj):
    scene = bpy.context.scene
    data = bpy.data.meshes.new("GBH mesh reader")
    proxy = bpy.data.objects.new("GBH mesh reader", data)
    scene.collection.objects.link(proxy)
    group = bpy.data.node_groups.new("Temporary GBH mesh reader", "GeometryNodeTree")
    group.interface.new_socket(
        name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry"
    )
    info = group.nodes.new("GeometryNodeObjectInfo")
    info.inputs["Object"].default_value = obj
    group.links.new(
        info.outputs["Geometry"], group.nodes.new("NodeGroupOutput").inputs[0]
    )
    proxy.modifiers.new("Read GBH output", "NODES").node_group = group
    try:
        obj.data.update_tag()
        obj.update_tag()
        bpy.context.view_layer.update()
        deps = bpy.context.evaluated_depsgraph_get()
        return bpy.data.meshes.new_from_object(
            proxy.evaluated_get(deps), depsgraph=deps
        )
    finally:
        bpy.data.objects.remove(proxy, do_unlink=True)
        bpy.data.meshes.remove(data)
        bpy.data.node_groups.remove(group)


def rebake():
    coll = bpy.data.collections["STYLE04 V13 • Native Hair Curves"]
    hidden = coll.hide_viewport
    max_error = 0.0
    try:
        coll.hide_viewport = False
        for ob in bpy.data.collections["STYLE04 V13 • Export mesh"].objects:
            guide = bpy.data.objects[ob["sourceGroom"]]
            generated = evaluated_mesh(guide)
            try:
                if len(generated.vertices) != len(ob.data.vertices):
                    raise ValueError(
                        "Số điểm thay đổi, cần tạo lại UV tại " + guide.name
                    )
                for old, new in zip(ob.data.vertices, generated.vertices):
                    max_error = max(max_error, (old.co - new.co).length)
                    old.co = new.co
                ob.data.update()
            finally:
                bpy.data.meshes.remove(generated)
    finally:
        coll.hide_viewport = hidden
    return max_error * 1000


if __name__ == "__main__":
    print("Sai số đồng bộ GBH lớn nhất (mm)", rebake())
