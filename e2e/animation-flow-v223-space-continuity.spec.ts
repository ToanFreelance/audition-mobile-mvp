import { test, expect } from "@playwright/test";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import * as T from "three";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
import { NORMAL_PHRASES, FINISH_PHRASES, REST_PHRASES, SOURCE_PIN } from "../lib/animation-flow-v2/catalog";
import { makeCanonicalRig, preparePhrase, SourceFlowEngine, type SourceMotion } from "../lib/animation-flow-v2/engine";
import { closeStandingIdle } from "../lib/animation-flow-v2/finish-presentation";
import { FLARE_RISE_SPEC, FLARE_SPEC, FlareLibrary } from "../lib/animation-flow-v2/flare-performance";
import type { FlareSource } from "../lib/animation-flow-v2/flare-source";
import { SessionChoreography } from "../lib/animation-flow-v2/session-choreography";
import { GameplayPreview } from "../lib/animation-flow-v2/gameplay-preview";
import { describeSharedTurn } from "../multiplayer/determinism";

const source: FlareSource = JSON.parse(readFileSync("public/qa/animation-flow-v2/flare-source.json", "utf8"));
const clips = new Map<string, SourceMotion>();
const results: unknown[] = [];
test.beforeAll(async () => {
  for (const id of new Set([...NORMAL_PHRASES, ...FINISH_PHRASES, ...REST_PHRASES, FLARE_RISE_SPEC].map(p => p.source))) {
    const file = (process.env.ANIMATION_FLOW_BVH_DIR ?? "../audit/bvh") + "/" + id + ".bvh";
    const raw = existsSync(file) ? readFileSync(file, "utf8") : await fetch(
      "https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/" + SOURCE_PIN
      + "/data/" + id.split("_")[0].padStart(3, "0") + "/" + id + ".bvh"
    ).then(r => { if (!r.ok) throw Error(id); return r.text(); });
    if (!existsSync(file)) { mkdirSync(file.slice(0, file.lastIndexOf("/")), { recursive: true }); writeFileSync(file, raw); }
    clips.set(id, new BVHLoader().parse(raw));
  }
});
function prepare(bpm: number, fade: number, seed = 42) {
  const base = clips.get("111_05")!, rig = makeCanonicalRig(base);
  const engine = new SourceFlowEngine(rig, new Map(
    [...NORMAL_PHRASES, ...FINISH_PHRASES, ...REST_PHRASES].map(p =>
      [p.id, closeStandingIdle(preparePhrase(p, clips.get(p.source)!, rig, base))] as const
    )
  ));
  engine.bpm = bpm; engine.blendBeats = fade; engine.loopIdle = true; engine.start("143-party");
  const flare = new FlareLibrary(source, engine,
    preparePhrase(FLARE_RISE_SPEC, clips.get(FLARE_RISE_SPEC.source)!, rig, base));
  const session = new SessionChoreography(engine, seed, true, flare);
  session.instantGameplay = true;
  const game = new GameplayPreview(bpm, seed, (event, beat) => {
    session.select(beat, event.absoluteTurn, event.isFinish,
      !event.isFinish && describeSharedTurn(game.manifest, event.absoluteTurn + 1).isFinish,
      event.isFinish ? game.resumeBeatAfterFinish(event.absoluteTurn) : undefined);
  });
  return { engine, session, game };
}
for (const bpm of [110, 120, 160, 200]) for (const fade of [.15, .35, 1]) {
  test("Immediate SPACE + continuity at " + bpm + " BPM / fade " + fade, () => {
    const { engine, session, game } = prepare(bpm, fade);
    for (let beat = 0; beat <= 276; beat += .2) {
      game.advance(beat, true, "perfect");
      session.update(beat);
      engine.update(beat);
    }
    const normal = engine.history.filter(h => NORMAL_PHRASES.some(p => p.id === h.b));
    const selected = session.selections.filter(s => !s.finish);
    const rejected = selected.filter(s => !s.accepted);
    const delayed = normal.filter(h => Math.abs(h.visualStartBeat - h.requestedBeat) > 1e-6);
    const flares = engine.history.filter(h => h.b === FLARE_SPEC.id);
    results.push({ bpm, fade, selected: selected.length, rejected, delayed,
      continuityEvents: session.continuityEvents,
      flares: flares.map(h => h.flare), maxRadius: engine.maxRadius,
      finish: game.turns.filter(t => t.isFinish).map(t => t.absoluteTurn) });
    expect(rejected).toEqual([]);
    expect(delayed).toEqual([]);
    expect(normal.length).toBeGreaterThan(5);
    expect(engine.history.every(h => h.entryDisplacement < 1e-6)).toBe(true);
    expect(engine.maxRadius).toBeLessThanOrEqual(1.35);
    expect(engine.stageAnchor.position.toArray()).toEqual([0, 0, 0]);
    expect(game.turns.filter(t => t.isFinish).map(t => t.absoluteTurn)).toEqual([38, 62]);
    expect(game.turns.filter(t => t.roomRest && t.absoluteTurn < 43).map(t => t.absoluteTurn)).toEqual([39, 40, 41, 42]);
    expect(game.turns[43]).toMatchObject({ level: 6, sequenceIndex: 4, status: "NORMAL" });
    expect(flares).toHaveLength(2);
    for (const h of flares) {
      expect(h.requestedBeat).toBeCloseTo(h.visualStartBeat, 6);
      expect(h.flare!.readyBeat).toBeCloseTo(h.flare!.resumeBeat - 1, 6);
      expect(h.flare!.loopCount).toBeGreaterThanOrEqual(2);
      expect(h.flare!.playbackRate).toBeGreaterThanOrEqual(.85);
      expect(h.flare!.playbackRate).toBeLessThanOrEqual(1.15);
    }
    expect(session.continuityEvents.every(e => e.accepted)).toBe(true);
    if (bpm === 200) expect(session.continuityEvents.length).toBeGreaterThan(0);
  });
}
test("Flare dismount has living idle for one beat at 110-200 BPM", () => {
  for (const bpm of [110, 120, 160, 200]) {
    const { engine, session, game } = prepare(bpm, .35);
    for (let beat = 0; beat <= 160; beat += .25) { game.advance(beat, true, "perfect"); session.update(beat); }
    const p = engine.phrases.get(FLARE_SPEC.id)!, plan = p.flare!;
    const rotations = (seconds: number) => p.rotations.map(r => new T.Quaternion().fromArray(r.evaluate(seconds)));
    const a = rotations(p.duration - plan.readySeconds * .75), b = rotations(p.duration - plan.readySeconds * .15);
    const maxAngle = Math.max(...a.map((q, i) => q.angleTo(b[i])));
    expect(maxAngle).toBeGreaterThan(1e-5);
    expect(plan.readySeconds * bpm / 60).toBeCloseTo(1, 7);
    expect(plan.readyBeat).toBeCloseTo(plan.resumeBeat - 1, 7);
    results.push({ case: "idle-visible", bpm, readySeconds: plan.readySeconds, jointChangeRad: maxAngle });
  }
});
test("Immediate gameplay flag cannot interrupt a protected Finish", () => {
  const { engine } = prepare(120, .35);
  engine.start("finish-arm-accent");
  expect(engine.request("111-groove", 1, undefined, true)).toBe(true);
  expect(engine.pending).not.toBeNull();
  expect(engine.pending!.dueBeat).toBeGreaterThan(1);
});
test.afterAll(() => {
  mkdirSync("test-results/animation-flow-v223", { recursive: true });
  writeFileSync("test-results/animation-flow-v223/immediate-space-validation.json", JSON.stringify(results, null, 2));
});
