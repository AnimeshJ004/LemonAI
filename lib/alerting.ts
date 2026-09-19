/**
 * On-Call Alerting
 *
 * Fans out `fatal`-severity events to configured on-call destinations:
 *
 *   • Slack        — HTTP POST to SLACK_ALERT_WEBHOOK_URL
 *   • PagerDuty    — Events API v2 (POST to https://events.pagerduty.com)
 *
 * The dispatcher is **non-throwing**, **env-gated**, and **best-effort**.
 * When no destinations are configured, `dispatchAlert()` is a no-op — the
 * app can be deployed without an on-call rotation and simply won't page.
 *
 * PII is redacted before the alert leaves the process (same guarantee as
 * `lib/observability.ts`). The payload contains a summary and a correlation
 * id so responders can find the full context in Sentry / logs.
 */

import { redactString, redactPII } from "@/lib/pii-redactor";

export interface AlertPayload {
  /** Short human summary — becomes the Slack title / PagerDuty summary. */
  summary: string;
  /**
   * Severity — matches lib/observability. Only "error" and "fatal" trigger
   * an alert dispatch. Anything lower is dropped.
   */
  severity: "error" | "fatal";
  /** Logical area, e.g. "api/user/consent" or "cron:publish". */
  scope?: string;
  /** Request correlation id — link back to the full logs. */
  correlationId?: string | null;
  /** Authenticated user id, if available. */
  userId?: string | null;
  /** Small extra context. Redacted before send. */
  extra?: Record<string, unknown>;
}

export interface DispatchResult {
  attempted: string[];
  succeeded: string[];
  failed: string[];
}

/**
 * Fan out an alert to every configured destination.
 * Returns a summary of what was tried. Never throws.
 */
export async function dispatchAlert(payload: AlertPayload): Promise<DispatchResult> {
  if (payload.severity !== "error" && payload.severity !== "fatal") {
    return { attempted: [], succeeded: [], failed: [] };
  }

  const attempted: string[] = [];
  const succeeded: string[] = [];
  const failed: string[] = [];

  const promises: Array<Promise<void>> = [];

  if (process.env.SLACK_ALERT_WEBHOOK_URL) {
    attempted.push("slack");
    promises.push(
      sendSlackAlert(payload)
        .then(() => void succeeded.push("slack"))
        .catch(() => void failed.push("slack"))
    );
  }

  if (process.env.PAGERDUTY_ROUTING_KEY) {
    // Only page on 'fatal'. 'error' goes to Slack only — pages are for
    // human-actionable production emergencies, not every 500.
    if (payload.severity === "fatal") {
      attempted.push("pagerduty");
      promises.push(
        sendPagerDutyAlert(payload)
          .then(() => void succeeded.push("pagerduty"))
          .catch(() => void failed.push("pagerduty"))
      );
    }
  }

  await Promise.allSettled(promises);
  return { attempted, succeeded, failed };
}

// ---------------------------------------------------------------------------
// Slack
// ---------------------------------------------------------------------------

async function sendSlackAlert(payload: AlertPayload): Promise<void> {
  const url = process.env.SLACK_ALERT_WEBHOOK_URL;
  if (!url) return;

  const emoji =
    payload.severity === "fatal" ? ":rotating_light:" : ":warning:";
  const summary = redactString(payload.summary).slice(0, 500);
  const scope = payload.scope || "app";
  const app = process.env.APP_ENV || "development";
  const safeExtra = payload.extra
    ? (redactPII(payload.extra) as Record<string, unknown>)
    : undefined;

  const body = {
    text: `${emoji} *${payload.severity.toUpperCase()}* [${app}] ${scope}: ${summary}`,
    attachments: [
      {
        color: payload.severity === "fatal" ? "danger" : "warning",
        fields: [
          { title: "Scope", value: scope, short: true },
          {
            title: "Correlation ID",
            value: payload.correlationId ?? "(none)",
            short: true,
          },
          {
            title: "User",
            value: payload.userId ?? "(none)",
            short: true,
          },
          {
            title: "Environment",
            value: app,
            short: true,
          },
          ...(safeExtra
            ? [
                {
                  title: "Extra",
                  value: "```" + JSON.stringify(safeExtra).slice(0, 800) + "```",
                  short: false,
                },
              ]
            : []),
        ],
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`Slack webhook returned HTTP ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// PagerDuty Events API v2
// ---------------------------------------------------------------------------

async function sendPagerDutyAlert(payload: AlertPayload): Promise<void> {
  const routingKey = process.env.PAGERDUTY_ROUTING_KEY;
  if (!routingKey) return;

  const summary = redactString(payload.summary).slice(0, 1024);
  const scope = payload.scope || "app";
  const app = process.env.APP_ENV || "development";
  const safeExtra = payload.extra
    ? (redactPII(payload.extra) as Record<string, unknown>)
    : undefined;

  const body = {
    routing_key: routingKey,
    event_action: "trigger",
    // dedup_key ensures duplicate errors within the same run don't spam.
    dedup_key: `lemon-ai:${app}:${scope}:${payload.correlationId ?? ""}`,
    payload: {
      summary,
      source: `lemon-ai:${app}`,
      severity: payload.severity === "fatal" ? "critical" : "error",
      component: scope,
      custom_details: {
        correlationId: payload.correlationId ?? undefined,
        userId: payload.userId ?? undefined,
        ...(safeExtra || {}),
      },
    },
  };

  const res = await fetch("https://events.pagerduty.com/v2/enqueue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`PagerDuty Events v2 returned HTTP ${res.status}`);
  }
}
