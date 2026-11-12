"""Chạy trong cảnh V1.2 sau khi chải guide. Giữ bề rộng, tiết diện và UV đã dựng."""

import bpy, numpy as np

mesh = bpy.data.objects["Style04_Cards"].data


def transfer():
    count = 0
    for o in bpy.context.scene.objects:
        if o.type != "CURVES" or "card_first" not in o.data.attributes:
            continue
        h = o.data
        count += len(h.curves)
        original = h.attributes["last_card_position"]
        for i, c in enumerate(h.curves):
            first = h.attributes["card_first"].data[i].value
            columns = h.attributes["card_columns"].data[i].value
            for j, p in enumerate(c.points):
                prior = original.data[p.index]
                delta = p.position - prior.vector
                if delta.length_squared:
                    for k in range(columns):
                        mesh.vertices[first + j * columns + k].co += delta
                    prior.vector = p.position
    mesh.update()
    return count


if __name__ == "__main__":
    print("Guides", transfer())
