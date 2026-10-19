import { FINISH_PHRASES, FINISH_RECOVERY, NORMAL_PHRASES } from "./catalog";
import { SourceFlowEngine } from "./engine";
import { PhraseBag } from "./shuffle";
import { FinishPresentation } from "./finish-presentation";
/** Visual consumer only; cannot create or advance a gameplay turn. */
export class SessionChoreography {
  readonly bag: PhraseBag;
  readonly selections: { beat: number; absoluteTurn: number | null; finish: boolean; eligibleIds: string[]; selected: string | null; accepted: boolean }[] = [];
  private previousFinish: string | null = null;
  readonly presentation: FinishPresentation | null;
  constructor(readonly engine: SourceFlowEngine, seed: number, postFinish = false) {
    this.bag = new PhraseBag(NORMAL_PHRASES, seed); this.presentation = postFinish ? new FinishPresentation(engine) : null;
  }
  update(beat: number) { this.presentation?.update(beat); }
  select(beat: number, absoluteTurn: number | null, finish = false, finishNext = false) {
    this.update(beat); this.engine.update(beat);
    this.presentation?.resetRecoveryCandidates();
    const current = this.engine.current?.phrase.spec;
    const pool = finish ? FINISH_PHRASES : NORMAL_PHRASES;
    const eligible = pool.filter(p => (finish || (p.source !== current?.source && p.group !== current?.group)) && this.engine.placementAtExit(p.id, beat)
      && (!finish || !this.presentation || this.engine.canFollowAtEnd(p.id, [FINISH_RECOVERY[p.id]], beat))
      && (!finishNext || this.engine.canFollowAt(p.id, FINISH_PHRASES.map(f => f.id), beat, beat + 4, this.presentation ? FINISH_RECOVERY : undefined)));
    const timely = finishNext && this.presentation ? eligible.filter(p => this.engine.nextExitDelayAt(p.id, beat, beat + 4) <= .35) : [];
    const chosen = finish ? eligible.find(p => p.id !== this.previousFinish) ?? eligible[0]
      : (timely.length ? this.bag.next(p => timely.some(e => e.id === p.id)) : null) ?? this.bag.next(p => eligible.some(e => e.id === p.id));
    const accepted = Boolean(chosen && this.engine.request(chosen.id, beat));
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
