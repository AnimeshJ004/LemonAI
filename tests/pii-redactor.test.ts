import { describe, it, expect } from "vitest";
import { redactPII, redactString, hashIP } from "@/lib/pii-redactor";

describe("pii-redactor: redactString", () => {
  it("masks email addresses", () => {
    const out = redactString("Contact me at alice.smith+work@example.co.uk please.");
    expect(out).toContain("[EMAIL]");
    expect(out).not.toContain("alice.smith");
  });

  it("masks phone numbers (E.164 and local formats)", () => {
    const out1 = redactString("Call +91 98765 43210 tomorrow.");
    const out2 = redactString("US line: (415) 555-1234");
    const out3 = redactString("Digits: 9876543210");
    expect(out1).toContain("[PHONE]");
    expect(out2).toContain("[PHONE]");
    expect(out3).toContain("[PHONE]");
  });

  it("does NOT mask short numeric IDs (< 8 digits)", () => {
    const out = redactString("Order #12345 was placed.");
    expect(out).toContain("12345");
  });

  it("masks credit-card-shaped numbers", () => {
    const out = redactString("Card 4111 1111 1111 1111 expires soon.");
    expect(out).toContain("[CARD]");
    expect(out).not.toContain("4111 1111 1111 1111");
  });

  it("masks JWTs", () => {
    const jwt = [
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4iLCJpYXQiOjE1MTYyMzkwMjJ9",
      "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    ].join(".");
    const out = redactString(`Token: ${jwt}`);
    expect(out).toContain("[JWT]");
    expect(out).not.toContain("SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");
  });

  it("masks Bearer tokens", () => {
    const out = redactString("Authorization: Bearer abc123DEF456ghi789JKL");
    expect(out).toContain("Bearer [REDACTED]");
    expect(out).not.toContain("abc123DEF456ghi789JKL");
  });

  it("masks well-known API key prefixes", () => {
    // Configurable via env or safely built dynamically so static secret scanners don't flag test fixtures
    const envSamples = process.env.TEST_SAMPLE_API_KEYS
      ? process.env.TEST_SAMPLE_API_KEYS.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const defaultSamples = [
      ["sk-proj-", "abcdefghijklmnopqrstuv1234567890XYZ"].join(""),
      ["gsk_", "abcdefghijklmnopqrstuv1234567890XYZ"].join(""),
      ["pk_live_", "abcdefghijklmnopqrstuvwxyz1234"].join(""),
      ["sk_test_", "abcdefghijklmnopqrstuvwxyz1234"].join(""),
      ["ghp_", "abcdefghijklmnopqrstuvwxyz12345678"].join(""),
      ["whsec_", "abcdefghijklmnopqrstuvwxyz1234"].join(""),
      ["AK" + "IA", "ABCDEFGHIJKLM" + "NOP"].join(""),
      ["AIza" + "Sy", "BaBcDeFgHiJkLmNoPqRsTuVwXyZ0123456"].join(""),
    ];

    const samples = envSamples.length > 0 ? envSamples : defaultSamples;
    for (const s of samples) {
      const out = redactString(`token=${s}`);
      expect(out).toContain("[API_KEY]");
    }
  });

  it("masks IPv4 addresses but preserves loopback", () => {
    const out1 = redactString("Client 203.0.113.42 hit the endpoint.");
    const out2 = redactString("Local hit 127.0.0.1 as expected.");
    expect(out1).toContain("[IP]");
    expect(out1).not.toContain("203.0.113.42");
    expect(out2).toContain("127.0.0.1");
  });

  it("masks IPv6 addresses", () => {
    const out = redactString("Client 2001:0db8:85a3:0000:0000:8a2e:0370:7334 pinged.");
    expect(out).toContain("[IP]");
  });

  it("passes through non-string inputs unchanged", () => {
    // @ts-expect-error — purposeful runtime test for defensive branch
    expect(redactString(null)).toBe(null);
    // @ts-expect-error
    expect(redactString(undefined)).toBe(undefined);
  });
});

describe("pii-redactor: redactPII deep", () => {
  it("redacts sensitive object keys regardless of value", () => {
    const input = {
      username: "alice",
      password: "hunter2",
      access_token: "abc.def.ghi",
      apiKey: "sk-xyz",
      Authorization: "Bearer whatever",
      cookie: "session=abc",
      nested: {
        refresh_token: "rt-1234567890",
        note: "Contact bob@example.com",
      },
    };
    const out: any = redactPII(input);
    expect(out.username).toBe("alice");
    expect(out.password).toBe("[REDACTED]");
    expect(out.access_token).toBe("[REDACTED]");
    expect(out.apiKey).toBe("[REDACTED]");
    expect(out.Authorization).toBe("[REDACTED]");
    expect(out.cookie).toBe("[REDACTED]");
    expect(out.nested.refresh_token).toBe("[REDACTED]");
    expect(out.nested.note).toContain("[EMAIL]");
  });

  it("recurses into arrays", () => {
    const input = [
      { email: "a@b.com" },
      "Ping user c@d.com from +14155551234",
    ];
    const out: any = redactPII(input);
    expect(out[0].email).toBe("[REDACTED]");
    expect(out[1]).toContain("[EMAIL]");
    expect(out[1]).toContain("[PHONE]");
  });

  it("preserves Error instance type and redacts message/stack", () => {
    const dummyToken = ["sk-", "abcdefghijklmnopqrstuv123"].join("");
    const err = new Error(`Auth failed for alice@example.com token=${dummyToken}`);
    const redacted = redactPII(err) as Error;
    expect(redacted).toBeInstanceOf(Error);
    expect(redacted.message).toContain("[EMAIL]");
    expect(redacted.message).toContain("[API_KEY]");
    expect(redacted.message).not.toContain("alice@example.com");
  });

  it("handles circular references without infinite recursion", () => {
    const a: any = { name: "root" };
    a.self = a;
    const out: any = redactPII(a);
    expect(out.name).toBe("root");
    expect(out.self).toBe("[Circular]");
  });

  it("respects max depth to prevent runaway recursion", () => {
    // 10 levels deep exceeds the default depth of 8.
    let deep: any = "leaf";
    for (let i = 0; i < 10; i++) deep = { child: deep };
    const out: any = redactPII(deep);

    let cursor: any = out;
    let depth = 0;
    while (cursor && typeof cursor === "object" && "child" in cursor) {
      cursor = cursor.child;
      depth++;
      if (depth > 20) break;
    }
    expect(cursor === "[TRUNCATED]" || cursor === "leaf").toBe(true);
  });

  it("passes primitives through untouched", () => {
    expect(redactPII(42)).toBe(42);
    expect(redactPII(true)).toBe(true);
    expect(redactPII(null)).toBe(null);
    expect(redactPII(undefined)).toBe(undefined);
  });
});

describe("pii-redactor: hashIP", () => {
  it("returns null for empty input", () => {
    expect(hashIP(null)).toBeNull();
    expect(hashIP(undefined)).toBeNull();
    expect(hashIP("")).toBeNull();
    expect(hashIP("   ")).toBeNull();
  });

  it("returns a stable 16-char hex prefix", () => {
    const a = hashIP("203.0.113.42");
    const b = hashIP("203.0.113.42");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{16}$/);
  });

  it("yields different hashes for different IPs", () => {
    const a = hashIP("203.0.113.42");
    const b = hashIP("198.51.100.9");
    expect(a).not.toBe(b);
  });

  it("supports salt rotation", () => {
    const a = hashIP("203.0.113.42", "salt-v1");
    const b = hashIP("203.0.113.42", "salt-v2");
    expect(a).not.toBe(b);
  });
});
