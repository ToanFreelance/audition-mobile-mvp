import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ["html", { open: "never" }],
    ["list"],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],

  expect: {
    timeout: 15_000,
  },

  use: {
    baseURL:
      process.env.PLAYWRIGHT_TEST_BASE_URL ??
      "http://127.0.0.1:3000",

    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    } : undefined,

    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  webServer: process.env.PLAYWRIGHT_WEB_SERVER === "1"
    ? {
        command: "npm start -- --hostname 127.0.0.1",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,

  projects: [
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        browserName: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? "chromium" : "webkit",
        isMobile: true,
        hasTouch: true,
      },
    },

    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
