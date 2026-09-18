import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("rate-limit (in-memory)", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    // Ensure Upstash is not configured so the in-memory backend is used.
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.useRealTimers();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.useRealTimers();
  });

  it("allows requests up to the limit then blocks", async () => {
    const opts = { limit: 3, windowMs: 60_000, namespace: "test-block" };
    const id = "user:alice";

    const r1 = await checkRateLimit(id, opts);
    const r2 = await checkRateLimit(id, opts);
    const r3 = await checkRateLimit(id, opts);
    const r4 = await checkRateLimit(id, opts);

    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r2.success).toBe(true);
    expect(r3.success).toBe(true);
    expect(r3.remaining).toBe(0);
    expect(r4.success).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it("isolates counters by identifier", async () => {
    const opts = { limit: 1, windowMs: 60_000, namespace: "test-isolate" };
    const a = await checkRateLimit("user:a", opts);
    const b = await checkRateLimit("user:b", opts);
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
  });

  it("isolates counters by namespace", async () => {
    const id = "user:same";
    const first = await checkRateLimit(id, { limit: 1, windowMs: 60_000, namespace: "ns1" });
    const second = await checkRateLimit(id, { limit: 1, windowMs: 60_000, namespace: "ns2" });
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
  });

  it("resets after the window elapses", async () => {
    vi.useFakeTimers();
    const opts = { limit: 1, windowMs: 1_000, namespace: "test-reset" };
    const id = "user:reset";

    const r1 = await checkRateLimit(id, opts);
    const r2 = await checkRateLimit(id, opts);
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(1_500);

    const r3 = await checkRateLimit(id, opts);
    expect(r3.success).toBe(true);
  });
});
