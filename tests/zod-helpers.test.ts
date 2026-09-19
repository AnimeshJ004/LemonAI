import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  Email,
  Phone,
  Url,
  ConsentType,
  LeadStageSchema,
  ChannelTypeSchema,
  parseBody,
  parseJson,
} from "@/lib/zod-helpers";

describe("zod-helpers: shared primitives", () => {
  it("Email accepts a well-formed address", () => {
    expect(Email.parse("alice@example.com")).toBe("alice@example.com");
    expect(Email.parse("  bob.smith+work@ex.io  ")).toBe("bob.smith+work@ex.io");
  });

  it("Email rejects nonsense", () => {
    expect(() => Email.parse("not-an-email")).toThrow();
    expect(() => Email.parse("a@b")).toThrow();
    expect(() => Email.parse("")).toThrow();
    expect(() => Email.parse("a".repeat(400) + "@x.com")).toThrow();
  });

  it("Phone normalizes and accepts E.164 / national formats", () => {
    expect(Phone.parse("+91 98765 43210")).toBe("+919876543210");
    expect(Phone.parse("(415) 555-1234")).toBe("4155551234");
  });

  it("Phone rejects too short / too long inputs", () => {
    expect(() => Phone.parse("12345")).toThrow();
    expect(() => Phone.parse("1".repeat(50))).toThrow();
  });

  it("Url requires http(s) protocol", () => {
    expect(Url.parse("https://example.com/path")).toBe("https://example.com/path");
    expect(() => Url.parse("ftp://example.com")).toThrow();
    expect(() => Url.parse("//example.com")).toThrow();
    expect(() => Url.parse("javascript:alert(1)")).toThrow();
  });

  it("ConsentType only accepts known values", () => {
    expect(ConsentType.parse("marketing_emails")).toBe("marketing_emails");
    expect(() => ConsentType.parse("nope")).toThrow();
  });

  it("LeadStageSchema enforces enum membership", () => {
    expect(LeadStageSchema.parse("new")).toBe("new");
    expect(() => LeadStageSchema.parse("archived")).toThrow();
  });

  it("ChannelTypeSchema enforces enum membership", () => {
    expect(ChannelTypeSchema.parse("INSTAGRAM")).toBe("INSTAGRAM");
    expect(() => ChannelTypeSchema.parse("instagram")).toThrow(); // case-sensitive
  });
});

describe("zod-helpers: parseBody + parseJson", () => {
  const TestSchema = z.object({
    name: z.string().min(1),
    count: z.number().int().nonnegative(),
  });

  it("returns typed data on success", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ name: "alice", count: 3 }),
      headers: { "content-type": "application/json" },
    });
    const { data, errorResponse } = await parseBody(req, TestSchema);
    expect(errorResponse).toBeNull();
    expect(data).toEqual({ name: "alice", count: 3 });
  });

  it("returns 400 for malformed JSON body", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      body: "definitely not json",
      headers: { "content-type": "application/json" },
    });
    const { data, errorResponse } = await parseBody(req, TestSchema);
    expect(data).toBeNull();
    expect(errorResponse!.status).toBe(400);
    const body = await errorResponse!.json();
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 400 with per-field issues on schema failure", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ name: "", count: -1 }),
      headers: { "content-type": "application/json" },
    });
    const { errorResponse } = await parseBody(req, TestSchema);
    expect(errorResponse!.status).toBe(400);
    const body = await errorResponse!.json();
    expect(body.error).toBe("Validation failed");
    expect(body.issues).toBeInstanceOf(Array);
    const fields = body.issues.map((i: { field: string }) => i.field);
    expect(fields).toContain("name");
    expect(fields).toContain("count");
    // Response NEVER leaks the raw offending value.
    expect(JSON.stringify(body)).not.toContain("-1");
  });

  it("parseJson works on pre-read raw values", () => {
    const { data, errorResponse } = parseJson({ name: "bob", count: 0 }, TestSchema);
    expect(errorResponse).toBeNull();
    expect(data).toEqual({ name: "bob", count: 0 });
  });

  it("parseJson returns errorResponse on invalid raw values", () => {
    const { data, errorResponse } = parseJson({ name: 42 }, TestSchema);
    expect(data).toBeNull();
    expect(errorResponse!.status).toBe(400);
  });
});
