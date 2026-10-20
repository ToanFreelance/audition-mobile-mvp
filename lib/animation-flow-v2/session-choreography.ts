import { FINISH_PHRASES, FINISH_RECOVERY, NORMAL_PHRASES, type PhraseSpec } from "./catalog";
import { SourceFlowEngine } from "./engine";
import { PhraseBag } from "./shuffle";
import { FinishPresentation } from "./finish-presentation";
import { FlareLibrary, FLARE_SPEC } from "./flare-performance";
/** Visual consumer only; cannot create or advance a gameplay turn. */
export class SessionChoreography {
  readonly bag: PhraseBag;
  readonly selections: { beat: number; absoluteTurn: number | null; finish: boolean; eligibleIds: string[]; selected: string | null; accepted: boolean }[] = [];
  readonly continuityEvents: { beat: number; previous: string; next: string; accepted: boolean; reason: string; kind?: "dance-bridge" | "living-idle"; requestedAtBeat?: number }[] = [];
  /** Opt-in: only the actual Gameplay Preview uses immediate successful-SPACE transitions. */
  instantGameplay = false;
  /** Only levels 6–9 sustain ordinary dance between valid SPACE commands. */
  private sustainHighLevelDance = false;
  private readonly bridgeBag: PhraseBag;
  private readonly bridgeFadeCapBeats = .35;
  private previousFinish: string | null = null;
  readonly presentation: FinishPresentation | null;
  finishChoice: string | null;
  constructor(readonly engine: SourceFlowEngine, seed: number, postFinish = false, flare?: FlareLibrary) {
    this.bag = new PhraseBag(NORMAL_PHRASES, seed);
    // Continuation has its own deterministic shuffle state; only real SPACE
    // judgements consume the ordinary choreography bag.
    this.bridgeBag = new PhraseBag(NORMAL_PHRASES, (seed ^ 0x52485248) >>> 0);
    this.presentation = postFinish ? new FinishPresentation(engine,flare) : null;
    this.finishChoice=flare?FLARE_SPEC.id:null;
  }
  /**
   * Sustain visible choreography without creating a SPACE or global turn.
   * A pre-end dance bridge is a visual continuation, never a gameplay action.
   * Schedule at the SOURCE beat, not the RAF frame, to survive sparse frames.
   */
  private sustain(beat: number, beforeJudgement = false) {
    this.presentation?.update(beat);
    if (!this.instantGameplay || this.presentation?.snapshot().active) return;
    const deadline = beforeJudgement ? beat - 1e-6 : beat;
    for (let guard = 0; guard < 24; guard++) {
      const current = this.engine.current;
      if (!current || current.phrase.spec.role !== "core") return;
      const durationBeats = current.phrase.duration * current.phrase.spec.referenceBpm / 60;
      const bridgeFade = Math.min(this.bridgeFadeCapBeats, Math.max(.15, this.engine.blendBeats));
      const bridgeBeat = current.startBeat + Math.max(0, durationBeats - bridgeFade);
      const endBeat = current.startBeat + durationBeats;
      const scheduled = this.sustainHighLevelDance ? bridgeBeat : endBeat;
      if (scheduled > deadline + 1e-7) return;
      // Advance at the exact end/bridge instant even when RAF is very late.
      this.engine.update(scheduled);
      const eligible = (p: PhraseSpec) =>
        p.id !== current.phrase.spec.id && Boolean(this.engine.placement(p.id));
      if (this.sustainHighLevelDance) {
        const differentStyle = (p: PhraseSpec) =>
          eligible(p) && p.source !== current.phrase.spec.source && p.group !== current.phrase.spec.group;
        const next = this.bridgeBag.next(differentStyle)
          ?? this.bridgeBag.next(eligible)
          ?? (this.engine.placement(current.phrase.spec.id) ? current.phrase.spec : null);
        const accepted = Boolean(next && this.engine.request(next.id, scheduled, bridgeFade, true)
          && this.engine.current?.phrase.spec.id === next.id && !this.engine.pending);
        this.continuityEvents.push({
          beat: scheduled, requestedAtBeat: beat, previous: current.phrase.spec.id,
          next: next?.id ?? "none", accepted, kind: "dance-bridge",
          reason: accepted ? "pre-end-continuous-dance" : "no-spatial-facing-compatible-bridge"
        });
        if (accepted) continue;
        // Never report a rejected bridge as motion continuity PASS. Fall back to
        // the existing living idle, but expose the root cause in telemetry.
        const idle = this.engine.phrases.get("rest-standing");
        if (idle && this.engine.placement(idle.spec.id))
          this.engine.request(idle.spec.id, scheduled, bridgeFade, true);
        return;
      }
      // Preserve the L1–L5 behavior that the owner already accepted.
      const accepted = this.engine.phrases.has("rest-standing")
        && Boolean(this.engine.placement("rest-standing"))
        && this.engine.request("rest-standing", scheduled, .25, true);
      this.continuityEvents.push({
        beat: scheduled, requestedAtBeat: beat, previous: current.phrase.spec.id,
        next: "rest-standing", accepted, kind: "living-idle",
        reason: accepted ? "authored-living-idle-after-one-shot" : "idle-placement-unavailable"
      });
      return;
    }
    this.continuityEvents.push({
      beat, previous: this.engine.current?.phrase.spec.id ?? "none",
      next: "none", accepted: false, kind: "dance-bridge",
      reason: "sparse-catchup-guard"
    });
  }
  update(beat: number) { this.sustain(beat); }
  select(beat: number, absoluteTurn: number | null, finish = false, finishNext = false, resumeBeat?: number, level?: number) {
    // Catch up every pre-end bridge *before* the incoming judgement; never
    // synthesize a bridge right on top of a new successful SPACE.
    this.sustain(beat, true);
    this.presentation?.update(beat); this.engine.update(beat);
    this.presentation?.resetRecoveryCandidates();
    if(finish&&this.finishChoice===FLARE_SPEC.id&&resumeBeat!==undefined){
      const accepted=this.presentation?.requestFlare(beat,absoluteTurn,resumeBeat,this.instantGameplay)??false;
      this.selections.push({beat,absoluteTurn,finish:true,eligibleIds:accepted?[FLARE_SPEC.id]:[],selected:accepted?FLARE_SPEC.id:null,accepted});
      if(accepted){this.sustainHighLevelDance=false;return true;}
      // Explicit deterministic fallback remains the old protected accent path.
    }
    const current = this.engine.current?.phrase.spec;
    const pool = finish ? FINISH_PHRASES : NORMAL_PHRASES;
    const immediate = this.instantGameplay && !finish;
    const compatible = (p: (typeof NORMAL_PHRASES)[number]) =>
      (!finish || !this.finishChoice || this.finishChoice === FLARE_SPEC.id || p.id === this.finishChoice)
      && Boolean(this.engine.placementAtExit(p.id, beat, immediate))
      && (!finish || !this.presentation || this.engine.canFollowAtEnd(p.id, [FINISH_RECOVERY[p.id]], beat))
      && (!finishNext || this.engine.canFollowAt(p.id, FINISH_PHRASES.map(f => f.id), beat, beat + 4, this.presentation ? FINISH_RECOVERY : undefined));
    const strict = pool.filter(p => (finish || (p.source !== current?.source && p.group !== current?.group)) && compatible(p));
    // Do not silently swallow a successful SPACE just because anti-repeat
    // restrictions exhaust the currently spatially safe candidates.
    const eligible = immediate && strict.length === 0
      ? pool.filter(p => p.id !== current?.id && compatible(p)) : strict;
    const timely = finishNext && this.presentation && !immediate
      ? eligible.filter(p => this.engine.nextExitDelayAt(p.id, beat, beat + 4) <= .35) : [];
    const chosen = finish ? eligible.find(p => p.id !== this.previousFinish) ?? eligible[0]
      : (timely.length ? this.bag.next(p => timely.some(e => e.id === p.id)) : null) ?? this.bag.next(p => eligible.some(e => e.id === p.id));
    const accepted = Boolean(chosen && this.engine.request(chosen.id, beat, undefined, immediate));
    if (accepted && this.presentation) {
      if (finish) this.presentation.begin(chosen!.id, beat, absoluteTurn);
      else this.presentation.resume(beat);
    }
    if (accepted && finish) this.previousFinish = chosen!.id;
    if (accepted) this.sustainHighLevelDance = !finish && level !== undefined && level >= 6;
    this.selections.push({ beat, absoluteTurn, finish, eligibleIds: eligible.map(p => p.id), selected: chosen?.id ?? null, accepted });
    return accepted;
  }
  manual(beat: number, status: string | undefined, level?: number) {
    if (status !== "NORMAL" || this.presentation?.snapshot().active || this.engine.current?.phrase.spec.role === "finish" || this.engine.pending?.id.startsWith("finish-")) return false;
    return this.select(beat, null, false, false, undefined, level);
  }
}
