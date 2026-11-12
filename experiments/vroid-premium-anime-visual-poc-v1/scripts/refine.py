"""Smooth rest-space deformation, applied also to posed coordinates and normals."""

from asset import *


def smooth(x):
    t = np.clip(x, 0, 1)
    return t * t * (3 - 2 * t)


def deform(p):
    x, h, z = p.T
    x = x - 0.00042066
    side = np.sign(x)
    ax = np.abs(x)
    near = smooth((0.008 - z) / 0.04)
    # Keep the transform differentiable across face/eye islands and fade above the brows.
    eye = (
        smooth((ax - 0.002) / 0.018)
        * smooth((0.107 - ax) / 0.022)
        * smooth((h - 1.481) / 0.022)
        * smooth((1.572 - h) / 0.021)
        * near
    )
    dx = -0.070 * (ax - 0.043) * side * eye
    dh = (-0.155 * (h - 1.5255) + 0.035 * (ax - 0.043)) * eye
    lower = np.exp(-(((h - 1.477) / 0.034) ** 2)) * near
    dx -= 0.052 * x * lower
    dh -= 0.0043 * np.exp(-(((h - 1.434) / 0.027) ** 2)) * near
    mouth = np.exp(-(((h - 1.469) / 0.014) ** 2) - (ax / 0.034) ** 4) * near
    dx += 0.075 * x * mouth
    dh += 0.0019 * (ax / 0.025) ** 1.5 * mouth
    dz = -0.0018 * np.exp(-((x / 0.015) ** 2) - ((h - 1.501) / 0.024) ** 2) * near
    dz -= 0.00075 * mouth
    return p + np.column_stack([dx, dh, dz])


def normals(p, n):
    eps = 0.000015
    jac = np.stack(
        [(deform(p + e) - deform(p - e)) / (2 * eps) for e in np.eye(3) * eps], axis=2
    )
    raw = np.linalg.solve(jac.transpose(0, 2, 1), n[:, :, None])[:, :, 0]
    return raw / np.maximum(np.linalg.norm(raw, axis=1, keepdims=True), 1e-9)


def apply(asset):
    prim = asset.doc["meshes"][0]["primitives"][0]
    a = prim["attributes"]
    base = asset.array(a["POSITION"]).astype(float)
    norm = asset.array(a["NORMAL"]).astype(float)
    dest = deform(base)
    new_norm = normals(base, norm)

    def write(i, v):
        buf = asset.array(i)
        buf[:] = v
        ac = asset.doc["accessors"][i]
        if "min" in ac:
            ac["min"] = buf.min(0).tolist()
            ac["max"] = buf.max(0).tolist()

    for target in prim["targets"]:
        key = base + asset.array(target["POSITION"])
        delta = deform(key) - dest
        write(target["POSITION"], delta)
        if "NORMAL" in target:
            n = norm + asset.array(target["NORMAL"])
            write(target["NORMAL"], normals(key, n) - new_norm)
    write(a["POSITION"], dest)
    write(a["NORMAL"], new_norm)
    return dict(
        verts=len(base),
        morphs=len(prim["targets"]),
        max_mm=float(np.linalg.norm(dest - base, axis=1).max() * 1000),
    )
