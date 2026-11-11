"""Directional hair atlas, eight independently seeded bundles, RGBA."""

from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
rng = np.random.default_rng(4104)
h, w = 1024, 256
u = np.linspace(0, 1, w)[None, :]
t = np.linspace(0, 1, h)[:, None]
tiles = []
for tile in range(8):
    carrier = u + 0.019 * np.sin(t * 5 + tile * 0.6) + 0.009 * np.sin(t * 10 + tile)
    waves = sum(
        np.sin(carrier * f * 2 * np.pi + rng.random() * 6) * a
        for f, a in [
            (3, 0.06),
            (6, 0.035),
            (17, 0.041),
            (38, 0.036),
            (59, 0.025),
            (93, 0.019),
        ]
    )
    rand = np.interp(
        (carrier % 1).ravel(), np.linspace(0, 1, w), rng.normal(0, 0.065, w)
    ).reshape(h, w)
    tone = (1 + waves + rand) * (
        0.74 + 0.24 * np.sin(np.pi * (t * 0.84 + 0.08)) + 0.07 * t
    )
    hue = np.array([148 + tile % 3 * 4, 109 + tile % 4 * 2, 164 + tile % 3 * 3])
    col = np.clip(tone[:, :, None] * hue, 0, 255)
    uneven = (
        0.11 * (0.5 + 0.5 * np.sin(carrier * 33 + tile))
        + 0.07 * (0.5 + 0.5 * np.sin(carrier * 119))
        + 0.14 * abs(2 * u - 1) ** 1.6
    )
    cutoff = 1 - uneven + 0.06 * rand + 0.03 * np.sin(carrier * 518)
    strand = np.clip((cutoff - t) * 100, 0, 1) * np.clip(
        (0.5 - abs(u - 0.5)) * 45, 0, 1
    )
    tiles.append(np.dstack([col, strand * 255]).astype("uint8"))
Image.fromarray(np.concatenate(tiles, axis=1)).save(root / "work/lavender-fibres.png")
