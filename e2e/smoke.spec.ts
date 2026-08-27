import { test, expect } from "@playwright/test";

test.describe("Audition Mobile MVP — QA", () => {
  test("A1 — application loads", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.goto("/", {
      waitUntil: "domcontentloaded",
    });

    await expect(
      page.getByRole("heading", {
        name: /Audition Mobile/i,
      })
    ).toBeVisible();

    await expect(
      page.locator("#game-container")
    ).toBeVisible();

    const horizontalOverflow = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        window.innerWidth + 1
      );
    });

    expect(
      horizontalOverflow,
      "Application must not have horizontal overflow"
    ).toBe(false);

    expect(
      pageErrors,
      `Unexpected page errors:\n${pageErrors.join("\n")}`
    ).toEqual([]);

    expect(
      consoleErrors,
      `Unexpected console errors:\n${consoleErrors.join("\n")}`
    ).toEqual([]);
  });

  test("A2 — mobile controls are visible and tappable", async ({
    page,
  }) => {
    await page.goto("/", {
      waitUntil: "domcontentloaded",
    });

    const startButton = page.getByRole("button", {
      name: "Start Demo",
    });

    await expect(startButton).toBeVisible();

    await startButton.tap();

    const dpad = page.getByRole("button", {
      name: "left",
    });

    await expect(dpad).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "up",
      })
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "down",
      })
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "right",
      })
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Space timing button",
      })
    ).toBeVisible();
  });

  test("A3 — correct D-pad input advances exactly one command", async ({
    page,
  }) => {
    await page.goto("/", {
      waitUntil: "domcontentloaded",
    });

    await page.getByRole("button", {
      name: "Start Demo",
    }).tap();

    const commandBar = page.locator(
      '[aria-label="Upcoming commands"]'
    );

    await expect(commandBar).toBeVisible();

    const steps = commandBar.locator(
      ".command-step"
    );

    await expect(steps).toHaveCount(8);

    /*
     * Approved demo sequence:
     *
     * LEFT → UP → DOWN → RIGHT
     * → LEFT → RIGHT → UP → DOWN
     */

    await page.getByRole("button", {
      name: "left",
    }).tap();

    await expect(
      steps.nth(0)
    ).toHaveClass(/command-completed/);

    await expect(
      steps.nth(1)
    ).toHaveClass(/command-target/);

    /*
     * The second command must NOT already
     * be completed after one tap.
     */
    await expect(
      steps.nth(1)
    ).not.toHaveClass(/command-completed/);
  });

  test("A4 — wrong D-pad input does not advance sequence", async ({
    page,
  }) => {
    await page.goto("/", {
      waitUntil: "domcontentloaded",
    });

    await page.getByRole("button", {
      name: "Start Demo",
    }).tap();

    const steps = page.locator(
      '[aria-label="Upcoming commands"] .command-step'
    );

    /*
     * First target is LEFT.
     * Press RIGHT intentionally.
     */

    await page.getByRole("button", {
      name: "right",
    }).tap();

    await expect(
      steps.nth(0)
    ).toHaveClass(/command-target/);

    await expect(
      steps.nth(0)
    ).not.toHaveClass(/command-completed/);

    await expect(
      steps.nth(1)
    ).not.toHaveClass(/command-completed/);
  });

  test("A5 — SPACE button is interactive", async ({
    page,
  }) => {
    await page.goto("/", {
      waitUntil: "domcontentloaded",
    });

    await page.getByRole("button", {
      name: "Start Demo",
    }).tap();

    const spaceButton = page.getByRole("button", {
      name: "Space timing button",
    });

    await expect(spaceButton).toBeVisible();

    await spaceButton.tap();

    /*
     * Part 2 intentionally has no timing
     * judgement implementation yet.
     *
     * This test only verifies that the
     * mobile interaction path exists and
     * does not crash the application.
     */
    await expect(spaceButton).toBeVisible();
  });

  test("A6 — all primary mobile controls have adequate hit area", async ({
    page,
  }) => {
    await page.goto("/", {
      waitUntil: "domcontentloaded",
    });

    await page.getByRole("button", {
      name: "Start Demo",
    }).tap();

    const buttonNames = [
      "left",
      "up",
      "down",
      "right",
      "Space timing button",
    ];

    for (const name of buttonNames) {
      const button = page.getByRole("button", {
        name,
      });

      await expect(button).toBeVisible();

      const box = await button.boundingBox();

      expect(
        box,
        `${name} button must have a bounding box`
      ).not.toBeNull();

      expect(
        box!.width,
        `${name} button is too narrow`
      ).toBeGreaterThanOrEqual(40);

      expect(
        box!.height,
        `${name} button is too short`
      ).toBeGreaterThanOrEqual(40);
    }
  });
});