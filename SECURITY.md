# Security Policy

## Supported Versions

The project is under active development. Only the `main` branch is supported —
security fixes land there first and downstream deploys should update within
one week.

| Version | Supported |
|---|---|
| `main` (latest) | ✅ |
| Older commits | ❌ |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email `privacy@lemon-ai.example` (or the address set in
`NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`) with:

- A description of the issue and the affected component / file / URL.
- Reproduction steps or a proof-of-concept.
- The commit SHA you tested against.
- Any suggested mitigation you have in mind.

You should receive an acknowledgement within **72 hours** and a triage /
remediation plan within **7 days**. Critical issues that expose customer data
or allow account takeover are treated as P0.

See `PRIVACY.md` §8 for the full breach-response playbook, including
regulator-notification timelines under GDPR Art. 33 (72 hours) and DPDP.

## Supply-Chain Hygiene

Lemon AI enforces a strict set of supply-chain controls to reduce the risk of
malicious or compromised dependencies. Everything below is enforced today.

### 1. Pinned, exact versions

Every runtime and dev dependency in `package.json` is pinned to a specific
version — no `^` or `~` ranges. This means `git checkout <sha>` always
resolves to the same tree. New installs are exact by default because `.npmrc`
sets `save-exact=true`.

### 2. `.npmrc` hardening

```
save-exact=true       # no floating ranges added to package.json
engine-strict=true    # refuse install on wrong Node version
audit-level=high      # `npm install` fails non-zero on new high-severity CVEs
fund=false            # quieter installs
legacy-peer-deps=false
```

### 3. Node.js engine requirement

`package.json` `engines.node` requires **Node >= 20**. Combined with
`engine-strict=true`, older Node versions are rejected at install time.

### 4. Automated CVE & Vulnerability Monitoring

- **`npm audit`** is run on every PR (`.github/workflows/security.yml`).
- **GitHub Dependency Review** blocks PRs that introduce a new
  high-severity CVE (`fail-on-severity: high`).
- **CodeQL** static analysis runs on every PR with the
  `security-and-quality` query pack.
- **Snyk Vulnerability Scan** automated via `.github/workflows/security.yml`
  to detect open-source dependency vulnerabilities and licensing risks.
- **Software Bill of Materials (SBOM)** generated in SPDX 2.3 standard format
  in CI (`lemon-ai-sbom` artifact) and locally via `npm run sbom`.
- **Dependabot** opens grouped PRs weekly for npm updates and monthly for
  GitHub Actions (`.github/dependabot.yml`).

### 5. Content Security Policy (CSP) & Security Headers

Configured directly in `next.config.ts` across all application routes (`/:path*`):
- **Content-Security-Policy (CSP)**: Strict origin whitelisting restricting script execution, frame embedding, and network connections to authenticated services (Clerk, Supabase, Groq, Sentry, Upstash, Cal.com).
- **Strict-Transport-Security (HSTS)**: 2-year duration (`max-age=63072000; includeSubDomains; preload`).
- **X-Frame-Options**: `DENY` to prevent clickjacking.
- **X-Content-Type-Options**: `nosniff` to prevent MIME-sniffing.
- **Referrer-Policy**: `strict-origin-when-cross-origin`.
- **Permissions-Policy**: Restricts camera, microphone, geolocation, and browsing topics.
- **X-XSS-Protection**: `1; mode=block`.

### 6. Pre-commit secret sniffer

The Husky `pre-commit` hook (`.husky/pre-commit`) refuses to commit staged
additions that match well-known live-key prefixes (`sk-`, `gsk_`, `whsec_`,
`AKIA`, `AIza`, `ghp_`, `xox[a-z]-…`, etc.). Bypass with `--no-verify` only
when you are sure.

### 7. Server-side PII redaction

Every server log line passes through `lib/pii-redactor.ts` before hitting the
console, Sentry, or any other sink — see `PRIVACY.md` §5. This means
accidentally logging a secret in a `catch` block cannot leak it downstream.

### 8. Application-layer encryption

OAuth access / refresh / page tokens stored in `user_channels` are encrypted
with AES-256-GCM using a dedicated `CHANNEL_TOKEN_ENCRYPTION_KEY`, with
transparent key rotation via `CHANNEL_TOKEN_ENCRYPTION_KEYS_LEGACY`. See
`lib/encryption.ts`.

### 9. Row-Level Security

Every user-keyed table has an RLS policy referencing the
`requesting_user_id()` Postgres function, which reads the Clerk JWT `sub`
claim. A tenant cannot read another tenant's rows even if a server bug tried
to.

## Known Third-Party Sub-processors

See `PRIVACY.md` §7 for the current list of vendors that receive Lemon AI
data (Clerk, Supabase, Vercel, Inngest, Groq, Meta, LinkedIn, X, YouTube,
Bluesky, Threads, Replicate, Cloudflare AI, Cal.com, Vapi.ai,
Sentry, Upstash Redis).

## Recent Security Fixes

| Date | Component | Severity | Advisory |
|---|---|---|---|
| 2026-09-18 | `next@16.2.6 → 16.3.5` | Critical | GHSA-p293-qw3h-jr36 (Windows RCE), GHSA-2xp9-vwfh-vxw4 (AVIF RCE) + 9 others |
| 2026-09-18 | `lint-staged@15.2.10 → 15.5.2` | Moderate | Yaml stack-overflow (GHSA-48c2-rrv3-qjmp) |
| 2026-09-18 | `vitest@2.1.9 → 4.1.11` | Moderate | @vitest/mocker path traversal (GHSA-82fw-gwwq-j7x9) + esbuild (GHSA-67mh-4wv8-2f99) |
| 2026-09-18 | `cn@0.3.0` | Hygiene | Removed — unused package, functionality duplicated by local `@/lib/utils` `cn()` |
