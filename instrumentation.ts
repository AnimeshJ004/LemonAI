/**
 * Next.js Instrumentation Hook
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * `register()` is invoked exactly once per Node.js/Edge runtime cold start.
 * We use it to:
 *   1. Run boot-time environment validation (`lib/env.ts`), so misconfigured
 *      deployments fail loudly at startup rather than throwing 500s at
 *      request time.
 *   2. Load the appropriate Sentry config for the active runtime. This is
 *      the official Next.js pattern (see Sentry docs) and lets Sentry
 *      instrument the server / edge boundaries.
 *
 * The Edge runtime does not support `process.exit`, so we skip env
 * validation there — the Node.js server runtime always runs it.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnvOnBoot } = await import("@/lib/env");
    validateEnvOnBoot();
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Forward server-side unhandled route errors to Sentry with a redacted
// message. Sentry's Next.js integration calls this hook automatically when
// exported here.
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  try {
    const { reportError } = await import("@/lib/observability");
    await reportError(
      err,
      {
        scope: `nextjs/${context.routerKind}/${context.routeType}`,
        extra: {
          path: request.path,
          method: request.method,
          routePath: context.routePath,
        },
      },
      "error"
    );
  } catch {
    // Never let observability failures bubble.
  }
}
