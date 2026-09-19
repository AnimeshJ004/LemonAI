import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted above module-level variables, so we use vi.hoisted() to
// share mock functions between the mock factory and the tests below.
const { authMock, recordConsentMock, listUserConsentsMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  recordConsentMock: vi.fn(),
  listUserConsentsMock: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));

vi.mock("@/lib/consent", async () => {
  const actual = await vi.importActual<typeof import("@/lib/consent")>("@/lib/consent");
  return {
    ...actual,
    recordConsent: recordConsentMock,
    listUserConsents: listUserConsentsMock,
  };
});

vi.mock("@/lib/observability", () => ({
  reportError: vi.fn(async () => undefined),
  logInfo: vi.fn(),
}));

import { GET, POST } from "@/app/api/user/consent/route";
import type { NextRequest } from "next/server";

function makePostReq(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new Request("http://localhost/api/user/consent", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("/api/user/consent", () => {
  beforeEach(() => {
    authMock.mockReset();
    recordConsentMock.mockReset();
    listUserConsentsMock.mockReset();
  });

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      authMock.mockResolvedValue({ userId: null });
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns a materialized consent map with a null entry per known type", async () => {
      authMock.mockResolvedValue({ userId: "user_abc" });
      listUserConsentsMock.mockResolvedValue([
        {
          id: "c1",
          userId: "user_abc",
          consentType: "marketing_emails",
          granted: true,
          version: "1.0",
          ipHash: null,
          userAgent: null,
          createdAt: "2024-01-01T00:00:00Z",
          metadata: {},
        },
      ]);

      const res = await GET();
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.consents.marketing_emails.granted).toBe(true);
      // Types not recorded appear as null so clients don't have to normalize.
      expect(body.consents.privacy_policy).toBeNull();
      expect(body.consents.terms_of_service).toBeNull();
    });
  });

  describe("POST", () => {
    it("returns 401 when unauthenticated", async () => {
      authMock.mockResolvedValue({ userId: null });
      const res = await POST(makePostReq({ consentType: "marketing_emails", granted: true }));
      expect(res.status).toBe(401);
    });

    it("returns 400 for a malformed JSON body", async () => {
      authMock.mockResolvedValue({ userId: "user_abc" });
      const bad = new Request("http://localhost/api/user/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "this is not json",
      }) as unknown as NextRequest;
      const res = await POST(bad);
      expect(res.status).toBe(400);
    });

    it("returns 400 for an unknown consentType", async () => {
      authMock.mockResolvedValue({ userId: "user_abc" });
      const res = await POST(makePostReq({ consentType: "nope", granted: true }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Validation failed");
      expect(body.issues).toBeDefined();
      expect(body.issues.some((i: { field: string }) => i.field === "consentType")).toBe(true);
    });

    it("returns 400 when granted is not a boolean", async () => {
      authMock.mockResolvedValue({ userId: "user_abc" });
      const res = await POST(makePostReq({ consentType: "marketing_emails", granted: "yes" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.issues.some((i: { field: string }) => i.field === "granted")).toBe(true);
    });

    it("records a valid consent and returns the record", async () => {
      authMock.mockResolvedValue({ userId: "user_abc" });
      recordConsentMock.mockResolvedValue({
        id: "c-new",
        userId: "user_abc",
        consentType: "marketing_emails",
        granted: true,
        version: "1.0",
        ipHash: null,
        userAgent: null,
        createdAt: "2026-09-18T00:00:00Z",
        metadata: {},
      });

      const res = await POST(makePostReq({ consentType: "marketing_emails", granted: true }));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.record.consentType).toBe("marketing_emails");
      expect(body.record.granted).toBe(true);

      // Verify the correct arguments made it through.
      const passed = recordConsentMock.mock.calls[0][0];
      expect(passed.userId).toBe("user_abc");
      expect(passed.consentType).toBe("marketing_emails");
      expect(passed.granted).toBe(true);
    });

    it("returns 500 when recordConsent fails to insert", async () => {
      authMock.mockResolvedValue({ userId: "user_abc" });
      recordConsentMock.mockResolvedValue(null);
      const res = await POST(makePostReq({ consentType: "ai_training", granted: false }));
      expect(res.status).toBe(500);
    });

    it("captures caller IP and User-Agent for the consent record", async () => {
      authMock.mockResolvedValue({ userId: "user_abc" });
      recordConsentMock.mockResolvedValue({
        id: "c-x",
        userId: "user_abc",
        consentType: "analytics_cookies",
        granted: true,
        version: "1.0",
        ipHash: null,
        userAgent: null,
        createdAt: "2026-09-18T00:00:00Z",
        metadata: {},
      });

      await POST(
        makePostReq(
          { consentType: "analytics_cookies", granted: true },
          {
            "x-forwarded-for": "203.0.113.42, 10.0.0.1",
            "user-agent": "Mozilla/5.0 (Test)",
          }
        )
      );

      const passed = recordConsentMock.mock.calls[0][0];
      expect(passed.ip).toBe("203.0.113.42"); // first hop only
      expect(passed.userAgent).toBe("Mozilla/5.0 (Test)");
    });
  });
});
