/** V2.2.8.2 experimental intake. This is presentation-only QA, not production. */
import * as T from "three";
import type { SourceMotion } from "./engine";
import type { CuratedPhrase } from "./catalog";
import { SOURCE_PIN } from "./catalog";
import { proposeReviewSegments, type ActivitySample, OWNER_CURATION_DIRECTIONS } from "./clip-curation";

export type IntakeRejection = { source: string; id: string; reason: string; start: number; end: number };
export type IntakeResult = { accepted: CuratedPhrase[]; rejected: IntakeRejection[] };
export const EXPERIMENTAL_SOURCES = ["85_12", "85_14", "90_28"] as const;
type Frame = { time: number; energy: number; posture: boolean; entrySafe: boolean };

/**
 * Scan the ENTIRE original take and find actual safely enterable/exitable
 * motion INSIDE each owner-approved survey chapter.
 *
 * V2.2.8 erroneously required every frame of the entire 1/4-source
 * chapter to be upright. One floor moment rejected 8+ seconds of useful
 * standing dance, and 90_28's entire 6.4s source was treated as one phrase.
 *
 * This screen finds 2–4 second bounded standing runs, not arbitrary 3.2s
 * slices. Source floor/handstand/flip content stays outside ordinary SPACE.
 * No protected-range bypass, stage radius override or synthetic turns.
 */
export function analyzeExperimentalSource(sourceId: string, motion: SourceMotion): IntakeResult {
  if (!(EXPERIMENTAL_SOURCES as readonly string[]).includes(sourceId)) return { accepted: [], rejected: [] };
  const root = motion.skeleton.bones[0], bones = motion.skeleton.bones;
  const head = bones.find(b => b.name === "Head");
  const leftFoot = bones.find(b => b.name === "LeftFoot");
  const rightFoot = bones.find(b => b.name === "RightFoot");
  if (!root || !head || !leftFoot || !rightFoot)
    return { accepted: [], rejected: [{ source: sourceId, id: sourceId, start: 0,
      end: motion.clip.duration, reason: "missing-head-hips-or-feet" }] };

  const mixer = new T.AnimationMixer(root);
  const action = mixer.clipAction(motion.clip); action.play();
  const rootPos = new T.Vector3(), headPos = new T.Vector3(),
    leftPos = new T.Vector3(), rightPos = new T.Vector3(), point = new T.Vector3();
  const tracked = bones.filter(b => ["Hips", "Head", "LeftHand", "RightHand", "LeftFoot", "RightFoot", "LeftUpLeg", "RightUpLeg"].includes(b.name));
  const previous = new Map<string, T.Vector3>();
  const heightBox = new T.Box3();
  const duration = motion.clip.duration, stride = .12;
  const frames: Frame[] = [], activity: ActivitySample[] = [];
  try {
    mixer.setTime(0); root.updateMatrixWorld(true);
    for (const bone of bones) { bone.getWorldPosition(point); heightBox.expandByPoint(point); }
    const height = Math.max(1, heightBox.max.y - heightBox.min.y);
    for (let i = 0; i <= Math.ceil(duration / stride); i++) {
      const time = Math.min(duration, i * stride);
      mixer.setTime(time); root.updateMatrixWorld(true);
      root.getWorldPosition(rootPos); head.getWorldPosition(headPos);
      leftFoot.getWorldPosition(leftPos); rightFoot.getWorldPosition(rightPos);
      let energy = 0;
      for (const bone of tracked) {
        bone.getWorldPosition(point);
        const prev = previous.get(bone.name);
        if (prev) energy += point.distanceTo(prev);
        previous.set(bone.name, point.clone());
      }
      const normalizedEnergy = energy / (height * Math.max(1, tracked.length));
      const headClearance = headPos.y - rootPos.y;
      const lowFoot = Math.min(leftPos.y, rightPos.y);
      const highFoot = Math.max(leftPos.y, rightPos.y);
      // Inside: upright upper body and at least one foot beneath pelvis.
      // This accepts standing footwork while rejecting inversions/handstands.
      const posture = headClearance > height * .24 && lowFoot < rootPos.y - height * .1;
      // Boundaries: both feet grounded under pelvis and a reliably upright torso.
      const entrySafe = headClearance > height * .34 && highFoot < rootPos.y - height * .07;
      frames.push({ time, energy: normalizedEnergy, posture, entrySafe });
      activity.push({ time, energy: normalizedEnergy, upright: posture });
      if (time >= duration) break;
    }
  } finally { action.stop(); mixer.stopAllAction(); }
  const surveys = proposeReviewSegments(sourceId, duration, activity);
  const accepted: CuratedPhrase[] = [], rejected: IntakeRejection[] = [];
  const target = OWNER_CURATION_DIRECTIONS[sourceId]?.targetSlots ?? 1;
  for (const survey of surveys) {
    const inSurvey = frames.filter(f => f.time >= survey.start - .001 && f.time <= survey.end + .001);
    // Find long enough continuous SAFE runs within each chapter, rather than
    // rejecting the whole chapter for a single flip frame.
    let best: { start: number; end: number; score: number } | null = null;
    for (let first = 0; first < inSurvey.length; first++) {
      if (!inSurvey[first].entrySafe) continue;
      for (let last = first + 1; last < inSurvey.length; last++) {
        const length = inSurvey[last].time - inSurvey[first].time;
        if (length > 4.0 + stride) break;
        if (!inSurvey[last].posture) break;
        if (length < 2.0 || !inSurvey[last].entrySafe) continue;
        const window = inSurvey.slice(first, last + 1);
        if (window.some(p => !p.posture)) break;
        // Require two stable boundary frames on either side, measured INSIDE
        // the chosen interval. Never punish a clip for an inversion OUTSIDE it.
        if (window.slice(0, 3).some(p => !p.entrySafe)
          || window.slice(-3).some(p => !p.entrySafe)) continue;
        const motionEnergy = window.reduce((sum, p) => sum + p.energy, 0) / window.length;
        if (motionEnergy < .0015) continue; // reject motionless standing
        const score = Math.min(length, 3.2) + Math.min(motionEnergy * 10, .6);
        if (!best || score > best.score)
          best = { start: inSurvey[first].time, end: inSurvey[last].time, score };
      }
    }
    if (!best) {
      rejected.push({ source: sourceId, id: survey.id, start: survey.start,
        end: survey.end, reason: "no-2s-upright-dance-with-safe-entry-exit-in-chapter; floor-or-short-movement-retained-in-catalog" });
      continue;
    }
    // Stable source-section IDs, even if an earlier chapter was rejected.
    const id = "break-" + sourceId.replace("_", "-") + "-" + survey.id.split("-").at(-1);
    accepted.push({
      id, source: sourceId, label: "Street Break · " + sourceId + " / " + survey.id.split("-").at(-1),
      group: "break-" + sourceId + "-" + survey.id, start: Number(best.start.toFixed(3)),
      end: Number(best.end.toFixed(3)), role: "core", policy: "FREE",
      referenceBpm: 120, tempoBasis: "testing-assumption", exitMarkers: [],
      style: "Street / Break (experimental upright segment)",
      tags: ["upright-screened", "owner-source-approved", "not-production", "full-source-scan"],
      openingGroup: "street-break", acceptance: "technical-preview-pending",
      provenance: {
        sourceUrl: "https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/"
          + SOURCE_PIN + "/data/" + sourceId.slice(0, 2).padStart(3, "0") + "/" + sourceId + ".bvh",
        indexDescription: "Owner V2.2.7 chapter; motion subwindow scanned for safe standing SPACE entry/exit. Contact/retarget pending.",
        licenseUrl: "https://mocap.cs.cmu.edu/",
        credit: "CMU Graphics Lab; experimental QA source, no raw reselling."
      }
    });
    if (accepted.length >= target) break;
  }
  return { accepted, rejected };
}
