import { expect, test } from "@playwright/test";
import { DEFAULT_CHARACTER_CREATION_PROFILE } from "../components/character/character-profile";

const nameOf = (page: import("@playwright/test").Page) => page.getByRole("textbox", { name: "Tên nhân vật", exact: true });
const railOf = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Tuỳ chỉnh nhân vật" });
const profileKey = "audition.characterCreationDraft.v1";
test.beforeEach(async ({ page }) => {
  // Deterministic guest identity fixture. Real Auth persistence is covered by
  // the separate HTTPS security runner, not simulated here as real Auth.
  await page.route("**/api/auth", r => r.fulfill({json:{authenticated:false}}));
  await page.route("**/api/multiplayer/guest-session", r => r.fulfill({json:{ok:true,participantId:"guest-00000000-0000-4000-8000-000000000001"}}));
  await page.route("**/api/multiplayer/room?browse=1", r => r.fulfill({json:{ok:true,rooms:[]}}));
});

test("M3 Creator resolves the real starter, drag, focus, name validation and persists a guest profile", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/character/create");
  const root = page.getByTestId("c2-character-creation");
  const stage = page.getByTestId("c2-character-stage");
  const confirm = page.getByTestId("c2-confirm-character");
  const name = nameOf(page);
  await expect(root).toHaveAttribute("data-profile-version", "1");
  await expect(root).toHaveAttribute("data-character-asset", "m3-drophunter");
  await expect(stage).toHaveAttribute("data-preview-state", "ready", {timeout:100_000});
  await name.fill(""); await name.blur();
  await expect(confirm).toBeDisabled();
  await name.fill("MinaQA"); await name.blur();
  await expect(confirm).toBeEnabled();
  const viewport = page.getByTestId("c2-character-viewport");
  const before = await viewport.getAttribute("data-yaw");
  const box = await viewport.boundingBox();
  if (!box) throw Error("Missing creator viewport");
  await page.mouse.move(box.x+box.width*.65,box.y+box.height*.5);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.35,box.y+box.height*.5,{steps:6});
  await page.mouse.up();
  expect(await viewport.getAttribute("data-yaw")).not.toBe(before);
  await expect(stage).toHaveAttribute("data-character-asset-id","m3-drophunter");
  await railOf(page).getByRole("button",{name:"Kiểu tóc"}).click();
  await expect(stage).toHaveAttribute("data-focus","hair");
  await railOf(page).getByRole("button",{name:"Tạo hình"}).click();
  await page.getByRole("button",{name:/Mặt · Tuỳ chỉnh/}).click();
  await expect(stage).toHaveAttribute("data-focus","face");
  await railOf(page).getByRole("button",{name:"Tạo hình"}).click();
  await expect(stage).toHaveAttribute("data-focus","body");
  await expect(page.getByTestId("creator-gender-male")).toBeEnabled();
  await railOf(page).getByRole("button",{name:"Giày"}).click();
  await expect(stage).toHaveAttribute("data-focus","shoes");
  await expect(page.getByTestId("creator-fixed-shoes")).toBeVisible();
  await confirm.click();
  await expect(page.getByTestId("entry-continue-rooms")).toHaveAttribute("href","/rooms");
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),profileKey)).toMatchObject({name:"MinaQA",characterAssetId:"m3-drophunter",m3Outfit:{top:"shirt",bottom:"casualshorts"}});
  await page.reload();
  await expect(page).toHaveURL(/\/rooms$/);
});

test("Creator rejects stale drafts requesting unavailable legacy variants", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("audition.characterCreationDraft.v1",JSON.stringify({
    version:1,gender:"female",characterAssetId:"c1-casual-grace",hairStyle:"female-long-01",hairColor:"brown",skinTone:"warm",face:"basic-01",name:"InvalidVariant",
  })));
  await page.goto("/character/create");
  await expect(nameOf(page)).toHaveValue("Luna");
  await expect(page.getByTestId("c2-character-creation")).toHaveAttribute("data-character-asset","m3-drophunter");
  await expect(page.getByTestId("c2-confirm-character")).toHaveText("TẠO NHÂN VẬT");
});

test("M3 chrome has four SVG categories, wardrobe controls and editable name", async ({ page }) => {
  await page.setViewportSize({width:390,height:740});
  await page.goto("/character/create");
  const root=page.getByTestId("c2-character-creation"),rail=railOf(page);
  await expect(rail.locator("button")).toHaveCount(4);
  await expect(rail.locator("svg")).toHaveCount(4);
  await expect(root.getByRole("button",{name:"Ngẫu nhiên"}).locator("svg")).toBeVisible();
  await root.getByRole("button",{name:"Sửa tên nhân vật"}).click();
  await expect(nameOf(page)).toBeFocused();
  await nameOf(page).blur();
  await rail.getByRole("button",{name:"Trang phục"}).click();
  await expect(page.getByTestId("creator-top-shirt")).toHaveAttribute("aria-pressed","true");
  await expect(page.getByTestId("creator-top-lightshirt")).toBeEnabled();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("Creator stays locked while preserving internal panel scrolling", async ({page})=>{
  await page.setViewportSize({width:390,height:660});
  await page.goto("/character/create");
  await expect.poll(()=>page.evaluate(()=>({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight,overflow:getComputedStyle(document.documentElement).overflow}))).toEqual({x:0,y:0,overflow:"hidden"});
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content",/maximum-scale=1/);
  await railOf(page).getByRole("button",{name:"Kiểu tóc"}).click();
  await expect(page.getByTestId("c1-category-options")).toHaveCSS("overflow-y","auto");
});

test("Saved account character cannot be replaced by guest draft in Creator",async({page})=>{
  const profile={...DEFAULT_CHARACTER_CREATION_PROFILE,name:"ExistingQA",m3Outfit:{top:"lightshirt",bottom:"sportshorts"}};
  await page.unroute("**/api/auth");
  await page.route("**/api/auth",r=>r.fulfill({json:{authenticated:true,user:{id:"00000000-0000-4000-8000-000000000001"}}}));
  await page.route("**/api/account/character",r=>r.fulfill({json:{ok:true,profile,revision:2}}));
  await page.addInitScript(key=>localStorage.setItem(key,"stale guest draft"),profileKey);
  await page.goto("/character/create");
  await expect(page).toHaveURL(/\/rooms$/);
  expect(await page.evaluate(key=>localStorage.getItem(key),profileKey)).toBe("stale guest draft");
});

test("M3 tablet and desktop stage/sidebar have no document overflow",async({page})=>{
  await page.goto("/character/create");
  for(const viewport of [{width:768,height:1024},{width:1280,height:800},{width:1440,height:900}]){
    await page.setViewportSize(viewport);
    await expect(page.getByTestId("c1-category-options")).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>({overflow:getComputedStyle(document.documentElement).overflow,width:document.documentElement.scrollWidth<=innerWidth,height:document.documentElement.scrollHeight<=innerHeight}))).toEqual({overflow:"hidden",width:true,height:true});
    const a=await page.getByTestId("c2-character-viewport").boundingBox();
    const b=await page.getByTestId("c2-confirm-character").boundingBox();
    expect(a&&b&&a.width>200&&b.width>200).toBeTruthy();
    expect(a!.x+a!.width).toBeLessThan(b!.x+25);
  }
});

test("Leaving Creator restores document scroll/zoom ownership",async({page})=>{
  await page.goto("/character/create");
  await expect.poll(()=>page.evaluate(()=>document.documentElement.style.overflow)).toBe("hidden");
  await page.getByRole("link",{name:"Quay lại"}).click();
  await expect(page).toHaveURL("/");
  await expect.poll(()=>page.evaluate(()=>document.documentElement.style.overflow)).toBe("");
});

test("M3 mobile rail fits above setup dock and decorative arcs are removed",async({page})=>{
  await page.goto("/character/create");
  for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:740},{width:430,height:932}]){
    await page.setViewportSize(viewport);
    const rail=railOf(page);
    await expect(rail.getByRole("button")).toHaveCount(4);
    const geometry=await rail.evaluate(el=>{
      const hero=el.parentElement!,r=el.getBoundingClientRect(),h=hero.getBoundingClientRect(),b=el.querySelector("button:last-child")!.getBoundingClientRect();
      return {railTop:r.top,railBottom:r.bottom,heroTop:h.top,heroBottom:h.bottom,lastBottom:b.bottom,arc:getComputedStyle(hero,"::after").content};
    });
    expect(geometry.railTop).toBeGreaterThanOrEqual(geometry.heroTop);
    expect(geometry.railBottom).toBeLessThanOrEqual(geometry.heroBottom+1);
    expect(geometry.lastBottom).toBeLessThanOrEqual(geometry.heroBottom+1);
    expect(geometry.arc).toBe("none");
    await expect(page.getByTestId("c1-category-options")).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  }
});
