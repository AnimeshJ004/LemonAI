import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Build a Supabase-like chainable query object driven by scripted responses.
 * Each element of `queue` is popped for a single terminal call (single/
 * maybeSingle/order-final) — matching the sequence of DB reads/writes issued
 * by the code under test.
 */
function buildAdminMock() {
  const responses: any[] = [];
  const insertCalls: any[] = [];
  const selectCalls: any[] = [];

  function chain() {
    const c: any = {
      insert: vi.fn((row: any) => {
        insertCalls.push(row);
        return c;
      }),
      select: vi.fn((cols: any) => {
        selectCalls.push(cols);
        return c;
      }),
      eq: vi.fn(() => c),
      order: vi.fn(() => c),
      limit: vi.fn(() => c),
      // Terminals
      single: vi.fn(async () => responses.shift() ?? { data: null, error: null }),
      maybeSingle: vi.fn(async () => responses.shift() ?? { data: null, error: null }),
      // Non-terminal single-shot (used by listUserConsents which awaits the chain directly)
      then: (resolve: any) => resolve(responses.shift() ?? { data: [], error: null }),
    };
    return c;
  }

  return {
    from: vi.fn(() => chain()),
    __respondWith: (r: any) => responses.push(r),
    __insertCalls: insertCalls,
    __selectCalls: selectCalls,
  };
}

const adminMock = buildAdminMock();

vi.mock("@/lib/insforge-server", () => ({
  getInsforgeAdminClient: () => ({ database: adminMock }),
}));

vi.mock("@/lib/observability", async () => {
  const actual = await vi.importActual<typeof import("@/lib/observability")>(
    "@/lib/observability"
  );
  return { ...actual, reportError: vi.fn(async () => undefined) };
});

// Silence the audit trail side-channel invoked by recordConsent.
vi.mock("@/lib/audit-log", () => ({
  writeAuditEntry: vi.fn(async () => undefined),
  AUDIT_EVENT: { CONSENT_GRANTED: "consent.granted", CONSENT_REVOKED: "consent.revoked" },
}));

import {
  recordConsent,
  revokeConsent,
  hasConsent,
  hasExplicitConsent,
  listUserConsents,
} from "@/lib/consent";
import { writeAuditEntry } from "@/lib/audit-log";

describe("consent module", () => {
  beforeEach(() => {
    adminMock.__insertCalls.length = 0;
    adminMock.__selectCalls.length = 0;
    (writeAuditEntry as any).mockClear?.();
  });

  it("records a consent grant and writes an audit entry", async () => {
    adminMock.__respondWith({
      data: {
        id: "c-1",
        user_id: "u-1",
        consent_type: "marketing_emails",
        granted: true,
        version: "1.0",
        ip_hash: null,
        user_agent: null,
        created_at: "2024-01-01T00:00:00Z",
        metadata: {},
      },
      error: null,
    });

    const rec = await recordConsent({
      userId: "u-1",
      consentType: "marketing_emails",
      granted: true,
      ip: "203.0.113.10",
      userAgent: "Mozilla/5.0",
    });

    expect(rec).not.toBeNull();
    expect(rec!.consentType).toBe("marketing_emails");
    expect(rec!.granted).toBe(true);

    // insert row shape
    const row = adminMock.__insertCalls[0];
    expect(row.user_id).toBe("u-1");
    expect(row.granted).toBe(true);
    expect(row.ip_hash).toMatch(/^[a-f0-9]{16}$/);

    // audit trail
    expect(writeAuditEntry).toHaveBeenCalledTimes(1);
    expect((writeAuditEntry as any).mock.calls[0][0].event).toBe("consent.granted");
  });

  it("revokeConsent produces a granted=false row", async () => {
    adminMock.__respondWith({
      data: {
        id: "c-2",
        user_id: "u-1",
        consent_type: "marketing_emails",
        granted: false,
        version: "1.0",
        ip_hash: null,
        user_agent: null,
        created_at: "2024-01-02T00:00:00Z",
        metadata: {},
      },
      error: null,
    });
    const rec = await revokeConsent("u-1", "marketing_emails");
    expect(rec!.granted).toBe(false);
    const row = adminMock.__insertCalls[0];
    expect(row.granted).toBe(false);
    expect((writeAuditEntry as any).mock.calls[0][0].event).toBe("consent.revoked");
  });

  it("hasConsent fails OPEN when no record exists", async () => {
    adminMock.__respondWith({ data: null, error: null });
    const ok = await hasConsent("u-noconsent", "marketing_emails");
    expect(ok).toBe(true);
  });

  it("hasExplicitConsent fails CLOSED when no record exists", async () => {
    adminMock.__respondWith({ data: null, error: null });
    const ok = await hasExplicitConsent("u-noconsent", "marketing_emails");
    expect(ok).toBe(false);
  });

  it("hasExplicitConsent returns true only for an explicit grant", async () => {
    adminMock.__respondWith({
      data: {
        id: "c-3",
        user_id: "u-1",
        consent_type: "ai_training",
        granted: true,
        version: "1.0",
        ip_hash: null,
        user_agent: null,
        created_at: "2024-01-03T00:00:00Z",
        metadata: {},
      },
      error: null,
    });
    expect(await hasExplicitConsent("u-1", "ai_training")).toBe(true);
  });

  it("hasConsent returns false when the latest record is a revocation", async () => {
    adminMock.__respondWith({
      data: {
        id: "c-4",
        user_id: "u-1",
        consent_type: "third_party_sharing",
        granted: false,
        version: "1.0",
        ip_hash: null,
        user_agent: null,
        created_at: "2024-02-01T00:00:00Z",
        metadata: {},
      },
      error: null,
    });
    expect(await hasConsent("u-1", "third_party_sharing")).toBe(false);
  });

  it("listUserConsents returns only the latest row per consent_type", async () => {
    adminMock.__respondWith({
      data: [
        {
          id: "r1",
          user_id: "u-1",
          consent_type: "marketing_emails",
          granted: false,
          version: "1.0",
          created_at: "2024-02-10T00:00:00Z",
          metadata: {},
        },
        {
          id: "r2",
          user_id: "u-1",
          consent_type: "marketing_emails",
          granted: true,
          version: "1.0",
          created_at: "2024-01-10T00:00:00Z",
          metadata: {},
        },
        {
          id: "r3",
          user_id: "u-1",
          consent_type: "analytics_cookies",
          granted: true,
          version: "1.0",
          created_at: "2024-02-01T00:00:00Z",
          metadata: {},
        },
      ],
      error: null,
    });

    const consents = await listUserConsents("u-1");
    expect(consents).toHaveLength(2);
    const marketing = consents.find((c) => c.consentType === "marketing_emails");
    expect(marketing?.granted).toBe(false); // most recent one wins
    const analytics = consents.find((c) => c.consentType === "analytics_cookies");
    expect(analytics?.granted).toBe(true);
  });

  it("returns null for empty userId / consentType", async () => {
    expect(await recordConsent({ userId: "", consentType: "terms_of_service", granted: true }))
      .toBeNull();
  });
});
