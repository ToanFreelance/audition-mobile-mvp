import bpy, sys, pathlib, json, hashlib
import numpy as np

r = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(r / "scripts"))
from identity import fingerprint

stem = "Vita-Style04-Golden-Hair-V12"


def sha(b):
    return hashlib.sha256(b).hexdigest()


def snap():
    face = bpy.data.objects["Face"]
    rig = bpy.data.objects["Armature"]
    s = fingerprint(face, rig)
    s["uv"] = sha(
        np.array(
            [l.uv[:] for l in face.data.uv_layers.active.data], dtype="<f4"
        ).tobytes()
    )

    def matdata(m):
        nt = m.node_tree
        nodes = []
        for n in nt.nodes:
            inputs = []
            for k in n.inputs:
                v = getattr(k, "default_value", None)
                if hasattr(v, "__len__") and not isinstance(v, str):
                    v = list(v)
                if isinstance(v, (type(None), str, int, float, list)):
                    inputs.append((k.name, v))
            im = getattr(n, "image", None)
            nodes.append(
                (
                    n.name,
                    n.type,
                    inputs,
                    sha(bytes(im.packed_file.data)) if im and im.packed_file else None,
                )
            )
        return [
            m.name,
            nodes,
            [
                (l.from_node.name, l.from_socket.name, l.to_node.name, l.to_socket.name)
                for l in nt.links
            ],
        ]

    s["faceMaterials"] = sha(
        json.dumps([matdata(m) for m in face.data.materials], sort_keys=True).encode()
    )
    return s
