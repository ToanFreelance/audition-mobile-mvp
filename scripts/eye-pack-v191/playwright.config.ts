import { defineConfig } from "@playwright/test";
import base from "../../playwright.config";

export default defineConfig({
  ...base,
  testDir: "../../e2e",
  outputDir: "../../test-results/eye-pack-v191",
  use: {
    ...base.use,
    video: "off",
    launchOptions: {
      ...base.use?.launchOptions,
      args: process.env.EYE_QA_SOFTWARE_WEBGL === "1"
        ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        : undefined,
    },
  },
});
