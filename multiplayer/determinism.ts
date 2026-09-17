import { createArrowCommand, soloCycle, targetSpaceMs, type SoloSettings } from "../game/solo-easy";
import type { ArrowToken } from "../game/types";
import type { MatchManifest } from "./types";

function fnv1a32(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mix32(value: number) {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

function seededUnit(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function deriveDeterministicSeed(matchSeed: number, absoluteTurn: number, purpose: string) {
  return mix32((matchSeed >>> 0) ^ mix32(absoluteTurn >>> 0) ^ fnv1a32(purpose));
}

export function soloSettingsFromManifest(manifest: MatchManifest): SoloSettings {
  return {
    sequenceCounts: manifest.gameplay.sequenceCounts,
    commandLengths: manifest.gameplay.commandLengths,
    endingReserveTurns: 0,
    finishRestTurns: manifest.gameplay.finishRestTurns,
  };
}

export function sharedAppearanceAtTurn(manifest: MatchManifest, absoluteTurn: number) {
  if (!Number.isInteger(absoluteTurn) || absoluteTurn < 0) throw new Error("absoluteTurn must be a non-negative integer.");
  const settings = soloSettingsFromManifest(manifest);
  const firstCycle = soloCycle(1, settings);
  if (absoluteTurn < firstCycle.length) return firstCycle[absoluteTurn];
  const repeatCycle = soloCycle(6, settings);
  return repeatCycle[(absoluteTurn - firstCycle.length) % repeatCycle.length];
}

export function firstFinishTurn(manifest: MatchManifest) {
  const cycle = soloCycle(1, soloSettingsFromManifest(manifest));
  const index = cycle.findIndex(appearance => appearance.isFinish);
  if (index < 0) throw new Error("Gameplay settings do not contain Finish.");
  return index;
}

export function repeatCycleTurns(manifest: MatchManifest) {
  return soloCycle(6, soloSettingsFromManifest(manifest)).length;
}

export function latestFinishTurnAtOrBefore(manifest: MatchManifest, absoluteTurn: number) {
  const first = firstFinishTurn(manifest);
  if (absoluteTurn < first) return null;
  const repeat = repeatCycleTurns(manifest);
  return first + Math.floor((absoluteTurn - first) / repeat) * repeat;
}

export function isSharedFinishRestTurn(manifest: MatchManifest, absoluteTurn: number) {
  const finish = latestFinishTurnAtOrBefore(manifest, absoluteTurn);
  if (finish === null) return false;
  const distance = absoluteTurn - finish;
  return distance >= 1 && distance <= manifest.gameplay.finishRestTurns;
}

export function createDeterministicCommand(manifest: MatchManifest, absoluteTurn: number): ArrowToken[] {
  const appearance = sharedAppearanceAtTurn(manifest, absoluteTurn);
  const seed = deriveDeterministicSeed(manifest.gameplay.seed, absoluteTurn, "shared-command");
  return createArrowCommand(
    appearance.level,
    appearance.isFinish,
    seededUnit(seed),
    manifest.gameplay.commandLengths,
  );
}

export function hashArrowCommand(command: readonly ArrowToken[]) {
  const serialized = command.map(token => `${token.displayDirection}:${token.requiredDirection}:${token.reverse ? 1 : 0}`).join("|");
  return fnv1a32(serialized).toString(16).padStart(8, "0");
}

export function describeSharedTurn(manifest: MatchManifest, absoluteTurn: number) {
  const appearance = sharedAppearanceAtTurn(manifest, absoluteTurn);
  const command = createDeterministicCommand(manifest, absoluteTurn);
  return {
    absoluteTurn,
    level: appearance.level,
    sequenceIndex: appearance.sequenceIndex,
    isFinish: appearance.isFinish,
    roomRest: isSharedFinishRestTurn(manifest, absoluteTurn),
    targetSpaceMs: targetSpaceMs(manifest.gameplay.spaceStartMs, manifest.gameplay.bpmExact, absoluteTurn),
    command,
    commandHash: hashArrowCommand(command),
  };
}
