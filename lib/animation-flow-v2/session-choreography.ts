import { FINISH_PHRASES, FINISH_RECOVERY, NORMAL_PHRASES } from "./catalog";
import { SourceFlowEngine } from "./engine";
import { PhraseBag } from "./shuffle";
import { FinishPresentation } from "./finish-presentation";
import { FlareLibrary, FLARE_SPEC } from "./flare-performance";
/** Visual consumer only; cannot create or advance a gameplay turn. */
export class SessionChoreography {
  readonly bag: PhraseBag;
  readonly selections: { beat: number; absoluteTurn: number | null; finish: boolean; eligibleIds: string[]; selected: string | null; accepted: boolean }[] = [];
  readonly continuityEvents: { beat: number; previous: string; next: string; accepted: boolean; reason: string }[] = [];
  /** Opt-in: only the actual Gameplay Preview uses immediate successful-SPACE transitions. */
  instantGameplay = false;
  private previousFinish: string | null = null;
  readonly presentation: FinishPresentation | null;
  finishChoice: string | null;
  constructor(readonly engine: SourceFlowEngine, seed: number, postFinish = false, flare?: FlareLibrary) {
    this.bag = new PhraseBag(NORMAL_PHRASES, seed); this.presentation = postFinish ? new FinishPresentation(engine,flare) : null;
    this.finishChoice=flare?FLARE_SPEC.id:null;
  }
  update(beat: number) {
    this.presentation?.update(beat);
    if (!this.instantGameplay || this.presentation?.snapshot().active) return;
    const current = this.engine.current;
    if (!current || current.phrase.spec.role !== "core") return;
    const endBeat = current.startBeat + current.phrase.duration * current.phrase.spec.referenceBpm / 60;
    if (beat + 1e-7 < endBeat) return;
    // A clip ending during HIDDEN / a long gap must remain alive. This is a
    // presentation-only continuation, never a synthetic SPACE or global turn.
    this.engine.update(beat);
    const hasIdle = this.engine.phrases.has("rest-standing");
    const accepted = hasIdle && Boolean(this.engine.placement("rest-standing"))
      && this.engine.request("rest-standing", beat, .25, true);
    this.continuityEvents.push({
      beat, previous: current.phrase.spec.id, next: "rest-standing", accepted,
      reason: accepted ? "authored-living-idle-after-one-shot" : "idle-placement-unavailable"
    });
  }
  select(beat: number, absoluteTurn: number | null, finish = false, finishNext = false, resumeBeat?: number) {
    // Process Finish deadlines, but do not insert an idle on the very beat
    // a successful SPACE is requesting its next ordinary choreography.
    this.presentation?.update(beat); this.engine.update(beat);
    this.presentation?.resetRecoveryCandidates();
    if(finish&&this.finishChoice===FLARE_SPEC.id&&resumeBeat!==undefined){
      const accepted=this.presentation?.requestFlare(beat,absoluteTurn,resumeBeat,this.instantGameplay)??false;
      this.selections.push({beat,absoluteTurn,finish:true,eligibleIds:accepted?[FLARE_SPEC.id]:[],selected:accepted?FLARE_SPEC.id:null,accepted});
      if(accepted)return true;
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
    this.selections.push({ beat, absoluteTurn, finish, eligibleIds: eligible.map(p => p.id), selected: chosen?.id ?? null, accepted });
    return accepted;
  }
  manual(beat: number, status: string | undefined) {
    if (status !== "NORMAL" || this.presentation?.snapshot().active || this.engine.current?.phrase.spec.role === "finish" || this.engine.pending?.id.startsWith("finish-")) return false;
    return this.select(beat, null);
  }
}
