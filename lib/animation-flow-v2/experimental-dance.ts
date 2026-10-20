/** Isolated experimental intake: only fully upright windows may enter the
 * ordinary four/eight-beat SPACE pool. Any flip, floor or uncertain window
 * remains in the separately reviewed source catalog. */
import * as T from "three";
import type { SourceMotion } from "./engine";
import type { CuratedPhrase } from "./catalog";
import { SOURCE_PIN } from "./catalog";
import { proposeReviewSegments, type ActivitySample } from "./clip-curation";

export type IntakeRejection = { source: string; id: string; reason: string; start: number; end: number };
export type IntakeResult = { accepted: CuratedPhrase[]; rejected: IntakeRejection[] };
export const EXPERIMENTAL_SOURCES = ["85_12", "85_14", "90_28"] as const;

/**
 * Sample the same full-source timeline as the V2.2.7 Catalog. Unlike the
 * *visual* review heuristics, acceptance requires reliably upright heads,
 * feet below hips, and no ground/inversion frames in the section. This errs
 * on the side of REJECTING good breakdance rather than snapping on SPACE.
 */
export function analyzeExperimentalSource(sourceId: string, motion: SourceMotion): IntakeResult {
  if (!(EXPERIMENTAL_SOURCES as readonly string[]).includes(sourceId)) return { accepted: [], rejected: [] };
  const bones = motion.skeleton.bones;
  const root = bones[0];
  const head = bones.find(b => b.name === "Head");
  const leftFoot = bones.find(b => b.name === "LeftFoot");
  const rightFoot = bones.find(b => b.name === "RightFoot");
  if (!root || !head || !leftFoot || !rightFoot) throw new Error("Thiếu Hips/Head/Feet trong BVH " + sourceId);
  const tracked = bones.filter(b => ["Hips", "Head", "LeftHand", "RightHand", "LeftFoot", "RightFoot", "LeftUpLeg", "RightUpLeg"].includes(b.name));
  const mixer = new T.AnimationMixer(root), action = mixer.clipAction(motion.clip);
  action.play();
  const heightBox = new T.Box3(), position = new T.Vector3();
  mixer.setTime(0); root.updateMatrixWorld(true);
  for (const bone of bones) { bone.getWorldPosition(position); heightBox.expandByPoint(position); }
  const height = Math.max(.001, heightBox.max.y - heightBox.min.y);
  const activity: ActivitySample[] = [];
  const previous = new Map<string, T.Vector3>(), hips = new T.Vector3(),
    face = new T.Vector3(), left = new T.Vector3(), right = new T.Vector3();
  const samples: Array<{ time: number; safe: boolean }> = [];
  const duration = motion.clip.duration;
  try {
    for (let t = 0; t <= duration + .00001; t += .15) {
      const time = Math.min(t, duration);
      mixer.setTime(time); root.updateMatrixWorld(true);
      root.getWorldPosition(hips); head.getWorldPosition(face);
      leftFoot.getWorldPosition(left); rightFoot.getWorldPosition(right);
      let energy = 0;
      for (const bone of tracked) {
        bone.getWorldPosition(position);
        const prev = previous.get(bone.name);
        if (prev) energy += position.distanceTo(prev);
        previous.set(bone.name, position.clone());
      }
      const upright = face.y - hips.y > height * .18;
      const safe = face.y - hips.y > height * .34
        && left.y < hips.y - height * .08 && right.y < hips.y - height * .08;
      activity.push({ time, energy: energy / (height * Math.max(tracked.length, 1)), upright });
      samples.push({ time, safe });
      if (time === duration) break;
    }
  } finally { action.stop(); mixer.stopAllAction(); }
  const windows = proposeReviewSegments(sourceId, duration, activity);
  const accepted: CuratedPhrase[] = [], rejected: IntakeRejection[] = [];
  for (const slot of windows) {
    const inside = samples.filter(p => p.time >= slot.start - .001 && p.time <= slot.end + .001);
    const near = (at: number) => samples.filter(p => Math.abs(p.time - at) <= .35);
    const reasons = [];
    if (slot.end - slot.start < 1.4) reasons.push("too-short");
    if (near(slot.start).some(p => !p.safe) || near(slot.end).some(p => !p.safe))
      reasons.push("unsafe-entry-or-exit");
    // Do not allow a successful SPACE to hit a floor/crossover inversion.
    if (inside.some(p => !p.safe)) reasons.push("contains-unsafe-floor-or-inversion");
    if (slot.end > duration + .001) reasons.push("source-out-of-range");
    if (reasons.length) {
      rejected.push({ source: sourceId, id: slot.id, start: slot.start, end: slot.end, reason: reasons.join("+") });
      continue;
    }
    const id = "break-" + sourceId.replace("_", "-") + "-" + String(accepted.length + 1).padStart(2, "0");
    accepted.push({
      id, source: sourceId, label: "Street Break · " + sourceId + " / " + (accepted.length + 1),
      group: "break-" + sourceId + "-" + slot.id, start: slot.start, end: slot.end,
      role: "core", policy: "FREE", referenceBpm: 120, tempoBasis: "testing-assumption",
      exitMarkers: [], style: "Street / Break (experimental)",
      tags: ["upright-screened", "owner-source-approved", "not-production"],
      openingGroup: "street-break", acceptance: "technical-preview-pending",
      provenance: {
        sourceUrl: "https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/"
          + SOURCE_PIN + "/data/" + sourceId.slice(0, 2).padStart(3, "0") + "/" + sourceId + ".bvh",
        indexDescription: "Owner-selected V2.2.7 segment, dynamically screened for continuous upright posture; foot contact and retarget still pending.",
        licenseUrl: "https://mocap.cs.cmu.edu/",
        credit: "CMU Graphics Lab; experimental QA source only; no raw reselling."
      }
    });
  }
  return { accepted, rejected };
}
