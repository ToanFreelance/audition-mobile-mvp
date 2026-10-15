import { expect, test, type Page } from "@playwright/test";
const profile = { version:1, gender:"female", characterAssetId:"c1-casual-grace", hairStyle:"female-bob-01", hairColor:"brown", skinTone:"warm", face:"basic-01", name:"Lucas" };
async function setup(page:Page) {
  await page.addInitScript(x => localStorage.setItem("audition.characterCreationDraft.v1", JSON.stringify(x)), profile);
  await page.route("**/api/multiplayer/room?browse=1", r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,rooms:[]})}));
}
test("C2 create-room mode and name go through canonical Solo Easy only",async({page})=>{
  await setup(page); await page.goto("/rooms");
  const name=page.getByRole("textbox",{name:"Tên phòng"});
  const modes=page.getByRole("group",{name:"Chọn mode chơi"});
  const create=page.getByTestId("entry-create-room");
  await expect(name).toBeVisible();
  await expect(modes.getByRole("button")).toHaveCount(3);
  await modes.getByRole("button",{name:/Khiêu vũ/}).click();
  await expect(create).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("chưa thể tạo phòng");
  await modes.getByRole("button",{name:/Boss hiện đại/}).click();
  await expect(create).toBeDisabled();
  await modes.getByRole("button",{name:/Pop tự do/}).click();
  await expect(create).toBeEnabled();
  await name.fill("C2 Custom Room");
  await page.route("**/api/multiplayer/room",r=>r.request().method()==="POST"
    ?r.fulfill({status:400,contentType:"application/json",body:JSON.stringify({ok:false,error:"QA blocked create"})})
    :r.continue());
  const req=page.waitForRequest(r=>r.method()==="POST"&&r.url().includes("/api/multiplayer/room"));
  await create.click();
  expect((await req).postDataJSON()).toMatchObject({action:"create",roomName:"C2 Custom Room",modeId:"solo-easy-battle",displayName:"Lucas",characterAssetId:"c1-casual-grace"});
  await expect(page.getByRole("alert")).toContainText("QA blocked create");
});
test("C2 API refuses mock gameplay modes",async({page})=>{
  const res=await page.request.post("/api/multiplayer/room",{data:{
    action:"create",roomName:"Never Saved",modeId:"boss-preview",
    participantId:"player-00000000-0000-4000-8000-000000000001",displayName:"QA",characterAssetId:"c1-casual-grace"
  }});
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toContain("Mode chưa hỗ trợ");
});
test("C2 portrait tablet and desktop layout does not overlap or scroll document",async({page})=>{
  await setup(page);
  for(const size of [
    {label:"small-phone",width:320,height:568},
    {label:"iphone",width:390,height:740},
    {label:"tablet-portrait",width:768,height:1024},
    {label:"tablet-landscape",width:1024,height:768},
    {label:"desktop",width:1280,height:800},
    {label:"desktop-wide",width:1440,height:900},
  ]){
    await page.setViewportSize({width:size.width,height:size.height});
    await page.goto("/rooms");
    await expect(page.getByTestId("entry-create-room")).toBeVisible();
    await expect(page.getByRole("textbox",{name:"Tên phòng"})).toBeVisible();
    await expect(page.getByRole("group",{name:"Chọn mode chơi"})).toBeVisible();
    await expect(page.getByTestId("entry-room-scroll")).toBeVisible();
    const data=await page.evaluate(()=>{
      const box=(selector:string)=>{const rect=document.querySelector(selector)!.getBoundingClientRect();
        return {x:rect.x,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height};};
      const scroller=document.querySelector('[data-testid="entry-room-scroll"]') as HTMLElement;
      return {dw:document.documentElement.scrollWidth,dh:document.documentElement.scrollHeight,iw:innerWidth,ih:innerHeight,
        left:box('section[aria-label="Thiết lập phòng mới"]'),
        right:box('section[aria-label="Danh sách phòng"]'),
        footer:box('footer[aria-label="Điều hướng chính"]'),
        list:box('[data-testid="entry-room-scroll"]'),
        button:box('[data-testid="entry-create-room"]'),
        scrollHeight:scroller.scrollHeight,listHeight:scroller.clientHeight};
    });
    console.log("C2_RESPONSIVE "+size.label+" "+JSON.stringify(data));
    expect(data.dw).toBeLessThanOrEqual(size.width+1);
    expect(data.dh).toBeLessThanOrEqual(size.height+1);
    expect(data.button.bottom).toBeLessThanOrEqual(data.footer.top+1);
    expect(data.list.bottom).toBeLessThanOrEqual(data.footer.top+1);
    expect(data.listHeight).toBeGreaterThan(60);
    expect(data.scrollHeight).toBeGreaterThan(data.listHeight);
    if(size.width>=768) {
      expect(data.left.right).toBeLessThanOrEqual(data.right.x+1);
      expect(data.right.width).toBeGreaterThan(200);
    }
    await page.screenshot({path:`test-results/c2-responsive/${size.label}-${size.width}x${size.height}.png`,animations:"disabled"});
    const list=page.getByTestId("entry-room-scroll");
    await list.evaluate(el=>el.scrollTop=el.scrollHeight);
    expect(await list.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  }
});
