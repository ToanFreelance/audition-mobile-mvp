import { PERFECT_CENTER, SCORE_ZONE_END, SCORE_ZONE_START } from './rhythm';
import type { ArrowToken, Direction } from './types';

export const SOLO_SEQUENCE_COUNTS = [1, 2, 3, 4, 5, 6, 6, 6, 6] as const;
// Provisional Solo Easy lengths. The reference includes another mode's extra
// tokens, so lengths are deliberately independent of level appearance counts.
export const SOLO_COMMAND_LENGTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const ENDING_RESERVE_TURNS = 2;
export type SoloSettings = { sequenceCounts: readonly number[]; commandLengths: readonly number[]; endingReserveTurns: number };
export const DEFAULT_SOLO_SETTINGS: SoloSettings = { sequenceCounts: SOLO_SEQUENCE_COUNTS, commandLengths: SOLO_COMMAND_LENGTHS, endingReserveTurns: ENDING_RESERVE_TURNS };
export type SoloAppearance = { level: number; sequenceIndex: number; isFinish: boolean };
export const turnDurationMs = (bpmExact: number) => 4 * 60000 / bpmExact;
export const targetSpaceMs = (spaceStartMs: number, bpmExact: number, absoluteTurn: number) => spaceStartMs + absoluteTurn * turnDurationMs(bpmExact);
export const zoneEntryMs = (targetMs: number, bpmExact: number) => targetMs + (SCORE_ZONE_START - PERFECT_CENTER) / 100 * turnDurationMs(bpmExact);
export const zoneExitMs = (targetMs: number, bpmExact: number) => targetMs + (SCORE_ZONE_END - PERFECT_CENTER) / 100 * turnDurationMs(bpmExact);
export const missPenaltyTurns = (level: number) => level <= 5 ? 1 : 2;
export const successHiddenTurns = (level: number) => level <= 5 ? 0 : 1;

export function soloCycle(startLevel: 1 | 6, settings = DEFAULT_SOLO_SETTINGS): SoloAppearance[] {
  const appearances: SoloAppearance[] = [];
  for (let level = startLevel; level <= 9; level++) {
    for (let sequenceIndex = 0; sequenceIndex < settings.sequenceCounts[level - 1]; sequenceIndex++) {
      appearances.push({ level, sequenceIndex, isFinish: false });
    }
  }
  appearances.push({ level: 9, sequenceIndex: settings.sequenceCounts[8], isFinish: true });
  return appearances;
}

export function oppositeDirection(direction: Direction): Direction {
  return ({ left: 'right', right: 'left', up: 'down', down: 'up' } as const)[direction];
}
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
export function createArrowCommand(level: number, isFinish = false, random: () => number = Math.random, lengths: readonly number[] = SOLO_COMMAND_LENGTHS): ArrowToken[] {
  const directions: Direction[] = ['left', 'up', 'down', 'right'];
  const length = Math.max(1, Math.floor(lengths[level - 1] ?? level));
  const reverseIndex = isFinish ? Math.floor(random() * length) : -1;
  return Array.from({ length }, (_, index) => {
    const displayDirection = directions[Math.floor(random() * 4)];
    const reverse = index === reverseIndex;
    return { displayDirection, requiredDirection: reverse ? oppositeDirection(displayDirection) : displayDirection, reverse };
  });
}

export function lastPlayableTurn(durationMs: number, spaceStart: number, bpm: number, reserve = ENDING_RESERVE_TURNS) {
  const turnMs = turnDurationMs(bpm);
  // Always keep the complete scoring window inside the audio, even at reserve=0.
  const ending = Math.max(reserve * turnMs, zoneExitMs(0, bpm));
  return Math.floor((durationMs - ending - spaceStart) / turnMs);
}
export function repeatCycleTurns(settings = DEFAULT_SOLO_SETTINGS) {
  return soloCycle(6, settings).length * 2;
}
/** Whole-turn plan, recalculated after every Finish (including its miss cost). */
export function planAfterFinish(finishTurn: number, lastTurn: number, settings = DEFAULT_SOLO_SETTINGS, missed = false) {
  const cycleTurns = repeatCycleTurns(settings);
  const extraPenalty = missed ? 1 : 0;
  const available = lastTurn - finishTurn - extraPenalty;
  const repeatCycles = Math.max(0, Math.floor(available / cycleTurns));
  const spareTurns = Math.max(0, available - repeatCycles * cycleTurns);
  const restTurns = repeatCycles ? Math.floor(spareTurns / repeatCycles) : 0;
  return { finalFinish: repeatCycles === 0, repeatCycles, restTurns, nextAbsoluteTurn: finishTurn + 2 + extraPenalty + restTurns };
}
export function minimumRemainingTurns(appearances: readonly SoloAppearance[], from: number) {
  let turns = 0;
  for (let i = from; i < appearances.length - 1; i++) turns += successHiddenTurns(appearances[i].level) + 1;
  return turns;
}
