import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

const { purgeMock } = vi.hoisted(() => ({
  purgeMock: vi.fn(async () => ({
    userId: "user_x",
    purgedTables: ["scheduled_posts", "leads"],
    success: true,
    errors: {},
  })),
}));

vi.mock("@/lib/user-purge", () => ({
  purgeAllUserData: purgeMock,
}));

import { POST } from "@/app/api/webhooks/clerk/route";

/**
 * Constructs a Clerk webhook request signed with the given secret using the
 * Svix signing scheme: `${svix_id}.${svix_timestamp}.${rawBody}` HMAC-SHA256
 * with the secret bytes (base64-decoded when prefixed with `whsec_`).
 */
function makeSignedRequest(
  secret: string,
  payload: unknown,
  opts: { svixId?: string; svixTimestamp?: string; overrideSignature?: string } = {}
): any {
  const rawBody = JSON.stringify(payload);
  const svixId = opts.svixId ?? "msg_test_123";
  const svixTimestamp = opts.svixTimestamp ?? String(Math.floor(Date.now() / 1000));
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const secretBytes = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice(6), "base64")
    : Buffer.from(secret, "utf-8");
  const sig = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  const svixSignature = opts.overrideSignature ?? `v1,${sig}`;

  return {
    text: async () => rawBody,
    headers: new Headers({
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }),
  };
}

describe("POST /api/webhooks/clerk", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    purgeMock.mockClear();
    process.env = { ...ORIGINAL_ENV };
    // Ensure NODE_ENV is not production in most tests so the "warn but pass"
    // path can be exercised.
    (process.env as any).NODE_ENV = "test";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns 401 when signature headers are missing (secret configured)", async () => {
    process.env.CLERK_WEBHOOK_SECRET = "whsec_dGVzdC1zZWNyZXQ";
    const req: any = {
      text: async () => JSON.stringify({ type: "user.deleted" }),
      headers: new Headers({}),
    };
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when signature verification fails", async () => {
    process.env.CLERK_WEBHOOK_SECRET = "whsec_dGVzdC1zZWNyZXQ";
    const req = makeSignedRequest(process.env.CLERK_WEBHOOK_SECRET, {
      type: "user.deleted",
      data: { id: "user_fake" },
    }, { overrideSignature: "v1,notarealsignature" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("accepts a valid signature and returns success", async () => {
    process.env.CLERK_WEBHOOK_SECRET = "whsec_dGVzdC1zZWNyZXQ";
    const req = makeSignedRequest(process.env.CLERK_WEBHOOK_SECRET, {
      type: "user.created",
      data: { id: "user_new" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.event).toBe("user.created");
  });

  it("purges user data on user.deleted", async () => {
    process.env.CLERK_WEBHOOK_SECRET = "whsec_dGVzdC1zZWNyZXQ";
    const req = makeSignedRequest(process.env.CLERK_WEBHOOK_SECRET, {
      type: "user.deleted",
      data: { id: "user_bye" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(purgeMock).toHaveBeenCalledWith("user_bye");
    const body = await res.json();
    expect(body.event).toBe("user.deleted");
    expect(body.purgedTables).toContain("scheduled_posts");
  });

  it("rejects malformed JSON with 400", async () => {
    process.env.CLERK_WEBHOOK_SECRET = "whsec_dGVzdC1zZWNyZXQ";
    // Sign junk so signature check passes but JSON.parse fails.
    const rawBody = "not-json";
    const svixId = "msg_x";
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
    // Match the exact secret decoding the route uses: base64 after 'whsec_'.
    const secretBytes = Buffer.from("dGVzdC1zZWNyZXQ", "base64");
    const sig = crypto
      .createHmac("sha256", secretBytes)
      .update(signedContent)
      .digest("base64");

    const req: any = {
      text: async () => rawBody,
      headers: new Headers({
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": `v1,${sig}`,
      }),
    };
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 in production when CLERK_WEBHOOK_SECRET is missing", async () => {
    delete process.env.CLERK_WEBHOOK_SECRET;
    (process.env as any).NODE_ENV = "production";
    const req: any = {
      text: async () => JSON.stringify({ type: "user.deleted" }),
      headers: new Headers({}),
    };
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
