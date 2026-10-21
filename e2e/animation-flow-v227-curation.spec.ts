import { expect, test } from "@playwright/test";
import { OWNER_CURATION_DIRECTIONS, proposeReviewSegments, type ActivitySample } from "../lib/animation-flow-v2/clip-curation";
import { DANCE_REVIEW_CANDIDATES, NORMAL_PHRASES, FINISH_PHRASES } from "../lib/animation-flow-v2/catalog";

test("Owner classifications remain isolated from runtime gameplay/Flare", () => {
  expect(OWNER_CURATION_DIRECTIONS["85_04"].role).toBe("finish-candidate");
  expect(OWNER_CURATION_DIRECTIONS["85_12"].targetSlots).toBeGreaterThan(1);
  expect(OWNER_CURATION_DIRECTIONS["85_14"].role).toBe("conditional-break-candidate");
  expect(OWNER_CURATION_DIRECTIONS["90_28"].role).toBe("conditional-break-candidate");
  const ids = new Set([...NORMAL_PHRASES,...FINISH_PHRASES].map(p => p.source));
  expect(["85_04","85_12","85_14","90_28"].every(id => !ids.has(id))).toBe(true);
  expect(DANCE_REVIEW_CANDIDATES.filter(p => ["85_14","90_28"].includes(p.source)).every(p =>
    p.role === "fixture" && p.policy === "PROTECTED")).toBe(true);
});

test("V2.2.7 proposes multiple editable review excerpts near low-motion upright windows", () => {
  const activity: ActivitySample[] = [];
  for (let t=0; t<=24; t+=.15) {
    const low = [6,12,18].some(x=>Math.abs(x-t)<.2);
    activity.push({time:t,energy:low?.002:1,upright:true});
  }
  const sections=proposeReviewSegments("85_12",24,activity);
  expect(sections).toHaveLength(4);
  expect(sections[0].start).toBe(0);
  expect(sections.at(-1)!.end).toBe(24);
  expect(sections.every(p=>p.provisional && !p.safeExitVerified
    && p.status==="needs-motion-and-contact-review")).toBe(true);
  expect(sections.every((p,i)=>i===0 || p.start>=sections[i-1].end)).toBe(true);
  expect(sections.every(p=>p.end-p.start>=1.3)).toBe(true);
  const flip=proposeReviewSegments("85_14",24,activity);
  expect(flip).toHaveLength(3);
  expect(flip.every(p=>p.role==="conditional-break-candidate")).toBe(true);
  const finish=proposeReviewSegments("85_04",21,activity);
  expect(finish).toHaveLength(1);
  expect(finish[0]).toMatchObject({role:"finish-candidate",start:0,end:21});
  const floor=proposeReviewSegments("90_28",6.4,activity);
  expect(floor).toHaveLength(1);
  expect(floor[0]).toMatchObject({role:"conditional-break-candidate",start:0,end:6.4});
});

test("Owner iPhone review lists adjustable source cuts without auto-promotion", async ({page})=>{
  await page.goto("/tools/animation-flow-qa-v2/catalog");
  await page.getByRole("combobox",{name:"Nguồn motion ứng viên"}).selectOption("candidate-85-12");
  await expect(page.getByTestId("owner-curation-panel")).toContainText("Dance");
  await page.getByRole("button",{name:"Phát toàn bộ nguồn"}).click();
  await expect(page.getByTestId("curation-segment").first()).toBeVisible({timeout:60000});
  expect(await page.getByTestId("curation-segment").count()).toBeGreaterThan(1);
  await expect(page.getByTestId("owner-curation-panel")).toContainText("Chưa xác minh safe exit");
});
