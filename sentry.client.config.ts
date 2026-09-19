// Sentry client-side configuration.
// Loaded automatically by Sentry's Next.js integration in the browser.
//
// No-op when SENTRY_DSN is not configured — safe to deploy without Sentry
// account. When configured, forwards unhandled browser errors + performance
// traces to your Sentry project.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Environment tag flows through to Sentry issue grouping.
    environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.APP_ENV || "development",
    // Client-side tracing: sample 10% by default. Tune per traffic volume.
    tracesSampleRate: 0.1,
    // Never send Personally Identifiable Information — the observability
    // library redacts on the server side, but Sentry SDK PII (IP, cookies,
    // headers) must also be off by policy. See PRIVACY.md §5.
    sendDefaultPii: false,
    // Suppress console breadcrumbs — our observability layer already ships
    // structured logs, so duplicating breadcrumbs adds noise + PII risk.
    integrations: (defaults) =>
      defaults.filter((i) => i.name !== "Breadcrumbs" && i.name !== "GlobalHandlers"),
  });
}
