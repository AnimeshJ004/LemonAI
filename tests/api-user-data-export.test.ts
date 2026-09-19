import { describe, it, expect, vi, beforeEach } from "vitest";

const { authMock, adminMock } = vi.hoisted(() => {
  function buildAdminMock() {
    const queue: any[] = [];
    const insertsReceived: Array<{ table: string; row: any }> = [];

    const makeChain = (table: string) => {
      const c: any = {
        select: vi.fn(() => c),
        insert: vi.fn((row: any) => {
          insertsReceived.push({ table, row });
          return {
            then: (resolve: any) => resolve(queue.shift() ?? { data: null, error: null }),
          };
        }),
        eq: vi.fn(() => ({
          then: (resolve: any) => resolve(queue.shift() ?? { data: [], error: null }),
          in: vi.fn(() => ({
            then: (resolve: any) => resolve(queue.shift() ?? { data: [], error: null }),
          })),
        })),
        in: vi.fn(() => ({
          then: (resolve: any) => resolve(queue.shift() ?? { data: [], error: null }),
        })),
      };
      return c;
    };

    return {
      from: vi.fn((table: string) => makeChain(table)),
      __respondWith: (r: any) => queue.push(r),
      __inserts: insertsReceived,
    };
  }
  return { authMock: vi.fn(), adminMock: buildAdminMock() };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@/lib/insforge-server", () => ({
  getInsforgeAdminClient: () => ({ database: adminMock }),
}));

vi.mock("@/lib/observability", () => ({
  reportError: vi.fn(async () => undefined),
  logInfo: vi.fn(),
}));

vi.mock("@/lib/audit-log", () => ({
  writeAuditEntry: vi.fn(async () => undefined),
  listAuditEntriesForUser: vi.fn(async () => []),
  AUDIT_EVENT: { ACCOUNT_DATA_EXPORTED: "account.data_exported" },
}));

vi.mock("@/lib/consent", () => ({
  listUserConsents: vi.fn(async () => []),
}));

import { GET } from "@/app/api/user/data-export/route";
import { writeAuditEntry } from "@/lib/audit-log";

function makeReq(headers: Record<string, string> = {}): any {
  return {
    headers: {
      get: (k: string) => headers[k.toLowerCase()] ?? null,
    },
  };
}

describe("/api/user/data-export GET", () => {
  beforeEach(() => {
    authMock.mockReset();
    adminMock.__inserts.length = 0;
    (writeAuditEntry as any).mockClear?.();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns a JSON export attachment with meta.userId", async () => {
    authMock.mockResolvedValue({ userId: "user_abc" });

    const res = await GET(makeReq({ "x-forwarded-for": "203.0.113.99" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain(
      `attachment; filename="lemon-ai-data-export-user_abc.json"`
    );
    expect(res.headers.get("cache-control")).toContain("no-store");

    const body = await res.json();
    expect(body.meta.userId).toBe("user_abc");
    expect(body.meta.legalBasis).toEqual(
      expect.arrayContaining([
        expect.stringContaining("GDPR Art. 15"),
        expect.stringContaining("DPDP Act 2023"),
      ])
    );
    // Structural top-level keys guaranteed.
    expect(body.data).toHaveProperty("user_channels");
    expect(body.data).toHaveProperty("audit_log");
    expect(body.data).toHaveProperty("consent_records");
  });

  it("emits an ACCOUNT_DATA_EXPORTED audit entry", async () => {
    authMock.mockResolvedValue({ userId: "user_xyz" });
    await GET(makeReq());
    expect(writeAuditEntry).toHaveBeenCalledTimes(1);
    expect((writeAuditEntry as any).mock.calls[0][0].event).toBe("account.data_exported");
    expect((writeAuditEntry as any).mock.calls[0][0].userId).toBe("user_xyz");
  });

  it("records a fulfilled dsr_requests row for regulator evidence", async () => {
    authMock.mockResolvedValue({ userId: "user_dsr" });
    await GET(makeReq());
    const dsr = adminMock.__inserts.find((i) => i.table === "dsr_requests");
    expect(dsr).toBeDefined();
    expect(dsr!.row.user_id).toBe("user_dsr");
    expect(dsr!.row.request_type).toBe("access");
    expect(dsr!.row.status).toBe("completed");
  });
});
