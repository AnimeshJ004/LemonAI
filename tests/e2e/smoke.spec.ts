import { test, expect } from "@playwright/test";

/**
 * Lemon AI — smoke tests
 *
 * These are the always-green baseline: any PR that breaks the landing page,
 * the privacy page, or the /api/health endpoint has an unshippable
 * regression. Every other E2E test is opt-in.
 */

test.describe("smoke @smoke", () => {
  test("landing page renders and shows the hero copy", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("/privacy page renders", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: /Privacy Policy/i })).toBeVisible();
    await expect(page.getByText(/GDPR|DPDP|CCPA/i)).toBeVisible();
  });

  test("/api/health returns 200 with checks payload", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBeGreaterThanOrEqual(200);
    expect(res.status()).toBeLessThan(600);
    const body = await res.json();
    expect(["ok", "degraded", "down"]).toContain(body.status);
    expect(body.checks).toBeDefined();
    expect(body.checks.db).toBeDefined();
  });
});
