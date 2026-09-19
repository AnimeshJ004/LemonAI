import { describe, it, expect, vi, beforeEach } from "vitest";

const { authMock, adminMock, sendMock } = vi.hoisted(() => {
  function buildAdminMock() {
    const queue: any[] = [];
    const chain = () => {
      const c: any = {
        update: vi.fn(() => c),
        select: vi.fn(() => c),
        eq: vi.fn(() => c),
        lte: vi.fn(() => c),
        is: vi.fn(() => ({
          then: (resolve: any) => resolve(queue.shift() ?? { error: null }),
        })),
        order: vi.fn(() => c),
        limit: vi.fn(() => ({
          then: (resolve: any) => resolve(queue.shift() ?? { data: [], error: null }),
        })),
      };
      return c;
    };
    return {
      from: vi.fn(() => chain()),
      __respondWith: (r: any) => queue.push(r),
    };
  }
  return {
    authMock: vi.fn(),
    adminMock: buildAdminMock(),
    sendMock: vi.fn(async () => undefined),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@/lib/insforge-server", () => ({
  getInsforgeAdminClient: () => ({ database: adminMock }),
}));
vi.mock("@/inngest/client", () => ({ inngest: { send: sendMock } }));
vi.mock("@/lib/observability", () => ({
  reportError: vi.fn(async () => undefined),
  logInfo: vi.fn(),
}));

import { GET, POST } from "@/app/api/post/process-due/route";

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/post/process-due", {
    method: "GET",
    headers,
  });
}

describe("/api/post/process-due", () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    authMock.mockReset();
    sendMock.mockClear();
    adminMock.from.mockClear();
    process.env = { ...originalEnv };
  });

  it("returns 401 when neither CRON_SECRET nor Clerk session is provided", async () => {
    process.env.CRON_SECRET = "s".repeat(24);
    authMock.mockResolvedValue({ userId: null });
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 401 for wrong bearer token", async () => {
    process.env.CRON_SECRET = "correct-secret-value-16chars";
    authMock.mockResolvedValue({ userId: null });
    const res = await GET(makeReq({ authorization: "Bearer wrong-secret-value-16char" }));
    expect(res.status).toBe(401);
  });

  it("authorizes on matching CRON_SECRET (timing-safe)", async () => {
    process.env.CRON_SECRET = "correct-secret-value-16chars";
    authMock.mockResolvedValue({ userId: null });

    // Recovery update: no data payload needed.
    adminMock.__respondWith({ error: null });
    // Fetch due posts: empty.
    adminMock.__respondWith({ data: [], error: null });

    const res = await GET(makeReq({ authorization: "Bearer correct-secret-value-16chars" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.dueCount).toBe(0);
    expect(body.dispatched).toBe(0);
  });

  it("authorizes an authenticated Clerk session even without CRON_SECRET header", async () => {
    delete process.env.CRON_SECRET;
    authMock.mockResolvedValue({ userId: "user_dashboard" });

    adminMock.__respondWith({ error: null });
    adminMock.__respondWith({ data: [], error: null });

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
  });

  it("fans out one Inngest event per due post and returns the count", async () => {
    process.env.CRON_SECRET = "correct-secret-value-16chars";
    authMock.mockResolvedValue({ userId: null });

    adminMock.__respondWith({ error: null });
    adminMock.__respondWith({
      data: [
        { id: "p1", user_id: "u1", scheduled_at: "2026-09-18T00:00:00Z" },
        { id: "p2", user_id: "u2", scheduled_at: "2026-09-18T00:01:00Z" },
        { id: "p3", user_id: "u1", scheduled_at: "2026-09-18T00:02:00Z" },
      ],
      error: null,
    });

    const res = await POST(makeReq({ authorization: "Bearer correct-secret-value-16chars" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dueCount).toBe(3);
    expect(body.dispatched).toBe(3);

    // One inngest.send call with an array of three events.
    expect(sendMock).toHaveBeenCalledTimes(1);
    const events = (sendMock.mock.calls[0] as unknown as [Array<{ name: string; data: { postId: string; userId: string } }>])[0];
    expect(events).toHaveLength(3);
    expect(events[0].name).toBe("post/publish.requested");
    expect(events[0].data.postId).toBe("p1");
    expect(events[0].data.userId).toBe("u1"); // required for per-user concurrency
  });

  it("does not fail the whole fan-out when Inngest is unreachable", async () => {
    process.env.CRON_SECRET = "correct-secret-value-16chars";
    authMock.mockResolvedValue({ userId: null });

    sendMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    adminMock.__respondWith({ error: null });
    adminMock.__respondWith({
      data: [{ id: "p1", user_id: "u1", scheduled_at: "2026-09-18T00:00:00Z" }],
      error: null,
    });

    const res = await POST(makeReq({ authorization: "Bearer correct-secret-value-16chars" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dueCount).toBe(1);
    expect(body.dispatched).toBe(0); // dispatch failed, count reflects it
  });
});
