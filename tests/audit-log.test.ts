import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Capture-and-mock the insforge admin client so we can assert on the insert
// payload without touching a real database.
type InsertResp = { error: null | { message: string } };
const insertMock = vi.fn(async (_row: unknown): Promise<InsertResp> => ({ error: null }));
const fromMock = vi.fn(() => ({ insert: insertMock }));

vi.mock("@/lib/insforge-server", () => ({
  getInsforgeAdminClient: () => ({
    database: {
      from: fromMock,
    },
  }),
}));

// Silence Sentry side-channel.
vi.mock("@/lib/observability", async () => {
  const actual = await vi.importActual<typeof import("@/lib/observability")>(
    "@/lib/observability"
  );
  return {
    ...actual,
    reportError: vi.fn(async () => undefined),
  };
});

import { writeAuditEntry, AUDIT_EVENT } from "@/lib/audit-log";
import { reportError } from "@/lib/observability";

describe("audit-log: writeAuditEntry", () => {
  beforeEach(() => {
    insertMock.mockClear();
    fromMock.mockClear();
    (reportError as any).mockClear?.();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("inserts a row into audit_logs with the correct shape", async () => {
    await writeAuditEntry({
      userId: "user_abc",
      event: AUDIT_EVENT.CHANNEL_CONNECTED,
      resourceType: "user_channel",
      resourceId: "ch_123",
      metadata: { channelType: "INSTAGRAM" },
      ip: "203.0.113.42",
      userAgent: "Mozilla/5.0",
    });

    expect(fromMock).toHaveBeenCalledWith("audit_logs");
    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = insertMock.mock.calls[0][0] as Record<string, unknown>;

    expect(row.user_id).toBe("user_abc");
    expect(row.actor_type).toBe("user");
    expect(row.actor_user_id).toBe("user_abc");
    expect(row.event).toBe("channel.connected");
    expect(row.resource_type).toBe("user_channel");
    expect(row.resource_id).toBe("ch_123");
    expect(row.metadata).toEqual({ channelType: "INSTAGRAM" });
    expect(row.user_agent).toBe("Mozilla/5.0");
    // IP must be hashed, not raw.
    expect(row.ip_hash).toMatch(/^[a-f0-9]{16}$/);
    expect(row.ip_hash).not.toBe("203.0.113.42");
  });

  it("redacts PII inside metadata before insertion", async () => {
    await writeAuditEntry({
      userId: "user_xyz",
      event: AUDIT_EVENT.CONSENT_GRANTED,
      metadata: {
        email: "alice@example.com",
        note: "Signed up via link with token=sk-proj-abcdefghijklmnopqrstuv1234567890XYZ",
      },
    });

    const row = insertMock.mock.calls[0][0] as Record<string, unknown>;
    const meta = row.metadata as Record<string, unknown>;
    expect(meta.email).toBe("[REDACTED]");
    expect(String(meta.note)).toContain("[API_KEY]");
    expect(String(meta.note)).not.toContain("sk-proj-abcdefghij");
  });

  it("never throws when the insert fails", async () => {
    insertMock.mockResolvedValueOnce({ error: { message: "table missing" } });
    await expect(
      writeAuditEntry({ event: AUDIT_EVENT.AUTH_LOGIN, userId: "u1" })
    ).resolves.toBeUndefined();
    expect(reportError).toHaveBeenCalled();
  });

  it("never throws when the client itself throws", async () => {
    fromMock.mockImplementationOnce(() => {
      throw new Error("db unreachable");
    });
    await expect(
      writeAuditEntry({ event: AUDIT_EVENT.AUTH_LOGIN, userId: "u2" })
    ).resolves.toBeUndefined();
    expect(reportError).toHaveBeenCalled();
  });

  it("defaults actor_type to 'user' when unspecified", async () => {
    await writeAuditEntry({ event: AUDIT_EVENT.AUTH_LOGIN, userId: "u3" });
    const row = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(row.actor_type).toBe("user");
  });

  it("honors an explicit actor_type of 'system'", async () => {
    await writeAuditEntry({
      event: AUDIT_EVENT.ADMIN_RETENTION_ENFORCED,
      actorType: "system",
    });
    const row = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(row.actor_type).toBe("system");
    expect(row.user_id).toBeNull();
  });

  it("stores null ip_hash when no ip provided", async () => {
    await writeAuditEntry({ event: AUDIT_EVENT.AUTH_LOGIN, userId: "u4" });
    const row = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(row.ip_hash).toBeNull();
  });
});
