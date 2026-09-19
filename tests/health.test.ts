import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Test the /api/health route directly. We mock the Insforge admin client so
 * we can simulate a healthy DB, a slow DB, a broken DB. Upstash is faked via
 * global fetch.
 */

const dbSelectMock = vi.fn();
const fromMock = vi.fn(() => ({
  select: dbSelectMock,
}));

vi.mock("@/lib/insforge-server", () => ({
  getInsforgeAdminClient: () => ({
    database: { from: fromMock },
  }),
}));

async function loadRoute() {
  // Fresh import per test so route-level constants pick up env changes.
  const mod = await import("@/app/api/health/route");
  return mod;
}

describe("GET /api/health", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    dbSelectMock.mockReset();
    fromMock.mockClear();
    process.env = { ...originalEnv };
    // Minimum env for the env-check to pass
    process.env.GROQ_API_KEY = "gsk_test";
    process.env.CLERK_SECRET_KEY = "sk_test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.APP_ENV = "development";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it("returns 200 ok when db is healthy and no optional deps are configured", async () => {
    dbSelectMock.mockResolvedValueOnce({ error: null });
    const { GET } = await loadRoute();
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks.db.ok).toBe(true);
    expect(body.checks.env.ok).toBe(true);
    expect(body.checks.inngest.ok).toBe(true);
    expect(body.checks.upstash).toBeUndefined(); // not configured — omitted
  });

  it("returns 503 down when the db check fails", async () => {
    dbSelectMock.mockResolvedValueOnce({ error: { message: "connection refused" } });
    const { GET } = await loadRoute();
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("down");
    expect(body.checks.db.ok).toBe(false);
    expect(body.checks.db.detail).toContain("connection refused");
  });

  it("returns 200 degraded when db is up but env is missing a required var", async () => {
    delete process.env.GROQ_API_KEY;
    dbSelectMock.mockResolvedValueOnce({ error: null });
    const { GET } = await loadRoute();
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("degraded");
    expect(body.checks.env.ok).toBe(false);
    expect(body.checks.env.detail).toContain("GROQ_API_KEY");
  });

  it("includes upstash check when configured and reports PONG", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: "PONG" }),
    } as any) as any;

    dbSelectMock.mockResolvedValueOnce({ error: null });
    const { GET } = await loadRoute();
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks.upstash.ok).toBe(true);
  });

  it("marks the response degraded when upstash is unreachable", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    global.fetch = vi.fn().mockRejectedValue(new Error("dns error")) as any;

    dbSelectMock.mockResolvedValueOnce({ error: null });
    const { GET } = await loadRoute();
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("degraded");
    expect(body.checks.upstash.ok).toBe(false);
  });

  it("marks inngest degraded in production when INNGEST_EVENT_KEY is missing", async () => {
    process.env.APP_ENV = "production";
    delete process.env.INNGEST_EVENT_KEY;
    dbSelectMock.mockResolvedValueOnce({ error: null });
    const { GET } = await loadRoute();
    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe("degraded");
    expect(body.checks.inngest.ok).toBe(false);
  });

  it("returns Cache-Control: no-store", async () => {
    dbSelectMock.mockResolvedValueOnce({ error: null });
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("includes an elapsedMs number and version info", async () => {
    dbSelectMock.mockResolvedValueOnce({ error: null });
    const { GET } = await loadRoute();
    const res = await GET();
    const body = await res.json();

    expect(typeof body.elapsedMs).toBe("number");
    expect(body.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(body.version.nodeVersion).toBeDefined();
    expect(body.version.appEnv).toBe("development");
  });
});
