import { expect, test } from "@playwright/test";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as T from "three";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
import { CORE_PHRASES, FIXTURE_PHRASES, FAILING_PAIRS, SOURCE_PIN, SOURCE_IDS, MOONWALK_PHRASE } from "../lib/animation-flow-v2/catalog";
import { DemoBeatClock, TurnCursor } from "../lib/animation-flow-v2/clock";
import { PhraseBag } from "../lib/animation-flow-v2/shuffle";
import { makeCanonicalRig, preparePhrase, SourceFlowEngine, safeExitTime, type SourceMotion } from "../lib/animation-flow-v2/engine";

test.describe.configure({ mode: "default" });
const sources = new Map<string, SourceMotion>();
const outputs: unknown[] = [];
test.beforeAll(async () => {
  test.setTimeout(120000);
  await Promise.all(SOURCE_IDS.map(async id => {
    const local = join(process.env.ANIMATION_FLOW_BVH_DIR ?? ".cache/animation-flow-v2", id + ".bvh");
    const text = existsSync(local) ? readFileSync(local, "utf8") : await fetch(`https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/${SOURCE_PIN}/data/${id.split("_")[0].padStart(3, "0")}/${id}.bvh`).then(r => { if (!r.ok) throw new Error("BVH HTTP " + r.status); return r.text(); });
    sources.set(id, new BVHLoader().parse(text));
  }));
});

function engine() {
  const base = sources.get("111_05")!; const rig = makeCanonicalRig(base);
  const phrases = new Map([...CORE_PHRASES, ...FIXTURE_PHRASES, MOONWALK_PHRASE].map(spec => [spec.id, preparePhrase(spec, sources.get(spec.source)!, rig, base)]));
  return new SourceFlowEngine(rig, phrases);
}

test("AudioContext seconds → beats: BPM changes and dropped frames preserve exactly one boundary per global turn", () => {
  const clock = new DemoBeatClock(), turns = new TurnCursor(); clock.reset(10);
  expect(clock.beat(12)).toBe(4); expect(turns.consume(clock.beat(12))).toEqual([4]);
  clock.setBpm(160, 12); expect(clock.beat(12)).toBe(4);
  expect(clock.beat(13.5)).toBe(8); expect(turns.consume(clock.beat(19.5))).toEqual([8, 12, 16, 20, 24]);
  expect(turns.consume(clock.beat(19.5))).toEqual([]); expect(turns.index).toBe(6);
});

test("phrase normalization preserves local travel, fixed bone offsets and bounded one-shot source time", () => {
  const flow = engine(); const boneOffsets = flow.rig.bones.map(b => b.position.clone());
  for (const spec of CORE_PHRASES) {
    const p = flow.phrases.get(spec.id)!;
    expect(p.path[0].x).toBeCloseTo(0, 9); expect(p.path[0].z).toBeCloseTo(0, 9);
    expect(p.path.every(v => v.toArray().every(Number.isFinite))).toBe(true);
    expect(p.clip.tracks.filter(t => t.name.endsWith(".position")).map(t => t.name)).toEqual(["motionRoot.position"]);
    flow.start(spec.id); for (let beat = 0; beat < 32; beat += 0.05) flow.update(beat);
    expect(flow.snapshot().heldAtEnd).toBe(true); expect(flow.snapshot().sourceTime).toBeCloseTo(spec.end, 4);
    flow.rig.bones.forEach((b, i) => expect(b.position.distanceTo(boneOffsets[i])).toBe(0));
  }
  const glide = flow.phrases.get(MOONWALK_PHRASE.id)!;
  expect(Math.max(...glide.path.map(p => Math.hypot(p.x, p.z)))).toBeGreaterThan(0.5);
});

test("shuffle suppresses phrase/source/group repetitions and is seed-replayable", () => {
  const a = new PhraseBag(CORE_PHRASES, 123), b = new PhraseBag(CORE_PHRASES, 123), c = new PhraseBag(CORE_PHRASES, 321);
  const seen: typeof CORE_PHRASES[number][] = []; const other: string[] = [];
  const violations: string[] = [];
  for (let i = 0; i < 10000; i++) {
    const p = a.next()!; if (!p || b.next()?.id !== p.id) violations.push("seed/null " + i); other.push(c.next()!.id);
    if (seen.slice(-3).some(r => r.id === p.id)) violations.push("phrase " + i);
    if (seen.slice(-2).some(r => r.source === p.source)) violations.push("source " + i);
    if (seen.at(-1)?.group === p.group) violations.push("group " + i); seen.push(p);
  }
  expect(violations).toEqual([]);
  expect(seen.slice(0, 20).map(p => p.id)).not.toEqual(other.slice(0, 20));
});

for (const bpm of [120, 160]) for (const fade of [0.35, 1]) for (const manual of [false, true]) {
  test(`40+ transitions at ${bpm} BPM / ${fade} beat / ${manual ? "manual interruptions" : "automatic four beats"}`, () => {
    const flow = engine(), bag = new PhraseBag(CORE_PHRASES, 20261018), cursor = new TurnCursor();
    flow.bpm = bpm; flow.blendBeats = fade; flow.start(bag.next()!.id);
    let manualAt = 0.47, requests = 0; const turnEvents: number[] = [];
    const seconds = manual ? 34 : 41 * 240 / bpm;
    for (let t = 1 / 120; t <= seconds; t += 1 / 120) {
      const beat = t * bpm / 60;
      for (const boundary of cursor.consume(beat)) {
        turnEvents.push(boundary); flow.update(boundary);
        if (!manual) { const next = bag.next(p => Boolean(flow.placement(p.id)) && p.source !== flow.current?.phrase.spec.source && p.group !== flow.current?.phrase.spec.group); if (next) { flow.request(next.id, boundary); requests++; } }
      }
      flow.update(beat);
      if (manual && t >= manualAt) { const next = bag.next(p => Boolean(flow.placement(p.id)) && p.source !== flow.current?.phrase.spec.source && p.group !== flow.current?.phrase.spec.group); if (next) { flow.request(next.id, beat); requests++; } manualAt += 0.47; }
    }
    const state = flow.snapshot(); expect(state.transitionCount).toBeGreaterThanOrEqual(39);
    expect(state.maxRadius).toBeLessThanOrEqual(flow.radius); expect(state.maxFrameStep).toBeLessThan(0.1);
    expect(flow.stageAnchor.position.toArray()).toEqual([0, 0, 0]); expect(state.loopSeamWarning).toBeNull();
    for (const record of flow.history.slice(1)) expect(record.entryDisplacement).toBeLessThan(1e-6);
    expect(new Set(turnEvents).size).toBe(turnEvents.length); expect(turnEvents).toEqual(Array.from({ length: cursor.index }, (_, i) => (i + 1) * 4));
    const history = flow.history.slice(1); for (let i = 1; i < history.length; i++) { expect(history[i].source).not.toBe(history[i - 1].source); expect(history[i].group).not.toBe(history[i - 1].group); }
    outputs.push({ bpm, fade, manual, requests, state, transitions: flow.history, turnEvents });
  });
}

test("protected recovery and coalesced pending SPACE never extend or duplicate global turns", () => {
  const flow = engine(); flow.start("fixture-85_10");
  flow.request("fixture-89_03", 4); expect(flow.pending?.dueBeat).toBeCloseTo(11.4);
  flow.request("fixture-111_05", 5); expect(flow.pending?.dueBeat).toBeCloseTo(11.4);
  flow.update(11.39); expect(flow.snapshot().current).toBe("fixture-85_10");
  flow.update(11.4); expect(flow.snapshot().current).toBe("fixture-111_05");
  expect(flow.history.at(-1)?.policy).toBe("PROTECTED"); expect(flow.history.at(-1)?.entryDisplacement).toBeLessThan(1e-6);
  const fixture = FIXTURE_PHRASES.find(p => p.source === "89_03")!;
  expect(safeExitTime(fixture, 0.8, 2.24, "FREE").policy).toBe("PROTECTED");
});

test("known failing pairs: original mixer reproduction → normalized entry and blend measurements", () => {
  for (const pair of FAILING_PAIRS) {
    const oldBase = sources.get(pair.id === "showdown-floor" ? "85_10" : "111_05")!;
    // Audit Showdown normalization used 85_03; use the exact audited scale/offset.
    const scale = pair.id === "showdown-floor" ? 0.06359731003893797 : 0.06603601561687863;
    const group = new T.Group(), root = oldBase.skeleton.bones[0].clone(true); group.add(root); group.scale.setScalar(scale);
    const a = T.AnimationUtils.subclip(sources.get(pair.a)!.clip, "a", 1, 99999, 120);
    const b = T.AnimationUtils.subclip(sources.get(pair.b)!.clip, "b", 1, 99999, 120);
    const mixer = new T.AnimationMixer(root), aa = mixer.clipAction(a), bb = mixer.clipAction(b); aa.play(); mixer.update(2); group.updateMatrixWorld(true);
    const before = root.getWorldPosition(new T.Vector3()); bb.reset().play(); aa.crossFadeTo(bb, 0.175, false);
    for (let i = 0; i < 42; i++) mixer.update(1 / 240); group.updateMatrixWorld(true);
    const after = root.getWorldPosition(new T.Vector3()); const old = Math.hypot(after.x - before.x, after.z - before.z);
    expect(old).toBeCloseTo(pair.before, 2);
    const flow = engine(); flow.start("fixture-" + pair.a); flow.update(4);
    flow.request("fixture-" + pair.b, 4);
    for (let beat = 4; beat <= 17; beat += 1 / 120) flow.update(beat);
    const record = flow.history.find(r => r.b === "fixture-" + pair.b)!;
    expect(record).toBeTruthy(); expect(record.entryDisplacement).toBeLessThan(1e-6);
    expect(flow.snapshot().maxRadius).toBeLessThanOrEqual(flow.radius);
    outputs.push({ pair: pair.id, beforeAudit: old, afterV2: record, snapshot: flow.snapshot(), note: "V1 fade travel and V2 entry error are distinct metrics; V2 uses canonical body scale." });
    mixer.stopAllAction();
  }
});

test.afterAll(() => {
  mkdirSync("test-results/animation-flow-v2", { recursive: true });
  writeFileSync("test-results/animation-flow-v2/data-validation.json", JSON.stringify({ sourcePin: SOURCE_PIN, results: outputs }, null, 2));
});
