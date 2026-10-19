import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getEnsembleFormation, getEnsembleCameraPose } from "../components/ensemble/formation";
import type { EnsembleParticipant } from "../components/ensemble/formation";
import { SELECTABLE_STAGE_IDS } from "../components/stage/stage-catalog";
import { getStagePresentationCameraPose } from "../components/stage/stageCamera";

const P: readonly EnsembleParticipant[] = [
  {participantId:"host",slotIndex:0,characterAssetId:"c1-casual-grace"},
  {participantId:"a",slotIndex:1,characterAssetId:"c4-casual-boy"},
  {participantId:"b",slotIndex:2,characterAssetId:"c1-casual-grace"},
  {participantId:"c",slotIndex:3,characterAssetId:"c4-casual-boy"},
  {participantId:"d",slotIndex:4,characterAssetId:"c1-casual-grace"},
];

test("P4.6A deterministic identities, nonintersecting layouts and ground contact on four stages", () => {
  for (const stage of SELECTABLE_STAGE_IDS) {
    for (let count=1; count<=5; count++) {
      const group = P.slice(0,count);
      const slots = getEnsembleFormation(stage,group);
      expect(slots).toHaveLength(count);
      expect(slots.map(s=>s.participantId)).toEqual(group.map(p=>p.participantId));
      expect(getEnsembleFormation(stage,[...group].reverse())).toEqual(slots);
      for (const slot of slots) expect(slot.y).toBe(0.02);
      for (let i=0;i<slots.length;i++)
        for (let j=i+1;j<slots.length;j++)
          expect(Math.hypot(slots[i].x-slots[j].x,slots[i].z-slots[j].z)).toBeGreaterThan(1.1);
    }
  }
});
test("P4.6A owner iPhone formation: horizontal 1–3, 3+1 and 3+2 rows on all stages", () => {
  // In stage-space, positive Z is closer to the audience-facing camera.
  const scale: Readonly<Record<string, number>> = {
    "bright-stage-v1": 1,
    "neon-stage-v1": 1.12,
    "basketball-court-v1": 1.08,
    "classroom-v1": 1,
  };
  const zOffset: Readonly<Record<string, number>> = {
    "bright-stage-v1": 0,
    "neon-stage-v1": 2,
    "basketball-court-v1": 0,
    "classroom-v1": 0,
  };
  const expectedX: Readonly<Record<number, readonly number[]>> = {
    1: [0],
    2: [-1.55, 1.55],
    3: [-2.35, 0, 2.35],
    4: [-2.50, 0, 2.50, 1.25],
    5: [-3.00, 0, 3.00, -1.65, 1.65],
  };
  const expectedZ: Readonly<Record<number, readonly number[]>> = {
    1: [0.25],
    2: [0.50, 0.50],
    3: [0.55, 0.55, 0.55],
    4: [0.45, 0.45, 0.45, 1.90],
    5: [0.45, 0.45, 0.45, 1.95, 1.95],
  };
  for (const stageId of SELECTABLE_STAGE_IDS) {
    for (let count = 1; count <= 5; count++) {
      const group = P.slice(0, count);
      const actual = getEnsembleFormation(stageId, group);
      const appliedScale = stageId === "neon-stage-v1" && count === 5
        ? 1.20 : scale[stageId];
      expect(actual.map(a => a.x)).toEqual(expectedX[count].map(v => v * appliedScale));
      expect(actual.map(a => a.z)).toEqual(expectedZ[count].map(v => v + zOffset[stageId]));
      expect(actual.map(a => a.y)).toEqual(group.map(() => 0.02));
      // Stable identity and formation order irrespective of input order.
      expect(getEnsembleFormation(stageId, [...group].reverse())).toEqual(actual);
      if (count <= 3) {
        expect(new Set(actual.map(a => a.z)).size).toBe(1);
        if (count > 1) {
          const xs = actual.map(a => a.x).sort((a, b) => a - b);
          for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(2.3);
        }
      } else {
        const rear = actual.slice(0, 3);
        const front = actual.slice(3);
        expect(new Set(rear.map(a => a.z)).size).toBe(1);
        expect(new Set(front.map(a => a.z)).size).toBe(1);
        expect(front.every(a => a.z > rear[0].z + 1.4)).toBe(true);
        // Stagger the forward row into silhouette gaps; never hide a rear performer.
        for (const frontActor of front) {
          const nearestRearX = Math.min(...rear.map(a => Math.abs(a.x - frontActor.x)));
          expect(nearestRearX).toBeGreaterThan(1.20);
        }
      }
      if (stageId === "neon-stage-v1" && count === 5) {
        // Increase previous +/-3.36 to +/-3.60 only for Neon 5.
        expect(actual.map(a => a.x)).toEqual([-3.6, 0, 3.6, -1.98, 1.98]);
        expect(Math.max(...actual.map(a => Math.abs(a.x)))).toBeCloseTo(3.6, 6);
        const unchangedFour = getEnsembleFormation(stageId, P.slice(0, 4));
        expect(unchangedFour[0].x).toBeCloseTo(-2.5 * 1.12, 6);
      }
      // Keep actor centers inside the previously owner-tested +/-3.62 stage envelope.
      expect(Math.max(...actual.map(a => Math.abs(a.x)))).toBeLessThan(3.62);
      for (let i = 0; i < actual.length; i++)
        for (let j = i + 1; j < actual.length; j++)
          expect(Math.hypot(actual[i].x - actual[j].x, actual[i].z - actual[j].z))
            .toBeGreaterThan(1.80);
    }
  }
});

test("P4.6A camera changes for ensemble only and stays count/stage deterministic", () => {
  const solo = getStagePresentationCameraPose(1000,false,true,"center");
  for (const stage of SELECTABLE_STAGE_IDS) {
    expect(getEnsembleCameraPose(stage,true,1,solo)).toBe(solo);
    expect(getEnsembleCameraPose(stage,false,5,solo)).toBe(solo);
    expect(getEnsembleCameraPose(stage,true,5,solo)).toEqual(getEnsembleCameraPose(stage,true,5,solo));
    expect(getEnsembleCameraPose(stage,true,5,solo).z).toBeGreaterThan(solo.z);
  }
});
test("P4.6A production entry stays manifest-scoped; no clock or protocol edits", () => {
  const source=readFileSync(join(process.cwd(),"components/multiplayer/LiveMultiplayerGameplay.tsx"),"utf8");
  expect(source).toContain("ensembleParticipants={ensembleParticipants}");
  expect(source).toContain("ensembleLocalParticipantId={props.participantId}");
  expect(source).toContain("avatarCharacterAssetId(participant.avatar)");
  const stage=readFileSync(join(process.cwd(),"components/Stage3D.tsx"),"utf8");
  expect(stage).toContain("ensemble?.update(delta, t, songTimeMs)");
  expect(stage).toContain('characterSettled = localState?.state === "loaded"');
  const actor = readFileSync(join(process.cwd(),"components/character/CharacterActor.ts"),"utf8");
  expect(actor).toContain("cachedGlbBytes");
  expect(actor).toContain("bytes.slice(0)"); // each actor owns an isolated parsed model
});
test("P4.6A isolated fixture controls without Supabase rooms", async ({page}) => {
  await page.goto("/tools/p4-6-ensemble-qa");
  await expect(page.getByTestId("p46-ensemble-qa")).toBeVisible();
  const surface=page.locator('[data-testid="p46-ensemble-stage"] .stage-3d');
  await expect(surface).toHaveAttribute("data-selected-stage-id","bright-stage-v1");
  for(const stage of SELECTABLE_STAGE_IDS) {
    const names:Record<string,string>={
      "bright-stage-v1":"Bright Stage","neon-stage-v1":"Neon Stage",
      "basketball-court-v1":"Basketball Court","classroom-v1":"Haunted Classroom"
    };
    await page.getByRole("button",{name:names[stage]}).click({timeout:30000});
    await expect(surface).toHaveAttribute("data-selected-stage-id",stage);
  }
  const webgl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  });
  for(const n of [1,2,3,4,5]) {
    await page.getByRole("button",{name:`${n} actors`}).click({timeout:30000});
    await expect(page.getByRole("button",{name:`${n} actors`})).toHaveAttribute("aria-pressed","true");
    if (webgl) await expect(surface).toHaveAttribute("data-ensemble-count",String(n));
  }
  if (!webgl) test.info().annotations.push({
    type:"hardware-limit",description:"WebGL2 unavailable: cannot assert real mesh/mixer state",
  });
});
