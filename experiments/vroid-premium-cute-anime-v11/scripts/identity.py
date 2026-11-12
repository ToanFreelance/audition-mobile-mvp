import hashlib
import numpy as np


def fingerprint(face, rig):
    m = face.data

    def digest(x):
        return hashlib.sha256(x).hexdigest()

    def xyz(a):
        return np.array([v.co[:] for v in a], dtype="<f4").tobytes()

    vt = rig.data.vrm_addon_extension.vrm0
    return dict(
        vertices=digest(xyz(m.vertices)),
        topology=digest(
            np.array([l.vertex_index for l in m.loops], dtype="<u4").tobytes()
        ),
        keys={k.name: digest(xyz(k.data)) for k in m.shape_keys.key_blocks},
        weights=digest(
            repr(
                [
                    [(face.vertex_groups[g.group].name, g.weight) for g in v.groups]
                    for v in m.vertices
                ]
            ).encode()
        ),
        skeleton=digest(
            repr(
                [
                    (
                        b.name,
                        b.parent.name if b.parent else "",
                        tuple(b.head_local),
                        tuple(b.tail_local),
                        list(map(tuple, b.matrix_local)),
                    )
                    for b in rig.data.bones
                ]
            ).encode()
        ),
        humanoid={
            b.bone: b.node.bone_name
            for b in vt.humanoid.human_bones
            if b.node.bone_name
        },
        expressions={
            g.name: [(b.mesh.mesh_object_name, b.index, b.weight) for b in g.binds]
            for g in vt.blend_shape_master.blend_shape_groups
        },
        springs=[
            (g.center.bone_name, [b.bone_name for b in g.bones])
            for g in vt.secondary_animation.bone_groups
        ],
    )
