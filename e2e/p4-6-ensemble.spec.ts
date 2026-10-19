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
    await page.getByRole("button",{name:names[stage]}).click();
    await expect(surface).toHaveAttribute("data-selected-stage-id",stage);
  }
  const webgl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  });
  for(const n of [1,2,3,4,5]) {
    await page.getByRole("button",{name:`${n} actors`}).click();
    await expect(page.getByRole("button",{name:`${n} actors`})).toHaveAttribute("aria-pressed","true");
    if (webgl) await expect(surface).toHaveAttribute("data-ensemble-count",String(n));
  }
  if (!webgl) test.info().annotations.push({
    type:"hardware-limit",description:"WebGL2 unavailable: cannot assert real mesh/mixer state",
  });
});
