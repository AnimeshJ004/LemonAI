# Contributing to Lemon AI

Thanks for working on Lemon AI. This document describes the developer workflow
and the CI/CD gates every change goes through.

---

## Quickstart

```bash
git clone <repo-url>
cd LemonAI
npm ci
cp .env.example .env.local          # fill in real values
npm run dev                         # http://localhost:3000
```

The `prepare` script installs Husky's Git hooks automatically after `npm ci`,
so a fresh clone is ready to commit safely.

---

## Everyday scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server (Turbopack) |
| `npm test` | Vitest — all unit tests, one shot |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | `tsc --noEmit` — pure type check |
| `npm run lint` | ESLint — errors block, warnings tolerated (see ratchet below) |
| `npm run lint:fix` | Same as above but auto-fixes what it can |
| `npm run build` | Full Next.js production build |
| `npm run ci` | The four gates back-to-back — mirrors what CI runs |

---

## Pre-commit hook

Every `git commit` runs:

1. **`lint-staged`** — ESLint `--fix` on the exact files being committed. No
   whole-codebase lint here, so it's fast (< 2 s typical).
2. **Secret sniffer** — a regex net for well-known provider API-key prefixes
   (`sk-…`, `gsk_…`, `ghp_…`, `whsec_…`, `AKIA…`, `AIza…`, etc.). If a live
   secret ends up in a staged addition, the commit is blocked with a clear
   message.

To bypass in an emergency: `git commit --no-verify`. Use it consciously.

---

## The CI gates (`.github/workflows/ci.yml`)

Every push to `main` and every pull request runs, in order:

1. **`npm run typecheck`** — `tsc --noEmit`.
2. **`npm run lint`** — must be zero errors. Warnings are counted but do not fail.
3. **`npm test`** — Vitest, all files.
4. **`npm run build`** — Next.js production build.

All four must be green. Concurrency is set so a new push to a PR cancels the
in-flight run automatically.

The **Security** workflow (`.github/workflows/security.yml`) runs alongside:

- `npm audit --audit-level=high` (advisory).
- **Dependency Review** (blocks PRs that introduce new high-severity CVEs).
- **CodeQL** static analysis.

---

## ESLint ratchet (why some warnings are allowed)

The codebase inherited ~527 legacy `any` usages plus several React 19 compiler
warnings. Rather than block CI on Day 1, `eslint.config.mjs` downgrades those
specific rules to `warn`:

- `@typescript-eslint/no-explicit-any`
- `@typescript-eslint/no-unused-vars`
- `@typescript-eslint/ban-ts-comment`
- `react-hooks/set-state-in-effect`
- `react-hooks/exhaustive-deps`
- `react-hooks/static-components`
- `react-hooks/purity`
- `react-hooks/immutability`
- `react/no-unescaped-entities`

Everything else is a hard error. The ratchet plan is documented at the top of
`eslint.config.mjs`. New code should not introduce these warnings — CI's
warning count is monitored over time and will eventually flip back to errors.

---

## Branch protection — REQUIRED SETTINGS on GitHub

The workflows enforce quality locally, but you also need to protect `main`
in the GitHub UI so the gate cannot be bypassed. Apply these settings once:

**Repo → Settings → Branches → Add rule → Branch name pattern: `main`**

Enable:

- [x] **Require a pull request before merging**
  - [x] Require approvals: at least **1**
  - [x] Dismiss stale pull-request approvals when new commits are pushed
  - [x] Require review from Code Owners
- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - Required checks (search & tick each one after the first PR runs):
    - `Typecheck · Lint · Test · Build` (from `ci.yml`)
    - `Dependency Review` (from `security.yml`)
    - `CodeQL` (from `security.yml`)
- [x] **Require conversation resolution before merging**
- [x] **Require signed commits** *(recommended for security)*
- [x] **Do not allow bypassing the above settings**
- [x] **Restrict who can push to matching branches** — leave empty (nobody
      pushes directly, everything goes through PR)

Also enable at the repository level:

- **Settings → General → Pull Requests**
  - [x] Allow squash merging (recommended default)
  - [x] Automatically delete head branches after merge
- **Settings → Code security and analysis**
  - [x] Dependency graph
  - [x] Dependabot alerts
  - [x] Dependabot security updates
  - [x] Secret scanning
  - [x] Push protection

---

## Environments (Vercel)

Three environments, distinguished by `APP_ENV`:

| Env | `APP_ENV` | Notes |
|---|---|---|
| Local dev | `development` (default) | `.env.local` on your machine |
| Preview / Staging | `staging` | Vercel Preview deployments |
| Production | `production` | Vercel Production deployment |

`lib/env.ts` refuses to boot in `staging` or `production` without the seven
required-in-prod secrets — see `.env.example` for the ⚑ list. This means a
misconfigured Vercel Environment surfaces at boot as a single clear log line,
not as 500s at request time.

---

## Making a change

1. Cut a branch from `main` — recommended prefix: `feat/`, `fix/`, `chore/`, `docs/`.
2. Commit early and often. The pre-commit hook keeps lint clean.
3. Push and open a PR against `main`.
4. Fill in the PR template.
5. CI runs automatically. Fix red X's, get an approval, merge.
6. Delete the branch — Vercel handles the preview and production deploys.

---

## Reporting security issues

Do **not** open a public GitHub issue for security vulnerabilities. Email
`privacy@lemon-ai.example` (or the address set in
`NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`) with details and expect a response within
72 hours. See `PRIVACY.md` §8 for the full breach-response playbook.
