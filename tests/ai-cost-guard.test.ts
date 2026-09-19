import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkAiSpend, __resetAiCostGuardForTests } from "@/lib/ai-cost-guard";

/**
 * These tests never touch Upstash. Without UPSTASH_REDIS_REST_URL configured
 * the guard falls back to in-memory counters, which we can reset between
 * tests via `__resetAiCostGuardForTests`.
 */

describe("lib/ai-cost-guard", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Force in-memory backend.
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.AI_DAILY_CAP_PER_USER;
    delete process.env.AI_HOURLY_CAP_PER_USER;
    delete process.env.AI_DAILY_CAP_GLOBAL;
    delete process.env.AI_DAILY_CAP_PROVIDER_GROQ;
    delete process.env.AI_COST_GUARD_FAIL_CLOSED;
    __resetAiCostGuardForTests();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("allows a first call and returns non-zero counters", async () => {
    const v = await checkAiSpend({ provider: "groq", userId: "user_1" });
    expect(v.allowed).toBe(true);
    expect(v.reason).toBe("");
    expect(v.detail.perUserToday).toBeGreaterThan(0);
    expect(v.detail.globalToday).toBeGreaterThan(0);
    expect(v.detail.perProviderToday).toBeGreaterThan(0);
  });

  it("blocks when the per-user hourly cap is exceeded", async () => {
    process.env.AI_HOURLY_CAP_PER_USER = "2";
    process.env.AI_DAILY_CAP_PER_USER = "1000";
    process.env.AI_DAILY_CAP_GLOBAL = "1000";
    __resetAiCostGuardForTests();

    const a = await checkAiSpend({ provider: "groq", userId: "user_burst" });
    const b = await checkAiSpend({ provider: "groq", userId: "user_burst" });
    const c = await checkAiSpend({ provider: "groq", userId: "user_burst" });

    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
    expect(c.allowed).toBe(false);
    expect(c.reason).toContain("per-user hourly cap");
  });

  it("blocks when the per-user daily cap is exceeded", async () => {
    process.env.AI_HOURLY_CAP_PER_USER = "1000";
    process.env.AI_DAILY_CAP_PER_USER = "2";
    process.env.AI_DAILY_CAP_GLOBAL = "1000";
    __resetAiCostGuardForTests();

    await checkAiSpend({ provider: "groq", userId: "user_daily" });
    await checkAiSpend({ provider: "groq", userId: "user_daily" });
    const third = await checkAiSpend({ provider: "groq", userId: "user_daily" });
    expect(third.allowed).toBe(false);
    expect(third.reason).toContain("per-user daily cap");
  });

  it("blocks when the global daily cap is exceeded", async () => {
    process.env.AI_HOURLY_CAP_PER_USER = "1000";
    process.env.AI_DAILY_CAP_PER_USER = "1000";
    process.env.AI_DAILY_CAP_GLOBAL = "2";
    __resetAiCostGuardForTests();

    await checkAiSpend({ provider: "groq", userId: "user_a" });
    await checkAiSpend({ provider: "groq", userId: "user_b" });
    const third = await checkAiSpend({ provider: "groq", userId: "user_c" });
    expect(third.allowed).toBe(false);
    expect(third.reason).toContain("global daily cap");
  });

  it("honors the provider-specific daily cap", async () => {
    process.env.AI_DAILY_CAP_PROVIDER_GROQ = "1";
    __resetAiCostGuardForTests();

    const first = await checkAiSpend({ provider: "groq", userId: "u1" });
    const second = await checkAiSpend({ provider: "groq", userId: "u2" });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(second.reason).toContain("provider daily cap");
  });

  it("supports anonymous (userId=null) calls — only global + provider caps apply", async () => {
    process.env.AI_HOURLY_CAP_PER_USER = "1";
    process.env.AI_DAILY_CAP_PER_USER = "1";
    process.env.AI_DAILY_CAP_GLOBAL = "1000";
    __resetAiCostGuardForTests();

    const a = await checkAiSpend({ provider: "groq", userId: null });
    const b = await checkAiSpend({ provider: "groq", userId: null });
    // No user attribution → per-user counter stays at 0 and the low
    // per-user cap does not fire.
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });

  it("charges the configured weight to every counter", async () => {
    __resetAiCostGuardForTests();
    const v = await checkAiSpend({ provider: "replicate", userId: "u", weight: 10 });
    expect(v.allowed).toBe(true);
    expect(v.detail.perUserToday).toBe(10);
    expect(v.detail.globalToday).toBe(10);
    expect(v.detail.perProviderToday).toBe(10);
  });
});
