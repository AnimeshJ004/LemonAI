import { describe, it, expect, vi, afterEach } from "vitest";
import { reportError, logInfo } from "@/lib/observability";

describe("observability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SENTRY_DSN;
  });

  it("reportError never throws and logs to console.error for error severity", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      reportError(new Error("boom"), { scope: "test", userId: "user_1" })
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });

  it("handles non-Error values gracefully", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(reportError("string error", { scope: "test" })).resolves.toBeUndefined();
    await expect(reportError({ weird: true }, { scope: "test" })).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });

  it("uses console.warn for warning severity", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await reportError(new Error("careful"), { scope: "test" }, "warning");
    expect(spy).toHaveBeenCalled();
  });

  it("logInfo writes a structured info log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logInfo("hello", { scope: "test", extra: { a: 1 } });
    expect(spy).toHaveBeenCalled();
  });

  it("redacts PII from error messages, stacks, and extra context", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error(
      "OAuth failed for alice@example.com token=sk-proj-abcdefghijklmnopqrstuv1234567890XYZ"
    );
    await reportError(err, {
      scope: "test",
      extra: {
        email: "bob@example.com",
        access_token: "abc.def.ghi",
        note: "Called +91 98765 43210",
      },
    });

    const combined = spy.mock.calls.flat().map(String).join(" ");
    expect(combined).not.toContain("alice@example.com");
    expect(combined).not.toContain("bob@example.com");
    expect(combined).not.toContain("sk-proj-abcdefghijklmnopqrstuv1234567890XYZ");
    expect(combined).not.toContain("abc.def.ghi");
    expect(combined).not.toContain("98765 43210");
    expect(combined).toContain("[EMAIL]");
    expect(combined).toContain("[API_KEY]");
    expect(combined).toContain("[REDACTED]"); // access_token key masked
    expect(combined).toContain("[PHONE]");
  });

  it("redacts PII from logInfo messages and extras", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logInfo("Contact carol@example.com now", {
      scope: "test",
      extra: { phone: "+1 415 555 1234" },
    });
    const combined = spy.mock.calls.flat().map(String).join(" ");
    expect(combined).not.toContain("carol@example.com");
    expect(combined).not.toContain("+1 415 555 1234");
    expect(combined).toContain("[EMAIL]");
    expect(combined).toContain("[REDACTED]"); // phone key
  });
});
