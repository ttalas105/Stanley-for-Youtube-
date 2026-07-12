import { defineConfig, devices } from "@playwright/test";

const productionBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const bypassToken = process.env.SITES_BYPASS_TOKEN;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: productionBaseUrl || "http://localhost:3000",
    extraHTTPHeaders: bypassToken
      ? { "OAI-Sites-Authorization": `Bearer ${bypassToken}` }
      : undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  expect: {
    timeout: 5_000,
  },
  webServer: productionBaseUrl
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  outputDir: "test-results",
});
