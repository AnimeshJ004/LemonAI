import { describe, it, expect, vi, beforeEach } from "vitest";

const { authMock, uploadMock, rateLimitMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  uploadMock: vi.fn(
    async (_key?: unknown, _body?: unknown): Promise<{
      data: { key: string; url: string } | null;
      error: { message: string } | null;
    }> => ({ data: { key: "images/user_a/1.png", url: "https://cdn/1.png" }, error: null })
  ),
  rateLimitMock: vi.fn(async (): Promise<unknown> => null),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));

vi.mock("@/lib/insforge-server", () => ({
  getInsforgeUploadClient: () => ({
    storage: { from: () => ({ upload: uploadMock }) },
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: rateLimitMock,
}));

vi.mock("@/lib/observability", () => ({
  reportError: vi.fn(async () => undefined),
  logWarn: vi.fn(),
}));

import { POST } from "@/app/api/upload-image/route";

function makeFormReq(
  file: File | null,
  headers: Record<string, string> = {}
): any {
  const form = new FormData();
  if (file) form.set("file", file);
  return {
    formData: async () => form,
    headers: {
      get: (k: string) => headers[k.toLowerCase()] ?? null,
    },
  };
}

function makeImage(mime: string, sizeBytes: number, name = "test.png"): File {
  const bytes = new Uint8Array(sizeBytes);
  return new File([bytes], name, { type: mime });
}

describe("POST /api/upload-image", () => {
  beforeEach(() => {
    authMock.mockReset();
    uploadMock.mockClear();
    rateLimitMock.mockReset();
    rateLimitMock.mockResolvedValue(null); // allow by default
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await POST(makeFormReq(makeImage("image/png", 1000)));
    expect(res.status).toBe(401);
  });

  it("returns rate-limit response when limiter blocks", async () => {
    authMock.mockResolvedValue({ userId: "user_a" });
    const { NextResponse } = await import("next/server");
    rateLimitMock.mockResolvedValueOnce(
      NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    );
    const res = await POST(makeFormReq(makeImage("image/png", 1000)));
    expect(res.status).toBe(429);
  });

  it("returns 413 when Content-Length exceeds the pre-check budget", async () => {
    authMock.mockResolvedValue({ userId: "user_a" });
    const res = await POST(
      makeFormReq(makeImage("image/png", 100), {
        "content-length": String(7 * 1024 * 1024),
      })
    );
    expect(res.status).toBe(413);
  });

  it("returns 400 when no file field is provided", async () => {
    authMock.mockResolvedValue({ userId: "user_a" });
    const res = await POST(makeFormReq(null));
    expect(res.status).toBe(400);
  });

  it("returns 415 for disallowed MIME types", async () => {
    authMock.mockResolvedValue({ userId: "user_a" });
    const res = await POST(makeFormReq(makeImage("application/pdf", 1000, "evil.pdf")));
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.allowed).toEqual(expect.arrayContaining(["image/png", "image/jpeg"]));
  });

  it("returns 413 when the file exceeds 5 MB", async () => {
    authMock.mockResolvedValue({ userId: "user_a" });
    const oversized = makeImage("image/png", 6 * 1024 * 1024);
    const res = await POST(makeFormReq(oversized));
    expect(res.status).toBe(413);
  });

  it("uploads a valid image and returns the key+url", async () => {
    authMock.mockResolvedValue({ userId: "user_a" });
    const res = await POST(makeFormReq(makeImage("image/jpeg", 500_000, "photo.jpg")));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.image.key).toBe("images/user_a/1.png"); // from mocked storage
    expect(body.image.url).toBe("https://cdn/1.png");
    expect(uploadMock).toHaveBeenCalledTimes(1);
  });

  it("sanitises the filename against path traversal", async () => {
    authMock.mockResolvedValue({ userId: "user_a" });
    await POST(makeFormReq(makeImage("image/png", 100, "../../etc/passwd")));
    const uploadCall = uploadMock.mock.calls[0] as unknown as [string, unknown];
    const key = uploadCall[0];
    // Must be scoped to the caller's user folder.
    expect(key).toMatch(/^images\/user_a\//);
    // No dot-dot sequences and no unexpected slashes past the userId segment.
    expect(key).not.toMatch(/\.\.+/);
    const afterUser = key.replace(/^images\/user_a\//, "");
    expect(afterUser).not.toContain("/");
  });

  it("returns 500 when storage upload fails", async () => {
    authMock.mockResolvedValue({ userId: "user_a" });
    uploadMock.mockResolvedValueOnce({ data: null, error: { message: "quota exceeded" } });
    const res = await POST(makeFormReq(makeImage("image/png", 500)));
    expect(res.status).toBe(500);
  });
});
