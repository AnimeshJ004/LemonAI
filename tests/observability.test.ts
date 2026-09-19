import { describe, it, expect, vi, afterEach } from "vitest";
import { reportError, logInfo, logWarn, logDebug } from "@/lib/observability";

// Mock next/headers so we can inject an x-correlation-id in tests.
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (k: string) => (k === "x-correlation-id" ? "corr_abc123" : null),
  })),
}));

describe("observability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SENTRY_DSN;
    delete process.env.LOG_LEVEL;
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
    // logInfo is fire-and-forget async; wait a tick.
    return new Promise<void>((resolve) => {
      setImmediate(() => {
        expect(spy).toHaveBeenCalled();
        resolve();
      });
    });
  });

  it("logWarn writes to console.warn", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logWarn("watch out", { scope: "test" });
    await new Promise((r) => setImmediate(r));
    expect(spy).toHaveBeenCalled();
    const combined = spy.mock.calls.flat().map(String).join(" ");
    expect(combined).toContain("watch out");
  });

  it("logDebug stays silent unless LOG_LEVEL=debug", async () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    logDebug("trace this", { scope: "test" });
    await new Promise((r) => setImmediate(r));
    expect(spy).not.toHaveBeenCalled();

    process.env.LOG_LEVEL = "debug";
    logDebug("trace this too", { scope: "test" });
    await new Promise((r) => setImmediate(r));
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
    expect(combined).toContain("[REDACTED]");
    expect(combined).toContain("[PHONE]");
  });

  it("redacts PII from logInfo messages and extras", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logInfo("Contact carol@example.com now", {
      scope: "test",
      extra: { phone: "+1 415 555 1234" },
    });
    await new Promise((r) => setImmediate(r));
    const combined = spy.mock.calls.flat().map(String).join(" ");
    expect(combined).not.toContain("carol@example.com");
    expect(combined).not.toContain("+1 415 555 1234");
    expect(combined).toContain("[EMAIL]");
    expect(combined).toContain("[REDACTED]");
  });

  it("includes correlationId auto-read from next/headers when not explicitly passed", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await reportError(new Error("with correlation"), { scope: "test" });
    const combined = spy.mock.calls.flat().map(String).join(" ");
    expect(combined).toContain("corr_abc123");
  });

  it("respects an explicitly provided correlationId over the header value", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logWarn("hi", { scope: "test", correlationId: "explicit_xyz" });
    await new Promise((r) => setImmediate(r));
    const combined = spy.mock.calls.flat().map(String).join(" ");
    expect(combined).toContain("explicit_xyz");
    expect(combined).not.toContain("corr_abc123");
  });

  it("treats a null correlationId as suppression (no header lookup)", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logInfo("no-corr", { scope: "test", correlationId: null });
    await new Promise((r) => setImmediate(r));
    const combined = spy.mock.calls.flat().map(String).join(" ");
    expect(combined).not.toContain("corr_abc123");
    expect(combined).not.toContain("correlationId");
  });
});
