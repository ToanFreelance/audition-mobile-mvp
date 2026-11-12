"""Atlas pigment/alpha de huit mèches, peint dans l'espace longitudinal de la fibre."""

from pathlib import Path
import numpy as np
from PIL import Image

r = Path(__file__).resolve().parents[1]
rng = np.random.default_rng(41501)
w, h = 256, 1024
x = np.linspace(0, 1, w)[None, :]
v = np.linspace(0, 1, h)[:, None]
tiles = []
for tile in range(8):
    phase = rng.uniform(0, 6)
    # Smoothly pull sub-bundles apart at the tip, keeping broad roots opaque.
    u = (
        x
        + 0.014 * np.sin(v * 7 + phase)
        + 0.012 * np.sin(v * 10 + x * 13 + phase) * v**2
    )
    thread = np.zeros((h, w))
    macro = 0
    for freq, gain in [
        (2.1, 6.8),
        (5.2, 5.8),
        (13, 4.3),
        (29, 2.5),
        (67, 1.6),
        (108, 1.4),
    ]:
        macro += gain * np.sin(
            2 * np.pi * (u * freq + 0.07 * np.sin(v * 8 + phase)) + rng.uniform(0, 6)
        )
    for i in range(74):
        c = (i + rng.uniform(-0.29, 0.29)) / 73
        center = c + 0.004 * np.sin(v * rng.uniform(3, 10) + rng.uniform(0, 6))
        thread += rng.uniform(-11, 12) * np.exp(
            -(((u - center) / rng.uniform(0.0012, 0.0045)) ** 2)
        )
    light = (
        56
        * np.exp(-(((v - (0.36 + 0.040 * np.sin(4 * u + phase))) / 0.090) ** 2))
        * (0.61 + 0.39 * np.cos(u * 5 + phase) ** 2)
        + 9 * np.exp(-(((v - 0.395 - 0.03 * np.sin(4 * u + phase)) / 0.024) ** 2))
        + 7 * np.exp(-(((v - 0.73) / 0.19) ** 2))
        - 24 * (1 - v) ** 4
    )
    band = macro + thread + light - (22 if tile == 0 else 0)
    band += 6 * np.sin(u * 10 + phase) * v - 9 * v**3
    rgb = np.stack(
        [
            np.broadcast_to(c + band * k + v * e, (h, w))
            for c, k, e in [(124, 1.04, 36), (85, 0.85, 27), (127, 1.05, 32)]
        ],
        axis=-1,
    )
    lengths = (
        0.73
        + 0.23 * (np.sin(u * 8 + phase) * 0.5 + 0.5)
        + 0.07 * np.sin(u * 25 + phase) ** 2
        + 0.026 * np.cos(u * 83) ** 2
    )
    alpha = np.clip((lengths - v) * 75 + 0.5, 0, 1) * np.clip(
        np.minimum(u - 0.015, 0.985 - u) * 24, 0, 1
    )
    channels = np.sin(2 * np.pi * (u * (4 + (tile % 3)) + 0.16 * np.sin(v * 5 + phase)))
    threshold = np.clip((v - 0.61) * 1.6, 0, 0.66)
    alpha *= np.clip((channels + 1.02 - threshold) * 9, 0, 1)
    alpha *= np.clip((0.99 - v) * 80, 0, 1)
    tiles.append(np.uint8(np.clip(np.dstack([rgb, alpha * 255]), 0, 255)))
Image.fromarray(np.concatenate(tiles, axis=1)).save(r / "review/Style04-silk.png")
