import { FINISH_PHRASES, FINISH_RECOVERY, FANCY_FOOTWORK_FINISH, NORMAL_PHRASES, type PhraseSpec } from "./catalog";
import { SourceFlowEngine } from "./engine";
import { PhraseBag } from "./shuffle";
import { FinishPresentation } from "./finish-presentation";
import { FlareLibrary, FLARE_SPEC } from "./flare-performance";
import { DEFAULT_STYLE_RUN_SPACES, isModernFamily, isPlayableModernPhrase, otherModernFamily, phraseFamily, type ModernFamily } from "./style-policy";
/** Visual consumer only; cannot create or advance a gameplay turn. */
export class SessionChoreography {
  readonly bag: PhraseBag;
  readonly selections: { beat: number; absoluteTurn: number | null; finish: boolean; eligibleIds: string[]; selected: string | null; accepted: boolean; danceFamily?: string | null; styleChanged?: boolean }[] = [];
  readonly continuityEvents: { beat: number; previous: string; next: string; accepted: boolean; reason: string; kind?: "dance-bridge" | "living-idle"; requestedAtBeat?: number; danceFamily?: string | null }[] = [];
  /** Opt-in: only the actual Gameplay Preview uses immediate successful-SPACE transitions. */
  instantGameplay = false;
  /** Only levels 6–9 sustain ordinary dance between valid SPACE commands. */
  private sustainHighLevelDance = false;
  private readonly bridgeBag: PhraseBag;
  private readonly bridgeFadeCapBeats = .35;
  /** Opt-in curated upright Break clips; never replaces normal accepted catalog. */
  private experimentalPhrases: readonly PhraseSpec[] = [];
  private experimentalSpaceBag: PhraseBag | null = null;
  private experimentalBridgeBag: PhraseBag | null = null;
  readonly experimentalSelections: { beat: number; id: string; kind: "space" | "bridge" }[] = [];
  setExperimentalPhrases(phrases: readonly PhraseSpec[]) {
    // Only prepared, uniquely identified experimental core clips can play.
    this.experimentalPhrases = phrases.filter(p =>
      p.id.startsWith("break-") && p.role === "core" && p.policy === "FREE"
      && this.engine.phrases.has(p.id));
    this.experimentalSpaceBag = this.experimentalPhrases.length
      ? new PhraseBag(this.experimentalPhrases, (this.bag.seed ^ 0x45585041) >>> 0) : null;
    this.experimentalBridgeBag = this.experimentalPhrases.length
      ? new PhraseBag(this.experimentalPhrases, (this.bag.seed ^ 0x42524944) >>> 0) : null;
  }
  /** Style chapters advance only on actual successful SPACE judgements. */
  private activeStyle: ModernFamily = "pop";
  private spacesInStyle = 0;
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
        const currentFamily = phraseFamily(current.phrase.spec);
        // HIDDEN bridges must remain in the same style as the active dance.
        // A same-source repeat is preferable to an abrupt swing/social jump.
        const sameFamily = (p: PhraseSpec) =>
          eligible(p) && isPlayableModernPhrase(p) && isModernFamily(currentFamily) && phraseFamily(p) === currentFamily;
        const differentMotion = (p: PhraseSpec) =>
          sameFamily(p) && p.source !== current.phrase.spec.source && p.group !== current.phrase.spec.group;
        const extraBridge = this.experimentalBridgeBag && current.phrase.spec.id.startsWith("break-")
          ? this.experimentalBridgeBag.next(p => differentMotion(p)) : null;
        const next = (current.phrase.spec.id.startsWith("break-") ? extraBridge : null)
          ?? this.bridgeBag.next(differentMotion)
          ?? this.bridgeBag.next(sameFamily)
          ?? extraBridge
          ?? (isModernFamily(currentFamily) && this.engine.placement(current.phrase.spec.id)
            ? current.phrase.spec : null);
        const accepted = Boolean(next && this.engine.request(next.id, scheduled, bridgeFade, true)
          && this.engine.current?.phrase.spec.id === next.id && !this.engine.pending);
        this.continuityEvents.push({
          beat: scheduled, requestedAtBeat: beat, previous: current.phrase.spec.id,
          next: next?.id ?? "none", accepted, kind: "dance-bridge",
          danceFamily: currentFamily,
          reason: accepted ? (next?.id === current.phrase.spec.id ? "same-style-repeat" : "same-style-dance-bridge")
            : "no-same-style-compatible-bridge"
        });
        if (accepted) {
          if (next?.id.startsWith("break-"))
            this.experimentalSelections.push({ beat: scheduled, id: next.id, kind: "bridge" });
          continue;
        }
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
    const pool: readonly (typeof NORMAL_PHRASES)[number][] = finish
      ? FINISH_PHRASES : [...NORMAL_PHRASES, ...this.experimentalPhrases.map(p => p as (typeof NORMAL_PHRASES)[number])];
    const immediate = this.instantGameplay && !finish;
    // Owner-selected QA Finish is fired at the actual successful Finish beat
    // when the outgoing phrase is not protected; it never shifts global turns.
    const fancyImmediate = this.instantGameplay && finish
      && this.finishChoice === FANCY_FOOTWORK_FINISH.id;
    const compatible = (p: (typeof NORMAL_PHRASES)[number]) =>
      (!finish || !this.finishChoice || this.finishChoice === FLARE_SPEC.id || p.id === this.finishChoice)
      && Boolean(this.engine.placementAtExit(p.id, beat, immediate || fancyImmediate))
      // Fancy Finish's recovery is generated/mirrored FROM THE DISPLAYED
      // FINAL POSE by FinishPresentation.alignRecovery(), not from the
      // unaligned catalog recovery used by canFollowAtEnd(). Testing the
      // unaligned version rejects valid Fancy clips before request().
      && (!finish || !this.presentation || fancyImmediate
        || this.engine.canFollowAtEnd(p.id, [FINISH_RECOVERY[p.id]], beat))
      && (!finishNext || this.engine.canFollowAt(p.id, FINISH_PHRASES.map(f => f.id), beat, beat + 4, this.presentation ? FINISH_RECOVERY : undefined));
    const strict = pool.filter(p => (finish || (p.source !== current?.source && p.group !== current?.group)) && compatible(p));
    // Street/Pop chapters: a real SPACE may change family only after a
    // coherent run; HIDDEN continuations never advance the chapter.
    const desiredFamily = immediate && this.spacesInStyle >= DEFAULT_STYLE_RUN_SPACES
      ? otherModernFamily(this.activeStyle) : this.activeStyle;
    const strictModern = strict.filter(isPlayableModernPhrase);
    const looseModern = immediate ? pool.filter(p => p.id !== current?.id
      && isPlayableModernPhrase(p) && compatible(p)) : [];
    const inFamily = (items: readonly (typeof NORMAL_PHRASES)[number][], family: ModernFamily) =>
      items.filter(p => phraseFamily(p) === family);
    const preferred = [
      inFamily(strictModern, desiredFamily),
      inFamily(strictModern, this.activeStyle),
      inFamily(looseModern, desiredFamily),
      inFamily(looseModern, this.activeStyle),
      strictModern, looseModern
    ];
    // Never fall back to Swing, Lambada or novelty even when spatial
    // placement or anti-repeat constraints narrow the candidate set.
    let eligible = immediate ? preferred.find(group => group.length > 0) ?? [] : strict;
    const timely = finishNext && this.presentation && !immediate
      ? eligible.filter(p => this.engine.nextExitDelayAt(p.id, beat, beat + 4) <= .35) : [];
    // Every third successful Street SPACE can choose a newly screened break
    // phrase. The standard bag is not consumed when this opt-in pool wins.
    // V2.2.8 bug: the experimental bag was filtered through the FIRST
    // non-empty ordinary tier, often Pop-only; it could stay loaded forever
    // without ever being selected. Check spatial eligibility independently.
    const availableBreaks = immediate && desiredFamily === "street"
      ? this.experimentalPhrases.filter(p => p.id !== current?.id
        && p.source !== current?.source && compatible(p as (typeof NORMAL_PHRASES)[number])) : [];
    const preferBreak = this.activeStyle !== "street" || this.spacesInStyle % 2 === 0;
    const tryExperimental = preferBreak && availableBreaks.length && this.experimentalSpaceBag
      ? this.experimentalSpaceBag.next(p => availableBreaks.some(e => e.id === p.id)) : null;
    if (tryExperimental) eligible = availableBreaks as (typeof NORMAL_PHRASES)[number][];
    let chosen = finish ? eligible.find(p => p.id !== this.previousFinish) ?? eligible[0]
      : tryExperimental
        ?? (timely.length ? this.bag.next(p => timely.some(e => e.id === p.id)) : null)
        ?? this.bag.next(p => eligible.some(e => e.id === p.id));
    if (immediate && !chosen) {
      // Preserve successful SPACE when shufflebag anti-repeat exhausts the
      // preferred family. Try other eligible *modern* tiers, never legacy.
      for (const tier of preferred.slice(1)) {
        if (!tier.length) continue;
        const alternative = this.bag.next(p => tier.some(candidate => candidate.id === p.id));
        if (alternative) { chosen = alternative; eligible = tier; break; }
      }
    }
    const accepted = Boolean(chosen && this.engine.request(chosen.id, beat, undefined, immediate || fancyImmediate));
    if (accepted && this.presentation) {
      if (finish) this.presentation.begin(chosen!.id, beat, absoluteTurn);
      else this.presentation.resume(beat);
    }
    if (accepted && finish) this.previousFinish = chosen!.id;
    if (accepted && chosen?.id.startsWith("break-"))
      this.experimentalSelections.push({ beat, id: chosen.id, kind: "space" });
    const chosenFamily = chosen ? phraseFamily(chosen) : null;
    const styleChanged = Boolean(accepted && immediate && isModernFamily(chosenFamily)
      && chosenFamily !== this.activeStyle);
    if (accepted && immediate && isModernFamily(chosenFamily)) {
      if (chosenFamily !== this.activeStyle) {
        this.activeStyle = chosenFamily;
        this.spacesInStyle = 1;
      } else this.spacesInStyle++;
    }
    if (accepted) this.sustainHighLevelDance = !finish && level !== undefined && level >= 6;
    this.selections.push({ beat, absoluteTurn, finish, eligibleIds: eligible.map(p => p.id),
      selected: chosen?.id ?? null, accepted, danceFamily: chosenFamily, styleChanged });
    return accepted;
  }
  manual(beat: number, status: string | undefined, level?: number) {
    if (status !== "NORMAL" || this.presentation?.snapshot().active || this.engine.current?.phrase.spec.role === "finish" || this.engine.pending?.id.startsWith("finish-")) return false;
    return this.select(beat, null, false, false, undefined, level);
  }
}
