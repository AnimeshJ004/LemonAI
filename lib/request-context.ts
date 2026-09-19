import type { ErrorContext } from "@/lib/observability";

/**
 * Request Context Helpers
 *
 * Small utilities that read request-scoped state without forcing every caller
 * to accept a `Request` argument. Rely on `next/headers`, which is available
 * inside route handlers and server components. When called from a background
 * job or module init, these functions return `null` — never throw.
 *
 * The middleware (`proxy.ts`) injects `x-correlation-id` on every incoming
 * request, so `getCorrelationId()` returns a stable UUID for the full
 * request lifetime.
 */

/**
 * Returns the current request's correlation id, or `null` if we are outside
 * a request scope (e.g. inside an Inngest function or a module top-level).
 */
export async function getCorrelationId(): Promise<string | null> {
  try {
    const mod = await import("next/headers");
    const h = await mod.headers();
    return h.get("x-correlation-id") ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns an `ErrorContext` seeded with the current correlation id — a
 * convenience for handler code that repeatedly logs under the same scope:
 *
 *   const ctx = await getRequestScope("api/user/consent");
 *   logInfo("Consent recorded", ctx);
 *   await reportError(err, ctx, "error");
 */
export async function getRequestScope(
  scope: string,
  extra: Partial<Omit<ErrorContext, "scope">> = {}
): Promise<ErrorContext> {
  const correlationId = extra.correlationId ?? (await getCorrelationId());
  return {
    scope,
    correlationId,
    userId: extra.userId,
    extra: extra.extra,
  };
}
