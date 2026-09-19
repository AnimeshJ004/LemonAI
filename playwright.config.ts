import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration — E2E smoke suite for Lemon AI.
 *
 * Runs against a local `next dev` server. Enable Playwright with:
 *
 *   npm install --save-dev @playwright/test
 *   npx playwright install chromium
 *   npm run test:e2e
 *
 * The suite is intentionally tiny (see `tests/e2e/smoke.spec.ts`) so it
 * completes in under a minute. Add per-route tests over time — keep the
 * `smoke` label reserved for the always-green subset that any PR must not
 * break.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
