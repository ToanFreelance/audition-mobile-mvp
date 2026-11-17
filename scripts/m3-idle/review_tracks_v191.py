"""Review original-pixel landmark candidates and propagate anatomical pins with bidirectional LK.

Usage: python review_tracks_v191.py VIDEO FULL_JSON HEAVY_JSON PINS_JSON OUTPUT
HEAVY_JSON stores 33 [px, py, visibility, nominal_depth] tuples per source frame.
PINS_JSON uses absolute source frame numbers and contains only reviewed image landmarks.
"""

import argparse
import json
from pathlib import Path

import cv2
import numpy as np

INDEX = {
    side + "_" + part: idx + offset
    for part, idx in [
        ("shoulder", 11),
        ("elbow", 13),
        ("wrist", 15),
        ("hip", 23),
        ("knee", 25),
        ("ankle", 27),
        ("heel", 29),
        ("toe", 31),
        ("eye", 2),
    ]
    for side, offset in [("left", 0), ("right", 1 if part != "eye" else 3)]
}
INDEX["nose"] = 0


def walk(images, start, stop, points):
    paths = {start: (points.copy(), np.ones(len(points), dtype=bool))}
    current = points.astype("float32").reshape(-1, 1, 2)
    live = np.ones(len(points), dtype=bool)
    step = 1 if stop > start else -1
    args = dict(
        winSize=(19, 19),
        maxLevel=3,
        criteria=(cv2.TERM_CRITERIA_COUNT | cv2.TERM_CRITERIA_EPS, 24, 0.015),
    )
    for i in range(start, stop, step):
        target, ok, _ = cv2.calcOpticalFlowPyrLK(
            images[i], images[i + step], current, None, **args
        )
        returned, back, _ = cv2.calcOpticalFlowPyrLK(
            images[i + step], images[i], target, None, **args
        )
        live &= ok.ravel().astype(bool) & back.ravel().astype(bool)
        live &= np.linalg.norm((current - returned)[:, 0], axis=1) < 1.6
        paths[i + step] = (target[:, 0].copy(), live.copy())
        current = target
    return paths


def propagate(images, pins, first):
    names = pins.get("names", [])
    anchors = {int(k) - first: v for k, v in pins.get("rows", {}).items()}
    tracks = [{} for _ in images]
    for a, b in zip(sorted(anchors), sorted(anchors)[1:]):
        active = [n for n in names if n in anchors[a] and n in anchors[b]]
        if not active:
            continue
        left = walk(images, a, b, np.array([anchors[a][n] for n in active]))
        right = walk(images, b, a, np.array([anchors[b][n] for n in active]))
        for i in range(a + 1, b):
            t = (i - a) / (b - a)
            pa, va = left[i]
            pb, vb = right[i]
            for j, name in enumerate(active):
                disagreement = np.linalg.norm(pa[j] - pb[j])
                if va[j] and vb[j] and disagreement < 8:
                    xy = pa[j] * (1 - t) + pb[j] * t
                    tracks[i][name] = [
                        *np.round(xy, 3).tolist(),
                        0.82,
                        "bidirectional_lk",
                    ]
                elif va[j] and i - a <= 4:
                    tracks[i][name] = [
                        *np.round(pa[j], 3).tolist(),
                        0.65,
                        "near_pin_lk",
                    ]
                elif vb[j] and b - i <= 4:
                    tracks[i][name] = [
                        *np.round(pb[j], 3).tolist(),
                        0.65,
                        "near_pin_lk",
                    ]
    for i, pose in anchors.items():
        for name, xy in pose.items():
            tracks[i][name] = [*xy, 1.0, "manual_pixel"]
    return tracks


def review(video, full, heavy, pins):
    raw = full["frames"]
    first = raw[0]["frame"]
    if len(heavy) != len(raw) or any(
        f["frame"] != first + i for i, f in enumerate(raw)
    ):
        raise ValueError("Source frame mapping mismatch")
    cap = cv2.VideoCapture(str(video))
    if (
        round(cap.get(cv2.CAP_PROP_FPS), 4),
        int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
    ) != (30.0, 2677):
        raise ValueError("Expected original 30 Hz / 2677-frame reference")
    cap.set(cv2.CAP_PROP_POS_FRAMES, first)
    images = []
    for _ in raw:
        ok, image = cap.read()
        if not ok or image.shape[:2] != (512, 910):
            raise ValueError("Missing original 910x512 frame")
        images.append(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY))
    cap.release()
    tracked = propagate(images, pins, first)
    results = []
    for i, (src, alt) in enumerate(zip(raw, heavy)):
        accepted = {}
        flags = []
        # A disagreement is not an anatomical swap diagnosis for a turning actor.
        different_sides = False
        if (
            alt
            and "left_shoulder" in src["joints"]
            and "right_shoulder" in src["joints"]
        ):
            width = (
                src["joints"]["left_shoulder"][0] - src["joints"]["right_shoulder"][0]
            )
            other = alt[11][0] - alt[12][0]
            different_sides = abs(width) > 8 and abs(other) > 8 and width * other < 0
            if different_sides:
                flags.append("shoulder_order_disagreement")
        for name, idx in INDEX.items():
            p = src["joints"].get(name)
            q = alt[idx] if alt and alt[idx][2] >= 0.65 else None
            if (
                p
                and q
                and not different_sides
                and np.linalg.norm(np.array(p[:2]) - q[:2]) < 9
            ):
                xy = (np.array(p[:2]) * p[2] + np.array(q[:2]) * q[2]) / (p[2] + q[2])
                accepted[name] = [
                    *np.round(xy, 3).tolist(),
                    min(p[2], q[2]),
                    "two_models",
                ]
            elif p and q:
                flags.append("disagree:" + name)
            elif (
                q
                and name
                in (
                    "left_toe",
                    "right_toe",
                    "left_heel",
                    "right_heel",
                    "nose",
                    "left_eye",
                    "right_eye",
                )
                and not different_sides
            ):
                accepted[name] = [*q[:2], q[2] * 0.58, "heavy_only"]
        if pins.get("reviewed_facing") == "front_or_three_quarter":
            pairs = [("left_shoulder", "right_shoulder"), ("left_hip", "right_hip")]
            # Both detectors can follow the wrong side on the same shot.
            # Suppress ambiguous observations; do not mirror them into evidence.
            inverted = any(
                l in accepted and r in accepted and accepted[l][0] < accepted[r][0] - 3
                for l, r in pairs
            )
            flagged = any(
                a <= first + i <= b for a, b in pins.get("ambiguous_frames", [])
            )
            if inverted or flagged:
                flags.append("reviewed_anatomical_sides_unresolved")
                accepted = {n: p for n, p in accepted.items() if n == "nose"}
        for name in pins.get("names", []):
            if name in tracked[i]:
                accepted[name] = tracked[i][name]
            elif name in accepted:
                # Models placing a wrist on the wrong piece of equipment may agree.
                del accepted[name]
                flags.append("pin_track_unavailable:" + name)
        results.append(dict(frame=first + i, points=accepted, flags=flags))
    return dict(clip=full["clip"], fps=30, first=first, rows=results)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for arg in ("video", "full", "heavy", "pins", "output"):
        parser.add_argument(arg, type=Path)
    args = parser.parse_args()
    load = lambda p: json.loads(p.read_text())
    full = load(args.full)
    heavy = load(args.heavy) if args.heavy.is_file() else [[] for _ in full["frames"]]
    result = review(args.video, full, heavy, load(args.pins).get(full["clip"], {}))
    args.output.write_text(json.dumps(result, separators=(",", ":")))
