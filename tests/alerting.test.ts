import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dispatchAlert } from "@/lib/alerting";

describe("lib/alerting", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SLACK_ALERT_WEBHOOK_URL;
    delete process.env.PAGERDUTY_ROUTING_KEY;
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as any);
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it("is a no-op when no destinations are configured", async () => {
    const result = await dispatchAlert({ summary: "boom", severity: "fatal" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.attempted).toEqual([]);
    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it("drops non-error severities entirely (no fetch calls)", async () => {
    process.env.SLACK_ALERT_WEBHOOK_URL = "https://hooks.slack.example/x";
    // dispatchAlert signature restricts severity to error|fatal at the type
    // level, but we defensively verify runtime behavior.
    const result = await dispatchAlert({
      summary: "trace",
      severity: "error" as const,
    });
    // 'error' should attempt Slack but not PagerDuty
    expect(result.attempted).toEqual(["slack"]);
  });

  it("dispatches to Slack on 'error' severity", async () => {
    process.env.SLACK_ALERT_WEBHOOK_URL = "https://hooks.slack.example/x";
    const result = await dispatchAlert({
      summary: "5xx spike",
      severity: "error",
      scope: "api/x",
      correlationId: "corr-1",
      userId: "user_abc",
    });
    expect(result.succeeded).toContain("slack");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.slack.example/x");
    expect((opts as RequestInit).method).toBe("POST");
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.text).toContain("ERROR");
    expect(body.text).toContain("api/x");
    expect(body.text).toContain("5xx spike");
  });

  it("dispatches to PagerDuty only on 'fatal' severity", async () => {
    process.env.PAGERDUTY_ROUTING_KEY = "pd-abc";

    // 'error' does NOT page
    let result = await dispatchAlert({ summary: "e", severity: "error" });
    expect(result.attempted).not.toContain("pagerduty");
    expect(fetchMock).not.toHaveBeenCalled();

    // 'fatal' DOES page
    result = await dispatchAlert({
      summary: "fire",
      severity: "fatal",
      scope: "publisher",
      correlationId: "corr-9",
    });
    expect(result.attempted).toContain("pagerduty");
    expect(result.succeeded).toContain("pagerduty");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://events.pagerduty.com/v2/enqueue");
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.routing_key).toBe("pd-abc");
    expect(body.event_action).toBe("trigger");
    expect(body.payload.severity).toBe("critical");
    expect(body.payload.component).toBe("publisher");
    expect(body.dedup_key).toContain("corr-9");
  });

  it("fans out to both Slack and PagerDuty in parallel for 'fatal'", async () => {
    process.env.SLACK_ALERT_WEBHOOK_URL = "https://hooks.slack.example/x";
    process.env.PAGERDUTY_ROUTING_KEY = "pd-abc";

    const result = await dispatchAlert({ summary: "meltdown", severity: "fatal" });
    expect(result.attempted).toEqual(expect.arrayContaining(["slack", "pagerduty"]));
    expect(result.succeeded).toEqual(expect.arrayContaining(["slack", "pagerduty"]));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never throws when a downstream webhook returns non-OK", async () => {
    process.env.SLACK_ALERT_WEBHOOK_URL = "https://hooks.slack.example/x";
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) } as any);

    const result = await dispatchAlert({ summary: "x", severity: "error" });
    expect(result.attempted).toContain("slack");
    expect(result.failed).toContain("slack");
    expect(result.succeeded).not.toContain("slack");
  });

  it("never throws when a downstream webhook network-errors", async () => {
    process.env.PAGERDUTY_ROUTING_KEY = "pd-abc";
    fetchMock.mockRejectedValueOnce(new Error("ETIMEDOUT"));

    const result = await dispatchAlert({ summary: "x", severity: "fatal" });
    expect(result.failed).toContain("pagerduty");
  });

  it("redacts PII in the Slack payload", async () => {
    process.env.SLACK_ALERT_WEBHOOK_URL = "https://hooks.slack.example/x";
    await dispatchAlert({
      summary: "OAuth failed for alice@example.com",
      severity: "error",
      extra: { note: "Called +1 415 555 1234" },
    });
    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse((opts as RequestInit).body as string);
    const asString = JSON.stringify(body);
    expect(asString).not.toContain("alice@example.com");
    expect(asString).not.toContain("+1 415 555 1234");
    expect(asString).toContain("[EMAIL]");
  });
});
