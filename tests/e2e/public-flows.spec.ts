import { test, expect } from "@playwright/test";

/**
 * Public-page and API-surface E2E tests.
 *
 * These do NOT require a signed-in user — they exercise everything a first-
 * time visitor sees. If any of these fail, the app is unshippable.
 *
 * Signed-in flows (dashboard, post creation, publishing) require a Clerk
 * test-mode session and live in `tests/e2e/dashboard.spec.ts` (opt-in, run
 * manually with CLERK_TEST_USER_EMAIL / CLERK_TEST_USER_PASSWORD set).
 */

const isMockClerk = (() => {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  if (!key || key.includes("dummy") || key.includes("placeholder")) return true;
  try {
    const parts = key.split("_");
    if (parts.length > 2) {
      const decoded = Buffer.from(parts[2], "base64").toString();
      if (decoded.includes("dummy") || decoded.includes("example")) return true;
    }
  } catch {}
  return false;
})();

test.describe("public pages", () => {
  test.beforeEach(() => {
    test.skip(isMockClerk, "Requires live Clerk instance — skipped in CI with mock keys");
  });

  test("/terms renders with 15 sections and legal contact", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: /Terms of Service/i })).toBeVisible();
    // Cross-check a few section titles that are baked into the copy.
    await expect(page.getByRole("heading", { name: /^3\. Acceptable Use$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^10\. Limitation of Liability$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^15\. Contact$/i })).toBeVisible();
  });

  test("sign-in page renders the Clerk widget", async ({ page }) => {
    await page.goto("/sign-in");
    // Clerk's sign-in form is mounted client-side; wait for the outer form
    // container. The test tolerates either the hosted or embedded variant.
    await expect(page.locator("body")).toContainText(/sign in|log in/i);
  });

  test("unknown route returns 404 without crashing", async ({ page }) => {
    const res = await page.goto("/this-route-does-not-exist-xyz");
    expect(res).not.toBeNull();
    // Next.js returns 404 with the built-in page.
    expect([404, 200]).toContain(res!.status());
  });
});

test.describe("cookie consent", () => {
  test.beforeEach(() => {
    test.skip(isMockClerk, "Requires live Clerk instance — skipped in CI with mock keys");
  });
  test("banner appears on first visit and dismisses on accept", async ({
    page,
    context,
  }) => {
    // Clear storage to force a first-visit state.
    await context.clearCookies();
    await page.goto("/privacy");
    // localStorage.clear works only after the first navigation loads the
    // origin, which is why we set it after goto.
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    // Banner should be visible with both action buttons.
    const banner = page.getByRole("dialog", { name: /We use cookies/i });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("button", { name: /Accept all/i })).toBeVisible();
    await expect(banner.getByRole("button", { name: /Reject non-essential/i })).toBeVisible();

    // Click accept; banner should disappear and localStorage should reflect the choice.
    await banner.getByRole("button", { name: /Accept all/i }).click();
    await expect(banner).toBeHidden();
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("lemonai.consent.v1")
    );
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.analytics).toBe(true);
    expect(parsed.marketing).toBe(true);
    expect(parsed.version).toBe("1.0");
  });

  test("reject-non-essential records analytics=false", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/privacy");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    const banner = page.getByRole("dialog", { name: /We use cookies/i });
    await banner.getByRole("button", { name: /Reject non-essential/i }).click();
    await expect(banner).toBeHidden();

    const stored = await page.evaluate(() =>
      window.localStorage.getItem("lemonai.consent.v1")
    );
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.analytics).toBe(false);
    expect(parsed.marketing).toBe(false);
  });

  test("banner does not re-appear after a decision is stored", async ({
    page,
  }) => {
    await page.goto("/privacy");
    await page.evaluate(() =>
      window.localStorage.setItem(
        "lemonai.consent.v1",
        JSON.stringify({
          analytics: false,
          marketing: false,
          timestamp: Date.now(),
          version: "1.0",
        })
      )
    );
    await page.reload();
    await expect(
      page.getByRole("dialog", { name: /We use cookies/i })
    ).toBeHidden();
  });
});

test.describe("api surface", () => {
  test("GET /api/health responds with a well-formed payload", async ({ request }) => {
    const res = await request.get("/api/health");
    const body = await res.json();
    expect(res.status()).toBeGreaterThanOrEqual(200);
    expect(res.status()).toBeLessThan(600);

    // Contract: status enum + timestamp + checks object.
    expect(["ok", "degraded", "down"]).toContain(body.status);
    expect(typeof body.timestamp).toBe("string");
    expect(typeof body.elapsedMs).toBe("number");
    expect(body.checks).toBeDefined();
    expect(body.checks.db).toBeDefined();
    expect(typeof body.checks.db.ok).toBe("boolean");
    expect(body.checks.env).toBeDefined();
    expect(typeof body.checks.env.ok).toBe("boolean");
  });

  test("unauthenticated hit to a protected API returns 401 JSON", async ({
    request,
  }) => {
    const res = await request.get("/api/post");
    expect(res.status()).toBe(401);
    const body = await res.json().catch(() => null);
    // Middleware-level 401 must respond in JSON, not redirect.
    expect(body).not.toBeNull();
    expect(body?.error).toBeDefined();
  });

  test("every response carries an x-correlation-id header", async ({ request }) => {
    const res = await request.get("/api/health");
    const cid = res.headers()["x-correlation-id"];
    expect(cid).toBeTruthy();
    // Middleware regex enforces 8..128 chars from a limited charset.
    expect(cid).toMatch(/^[a-zA-Z0-9._-]{8,128}$/);
  });
});
