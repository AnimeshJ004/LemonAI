// Sentry Edge runtime (middleware) configuration.
// Loaded by instrumentation.ts when the middleware runs on the Edge.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.APP_ENV || "development",
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}
