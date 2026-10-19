import { FINISH_PHRASES, NORMAL_PHRASES } from "./catalog";
import { SourceFlowEngine } from "./engine";
import { PhraseBag } from "./shuffle";
/** Visual consumer only; cannot create or advance a gameplay turn. */
export class SessionChoreography {
  readonly bag: PhraseBag;
  readonly selections: { beat: number; absoluteTurn: number | null; finish: boolean; eligibleIds: string[]; selected: string | null; accepted: boolean }[] = [];
  private previousFinish: string | null = null;
  constructor(readonly engine: SourceFlowEngine, seed: number) { this.bag = new PhraseBag(NORMAL_PHRASES, seed); }
  select(beat: number, absoluteTurn: number | null, finish = false, finishNext = false) {
    this.engine.update(beat);
    const current = this.engine.current?.phrase.spec;
    const pool = finish ? FINISH_PHRASES : NORMAL_PHRASES;
    const eligible = pool.filter(p => (finish || (p.source !== current?.source && p.group !== current?.group)) && this.engine.placementAtExit(p.id, beat)
      && (!finishNext || this.engine.canFollowAt(p.id, FINISH_PHRASES.map(f => f.id), beat, beat + 4)));
    const chosen = finish ? eligible.find(p => p.id !== this.previousFinish) ?? eligible[0] : this.bag.next(p => eligible.some(e => e.id === p.id));
    const accepted = Boolean(chosen && this.engine.request(chosen.id, beat));
    if (accepted && finish) this.previousFinish = chosen!.id;
    this.selections.push({ beat, absoluteTurn, finish, eligibleIds: eligible.map(p => p.id), selected: chosen?.id ?? null, accepted });
    return accepted;
  }
  manual(beat: number, status: string | undefined) {
    if (status !== "NORMAL" || this.engine.current?.phrase.spec.role === "finish" || this.engine.pending?.id.startsWith("finish-")) return false;
    return this.select(beat, null);
  }
}
