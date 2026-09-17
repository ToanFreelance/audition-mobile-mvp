import { expect, test } from "@playwright/test";
import {
  createDeterministicCommand,
  describeSharedTurn,
  hashArrowCommand,
} from "../multiplayer/determinism";
import { createP41QaFixture, simulateRoom } from "../multiplayer/simulated-room";

const FINISH_TURNS = [38, 62, 86, 110] as const;

test.describe("P4.1 deterministic shared timeline", () => {
  test("canonical Finish cadence is shared on turns 38/62/86/110", () => {
    const { manifest } = createP41QaFixture();
    for (const turn of FINISH_TURNS) {
      const descriptor = describeSharedTurn(manifest, turn);
      expect(descriptor.isFinish).toBe(true);
      expect(descriptor.level).toBe(9);
    }
  });

  test("T38 Finish produces room-wide T39-T42 rest and resumes L6 sequence 4 at T43", () => {
    const { manifest } = createP41QaFixture();
    expect(describeSharedTurn(manifest, 38)).toMatchObject({ isFinish: true, roomRest: false, level: 9 });
    for (const turn of [39, 40, 41, 42]) {
      expect(describeSharedTurn(manifest, turn).roomRest).toBe(true);
    }
    expect(describeSharedTurn(manifest, 43)).toMatchObject({
      roomRest: false,
      level: 6,
      sequenceIndex: 4,
    });
  });

  test("command generation is stateless per global turn", () => {
    const { manifest } = createP41QaFixture();
    const first = createDeterministicCommand(manifest, 43);
    for (const unrelatedTurn of [0, 4, 17, 38, 100, 2, 62]) {
      createDeterministicCommand(manifest, unrelatedTurn);
    }
    const second = createDeterministicCommand(manifest, 43);
    expect(second).toEqual(first);
    expect(hashArrowCommand(second)).toBe(hashArrowCommand(first));
  });

  test("mixed Finish outcomes never change shared T43 level, target or command hash", () => {
    const { room, manifest } = createP41QaFixture();
    const result = simulateRoom({
      room,
      manifest,
      throughTurn: 43,
      policyOverrides: { "human-host": "miss" },
    });

    expect(result.invariants).toMatchObject({
      pass: true,
      turnSync: true,
      levelSync: true,
      finishSync: true,
      targetSync: true,
      commandSync: true,
      timelineOwner: "shared",
    });
    expect(new Set(result.clients.map(client => client.absoluteTurn))).toEqual(new Set([43]));
    expect(new Set(result.clients.map(client => client.level))).toEqual(new Set([6]));
    expect(new Set(result.clients.map(client => client.sequenceIndex))).toEqual(new Set([4]));
    expect(new Set(result.clients.map(client => client.commandHash)).size).toBe(1);
    expect(result.clients.every(client => client.commandVisible)).toBe(true);
  });

  test("1 human + 5 bots remain globally synchronized through 100 turns despite player-specific suppression", () => {
    const { room, manifest } = createP41QaFixture();
    const result = simulateRoom({
      room,
      manifest,
      throughTurn: 100,
      policyOverrides: { "human-host": "mixed" },
    });

    expect(result.clients).toHaveLength(6);
    expect(result.invariants.pass).toBe(true);
    expect(new Set(result.clients.map(client => client.commandHash)).size).toBe(1);
  });

  test("replaying the same manifest and policies is deterministic", () => {
    const fixture = createP41QaFixture();
    const input = {
      room: fixture.room,
      manifest: fixture.manifest,
      throughTurn: 86,
      policyOverrides: { "human-host": "mixed" as const },
    };
    expect(simulateRoom(input)).toEqual(simulateRoom(input));
  });
});
