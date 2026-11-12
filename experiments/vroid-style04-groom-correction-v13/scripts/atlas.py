"""Atlas sợi hẹp dùng chung cho GBH cards. Alpha hỗ trợ mép và ngọn."""

from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
rng = np.random.default_rng(130413)
w, h = 256, 1024
u = np.linspace(0, 1, w)[None, :]
t = np.linspace(0, 1, h)[:, None]
tiles = []
for tile in range(8):
    phase = rng.uniform(0, 6.28)
    strand = np.zeros((h, w))
    for i in range(9):
        center = (i + 0.55 + rng.uniform(-0.25, 0.25)) / 9
        wave = center + 0.005 * np.sin(t * 5 + phase + i)
        strand += rng.uniform(-7, 7) * np.exp(
            -(((u - wave) / rng.uniform(0.006, 0.016)) ** 2)
        )
    shade = (
        7 * np.sin(u * 5 + phase)
        + strand
        + 15 * np.exp(-(((t - 0.32 - 0.015 * np.sin(u * 3 + phase)) / 0.15) ** 2))
        - 15 * (1 - t) ** 4
    )
    shade += rng.uniform(-4, 4)
    rgb = np.stack(
        [
            np.broadcast_to(c + shade * gain + t * 4, (h, w))
            for c, gain in [(157, 1.1), (113, 0.90), (171, 1.08)]
        ],
        axis=-1,
    )
    edge = np.minimum(u, 1 - u)
    alpha = np.clip((edge - 0.025) * 40, 0, 1) * np.clip((0.995 - t) * 80, 0, 1)
    # Unequal sub-fibre endings confined to the last 18 percent.
    lengths = 0.91 + 0.08 * np.sin(u * 19 + phase) ** 2
    alpha *= np.clip((lengths - t) * 90 + 0.5, 0, 1)
    fine_split = np.sin((u * 5 + 0.02 * np.sin(t * 3 + phase)) * 2 * np.pi)
    alpha *= np.clip((fine_split + 1.09 - (np.maximum(0, t - 0.78) * 2.8)) * 12, 0, 1)
    tiles.append(np.uint8(np.clip(np.dstack([rgb, alpha * 255]), 0, 255)))
Image.fromarray(np.concatenate(tiles, axis=1)).save(
    root / "review/Style04-V13-silk.png"
)
