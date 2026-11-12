"""Author sRGB base-color maps in Vita's existing UVs; retain native alpha coverage."""

from asset import *
from scipy.ndimage import gaussian_filter, maximum_filter


def mix(a, b, w):
    return a * (1 - w[..., None]) + np.asarray(b) * w[..., None]


def gaussian(x, y, cx, cy, rx, ry):
    return np.exp(-(((x - cx) / rx) ** 2) - ((y - cy) / ry) ** 2)


def gradient(value, stops, colors):
    return np.stack(
        [np.interp(value, stops, np.array(colors)[:, i]) for i in range(3)], axis=-1
    )


def paint(index, image):
    src = np.asarray(image).copy()
    rgb = src[:, :, :3].astype("float32")
    h, w = rgb.shape[:2]
    y, x = np.ogrid[:h, :w]
    u = x / (w - 1)
    v = y / (h - 1)
    if index == 11:
        # Reconstruct the skin gradient beneath the cyan decal using surrounding skin texels.
        mask = (rgb[:, :, 2] > rgb[:, :, 0] * 0.99) | (
            rgb[:, :, 1] > rgb[:, :, 0] * 0.995
        )
        mask = maximum_filter(mask, size=15)
        valid = (~mask).astype(float)
        repair = np.stack(
            [
                gaussian_filter(rgb[:, :, k] * valid, 24)
                / np.maximum(0.000001, gaussian_filter(valid, 24))
                for k in range(3)
            ],
            -1,
        )
        rgb = np.where(mask[:, :, None], repair, rgb)
        rgb = rgb * [0.985, 0.984, 1.012] + [3, 4, 5]
        blush = gaussian(abs(u - 0.5), v, 0.235, 0.662, 0.137, 0.054)
        rgb = mix(rgb, [228, 137, 151], 0.27 * blush)
        rgb = mix(
            rgb, [255, 222, 202], 0.25 * gaussian(u, v, 0.50, 0.637, 0.021, 0.049)
        )
        rgb = mix(rgb, [214, 140, 140], 0.28 * gaussian(u, v, 0.5, 0.675, 0.024, 0.010))
        # Painted cupid's bow and lower-lip glaze follow Vita's original mouth UV.
        width = (u - 0.5) / 0.050
        upper = gaussian(
            u,
            v,
            0.5,
            0.747 - 0.007 * np.exp(-(((abs(width) - 0.42) / 0.27) ** 2)),
            0.047,
            0.009,
        )
        lower = gaussian(u, v, 0.5, 0.758, 0.047, 0.011)
        rgb = mix(rgb, [178, 87, 105], upper * 0.46)
        rgb = mix(rgb, [220, 126, 142], lower * 0.40)
        rgb = mix(
            rgb, [255, 221, 205], gaussian(u, v, 0.505, 0.760, 0.023, 0.003) * 0.45
        )
    elif index == 9:
        # Each original iris island covers 1/2 of the atlas, highlights live on a separate mesh.
        cx = np.where(u < 0.5, 0.251, 0.749)
        dx = (u - cx) / 0.112
        dy = (v - 0.507) / 0.251
        radius = np.sqrt(dx * dx + dy * dy)
        angle = np.arctan2(dy, dx)
        value = np.clip(
            0.47 + 0.35 * dy + 0.18 * np.exp(-(((radius - 0.60) / 0.25) ** 2)), 0, 1
        )
        fibres = (
            np.sin(angle * 59 + radius * 10)
            + 0.5 * np.sin(angle * 97 - radius * 5)
            + 0.35 * np.sin(angle * 137 + radius * 11)
        ) / 1.85
        value = np.clip(
            value + 0.075 * fibres * np.exp(-(((radius - 0.66) / 0.26) ** 2)), 0, 1
        )
        col = gradient(
            value,
            [0, 0.26, 0.48, 0.72, 1],
            [
                [47, 31, 49],
                [99, 53, 49],
                [160, 89, 43],
                [236, 166, 62],
                [255, 221, 135],
            ],
        )
        col = mix(col, [66, 38, 48], np.clip((radius - 0.78) / 0.18, 0, 1) * 0.85)
        pr = np.sqrt((dx / 0.29) ** 2 + ((dy + 0.032) / 0.39) ** 2)
        col = mix(col, [48, 28, 43], np.clip((1.11 - pr) / 0.18, 0, 1))
        glint = np.exp(-((((dx + 0.30) / 0.115) ** 2 + ((dy + 0.32) / 0.13) ** 2) ** 2))
        small = np.exp(
            -((((dx - 0.29) / 0.065) ** 2 + ((dy - 0.39) / 0.061) ** 2) ** 2)
        )
        col = mix(col, [255, 247, 227], np.clip(0.99 * glint + 0.83 * small, 0, 1))
        crescent = np.exp(-(((radius - 0.72) / 0.045) ** 2)) * np.clip(
            (dy - 0.32) * 2.7, 0, 1
        )
        col = mix(col, [255, 219, 141], crescent * 0.59)
        rgb = np.where((v < 0.87)[..., None], col, rgb)
    elif index in (5, 7, 8):
        cols = {
            5: ([46, 31, 48], [91, 53, 66]),
            7: ([61, 37, 57], [110, 68, 83]),
            8: ([108, 77, 95], [151, 110, 127]),
        }[index]
        rgb = mix(
            np.array(cols[0]),
            cols[1],
            np.broadcast_to(np.clip(0.3 + v * 0.4, 0, 1), (h, w)),
        )
    elif index == 4:
        rgb = rgb * 0.44 + np.array([252, 243, 240]) * 0.56
    elif index == 10:
        rgb[:] = [255, 243, 220]
    elif index in (19, 22, 25):
        a = rgb[:, :, 0] / 255
        # A soft transverse reflection crosses the longitudinal pigment strands.
        wav = u + 0.017 * np.sin(6 * v + 0.5) + 0.009 * np.sin(9 * v - 1.2)
        fibres = (
            0.026 * np.sin(2 * np.pi * (wav * 28 + 0.31 * np.sin(v * 4)))
            + 0.014 * np.sin(wav * 2 * np.pi * 72)
            + 0.034 * np.sin(wav * 2 * np.pi * 6)
        )
        band = 0.205 * np.exp(
            -(((v - 0.38 - 0.065 * np.cos(u * 4.7)) / 0.119) ** 2)
        ) + 0.09 * np.exp(-(((v - 0.73 - 0.04 * np.sin(u * 7)) / 0.18) ** 2))
        t = np.clip(
            0.22
            + 0.31 * a
            + fibres
            + band
            + 0.10 * np.sin(np.pi * v)
            - 0.12 * (abs(u - 0.50) * 2) ** 2,
            0,
            1,
        )
        if index == 19:
            t = np.clip(0.26 + 0.31 * a, 0, 1)
        if index == 25:
            t = np.clip(t + 0.072, 0, 1)
        rgb = gradient(
            t,
            [0, 0.25, 0.48, 0.65, 0.82, 1],
            [
                [47, 38, 68],
                [77, 57, 96],
                [123, 95, 143],
                [161, 130, 174],
                [199, 169, 204],
                [234, 213, 230],
            ],
        )
    elif index in (15, 17, 18, 26):
        r, g, b = rgb.transpose(2, 0, 1)
        cool = (b > r * 1.05) | (g > r * 1.02)
        if index != 15:
            cool = np.ones((h, w), bool)
        l = (0.22 * r + 0.56 * g + 0.22 * b) / 255
        cloth = gradient(
            l,
            [0, 0.16, 0.35, 0.51, 0.67, 0.82, 1],
            [
                [29, 28, 47],
                [46, 40, 67],
                [77, 66, 101],
                [118, 97, 139],
                [166, 143, 178],
                [209, 182, 164],
                [251, 225, 178],
            ],
        )
        rgb = np.where(cool[:, :, None], cloth, rgb * [0.985, 0.984, 1.012] + [3, 4, 5])
    src[:, :, :3] = np.clip(rgb, 0, 255).astype("uint8")
    return Image.fromarray(src)


def apply(asset):
    j = asset.doc
    vrm = j["extensions"]["VRM"]
    for i in [4, 5, 7, 8, 9, 10, 11, 15, 17, 18, 19, 22, 25, 26]:
        asset.set_image(i, paint(i, asset.image(i)))
    for i, (m, v) in enumerate(zip(j["materials"], vrm["materialProperties"])):
        color = v["vectorProperties"]
        floating = v["floatProperties"]
        pbr = m["pbrMetallicRoughness"]
        color["_Color"] = [1, 1, 1, 1]
        pbr["baseColorFactor"] = [1, 1, 1, 1]
        hair = i >= 12
        skin = i in (7, 9)
        cloth = i in (10, 11)
        shade = (
            [0.67, 0.50, 0.75]
            if hair
            else [0.88, 0.71, 0.72]
            if skin
            else [0.75, 0.67, 0.82]
            if cloth
            else [0.87, 0.77, 0.77]
        )
        color["_ShadeColor"] = shade + [1]
        color["_EmissionColor"] = [0, 0, 0, 1]
        m["emissiveFactor"] = [0, 0, 0]
        v["textureProperties"]["_SphereAdd"] = 2
        floating.update(
            _ShadeShift=-0.31 if hair else -0.47,
            _ShadeToony=0.28 if hair else 0.16,
            _IndirectLightIntensity=0.12,
        )
        pbr["roughnessFactor"] = (
            0.49 if hair else 0.76 if skin else 0.55 if cloth else 0.65
        )
        if skin or hair or cloth:
            m.get("extensions", {}).pop("KHR_materials_unlit", None)
            if not m.get("extensions"):
                m.pop("extensions", None)
            if "normalTexture" in m:
                m["normalTexture"]["scale"] = 0.25 if skin else 0.40
            floating["_BumpScale"] = 0.25 if skin else 0.40
        if i in (2, 3, 4):
            color["_ShadeColor"] = [0.77, 0.63, 0.72, 1]
