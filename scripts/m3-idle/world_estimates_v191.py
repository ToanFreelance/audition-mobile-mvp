#!/usr/bin/env python3
"""V1.9.1 single-camera 3D *estimates*, NOT ground-truth 3D mocap.

Usage: python scripts/m3-idle/world_estimates_v191.py --video source.mp4
  --model pose_landmarker_full.task --rois reviewed-rois.json
  --output-dir /tmp/m3-world

Ground truth remains the owner video 2D landmarks. MediaPipe pose_world_landmarks
are model estimates relative to the inferred pelvis and are not safe to bake
onto M3 without bone-length, joint-limit, support and occlusion constraints.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import cv2
import numpy as np

from reference_metrics_v19 import JOINTS, store
from reference_metrics_v191 import existing_clip_windows, parse_rois

LIMBS = {
    "upper_arm_L": ("left_shoulder", "left_elbow"),
    "upper_arm_R": ("right_shoulder", "right_elbow"),
    "forearm_L": ("left_elbow", "left_wrist"),
    "forearm_R": ("right_elbow", "right_wrist"),
    "thigh_L": ("left_hip", "left_knee"),
    "thigh_R": ("right_hip", "right_knee"),
    "shin_L": ("left_knee", "left_ankle"),
    "shin_R": ("right_knee", "right_ankle"),
}


def audit_world(clip: str, frames: list[dict]) -> dict:
    if not frames:
        raise ValueError("No frames for " + clip)
    lens: dict[str, list[float]] = {name: [] for name in LIMBS}
    jumps: list[dict] = []
    previous = None
    points = 0
    for frame in frames:
        joints = frame["estimated_world_joints"]
        points += len(joints)
        for name, (a, b) in LIMBS.items():
            if a in joints and b in joints:
                distance = float(np.linalg.norm(
                    np.asarray(joints[a][:3]) - np.asarray(joints[b][:3])))
                if np.isfinite(distance):
                    lens[name].append(distance)
        if previous is not None:
            for joint in JOINTS:
                if joint in joints and joint in previous:
                    delta = float(np.linalg.norm(
                        np.asarray(joints[joint][:3]) - np.asarray(previous[joint][:3])))
                    if delta > .20:
                        jumps.append({"frame": frame["frame"], "joint": joint,
                                      "world_displacement": round(delta, 5)})
        previous = joints
    coverage = points / (len(frames) * len(JOINTS))
    length_stats = {}
    variable_limbs = []
    for name, lengths in lens.items():
        cv = float(np.std(lengths) / np.mean(lengths)) if (len(lengths) >= 2
               and np.mean(lengths) > 0) else None
        length_stats[name] = {"observations": len(lengths),
                              "median_estimated_world_units": (
                                  float(np.median(lengths)) if lengths else None),
                              "coefficient_of_variation": cv}
        # This is a diagnostic heuristic, NOT a passing anatomical gate.
        if len(lengths) >= 30 and cv is not None and cv > .15:
            variable_limbs.append(name)
    return {
        "clip": clip, "source_frames": len(frames),
        "mean_world_joint_coverage": round(coverage, 5),
        "model": "MediaPipe Tasks PoseLandmarker Full",
        "kind": "MODEL_ESTIMATED_3D_NOT_MEASURED_DEPTH",
        "limbs": length_stats, "length_variation_review": variable_limbs,
        "jump_threshold_world_units": .20, "jump_count": len(jumps),
        "jump_examples": jumps[:100],
        "tracking_sufficient": coverage >= .70,
        "retarget_ready": False,
        "limitations": [
            "Monocular pose_world_landmarks do not uniquely determine 3D motion",
            "World bone lengths are not necessarily the actual M3 rig lengths",
            "Occluded joints are missing; no automatic interpolation",
            "Camera, foot contacts, rotations, physical constraints not solved",
            "Joint swaps and garment intersections require independent validation",
        ],
    }


def estimate(video: Path, model: Path, roi_file: Path, output: Path,
             confidence: float, selected: list[str]) -> dict:
    import mediapipe as mp
    windows = existing_clip_windows()
    rois = parse_rois(roi_file, windows)
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise FileNotFoundError(str(video))
    fps = float(cap.get(cv2.CAP_PROP_FPS))
    count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    size = (int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)))
    if abs(fps - 30) > .05 or count != 2677 or size != (910, 512):
        raise ValueError("Unexpected owner video identity: " + str((fps,count,size)))
    output.mkdir(parents=True, exist_ok=True)
    reports = {}
    for clip in selected:
        first,last = windows[clip]
        x,y,w,h = [int(q) for q in rois[clip].split(",")]
        options = mp.tasks.vision.PoseLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(model)),
            running_mode=mp.tasks.vision.RunningMode.VIDEO,
            num_poses=1, min_pose_detection_confidence=.45,
            min_tracking_confidence=.45)
        cap.set(cv2.CAP_PROP_POS_FRAMES,first)
        frames = []
        with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
            for frame in range(first,last+1):
                ok,image = cap.read()
                if not ok: raise ValueError("Missing original frame "+str(frame))
                rgb=cv2.cvtColor(image[y:y+h,x:x+w],cv2.COLOR_BGR2RGB)
                source=mp.Image(image_format=mp.ImageFormat.SRGB,
                                data=np.ascontiguousarray(rgb))
                result=detector.detect_for_video(
                    source, round((frame-first)*1000/fps))
                joints={}
                if result.pose_world_landmarks:
                    for name,idx in JOINTS.items():
                        p=result.pose_world_landmarks[0][idx]
                        if p.visibility >= confidence and np.isfinite(
                                [p.x,p.y,p.z,p.visibility]).all():
                            joints[name] = [round(float(v),6) for v in
                                            [p.x,p.y,p.z,p.visibility]]
                frames.append({
                    "frame":frame, "source_time_s":round(frame/fps,6),
                    "clip_time_s":round((frame-first)/fps,6),
                    "estimated_world_joints":joints,
                    "missing_or_unreliable":[n for n in JOINTS if n not in joints]})
        report=audit_world(clip,frames)
        reports[clip]=report
        store(output/(clip+"-world-estimated-3D.json"),
              {"metadata":report,"frames":frames})
        store(output/(clip+"-world-biomechanics-audit.json"),report)
    cap.release()
    store(output/"selected-clips-3D-audit.json", {
        "source_video": video.name, "fps": fps, "clips": reports,
        "all_selected_tracking_sufficient": all(
            r["tracking_sufficient"] for r in reports.values()),
        "all_retarget_ready": False,
        "note": "These are ML estimates, not constrained M3 animations."})
    return reports


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--video",type=Path,required=True)
    p.add_argument("--model",type=Path,required=True)
    p.add_argument("--rois",type=Path,required=True)
    p.add_argument("--output-dir",type=Path,required=True)
    p.add_argument("--confidence",type=float,default=.60)
    p.add_argument("--clip",choices=["all",*existing_clip_windows()],default="all")
    a=p.parse_args()
    if not 0<a.confidence<=1: p.error("Confidence must be in (0,1]")
    chosen=(list(existing_clip_windows()) if a.clip=="all" else [a.clip])
    reports=estimate(a.video,a.model,a.rois,a.output_dir,
                     a.confidence,chosen)
    if any(not r["tracking_sufficient"] for r in reports.values()):
        raise SystemExit("3D estimate coverage insufficient; do not retarget")


if __name__ == "__main__":
    main()
