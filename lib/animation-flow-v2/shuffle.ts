import type { PhraseSpec } from "./catalog";

export class PhraseBag {
  private bag: PhraseSpec[] = [];
  private recent: PhraseSpec[] = [];
  private state: number;
  constructor(readonly pool: readonly PhraseSpec[], readonly seed: number) { this.state = seed >>> 0; }
  private random() {
    let t = this.state += 0x6d2b79f5;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  private refill() {
    this.bag = [...this.pool];
    for (let i = this.bag.length - 1; i > 0; i--) {
      const k = Math.floor(this.random() * (i + 1)); [this.bag[i], this.bag[k]] = [this.bag[k], this.bag[i]];
    }
  }
  next(eligible: (p: PhraseSpec) => boolean = () => true): PhraseSpec | null {
    const allowed = (p: PhraseSpec) => eligible(p)
      && !this.recent.slice(-3).some(r => r.id === p.id)
      && !this.recent.slice(-2).some(r => r.source === p.source)
      && this.recent.at(-1)?.group !== p.group;
    if (!this.bag.length) this.refill();
    let i = this.bag.findIndex(allowed);
    // Ineligible phrases remain deferred; refill only when the remaining bag
    // cannot satisfy both spatial eligibility and anti-repeat constraints.
    if (i < 0) { this.refill(); i = this.bag.findIndex(allowed); }
    if (i < 0) return null;
    const [picked] = this.bag.splice(i, 1); this.recent.push(picked); this.recent = this.recent.slice(-4);
    return picked;
  }
}
