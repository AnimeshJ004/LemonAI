import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * These tests intercept global `fetch` to simulate the Upstash REST API
 * without any network call. We reset the in-memory cache and env between
 * tests so behavior is deterministic.
 */

async function loadCache() {
  return await import("@/lib/ai-cache");
}

describe("ai-cache: in-memory tier (backward compatible)", () => {
  beforeEach(async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const mod = await loadCache();
    mod.clearAICache();
  });

  it("stores and retrieves a response synchronously", async () => {
    const mod = await loadCache();
    const key = mod.buildCacheKey({
      task: "QUICK_IDEA",
      systemPrompt: "sys",
      userPrompt: "hello",
    });
    mod.setCachedAIResponse(key, { ok: true }, "raw", "gpt-oss-20b", "QUICK_IDEA");
    const got = mod.getCachedAIResponse(key);
    expect(got?.data).toEqual({ ok: true });
  });

  it("returns null for a missing key", async () => {
    const mod = await loadCache();
    expect(mod.getCachedAIResponse("nonexistent")).toBeNull();
  });

  it("tracks hits and misses in metrics", async () => {
    const mod = await loadCache();
    const k = "metrics-key";
    mod.getCachedAIResponse(k); // miss
    mod.setCachedAIResponse(k, "value", "raw", "m", "QUICK_IDEA");
    mod.getCachedAIResponse(k); // hit

    const m = mod.getCacheMetrics();
    expect(m.hits).toBeGreaterThanOrEqual(1);
    expect(m.misses).toBeGreaterThanOrEqual(1);
    expect(m.upstashEnabled).toBe(false);
  });
});

describe("ai-cache: getCachedAIResponseAsync + Upstash tier", () => {
  const originalFetch = global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: null }),
    } as any);
    global.fetch = fetchMock as any;

    const mod = await loadCache();
    mod.clearAICache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("returns from in-memory tier when populated (no Upstash call)", async () => {
    const mod = await loadCache();
    const key = "in-mem-first";
    mod.setCachedAIResponse(key, { a: 1 }, "raw", "m", "QUICK_IDEA");

    // Let the fire-and-forget Upstash SET drain before observing GET traffic.
    await new Promise((r) => setTimeout(r, 10));
    fetchMock.mockClear();

    const hit = await mod.getCachedAIResponseAsync(key);
    expect(hit?.data).toEqual({ a: 1 });
    // Should NOT have hit Upstash for this read — in-memory tier answered.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls through to Upstash on in-memory miss and populates in-memory", async () => {
    const mod = await loadCache();
    const key = "upstash-hit";
    const upstashEntry = {
      data: { fromRedis: true },
      rawText: "raw",
      model: "gpt-oss-20b",
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      taskType: "QUICK_IDEA",
    };
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ result: JSON.stringify(upstashEntry) }),
    } as any);

    const hit1 = await mod.getCachedAIResponseAsync(key);
    expect(hit1?.data).toEqual({ fromRedis: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second read should be an in-memory hit (no additional fetch).
    fetchMock.mockClear();
    const hit2 = await mod.getCachedAIResponseAsync(key);
    expect(hit2?.data).toEqual({ fromRedis: true });
    expect(fetchMock).not.toHaveBeenCalled();

    // Metrics reflect the Upstash hit.
    const m = mod.getCacheMetrics();
    expect(m.redisHits).toBeGreaterThanOrEqual(1);
  });

  it("returns null when Upstash misses (no in-memory, no Redis result)", async () => {
    const mod = await loadCache();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ result: null }),
    } as any);
    const hit = await mod.getCachedAIResponseAsync("nowhere");
    expect(hit).toBeNull();
  });

  it("gracefully falls back to in-memory when Upstash fails (network error)", async () => {
    const mod = await loadCache();
    fetchMock.mockRejectedValue(new Error("network down"));
    const hit = await mod.getCachedAIResponseAsync("net-fail");
    // Must not throw, must return null.
    expect(hit).toBeNull();

    const m = mod.getCacheMetrics();
    expect(m.redisErrors).toBeGreaterThanOrEqual(1);
  });

  it("gracefully falls back when Upstash returns non-OK", async () => {
    const mod = await loadCache();
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) } as any);
    const hit = await mod.getCachedAIResponseAsync("not-ok");
    expect(hit).toBeNull();
  });

  it("setCachedAIResponse issues a fire-and-forget Upstash SET", async () => {
    const mod = await loadCache();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) } as any);

    mod.setCachedAIResponse("write-key", { x: 1 }, "raw", "m", "QUICK_IDEA");

    // The Upstash write is async and fire-and-forget. Give it a tick.
    await new Promise((r) => setTimeout(r, 10));

    // Should have called the SETEX endpoint once.
    const setCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/set/")
    );
    expect(setCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("upstashEnabled=false when only one credential is set", async () => {
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const mod = await loadCache();
    mod.clearAICache();
    const m = mod.getCacheMetrics();
    expect(m.upstashEnabled).toBe(false);
  });

  it("ignores stale entries returned by Upstash", async () => {
    const mod = await loadCache();
    const stale = {
      data: "old",
      rawText: "old",
      model: "m",
      createdAt: Date.now() - 10 * 60 * 1000,
      expiresAt: Date.now() - 1000, // already expired
      taskType: "QUICK_IDEA",
    };
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ result: JSON.stringify(stale) }),
    } as any);
    const hit = await mod.getCachedAIResponseAsync("stale-key");
    expect(hit).toBeNull();
  });
});
