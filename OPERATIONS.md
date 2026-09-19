# Lemon AI — Operations Runbook

Document version: 1.0
Last updated: 2026-09-18

This is the on-call handbook for the Lemon AI background job system. It
describes every recurring job, the back-pressure knobs, the failure signals
you'll see, and the exact commands to diagnose and remediate.

---

## 1. Scheduled jobs at a glance

Two schedulers cooperate. Vercel Cron is authoritative for post publishing;
Inngest is authoritative for all other recurring work.

| Cron | Schedule | Owned By | What it does | Concurrency | Throttle |
|---|---|---|---|---|---|
| `/api/post/process-due` | `* * * * *` | **Vercel Cron** (`vercel.json`) | Fan-out only. Fetches due posts and dispatches `post/publish.requested` Inngest events. Response < 500 ms typical | n/a (thin HTTP) | n/a |
| `publish-scheduled-post` | event-driven | Inngest | Publishes one post to its target platform. Called once per event dispatched above | Global 10, per-user 3 | 30 / min |
| `poll-post-comments` | `* * * * *` | Inngest cron | Polls connected Instagram/Facebook channels for new comments, auto-replies via AI | 1 | — |
| `poll-social-dms` | `*/5 * * * *` | Inngest cron | Polls Instagram/Facebook DMs, classifies intent, replies + captures leads | 1 | — |
| `lead-followup-orchestrator` | `*/15 * * * *` | Inngest cron | Follow-up sweep for unbooked leads, WhatsApp drip + optional voice call | 1 | — |
| `ad-optimizer-cron` | `0 */6 * * *` | Inngest cron | Autonomous Meta Ads budget reallocation on active campaigns | 1 | — |
| `data-retention-cron` | `0 3 * * *` | Inngest cron | Enforces `data_retention_policies`. Env-gated by `DATA_RETENTION_ENABLED=true` | (implicit) | — |

Cadence intentionally staggered so that no two heavy jobs overlap.

---

## 2. Back-pressure knobs

Every knob is expressed as an Inngest function config or as a Vercel env var.
Change them, redeploy, done.

### 2.1 Per-post publishing (`publishScheduledPost`)

Located in `inngest/functions/publish-scheduled-posts.ts`.

```ts
concurrency: [
  { limit: 10 },                                    // global cap
  { scope: "fn", key: "event.data.userId", limit: 3 } // per-user cap
]
throttle: { limit: 30, period: "1m" }               // burst smoother
```

Tune these when:

- Social APIs return 429s in bulk → lower the global cap.
- One noisy tenant is starving others → lower the per-user cap.
- CPU is idle but Inngest queue is deep → raise the global cap.

### 2.2 Fan-out batch size

`app/api/post/process-due/route.ts` fetches up to **500 due posts per tick**
(`.limit(500)`). Anything beyond that rolls to the next minute. Raise only
after Inngest has room to absorb the fan-out.

### 2.3 Retention

`data-retention-cron` is a no-op unless `DATA_RETENTION_ENABLED=true` is set
in the Vercel environment. See `PRIVACY.md` §2 for the retention matrix.

### 2.4 Client-side fallback poller

`components/schedule/scheduled-posts-poller.tsx` is **disabled by default**.
Re-enable only in an emergency by setting
`NEXT_PUBLIC_ENABLE_CLIENT_POLLER=true`. This should never be on in normal
production — Vercel Cron owns scheduling.

---

## 3. Dashboards & monitoring URLs

Fill in your project IDs / org slugs. Keep this list in sync as you add
observability.

| Service | URL | What to watch |
|---|---|---|
| Vercel deployments | `https://vercel.com/<team>/<project>` | Failed deploys, function invocation errors, 500 rate |
| Vercel Cron logs | `https://vercel.com/<team>/<project>/settings/crons` | Confirm `process-due` fired every minute; check run history |
| Inngest dashboard | `https://app.inngest.com/env/<env>/functions` | Per-function run counts, failure rate, retry backoff |
| Supabase / Insforge | `https://<project>.supabase.co/project/_/logs` | DB query latency, connection saturation |
| Sentry (if configured) | `https://sentry.io/organizations/<org>/issues/` | Runtime errors grouped by scope (see `lib/observability.ts`) |
| Upstash Redis | `https://console.upstash.com/redis/<db>` | Command throughput, evictions, hit rate |
| Clerk | `https://dashboard.clerk.com` | Auth failures, webhook delivery |
| `/api/health` | `https://<your-domain>/api/health` | Public liveness — hook up an external uptime monitor here |

Recommend a **1-minute UptimeRobot / Better Stack check** on `/api/health`
with alerting to a Slack channel or PagerDuty.

---

## 4. Failure playbook

### 4.1 Posts stuck in `queue` past their scheduled_at

**Symptom:** users report a post did not publish at its scheduled time.

Diagnose:

```sql
SELECT id, user_id, status, scheduled_at, publishing_started_at, error_message
FROM scheduled_posts
WHERE status IN ('queue', 'publishing', 'failed')
  AND scheduled_at < NOW() - interval '5 minutes'
ORDER BY scheduled_at DESC
LIMIT 50;
```

Then:

1. **Vercel Cron logs** — confirm `/api/post/process-due` is ticking every
   minute. If it isn't, redeploy or re-add the cron in Vercel UI.
2. **Inngest dashboard** — filter to `publish-scheduled-post`. If runs are
   piling up in "queued" state, concurrency is saturated. Raise
   `concurrency.limit` temporarily.
3. **Provider error** — if `error_message` mentions the social platform,
   check that platform's status page. Rotate the OAuth token if it says
   expired.

Manual force-publish for a single post:

```bash
# From the running server, via HTTP:
curl -X POST "https://<domain>/api/post/[id]/publish" \
  -H "Authorization: Bearer <admin-session>"
```

### 4.2 Posts stuck in `publishing`

The Vercel Cron auto-recovers posts stuck > 3 min. If a post is stuck
longer than that, the recovery step is failing. Manual reset:

```sql
UPDATE scheduled_posts
   SET status = 'queue', publishing_started_at = NULL
 WHERE status = 'publishing'
   AND publishing_started_at < NOW() - interval '10 minutes'
   AND published_at IS NULL;
```

### 4.3 Comment auto-reply not firing

- Confirm `pollPostComments` is running in Inngest.
- Check the `replied_comments` table — a full table means the idempotency
  guard is working correctly and there simply are no new comments.
- Meta rate-limits: check `access_token` on `user_channels` isn't expired.

### 4.4 Retention cron didn't purge

Retention is env-gated. Confirm `DATA_RETENTION_ENABLED=true` in the Vercel
env. In a preview environment this is off by design.

### 4.5 `/api/health` returns 503

The DB is unreachable. Check:

- Supabase / Insforge status page.
- Vercel Function log for `[env]` boot errors — a rotated
  `SUPABASE_SERVICE_ROLE_KEY` is a common cause.
- Network egress from the region pinned in `vercel.json` (`iad1`).

### 4.6 `/api/health` returns 200 `degraded`

An optional check failed. Body pinpoints which one:

- `checks.upstash.ok=false` → Upstash Redis unreachable. Rate limits and AI
  cache degrade to per-instance in-memory. Not user-visible immediately but
  can inflate LLM cost and weaken rate-limits.
- `checks.inngest.ok=false` → `INNGEST_EVENT_KEY` missing in prod. Fan-out
  will fail silently. Fix env var and redeploy.
- `checks.env.ok=false` → a required env var was removed. Consult
  `lib/env.ts` for the required-in-prod list.

---

## 5. Rollback

Every deploy is a Vercel preview → promote. To roll back:

1. `Vercel → Deployments → find the last known-good deploy → Promote to Production`.
2. If a bad migration was applied to Insforge / Supabase, the SQL files in
   `lib/db/` are numbered but not automatically reversible. Prepare an
   explicit down-migration in a fresh SQL file (`13-rollback-*.sql`).

---

## 6. Escalation

- Any suspected data breach → `privacy@lemon-ai.example` (see
  `PRIVACY.md` §8; regulator notification within 72 h).
- Vercel/CD outage blocking deploys → Vercel support + PagerDuty.
- Extended provider outage (Meta / LinkedIn / X) blocking publishing → post
  status page notice; scheduled_posts are safe in the queue and will
  resume on next successful tick.

---

## 7. Service Level Objectives (SLOs)

Every SLO is measured over a **28-day rolling window**. The error budget is
`(1 − target)` — spend it wisely.

| SLI | Target | Error budget (28d) | Measurement source |
|---|---|---|---|
| **Availability** — `/api/health` returns 2xx | **99.5%** | ≈ 3h 21m | GitHub Actions uptime probe + external monitor (Better Stack / UptimeRobot recommended) |
| **Publish latency** — `scheduled_at → published_at` | **P95 < 3 min** | 5% of posts | `SELECT` on `scheduled_posts` where status='published' |
| **DSR fulfilment** — access + deletion requests | **100% within 30 days** (GDPR Art. 12(3)) | 0 breaches tolerated | `dsr_requests` table `created_at → fulfilled_at` |
| **Alert response** — page acknowledged | **P95 < 15 min** during business hours, **< 30 min** off-hours | 5% of pages | PagerDuty acknowledge timestamps |
| **Rate-limit false-positive** — legit requests 429'd | **< 0.1%** | 0.1% of requests | Sample from `429` responses in Vercel logs |
| **AI cache hit rate** — `getCachedAIResponseAsync` | **> 40%** | (target, not budget) | `getCacheMetrics()` → `hitRate` field |

Track the SLIs weekly. When more than half the error budget is consumed in
one week, freeze non-urgent feature work until the trend reverses.

---

## 8. On-Call Playbook

Alerting fans out via `lib/alerting.ts` (see PRIVACY.md §5 for the redaction
guarantee). Two channels are supported:

| Channel | Fires on | Env var to configure |
|---|---|---|
| Slack incoming webhook | `error` + `fatal` | `SLACK_ALERT_WEBHOOK_URL` |
| PagerDuty Events v2 | `fatal` only | `PAGERDUTY_ROUTING_KEY` |

Sentry (when installed and `SENTRY_DSN` set) captures the same errors in
parallel — it is a passive record, not an active pager.

### Rotation
Configure a PagerDuty schedule so at least one person is on call 24×7. In a
solo-founder or small-team phase, rotate primary/secondary weekly.

### Response flow

1. Page fires (PagerDuty) or Slack alert appears.
2. On-call ACKs within the SLO target above.
3. Grab the `X-Correlation-Id` from the alert. Search Sentry / Vercel logs
   filtered on that value to see everything the offending request touched.
4. If a full outage: check the deployment page in Vercel first, then the
   health endpoint `/api/health` for the failing signal.
5. Roll back via `Vercel → Deployments → Promote to Production` (see §5).
6. Post-incident: file a short summary in the tracker with the correlation
   id, the affected user set, the fix, and the follow-up items.

### Silence pages during a known outage
`export event_action = "resolve"` via PagerDuty to close the incident, then
mute the Slack alert channel manually while remediation is in progress.
Re-enable when green.
