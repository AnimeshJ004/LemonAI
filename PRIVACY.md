# Lemon AI — Data Privacy & Compliance

**Document version:** 1.0
**Last updated:** 2026-09-18
**Owner:** Engineering + Compliance
**Contact:** `privacy@lemon-ai.example` (set via `PRIVACY_CONTACT_EMAIL`)

This document is the single source of truth for how Lemon AI collects, stores,
processes, retains, and deletes personal data. It is written to satisfy:

- **GDPR** (EU Regulation 2016/679)
- **UK GDPR + Data Protection Act 2018**
- **DPDP Act 2023** (India Digital Personal Data Protection Act)
- **CCPA / CPRA** (California)
- **LGPD** (Brazil)

---

## 1. Data Map

Every piece of personal data Lemon AI stores, why it exists, and where it lives.

| Data Class | Storage | Contains | Legal Basis | Encryption | Retention |
|---|---|---|---|---|---|
| **Authentication identity** | Clerk (managed) | Email, name, avatar, sign-in factors | Contract (GDPR Art. 6(1)(b)) | TLS in-transit + Clerk at-rest | Until account deletion |
| **User profile snapshot** | `brand_profiles`, `ai_memory` | Business name, niche, tone, target audience, address | Contract | TLS + DB at-rest | Until account deletion |
| **OAuth channel tokens** | `user_channels.access_token`, `.refresh_token`, `.page_access_token` | Provider access tokens for Instagram, Facebook, LinkedIn, X, YouTube, Threads, Bluesky | Contract | **AES-256-GCM app-layer** (`lib/encryption.ts`) + DB at-rest | Until channel disconnect or account deletion |
| **Social handles** | `user_channels.handle`, `.provider_account_id`, `.profile_image` | Public handle + provider IDs | Contract | TLS + DB at-rest | Until channel disconnect |
| **Lead PII** | `leads` | Name, email, phone, score, deal value | Legitimate interest (Art. 6(1)(f)) for the tenant's own CRM | TLS + DB at-rest | 2 years post last activity, then purged by retention cron |
| **Conversation content** | `crm_conversations`, `crm_messages`, `crm_activities`, `social_dms`, `social_comments` | Full message bodies, sender metadata | Legitimate interest | TLS + DB at-rest | 2 years for `crm_messages`, 1 year for `social_comments` |
| **Scheduled posts** | `scheduled_posts` | Post content, images (URL), scheduled time | Contract | TLS + DB at-rest | Until user deletion |
| **AI memory & brand knowledge** | `ai_memory`, `brand_profiles` | Chat history with brand bot, product/service details | Contract | TLS + DB at-rest | 2 years for `ai_memory` |
| **Competitor research** | `competitor_researches` | User-supplied niche + AI-generated hooks | Contract | TLS + DB at-rest | 1 year |
| **Meta Ads campaigns** | `meta_campaigns` | Campaign IDs, budget, target audiences | Contract | TLS + DB at-rest | Until user deletion |
| **Idempotency ledger** | `replied_comments` | Comment IDs already replied to | Legitimate interest (spam prevention) | TLS + DB at-rest | 30 days |
| **Flywheel executions** | `flywheel_executions` | Run history, step outcomes | Contract | TLS + DB at-rest | 1 year |
| **Consent history** | `consent_records` | Consent grants & revocations with hashed IP | Legal obligation (GDPR Art. 7(1)) | TLS + DB at-rest | 6 years (legal defense) |
| **Audit trail** | `audit_logs` | Security & privacy events; **hashed** IP; **redacted** metadata | Legal obligation (GDPR Art. 5(2)) | TLS + DB at-rest | 6 years |
| **DSR requests** | `dsr_requests` | Data Subject Request status | Legal obligation | TLS + DB at-rest | 6 years |
| **Uploaded images** | Supabase Storage bucket `post-images/<userId>/…` | User-uploaded post media | Contract | TLS + storage at-rest | Until deletion |
| **Server logs** | Vercel log drain + optional Sentry | Structured request/error logs. **PII is redacted at source** by `lib/observability.ts` (masks email, phone, JWT, API keys, IPv4/IPv6, Bearer tokens). | Legitimate interest (security) | TLS in transit | 30 days (Vercel default) |

**What we do NOT store:** raw client IP addresses, credit-card numbers, national IDs (SSN/Aadhaar/PAN), passwords (handled entirely by Clerk).

---

## 2. Retention Policy

Enforced by the daily Inngest cron `data-retention-cron` (03:00 UTC).
Rules live in `data_retention_policies`; the engine (`lib/data-retention.ts`)
is env-gated via `DATA_RETENTION_ENABLED=true`.

Default seeded rules (migration 12):

| Table | Retention | Timestamp column | Rationale |
|---|---|---|---|
| `audit_logs` | **6 years** | `created_at` | GDPR / DPDP legal defense window |
| `dsr_requests` | **6 years** | `created_at` | Regulator evidence retention |
| `crm_messages` | 2 years | `created_at` | Cold conversation aging |
| `ai_memory` | 2 years | `created_at` | Chat context freshness |
| `social_comments` | 1 year | `created_at` | Public engagement history |
| `flywheel_executions` | 1 year | `created_at` | Operational run history |
| `replied_comments` | 30 days | `replied_at` | Pure dedup ledger |

To change a rule, `UPDATE data_retention_policies SET retention_days=… WHERE table_name=…`.
Deactivate a rule with `active=false`.

Retention is **allowlisted**: `lib/data-retention.ts` will refuse to purge any
table not in its internal allowlist, even if a corrupt policy row references
it. Column names are validated against a strict regex to prevent SQL injection.

---

## 3. Data Subject Requests (DSRs)

Rights supported: access, deletion, portability, rectification, restriction, objection.

### Self-service endpoints

| Right | Endpoint | Notes |
|---|---|---|
| Access (Art. 15) | `GET /api/user/data-export` | Returns a single JSON document with every user-keyed row. OAuth tokens are stripped. |
| Portability (Art. 20) | `GET /api/user/data-export` | Same payload; JSON is a portable format. |
| Erasure (Art. 17) | `DELETE /api/user/delete-account` | Cascades across all tables + storage bucket + Clerk user. |
| Consent grant / revoke (Art. 7) | `POST /api/user/consent` | Immutable — each call creates a new row. |
| Consent view | `GET /api/user/consent` | Latest effective state per consent type. |

Every DSR endpoint writes a row to `dsr_requests` and an entry to `audit_logs`.

### Manual / regulator-driven SOP

1. Ticket lands via `privacy@lemon-ai.example`.
2. Compliance verifies identity (Clerk email match).
3. Engineer runs the corresponding API endpoint impersonating the tenant OR
   direct SQL from the admin console.
4. `dsr_requests.status` moves `pending → processing → completed | rejected`.
5. Response to the requester within **30 days** (GDPR Art. 12(3)).

---

## 4. Consent Model

Types tracked (`lib/consent.ts`):

- `terms_of_service`
- `privacy_policy`
- `marketing_emails`
- `analytics_cookies`
- `ai_training`
- `data_processing`
- `third_party_sharing`

Consent is versioned (`version` column on `consent_records`) so we can invalidate
prior consent when the policy text materially changes.

Callsite guidance:

- Use `hasConsent(userId, type)` for non-essential features — fails open when
  no record exists (backward compatibility for pre-consent-module users).
- Use `hasExplicitConsent(userId, type)` for GDPR-sensitive operations
  (marketing emails, third-party sharing, AI training) — fails closed.

### 4.1 Cookie Consent & Analytics Tracker Blocker (`lib/consent-tracker-gate.ts`)

In compliance with GDPR Recital 30, ePrivacy Directive 2002/58/EC (Art. 5(3)), and DPDP Sec. 6:
- **Strict Prior Consent (Fail-Closed)**: Non-essential analytics and marketing cookies/trackers are strictly blocked prior to explicit opt-in.
- **Dynamic Script Interception**: `installTrackerScriptBlocker()` intercepts `document.createElement('script')` and `navigator.sendBeacon` to block dynamic loading of Google Analytics, Tag Manager, Meta Pixel, PostHog, Clarity, Hotjar, etc., when consent is withheld.
- **Automatic Tracker Cookie Purge**: When consent is rejected or revoked, `purgeTrackingCookies()` immediately clears all matching tracking identifiers (`_ga`, `_gid`, `_gat`, `_fbp`, `_clck`, `_hj*`, etc.) from `document.cookie`.
- **Global Opt-Out Flags**: Sets `window['ga-disable-*'] = true` and stubs analytics globals (`window.gtag`, `window.fbq`) to drop tracking payloads.
- **Safe Telemetry API**: Client calls route through `trackAnalyticsEvent(name, payload)` which verifies `isAnalyticsConsentGranted()` before firing.

---

## 5. Logging & PII Redaction

`lib/observability.ts` is the sole logging boundary. Every call to
`reportError()` and `logInfo()` passes the message, stack, and `extra` context
through `lib/pii-redactor.ts` before it reaches:

- `console.*`
- Vercel log drain
- Sentry (if `SENTRY_DSN` is set)

Redaction patterns (see `lib/pii-redactor.ts`):

| Class | Replacement |
|---|---|
| Email addresses | `[EMAIL]` |
| Phone numbers (E.164 / NA / Indian) | `[PHONE]` |
| Credit-card-shaped digits (13–19) | `[CARD]` |
| JWT tokens | `[JWT]` |
| `Bearer …` tokens | `Bearer [REDACTED]` |
| OpenAI/Groq/Stripe/GitHub/AWS/Google/Slack/Clerk keys | `[API_KEY]` |
| IPv4 / IPv6 (loopback preserved) | `[IP]` |
| Object keys matching `password`, `token`, `apiKey`, `authorization`, `cookie`, `email`, `phone`, `name`, `address`, `ssn`, `aadhaar`, `pan`, `cvv`, `otp` | `[REDACTED]` |

Direct `console.log/warn/error` calls scattered elsewhere in the codebase are
being migrated to `reportError` / `logInfo` — track progress in
`P1: replace console.* with observability helpers`.

---

## 6. Security Controls

- **Row-Level Security** on every user-keyed table via the `requesting_user_id()`
  Postgres function (Clerk JWT `sub`).
- **AES-256-GCM** application-layer encryption of OAuth tokens with declarative
  key rotation via `CHANNEL_TOKEN_ENCRYPTION_KEYS_LEGACY`.
- **Timing-safe** comparison for CRON authorization.
- **Middleware-level** 401 for all non-public API routes (defense-in-depth).
- **PKCE** for Twitter/X OAuth; encrypted state for all providers.
- **Rate limiting** (Upstash-backed) on public + AI-cost endpoints.

---

## 7. Sub-processors

| Vendor | Purpose | Location |
|---|---|---|
| Clerk | Authentication, session management | US |
| Supabase / Insforge | Postgres, storage, realtime | Configurable per project |
| Vercel | Hosting, edge, log drain | Global (region `iad1` per `vercel.json`) |
| Inngest | Background jobs & cron | US |
| Groq | LLM inference (GPT-OSS models) | US |
| Meta (Facebook / Instagram / Threads) | Social OAuth + Ads + Messaging | Global |
| LinkedIn / X / YouTube / Bluesky | Social OAuth + publishing | Global |
| Replicate | Image / video generation (opt-in) | US |
| Cloudflare Workers AI | Backup image inference (opt-in) | Global |
| Cal.com | Appointment booking (opt-in) | Configurable |
| Vapi.ai | Voice calling (opt-in) | US |
| Sentry | Error tracking (opt-in via `SENTRY_DSN`) | US / EU regions |
| Upstash Redis | Rate-limit backend (opt-in) | Configurable |

---

## 8. Breach Response

Reporting SLA: **72 hours** to lead supervisory authority (GDPR Art. 33).

Playbook:

1. Detect (Sentry alert, unusual query in Vercel logs, sub-processor advisory).
2. Contain (rotate keys via `CHANNEL_TOKEN_ENCRYPTION_KEYS_LEGACY`; revoke
   compromised Clerk sessions; disable affected channel tokens).
3. Assess scope by querying `audit_logs` for the affected `user_id` set.
4. Notify affected data subjects if high-risk (GDPR Art. 34).
5. File regulator report within 72 hours.
6. Post-mortem, add regression test.

---

## 9. Change Log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-09-18 | Initial publication. Migration 12 adds `audit_logs`, `consent_records`, `dsr_requests`, `data_retention_policies`. Observability now redacts PII by default. Self-service data export + consent endpoints live. |
