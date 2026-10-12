import { expect, test } from "@playwright/test";

const mockedProfile = {
  version: 1,
  gender: "female",
  characterAssetId: "c1-casual-grace",
  hairStyle: "female-bob-01",
  hairColor: "brown",
  skinTone: "warm",
  face: "basic-01",
  name: "Lucas",
};

for (const height of [620, 740] as const) {
  test(`portrait room browser scrolls only room list at 390×${height}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height });
    await page.addInitScript(profile => {
      localStorage.setItem("audition.characterCreationDraft.v1", JSON.stringify(profile));
    }, mockedProfile);
    await page.route("**/api/multiplayer/room?browse=1", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, rooms: [] }),
    }));
    await page.goto("/rooms");
    const browser = page.getByTestId("entry-room-browser");
    const list = page.getByTestId("entry-room-scroll");
    const profile = browser.locator("header");
    const tabs = page.getByRole("navigation", { name: "Mục trong sảnh" });
    const filters = page.getByRole("navigation", { name: "Bộ lọc phòng" });
    const create = page.getByTestId("entry-create-room");
    const join = page.getByRole("region", { name: "Vào phòng bằng mã" });
    const footer = page.getByRole("contentinfo", { name: "Điều hướng chính" });

    await expect(browser).toBeVisible();
    await expect(list).toBeVisible();
    await expect(profile).toBeVisible();
    await expect(tabs).toBeVisible();
    await expect(filters).toBeVisible();
    await expect(create).toBeEnabled();
    await expect(join).toBeVisible();
    await expect(footer).toBeVisible();

    const selectors = [
      "header",
      "nav[aria-label='Mục trong sảnh']",
      "nav[aria-label='Bộ lọc phòng']",
      "[data-testid='entry-create-room']",
      "section[aria-label='Vào phòng bằng mã']",
      "footer[aria-label='Điều hướng chính']",
    ];
    const measure = () => page.evaluate(selectors => {
      const rects = selectors.map(selector => {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`Missing fixed element ${selector}`);
        const rect = el.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom };
      });
      const scroll = document.querySelector("[data-testid='entry-room-scroll']") as HTMLElement | null;
      if (!scroll) throw new Error("Room list scroll missing");
      return {
        pageHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        rects,
        scrollTop: scroll.scrollTop,
        scrollHeight: scroll.scrollHeight,
        listHeight: scroll.clientHeight,
        listTop: scroll.getBoundingClientRect().top,
        listBottom: scroll.getBoundingClientRect().bottom,
      };
    }, selectors);

    const before = await measure();
    expect(before.pageHeight).toBeLessThanOrEqual(before.viewportHeight + 2);
    expect(before.listHeight).toBeGreaterThan(70);
    expect(before.scrollHeight).toBeGreaterThan(before.listHeight);
    expect(before.rects[5].bottom).toBeLessThanOrEqual(before.viewportHeight + 2);
    expect(before.listBottom).toBeLessThanOrEqual(before.rects[5].top + 1);

    await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
    const after = await measure();
    expect(after.scrollTop).toBeGreaterThan(100);
    expect(after.pageHeight).toBeLessThanOrEqual(after.viewportHeight + 2);
    before.rects.forEach((rect, index) => {
      expect(Math.abs(after.rects[index].top - rect.top)).toBeLessThan(1.5);
      expect(Math.abs(after.rects[index].bottom - rect.bottom)).toBeLessThan(1.5);
    });
  });
}
