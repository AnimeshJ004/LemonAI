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
 */

import { redactPII, redactString } from "@/lib/pii-redactor";

type Severity = "debug" | "info" | "warning" | "error" | "fatal";

export interface ErrorContext {
  /** Logical area, e.g. "api/crm/leads" or "lib/direct-publisher". */
  scope?: string;
  /** Authenticated user id, if available. */
  userId?: string | null;
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
    // Dynamic import via an indirect specifier so TypeScript/webpack do not try
    // to statically resolve the optional dependency at build time.
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

  // Structured console log (picked up by Vercel/host log drains).
  const logPayload = {
    level: severity,
    scope,
    message,
    userId: context.userId ?? undefined,
    ...(safeExtra || {}),
  };

  if (severity === "error" || severity === "fatal") {
    console.error(`[${scope}]`, JSON.stringify(logPayload), stack || "");
  } else if (severity === "warning") {
    console.warn(`[${scope}]`, JSON.stringify(logPayload));
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
        if (safeExtra) s.setContext("extra", safeExtra);
        // Only forward a redacted Error object to Sentry so no raw PII ever
        // leaves the process boundary.
        const redactedErr = error instanceof Error
          ? Object.assign(new Error(message), { stack })
          : new Error(message);
        sentry.captureException(redactedErr);
      });
    } catch {
      // Ignore reporting errors.
    }
  }
}

/** Structured info-level log helper. */
export function logInfo(message: string, context: ErrorContext = {}): void {
  const safeExtra = context.extra ? (redactPII(context.extra) as Record<string, unknown>) : undefined;
  console.log(
    `[${context.scope || "app"}]`,
    JSON.stringify({
      level: "info",
      message: redactString(message),
      userId: context.userId ?? undefined,
      ...(safeExtra || {}),
    })
  );
}
