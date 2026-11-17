#!/usr/bin/env python3
"""V1.9.1 nine-clip source tracking entrypoint.

This extends the measured V1.9 tracker; it does not invent pose data, recover
occluded depth, or certify the nine clip boundaries. A private owner MP4 and
manually reviewed per-clip ROIs are mandatory for real source measurements.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from types import SimpleNamespace

import cv2
import numpy as np
import reference_metrics_v19 as v19

CLIP_ASSETS = {
    "F01": "drophunter", "F02": "F02", "F03": "F03",
    "F04": "F04", "F05": "F05", "M01": "neurohacker",
    "M02": "M02", "X01": "X01", "M03": "M03",
}
MOTION_DIR = Path(__file__).resolve().parents[2] / "components/character/motion"


def existing_clip_windows(motion_dir: Path = MOTION_DIR) -> dict[str, tuple[int, int]]:
    """Frame ranges present in existing motion assets, NOT independently verified source cuts."""
    result = {}
    for clip, asset in CLIP_ASSETS.items():
        data = json.loads((motion_dir / (asset + ".json")).read_text())
        if data.get("fps") != 30 or not isinstance(data.get("lastFrame"), int):
            raise ValueError("Unexpected 30Hz clip metadata for " + clip)
        start = data.get("sourceStartFrame")
        if not isinstance(start, int) or start < 0 or data["lastFrame"] < 0:
            raise ValueError("Missing/invalid source frame range for " + clip)
        result[clip] = start, start + data["lastFrame"]
    return result


def inspect_landmarks(source: dict) -> dict:
    """Flag occlusion, improbable jumps and sudden anatomical L/R reversals.

    Flags are review candidates, NOT automatic correction or claims of tracking validity.
    Never interpolate an occluded joint.
    """
    frames = source["frames"]
    if not frames:
        raise ValueError("No source frames")
    fps = float(source["fps"])
    if abs(fps - 30) > .05:
        raise ValueError("Expected 30Hz source video")
    first = int(frames[0]["frame"])
    for i, frame in enumerate(frames):
        if frame["frame"] != first + i or abs(frame["time"] - i / fps) > .5 / fps:
            raise ValueError("Non-contiguous or misaligned source frame " + str(i))
    coverage = {}
    for name in v19.JOINTS:
        strengths = [f["joints"][name][2] for f in frames if name in f["joints"]]
        coverage[name] = {
            "tracked": len(strengths),
            "missing": len(frames) - len(strengths),
            "fraction": round(len(strengths) / len(frames), 4),
            "median_visibility": round(float(np.median(strengths)), 4) if strengths else None,
        }
    anchor_fraction = min(coverage[name]["fraction"] for name in v19.ANCHORS)
    warnings = []
    previous = None
    previous_shoulder_sign = None
    for f in frames:
        joints = f["joints"]
        if all(k in joints for k in ("left_shoulder", "right_shoulder", "left_hip", "right_hip")):
            shoulder = (np.array(joints["left_shoulder"][:2]) +
                        np.array(joints["right_shoulder"][:2])) / 2
            pelvis = (np.array(joints["left_hip"][:2]) +
                      np.array(joints["right_hip"][:2])) / 2
            torso = max(float(np.linalg.norm(shoulder - pelvis)), 1.0)
            signed = joints["left_shoulder"][0] - joints["right_shoulder"][0]
            if abs(signed) > 8:
                sign = 1 if signed > 0 else -1
                if previous_shoulder_sign is not None and sign != previous_shoulder_sign:
                    warnings.append({"frame": f["frame"], "kind": "left_right_reversal",
                                     "note": "Possible genuine turn or tracking swap; inspect source"})
                previous_shoulder_sign = sign
            if previous is not None and f["frame"] == previous["frame"] + 1:
                for name in v19.JOINTS:
                    if name in joints and name in previous["joints"]:
                        p = np.array(joints[name][:2])
                        q = np.array(previous["joints"][name][:2])
                        if np.linalg.norm(p - q) > .55 * torso:
                            warnings.append({"frame": f["frame"], "kind": "temporal_jump",
                                             "joint": name, "displacement_torso": round(
                                                float(np.linalg.norm(p - q) / torso), 4)})
        previous = f
    return {"clip": source["clip"], "frame_start": first, "frame_end": frames[-1]["frame"],
            "frames": len(frames), "coverage": coverage, "review_flags": warnings,
            "status": ("SOURCE_TRACKING_INSUFFICIENT" if anchor_fraction < .50
                       else "SOURCE_TRACKING_REQUIRES_HUMAN_FRAME_REVIEW"),
            "anchor_min_coverage": anchor_fraction,
            "source_bounds_verified": False,
            "depth_estimation": "NOT_PERFORMED",
            "retargeting": "NOT_PERFORMED"}


def parse_rois(path: Path, windows: dict[str, tuple[int, int]]) -> dict[str, str]:
    rois = json.loads(path.read_text(encoding="utf-8"))
    if set(rois) != set(windows):
        raise ValueError("ROIs must specify all nine IDs, without extra IDs")
    parsed = {}
    for clip, values in rois.items():
        if not isinstance(values, list) or len(values) != 4 or not all(
                isinstance(v, int) and not isinstance(v, bool) for v in values):
            raise ValueError("ROI must be reviewed [x,y,width,height] for " + clip)
        parsed[clip] = ",".join(str(v) for v in values)
    return parsed


def main() -> None:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--video", type=Path, help="Actual private 89.23s owner reference")
    cli.add_argument("--rois", type=Path, help="Nine manually inspected clip ROIs as JSON")
    cli.add_argument("--model", type=Path, help="MediaPipe pose_landmarker_full.task when using Tasks")
    cli.add_argument("--output-dir", type=Path, required=True)
    cli.add_argument("--confidence", type=float, default=.60)
    cli.add_argument("--m3-dir", type=Path,
                     help="Nine actual Playwright M3 2D rig export files")
    cli.add_argument("--baseline-m3-dir", type=Path,
                     help="Optional nine old M3 exports for before/after comparison")
    cli.add_argument("--template-only", action="store_true",
                     help="Write an unverified ROI template; no source processing")
    args = cli.parse_args()
    windows = existing_clip_windows()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    if args.template_only:
        v19.store(args.output_dir / "roi-REVIEW-BEFORE-USE.json",
                  {clip: ([300,110,315,375] if clip in ("F03","M03") else None)
                   for clip in windows})
        return
    if not args.video or not args.rois:
        cli.error("--video and --rois are required without --template-only")
    if not 0 < args.confidence <= 1:
        cli.error("Confidence must be in (0,1]")
    cap = cv2.VideoCapture(str(args.video))
    if not cap.isOpened():
        raise FileNotFoundError(args.video)
    fps = float(cap.get(cv2.CAP_PROP_FPS))
    count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    size = (int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)))
    cap.release()
    if abs(fps - 30) > .05 or count < max(e for _,e in windows.values()) + 1:
        raise ValueError("Original source FPS/frame count does not match the motion assets")
    if size != (910,512):
        raise ValueError("Unexpected original source dimensions: " + str(size))
    rois = parse_rois(args.rois, windows)
    reports = {}
    measured = {}
    failures = []
    for clip, (start, end) in windows.items():
        # Existing ranges are unverified until explicitly checked on source frames.
        v19.SEGMENTS[clip] = (start / fps, end / fps)
        source_path = args.output_dir / (clip + "-source-landmarks.json")
        v19.track(SimpleNamespace(video=args.video, clip=clip,
            roi=rois[clip], model=args.model, confidence=args.confidence,
            output=source_path,
            overlay=args.output_dir / (clip + "-source-skeleton.mp4")))
        data = json.loads(source_path.read_text())
        if data["frames"][0]["frame"] != start or data["frames"][-1]["frame"] != end:
            raise ValueError("Frame mismatch after tracking " + clip)
        for f in data["frames"]:
            f["occluded_or_unreliable"] = [j for j in v19.JOINTS if j not in f["joints"]]
        data["source_range_provenance"] = "existing_m3_clip_metadata_UNVERIFIED"
        v19.store(source_path,data)
        reports[clip] = inspect_landmarks(data)
        v19.store(args.output_dir / (clip + "-tracking-coverage.json"), reports[clip])
        if reports[clip]["status"] == "SOURCE_TRACKING_INSUFFICIENT":
            failures.append(clip)
            measured[clip] = {"status": "NO_VALID_REPROJECTION",
                              "reason": "Insufficient source shoulder/hip coverage"}
            continue
        if args.m3_dir:
            target = args.m3_dir / (clip + "-m3-2d.json")
            if not target.is_file():
                raise FileNotFoundError("Missing M3 capture: " + str(target))
            metrics_path = args.output_dir / (clip + "-source-vs-M3-metrics.json")
            try:
                v19.score(SimpleNamespace(
                    source=source_path, target=target, output=metrics_path,
                    csv=args.output_dir / (clip + "-reprojection.csv"),
                    overlay=args.output_dir / (clip + "-source-vs-M3-overlay.mp4"),
                    video=args.video, confidence=args.confidence))
            except ValueError as exc:
                failures.append(clip)
                measured[clip] = {"status": "NO_VALID_REPROJECTION",
                                  "reason": str(exc)}
                continue
            measured[clip] = {"current": json.loads(metrics_path.read_text())["error_px"]}
            if args.baseline_m3_dir:
                old = args.baseline_m3_dir / (clip + "-m3-2d.json")
                if not old.is_file():
                    raise FileNotFoundError("Missing old M3 capture: " + str(old))
                baseline, _ = v19.compare(
                    data, json.loads(old.read_text()), args.confidence)
                measured[clip]["baseline"] = baseline["error_px"]
                measured[clip]["delta_p50_px"] = round(
                    measured[clip]["current"]["p50"] - baseline["error_px"]["p50"], 4)
                measured[clip]["delta_p95_px"] = round(
                    measured[clip]["current"]["p95"] - baseline["error_px"]["p95"], 4)
    v19.store(args.output_dir / "nine-clips-tracking-audit.json", {
        "source_file": args.video.name, "source_fps": fps, "source_frame_count": count,
        "range_review": "NOT_YET_VERIFIED_AGAINST_SOURCE", "clips": reports,
        "reprojection": measured, "failed_clips": failures,
        "overall_status": ("INCOMPLETE" if failures else "SOURCE_TRACKING_REQUIRES_HUMAN_REVIEW"),
        "warning": "Tracking data must be frame-reviewed before 3D reconstruction."})
    if failures:
        raise SystemExit("Tracking incomplete for: " + ", ".join(failures))


if __name__ == "__main__":
    main()
