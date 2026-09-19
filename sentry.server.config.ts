// Sentry server-side (Node runtime) configuration.
// Loaded by instrumentation.ts on server boot.
//
// The lazy dynamic import in lib/observability.ts also forwards captured
// errors here when this file's init() has run. No-op if SENTRY_DSN is unset.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.APP_ENV || "development",
    tracesSampleRate: 0.1,
    // Server-side PII is redacted in lib/observability.ts before it reaches
    // Sentry; explicitly disable Sentry's own PII collection as a second
    // line of defence. See PRIVACY.md §5.
    sendDefaultPii: false,
  });
}
