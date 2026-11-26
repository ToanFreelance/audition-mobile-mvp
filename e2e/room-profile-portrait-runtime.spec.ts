import { expect, test } from "@playwright/test";
import { roomPortraitKey, ROOM_PORTRAIT_STORAGE_KEY } from "../components/entry/room-profile-portrait";
import type { CharacterCreationProfileV1 } from "../components/character/character-profile";

const profiles: CharacterCreationProfileV1[] = [
  { version: 1, name: "QA Female", gender: "female", characterAssetId: "m3-drophunter",
    face: "basic-01", hairStyle: "short", hairColor: "red", skinTone: "originalskin",
    m3Outfit: { top: "lightshirt", bottom: "sportshorts" } },
  { version: 1, name: "QA Male", gender: "male", characterAssetId: "m3-neurohacker",
    face: "basic-01", hairStyle: "hair2", hairColor: "yellow", skinTone: "tone3skin",
    m3Outfit: { top: "simpleshirt", bottom: "shorts" } },
];

for (const initial of profiles) {
  test("real WebGL room portrait and reload cache: " + initial.characterAssetId, async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    let profile = initial;
    // Mock identity/room API only; immutable VRM/PNG requests and Three.js are real.
    await page.route("**/api/auth", route => route.fulfill({ json: {
      authenticated: true, user: { id: "11111111-1111-4111-8111-111111111111" },
    } }));
    await page.route("**/api/account/character", route => route.fulfill({ json: { ok: true, profile } }));
    await page.route("**/api/multiplayer/room?browse=1", route => route.fulfill({ json: { ok: true, rooms: [] } }));
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(window, "__portraitWebGLCalls", { value: { count: 0 } });
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true, writable: true,
        value: function(this: HTMLCanvasElement, ...args: unknown[]) {
          if (typeof args[0] === "string" && args[0].includes("webgl")) {
            (window as unknown as { __portraitWebGLCalls: { count: number } }).__portraitWebGLCalls.count++;
          }
          return Reflect.apply(original, this, args);
        },
      });
    });
    const count = () => page.evaluate(() =>
      (window as unknown as { __portraitWebGLCalls: { count: number } }).__portraitWebGLCalls.count);
    const portrait = page.getByTestId("room-profile-portrait");
    const waitForPortrait = async () => {
      await expect(portrait).toHaveAttribute("data-character-asset-id", profile.characterAssetId, { timeout: 70_000 });
      await expect.poll(() => portrait.evaluate((img: HTMLImageElement) =>
        img.complete && img.naturalWidth === 128 && img.naturalHeight === 128), { timeout: 10_000 }).toBe(true);
      const pixels = await portrait.evaluate((img: HTMLImageElement) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 128;
        const context = canvas.getContext("2d")!;
        context.drawImage(img, 0, 0);
        const data = context.getImageData(0, 0, 128, 128).data;
        const colors = new Set<number>();
        let different = 0;
        for (let i = 0; i < data.length; i += 4) {
          colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
          if (Math.abs(data[i] - data[0]) + Math.abs(data[i + 1] - data[1]) + Math.abs(data[i + 2] - data[2]) > 30) different++;
        }
        return { colors: colors.size, different };
      });
      expect(pixels.colors).toBeGreaterThan(50);
      expect(pixels.different).toBeGreaterThan(500);
      const src = await portrait.getAttribute("src");
      expect(src).toMatch(/^data:image\/png;base64,/);
      const stored = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key) || "null"), ROOM_PORTRAIT_STORAGE_KEY);
      expect(stored).toEqual({ key: roomPortraitKey(profile), image: src });
      return src;
    };
    await page.goto("/rooms");
    const first = await waitForPortrait();
    expect(await count()).toBeGreaterThan(0);
    await testInfo.attach("initial-" + initial.characterAssetId, { body: Buffer.from(first!.split(",")[1], "base64"), contentType: "image/png" });
    await page.reload();
    expect(await waitForPortrait()).toBe(first);
    expect(await count()).toBe(0);
    profile = { ...profile, hairColor: "black" };
    expect(roomPortraitKey(profile)).toBeTruthy();
    expect(roomPortraitKey(profile)).not.toBe(roomPortraitKey(initial));
    await page.reload();
    const changed = await waitForPortrait();
    expect(changed).not.toBe(first);
    expect(await count()).toBeGreaterThan(0);
    await testInfo.attach("changed-" + initial.characterAssetId, { body: Buffer.from(changed!.split(",")[1], "base64"), contentType: "image/png" });
  });
}
