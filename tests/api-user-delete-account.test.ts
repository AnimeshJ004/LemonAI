import { describe, it, expect, vi, beforeEach } from "vitest";

const { authMock, deleteUserMock, purgeMock, insertMock, updateMock, fromMock } = vi.hoisted(() => {
  const insertMock = vi.fn(async () => ({ error: null }));
  const updateMock = vi.fn(() => ({
    eq: () => ({
      eq: () => ({
        eq: () => ({ then: (r: any) => r({ error: null }) }),
      }),
    }),
  }));
  return {
    authMock: vi.fn(),
    deleteUserMock: vi.fn(async () => undefined),
    purgeMock: vi.fn(async () => ({
      userId: "user_del",
      purgedTables: ["scheduled_posts", "leads"],
      success: true,
      errors: {},
    })),
    insertMock,
    updateMock,
    fromMock: vi.fn(() => ({ insert: insertMock, update: updateMock })),
  };
});

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
  clerkClient: async () => ({ users: { deleteUser: deleteUserMock } }),
}));

vi.mock("@/lib/user-purge", () => ({
  purgeAllUserData: purgeMock,
}));

vi.mock("@/lib/insforge-server", () => ({
  getInsforgeAdminClient: () => ({ database: { from: fromMock } }),
}));

vi.mock("@/lib/observability", () => ({
  reportError: vi.fn(async () => undefined),
  logInfo: vi.fn(),
}));

vi.mock("@/lib/audit-log", () => ({
  writeAuditEntry: vi.fn(async () => undefined),
  AUDIT_EVENT: { ACCOUNT_DELETION_REQUESTED: "account.deletion_requested" },
}));

import { DELETE } from "@/app/api/user/delete-account/route";
import { writeAuditEntry } from "@/lib/audit-log";

function makeReq(headers: Record<string, string> = {}): any {
  return {
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  };
}

describe("DELETE /api/user/delete-account", () => {
  beforeEach(() => {
    authMock.mockReset();
    purgeMock.mockClear();
    insertMock.mockClear();
    deleteUserMock.mockClear();
    (writeAuditEntry as any).mockClear?.();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await DELETE(makeReq());
    expect(res.status).toBe(401);
  });

  it("purges all user data, deletes the Clerk user, and returns success", async () => {
    authMock.mockResolvedValue({ userId: "user_del" });
    const res = await DELETE(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.purgedTables).toContain("scheduled_posts");
    expect(purgeMock).toHaveBeenCalledWith("user_del");
    expect(deleteUserMock).toHaveBeenCalledWith("user_del");
  });

  it("records a dsr_requests row of type='deletion' status='processing' up front", async () => {
    authMock.mockResolvedValue({ userId: "user_del" });
    await DELETE(makeReq());
    // First insert is the DSR row.
    expect(insertMock).toHaveBeenCalled();
    const firstInsert = (insertMock.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(firstInsert.user_id).toBe("user_del");
    expect(firstInsert.request_type).toBe("deletion");
    expect(firstInsert.status).toBe("processing");
  });

  it("emits an ACCOUNT_DELETION_REQUESTED audit entry at the API layer", async () => {
    authMock.mockResolvedValue({ userId: "user_del" });
    await DELETE(makeReq({ "x-forwarded-for": "203.0.113.5" }));
    expect(writeAuditEntry).toHaveBeenCalled();
    const call = (writeAuditEntry as any).mock.calls[0][0];
    expect(call.event).toBe("account.deletion_requested");
    expect(call.userId).toBe("user_del");
    expect(call.ip).toBe("203.0.113.5");
  });

  it("does NOT return 500 when the Clerk user delete fails (already gone is fine)", async () => {
    authMock.mockResolvedValue({ userId: "user_del" });
    deleteUserMock.mockRejectedValueOnce(new Error("user not found"));
    const res = await DELETE(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
