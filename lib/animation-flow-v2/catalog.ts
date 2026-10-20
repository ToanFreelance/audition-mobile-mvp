/** Isolated source QA only. These are not Character Catalog or production pool entries. */
export const SOURCE_PIN = "09a07f54f3bbb58797325f009282d0b2048a2871";
export type ExitPolicy = "FREE" | "BEAT_WINDOW" | "PROTECTED";
export type PhraseSpec = {
  id: string; source: string; label: string; group: string;
  start: number; end: number; policy: ExitPolicy;
  exitMarkers: readonly number[];
  protectedRanges?: readonly (readonly [number, number])[];
  referenceBpm: number; tempoBasis: "testing-assumption";
  role: "core" | "fixture" | "travel" | "finish" | "recovery" | "idle";
};

// Windows are source seconds. Reference tempo is deliberately marked assumed,
// not musical metadata. Markers are technical QA candidates, owner review pending.
export const CORE_PHRASES: readonly PhraseSpec[] = [
  { id: "111-groove", source: "111_05", label: "Groove · đổi chân", group: "casual-groove", start: 0.6, end: 3, policy: "FREE", exitMarkers: [0.8, 1.6, 2.4], referenceBpm: 120, tempoBasis: "testing-assumption", role: "core" },
  { id: "141-twist", source: "141_12", label: "Twist · nhấn thân", group: "twist", start: 0.6, end: 4.4, policy: "FREE", exitMarkers: [0.9, 1.8, 2.7, 3.8], referenceBpm: 120, tempoBasis: "testing-assumption", role: "core" },
  { id: "93-charleston", source: "93_03", label: "Charleston · điểm nhấn", group: "swing-footwork", start: 0.4, end: 3.5, policy: "BEAT_WINDOW", exitMarkers: [0.5, 1, 1.5, 2, 2.5, 3.1], referenceBpm: 120, tempoBasis: "testing-assumption", role: "core" },
  { id: "143-party", source: "143_35", label: "Macarena · động tác tay", group: "party-arms", start: 1, end: 5, policy: "FREE", exitMarkers: [1, 2, 3, 4], referenceBpm: 120, tempoBasis: "testing-assumption", role: "core" },
  { id: "120-mickey", source: "120_06", label: "Mickey · nhịp chân", group: "casual-groove", start: 2.2, end: 5.4, policy: "FREE", exitMarkers: [0.8, 1.6, 2.4, 3.2], referenceBpm: 120, tempoBasis: "testing-assumption", role: "core" },
  { id: "85-upright", source: "85_03", label: "Upright · break bước đứng", group: "upright-break", start: 18, end: 20, policy: "BEAT_WINDOW", exitMarkers: [0.5, 1, 1.5, 2], referenceBpm: 120, tempoBasis: "testing-assumption", role: "core" },
];

export const FAILING_PAIRS = [
  { id: "classic-origin", label: "Classic · 05_04 → 90_32", a: "05_04", b: "90_32", before: 3.836 },
  { id: "classic-swing", label: "Classic · 93_08 → 90_32", a: "93_08", b: "90_32", before: 2.645 },
  { id: "team-travel", label: "Team · 111_05 → 05_07", a: "111_05", b: "05_07", before: 3.820 },
  { id: "showdown-floor", label: "Showdown · 85_10 → 89_03", a: "85_10", b: "89_03", before: 2.112 },
] as const;

const FIXTURE_IDS = ["05_04", "90_32", "93_08", "111_05", "05_07", "85_10", "89_03"];
export const FIXTURE_PHRASES: readonly PhraseSpec[] = FIXTURE_IDS.map(source => ({
  id: "fixture-" + source, source, label: "Đối chứng " + source, group: "fixture-" + source,
  start: 1 / 120, end: source === "89_03" ? 2.25 : source === "85_10" ? 6.4 : 3,
  policy: source === "85_10" || source === "89_03" ? "PROTECTED" : "FREE",
  // Floor source is not admitted to random selection. Its requested SPACE waits
  // for the recovery candidate rather than tearing an inversion into upright.
  exitMarkers: source === "85_10" ? [5.7, 6.4 - 1 / 120] : source === "89_03" ? [2.25 - 1 / 120] : [3 - 1 / 120],
  protectedRanges: source === "85_10" ? [[0, 5.7]] : source === "89_03" ? [[0.4, 1.9]] : undefined,
  referenceBpm: 120, tempoBasis: "testing-assumption", role: "fixture",
}));

export const MOONWALK_PHRASE: PhraseSpec = {
  id: "90-moonwalk", source: "90_32", label: "Moonwalk · trượt có chủ ý", group: "glide",
  start: 3, end: 4.2, policy: "BEAT_WINDOW", exitMarkers: [1.2], referenceBpm: 120,
  tempoBasis: "testing-assumption", role: "travel",
};
export type CuratedPhrase = PhraseSpec & {
  style: string; tags: readonly string[]; openingGroup: string;
  acceptance: "owner-demo-v21" | "technical-preview-pending";
  provenance: { sourceUrl: string; indexDescription: string; licenseUrl: string; credit: string };
};
function curated(spec: PhraseSpec, style: string, tags: string[], description: string, accepted = false): CuratedPhrase {
  return { ...spec, style, tags, openingGroup: spec.group, acceptance: accepted ? "owner-demo-v21" : "technical-preview-pending",
    provenance: { sourceUrl: `https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/${SOURCE_PIN}/data/${spec.source.split("_")[0].padStart(3, "0")}/${spec.source}.bvh`, indexDescription: description,
      licenseUrl: "https://mocap.cs.cmu.edu/", credit: "CMU Graphics Lab, NSF EIA-0196217; Bruce Hahne BVH, mirror una-dinosauria/cmu-mocap. Research/product use permitted; do not resell raw or converted motion data." } };
}
const extra = (id: string, source: string, label: string, group: string, start: number, end: number, style: string, tags: string[], description: string) =>
  curated({ id, source, label, group, start, end, policy: "BEAT_WINDOW", exitMarkers: [end - start], referenceBpm: 120, tempoBasis: "testing-assumption", role: "core" }, style, tags, description);
/** Six V2.1 windows stay unchanged above. New windows are technical candidates, not production approvals. */
export const NORMAL_PHRASES: readonly CuratedPhrase[] = [
  ...CORE_PHRASES.map((p, i) => curated(p,
    ["Casual / Groove", "Casual / Groove", "Footwork / Swing", "Party", "Casual / Groove", "Street / upright"][i],
    [["step-change"], ["torso-twist"], ["heel-toe", "charleston"], ["arm-sequence"], ["kick-step"], ["upright-return"]][i],
    ["Dance", "Dance, Twist", "charleston_01", "Macarena Dance", "Mickey Dance", "UpRightSequence"][i], true)),
  extra("55-lambada", "55_02", "Lambada · nhún hông", "lateral-sway", 9.5, 12.7, "Casual / Social accent", ["hip-sway", "raised-elbow"], "lambada dance"),
  extra("55-bear", "55_12", "Bear groove · nhún vai", "bear-groove", 9, 12.2, "Party", ["elbow-pump", "wide-bounce"], "dancing bear (human subject)"),
  extra("85-toprock", "85_11", "Toprock · bước chéo", "upright-break", 2, 5.2, "Street / upright", ["cross-step", "arm-open"], "UpRightSequence"),
  extra("93-fancy", "93_08", "Charleston · chân chéo nhanh", "swing-footwork", .5, 3.7, "Footwork / Swing", ["cross-kick", "quick-feet"], "xtra fancY charleston"),
  extra("94-knee-open", "94_03", "Mở tay · nâng gối", "open-knee", 6, 9.2, "Footwork / descriptive", ["knee-lift", "wide-arms"], "Unknown; descriptive label from skeleton inspection, not verified dance style"),
  extra("94-diagonal", "94_06", "Tay chéo · đổi chân", "diagonal-step", 7.5, 10.7, "Energetic / descriptive", ["diagonal-reach", "single-leg-step"], "Unknown; descriptive label from skeleton inspection"),
  extra("94-point", "94_08", "Chỉ tay · bước ngang", "point-step", 19.5, 22.7, "Casual / descriptive", ["point-high", "side-step"], "Unknown; descriptive label from skeleton inspection"),
  extra("94-pulse", "94_16", "Nhún thấp · mở thân", "squat-pulse", 11.5, 14.7, "Energetic / descriptive", ["upright-pulse", "arm-expand"], "Unknown; descriptive label from skeleton inspection"),
  extra("143-chicken", "143_34", "Chicken · nhấn khuỷu tay", "chicken-arms", 1, 4.2, "Party", ["elbow-flap", "hands-close"], "Chicken Dance"),
  curated({ ...MOONWALK_PHRASE, id: "90-glide", role: "core" }, "Special upright travel", ["moonwalk", "backward-glide"], "moonwalk"),
];
/** V2.2.6: verified CMU source IDs, but NOT verified dance windows or gameplay assets.
 * Each 3.2s opening excerpt is a first-pass SURVEY ONLY. No source is
 * silently promoted to the normal shuffle pool or published character rig. */
export const DANCE_REVIEW_CANDIDATES: readonly CuratedPhrase[] = [
  curated({ id: "candidate-85-01", source: "85_01", label: "Jump Twist A · đầu nguồn (thăm dò)", group: "street-survey", start: .2, end: 3.4, policy: "FREE", exitMarkers: [3.2], referenceBpm: 120, tempoBasis: "testing-assumption", role: "core" }, "Street / jump-accent candidate", ["jump", "twist", "untrimmed"], "CMU #85 JumpTwist; sampled initial 3.2 seconds; inspect jumping/contact before inclusion"),
  curated({ id: "candidate-85-02", source: "85_02", label: "Jump Twist B · đầu nguồn (thăm dò)", group: "street-survey", start: .2, end: 3.4, policy: "FREE", exitMarkers: [3.2], referenceBpm: 120, tempoBasis: "testing-assumption", role: "core" }, "Street / jump-accent candidate", ["jump", "twist", "untrimmed"], "CMU #85 JumpTwist variant; sample, not validated independent choreography"),
  curated({ id: "candidate-85-04", source: "85_04", label: "Fancy Footwork · ứng viên Finish", group: "street-footwork-survey", start: .2, end: 3.4, policy: "FREE", exitMarkers: [3.2], referenceBpm: 120, tempoBasis: "testing-assumption", role: "core" }, "Street / footwork candidate", ["footwork", "untrimmed"], "CMU #85 FancyFootWork; owner selected for Finish; still pending entry, duration, dismount and REST validation"),
  curated({ id: "candidate-85-12", source: "85_12", label: "Long Break Sequence · đề xuất tách dance", group: "street-long-survey", start: .2, end: 3.4, policy: "FREE", exitMarkers: [3.2], referenceBpm: 120, tempoBasis: "testing-assumption", role: "core" }, "Street / long-form candidate", ["long-sequence", "untrimmed"], "CMU #85 LongSequenceGood; owner requested multiple dance excerpts; full source curation needed"),
  curated({ id: "candidate-85-14", source: "85_14", label: "Break Flips · thử tách dance an toàn", group: "floor-special-survey", start: .2, end: 3.4, policy: "PROTECTED", protectedRanges: [[0,3.2]], exitMarkers: [3.2], referenceBpm: 120, tempoBasis: "testing-assumption", role: "fixture" }, "Special / acrobatic (not ordinary)", ["flip", "protected", "not-random"], "CMU #85 BreakSequencewithFlips; owner requested segmentation if possible; keep protected floor/flip until safe exits proven"),
  curated({ id: "candidate-90-28", source: "90_28", label: "Breakdance · dance candidate (floor-protected)", group: "floor-special-survey", start: .2, end: 3.4, policy: "PROTECTED", protectedRanges: [[0,3.2]], exitMarkers: [3.2], referenceBpm: 120, tempoBasis: "testing-assumption", role: "fixture" }, "Special / breakdance (not ordinary)", ["floor", "protected", "not-random"], "CMU #90 breakdance; owner selected as dance candidate; protected floor motion pending safe SPACE exit validation"),
];
export const FINISH_PHRASES: readonly CuratedPhrase[] = [
  curated({ id: "finish-arm-accent", source: "90_33", label: "FINISH · thế rộng, tay vươn cao", group: "finish-accent", start: 5, end: 6.35, policy: "PROTECTED", protectedRanges: [[0, 1.35]], exitMarkers: [1.35], referenceBpm: 120, tempoBasis: "testing-assumption", role: "finish" }, "Finish / accent", ["wide-stance", "one-arm-up", "accent-hold"], "arm up wide leg roll; ONLY upright arm accent after roll, no inversion window"),
  curated({ id: "finish-spell", source: "120_03", label: "FINISH · mở tay nhấn nhạc", group: "finish-reach", start: 1, end: 2.4, policy: "PROTECTED", protectedRanges: [[0, 1.4]], exitMarkers: [1.4], referenceBpm: 120, tempoBasis: "testing-assumption", role: "finish" }, "Finish / expressive", ["upper-body-reach", "accent"], "Mickey cast spell; short upright opening, not whole take"),
];
/** Presentation only: authored closing sidestep and its settled standing tail.
 * Kept outside the normal shuffle pool and production assets. */
export const REST_PHRASES: readonly CuratedPhrase[] = [
  curated({ id: "recover-wide", source: "83_01", label: "Hồi phục · thu chân ngang", group: "rest-recovery", start: 3, end: 4.05, policy: "PROTECTED", protectedRanges: [[0, 1.05]], exitMarkers: [1.05], referenceBpm: 120, tempoBasis: "testing-assumption", role: "recovery" }, "Recovery / authored sidestep", ["close-stance", "weight-transfer", "arms-down"], "large sidestep to right; closing step only, no new command"),
  curated({ id: "recover-narrow", source: "83_01", label: "Hồi phục · về thế đứng", group: "rest-recovery", start: 3.65, end: 4.05, policy: "PROTECTED", protectedRanges: [[0, .4]], exitMarkers: [.4], referenceBpm: 120, tempoBasis: "testing-assumption", role: "recovery" }, "Recovery / authored sidestep", ["settle", "arms-down"], "large sidestep to right; final closing/settling section"),
  curated({ id: "rest-standing", source: "83_01", label: "REST · đứng chuyển trọng lượng nhẹ", group: "rest-idle", start: 4.05, end: 5.2, policy: "FREE", exitMarkers: [], referenceBpm: 120, tempoBasis: "testing-assumption", role: "idle" }, "Standing / authored tail", ["standing", "small-arm-motion", "weight-shift"], "large sidestep to right; settled standing tail, demo-only closed seam"),
];
export const FINISH_RECOVERY: Readonly<Record<string, string>> = { "finish-arm-accent": "recover-wide", "finish-spell": "recover-narrow" };
export const SOURCE_IDS = [...new Set([...NORMAL_PHRASES, ...FINISH_PHRASES, ...REST_PHRASES, ...FIXTURE_PHRASES, MOONWALK_PHRASE, ...DANCE_REVIEW_CANDIDATES].map(p => p.source))];
