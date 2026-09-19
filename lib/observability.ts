/**
 * Centralized error reporting and structured logging.
 *
 * Provides a single place to log/report server-side errors so we can plug in an
 * external provider (Sentry, Datadog, etc.) without touching every call site.
 *
 * Sentry is wired in lazily and optionally: if `@sentry/nextjs` is installed
 * and `SENTRY_DSN` is set, errors are forwarded to it. Otherwise we fall back
 * to structured console logging. This keeps the dependency optional so the
 * build never fails when Sentry is not configured.
 *
 * PII redaction: every message, stack, error, and `extra` payload is passed
 * through `lib/pii-redactor` before it reaches console, Sentry, or any other
 * downstream sink. Callers never need to remember to scrub — this module does
 * it uniformly. This is the primary defense for GDPR Art. 32 and DPDP Sec. 8
 * "reasonable security safeguards" against inadvertent PII leakage in logs.
 *
 * Correlation IDs: every log line includes a `correlationId` when available.
 * The middleware (`proxy.ts`) generates one per request and injects it as
 * `x-correlation-id` on the request headers. `resolveCorrelationId()` reads
 * it back inside route handlers via `next/headers`. This lets you follow a
 * single request across log lines, Sentry issues, and Inngest events.
 */

import { redactPII, redactString } from "@/lib/pii-redactor";

type Severity = "debug" | "info" | "warning" | "error" | "fatal";

export interface ErrorContext {
  /** Logical area, e.g. "api/crm/leads" or "lib/direct-publisher". */
  scope?: string;
  /** Authenticated user id, if available. */
  userId?: string | null;
  /**
   * Request correlation id. If omitted, we try to resolve it from the current
   * request via `next/headers`. Middleware injects it as `x-correlation-id`.
   */
  correlationId?: string | null;
  /** Any additional structured metadata (no secrets). */
  extra?: Record<string, unknown>;
}

let sentryClient: any = null;
let sentryInitAttempted = false;

async function getSentry(): Promise<any | null> {
  if (sentryInitAttempted) return sentryClient;
  sentryInitAttempted = true;

  if (!process.env.SENTRY_DSN) return null;

  try {
    const moduleName = "@sentry/nextjs";
    const importer = new Function("m", "return import(m)") as (m: string) => Promise<any>;
    const mod: any = await importer(moduleName).catch(() => null);
    if (mod && typeof mod.captureException === "function") {
      sentryClient = mod;
    }
  } catch {
    sentryClient = null;
  }
  return sentryClient;
}

/**
 * Resolves the current request's correlation id.
 *
 * Reads from `next/headers` — which is only available inside a request scope
 * (route handlers, server components, server actions). When called from
 * outside such a scope (a background job, a module init) it returns `null`.
 * Never throws.
 */
async function resolveCorrelationId(): Promise<string | null> {
  try {
    const mod = await import("next/headers");
    const h = await mod.headers();
    return h.get("x-correlation-id") ?? null;
  } catch {
    return null;
  }
}

function serializeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: redactString(error.message),
      stack: error.stack ? redactString(error.stack) : undefined,
    };
  }
  if (typeof error === "string") return { message: redactString(error) };
  try {
    return { message: redactString(JSON.stringify(redactPII(error))) };
  } catch {
    return { message: redactString(String(error)) };
  }
}

/**
 * Report an error to the configured provider and structured logs.
 * Never throws — reporting failures must not break request handling.
 * All strings and objects are PII-redacted before they leave this function.
 */
export async function reportError(
  error: unknown,
  context: ErrorContext = {},
  severity: Severity = "error"
): Promise<void> {
  const { message, stack } = serializeError(error);
  const scope = context.scope || "app";
  const safeExtra = context.extra ? (redactPII(context.extra) as Record<string, unknown>) : undefined;

  // Resolve correlation id from the caller or the current request scope.
  const correlationId =
    context.correlationId !== undefined
      ? context.correlationId
      : await resolveCorrelationId();

  const logPayload = {
    level: severity,
    scope,
    message,
    userId: context.userId ?? undefined,
    correlationId: correlationId ?? undefined,
    ...(safeExtra || {}),
  };

  if (severity === "error" || severity === "fatal") {
    console.error(`[${scope}]`, JSON.stringify(logPayload), stack || "");
  } else if (severity === "warning") {
    console.warn(`[${scope}]`, JSON.stringify(logPayload));
  } else if (severity === "debug") {
    // Debug is chatty — only emit when explicitly enabled.
    if (process.env.LOG_LEVEL === "debug") {
      console.debug(`[${scope}]`, JSON.stringify(logPayload));
    }
  } else {
    console.log(`[${scope}]`, JSON.stringify(logPayload));
  }

  const sentry = await getSentry();
  if (sentry) {
    try {
      sentry.withScope((s: any) => {
        s.setLevel(severity);
        if (context.userId) s.setUser({ id: context.userId });
        s.setTag("scope", scope);
        if (correlationId) s.setTag("correlation_id", correlationId);
        if (safeExtra) s.setContext("extra", safeExtra);
        const redactedErr =
          error instanceof Error
            ? Object.assign(new Error(message), { stack })
            : new Error(message);
        sentry.captureException(redactedErr);
      });
    } catch {
      // Ignore reporting errors.
    }
  }

  // ── On-call alerting ────────────────────────────────────────────────────
  // Fire-and-forget: `fatal` severity pages via configured destinations
  // (Slack / PagerDuty). `error` severity notifies Slack only. See
  // lib/alerting.ts for the exact matrix. No dependency on Sentry — the
  // dispatch is unconditional when destinations are configured.
  if (severity === "fatal" || severity === "error") {
    try {
      const { dispatchAlert } = await import("@/lib/alerting");
      void dispatchAlert({
        summary: message,
        severity,
        scope,
        correlationId,
        userId: context.userId ?? null,
        extra: safeExtra,
      });
    } catch {
      // Alerting is best-effort — never break the request path.
    }
  }
}

/**
 * Internal helper for the leveled log convenience wrappers. Never throws.
 * Prefer this over calling `reportError` directly for `info`/`warning`/`debug`
 * since we don't need Sentry to receive info/debug lines.
 */
async function writeLog(
  level: Severity,
  message: string,
  context: ErrorContext = {}
): Promise<void> {
  const safeExtra = context.extra ? (redactPII(context.extra) as Record<string, unknown>) : undefined;
  const correlationId =
    context.correlationId !== undefined
      ? context.correlationId
      : await resolveCorrelationId();

  const payload = {
    level,
    message: redactString(message),
    userId: context.userId ?? undefined,
    correlationId: correlationId ?? undefined,
    ...(safeExtra || {}),
  };
  const scope = context.scope || "app";

  if (level === "warning") {
    console.warn(`[${scope}]`, JSON.stringify(payload));
  } else if (level === "error" || level === "fatal") {
    console.error(`[${scope}]`, JSON.stringify(payload));
  } else if (level === "debug") {
    if (process.env.LOG_LEVEL === "debug") {
      console.debug(`[${scope}]`, JSON.stringify(payload));
    }
  } else {
    console.log(`[${scope}]`, JSON.stringify(payload));
  }
}

/**
 * Structured info-level log helper. PII-redacted. Correlation-id-aware.
 * Preferred over `console.log` in all server code.
 */
export function logInfo(message: string, context: ErrorContext = {}): void {
  void writeLog("info", message, context);
}

/**
 * Structured warning-level log helper. PII-redacted. Correlation-id-aware.
 * Use for recoverable notices (e.g. "token refresh needed", "retryable failure").
 * Does NOT forward to Sentry — for that use `reportError(..., 'warning')`.
 */
export function logWarn(message: string, context: ErrorContext = {}): void {
  void writeLog("warning", message, context);
}

/**
 * Structured debug-level log helper. Only prints when `LOG_LEVEL=debug`.
 * Safe to leave in production code — completely silent by default.
 */
export function logDebug(message: string, context: ErrorContext = {}): void {
  void writeLog("debug", message, context);
}

/**
 * Shorthand for reportError at 'error' severity with the standard scope key.
 * Provided for symmetry with logInfo/logWarn/logDebug so callers can pick a
 * consistent verb style.
 */
export async function logError(
  error: unknown,
  context: ErrorContext = {}
): Promise<void> {
  return reportError(error, context, "error");
}
