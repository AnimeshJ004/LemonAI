import { z } from "zod";

/**
 * Environment Variable Schema — single source of truth for every env var
 * Lemon AI reads at runtime.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ THREE BUCKETS                                                            │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ 1. Required-always   — the app cannot start without these in any env    │
 * │                        (auth, database, LLM).                           │
 * │ 2. Required-in-prod  — safe to omit in local dev but MUST be set when   │
 * │                        APP_ENV is 'production' or 'staging'.            │
 * │ 3. Optional          — feature-gated integrations (Meta, WhatsApp,      │
 * │                        Cal.com, Vapi, Replicate, etc.).                 │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * BOOT-TIME BEHAVIOR
 *   • On process start, `instrumentation.ts` calls `validateEnvOnBoot()`.
 *   • In production/staging, missing required-in-prod vars cause the process
 *     to log a redacted error and exit(1) — fail fast, no silent runtime
 *     crashes at request time.
 *   • During `next build` (NEXT_PHASE === "phase-production-build") the
 *     validator degrades to warnings so CI builds don't fail when the
 *     builder does not have production secrets injected.
 *   • In test / development, missing prod-only vars are warnings, not
 *     errors — dev workflows are never blocked.
 *
 * REDACTION
 *   • Zod's default error message includes the offending value. We wrap
 *     `parse()` so the reported errors ONLY name the failing key, never its
 *     value — critical for CI logs where a broken secret must not leak.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

const nodeEnv = z.enum(["development", "test", "production"]).default("development");

/**
 * APP_ENV distinguishes staging from production even when NODE_ENV=production
 * for both (which is how Next.js builds are always deployed). Used by feature
 * flags, retention gates, and Sentry release tagging.
 */
const appEnv = z
  .enum(["development", "test", "staging", "production"])
  .default("development");

// Helpers ------------------------------------------------------------------

const nonEmpty = (min = 1) => z.string().trim().min(min);
const url = (min = 6) => z.string().trim().url().or(z.string().trim().min(min));
const boolean = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

// ---------------------------------------------------------------------------
// Full schema (single object)
// ---------------------------------------------------------------------------

const envSchema = z.object({
  // ── Bucket 1: required-always ──────────────────────────────────────────
  NODE_ENV: nodeEnv,
  APP_ENV: appEnv,

  // Auth
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: nonEmpty(),
  CLERK_SECRET_KEY: nonEmpty(),

  // Database
  NEXT_PUBLIC_SUPABASE_URL: url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmpty(),

  // LLM
  GROQ_API_KEY: nonEmpty(),

  // App URL
  NEXT_PUBLIC_APP_URL: url().default("http://localhost:3000"),

  // ── Bucket 2: required-in-prod / staging (optional-in-dev) ─────────────
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  CHANNEL_TOKEN_ENCRYPTION_KEY: z.string().min(16).optional(),
  CHANNEL_TOKEN_ENCRYPTION_KEYS_LEGACY: z.string().optional(),
  CHANNEL_OAUTH_STATE_SECRET: z.string().optional(),
  CRON_SECRET: z.string().min(16).optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  // ── Bucket 3: optional feature integrations ────────────────────────────
  CLERK_SUPABASE_TEMPLATE: z.string().default("supabase"),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default("/sign-in"),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default("/sign-up"),
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: z.string().default("/"),
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: z.string().default("/onboarding"),
  NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL: z.string().default("/onboarding"),

  INNGEST_DEV: z.string().optional(),

  // Meta / Facebook / Instagram
  META_CLIENT_ID: z.string().optional(),
  META_CLIENT_SECRET: z.string().optional(),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_AD_ACCOUNT_ID: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().default("lemon_ai_webhook"),
  META_PAGE_ID: z.string().optional(),
  META_ADS_ACCESS_TOKEN: z.string().optional(),

  // Threads
  THREADS_APP_ID: z.string().optional(),
  THREADS_APP_SECRET: z.string().optional(),

  // WhatsApp
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),

  // OAuth providers
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  TWITTER_CLIENT_ID: z.string().optional(),
  TWITTER_CLIENT_SECRET: z.string().optional(),
  BLUESKY_IDENTIFIER: z.string().optional(),
  BLUESKY_APP_PASSWORD: z.string().optional(),

  // AI generation
  REPLICATE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_API_KEY: z.string().optional(),
  TOGETHER_API_KEY: z.string().optional(),

  // Cal.com / Voice
  CALCOM_API_KEY: z.string().optional(),
  CALCOM_EVENT_TYPE_ID: z.string().optional(),
  NEXT_PUBLIC_CALCOM_LINK: z.string().optional(),
  VOICE_WEBHOOK_SECRET: z.string().optional(),
  VAPI_WEBHOOK_SECRET: z.string().optional(),

  // Observability / rate-limit
  SENTRY_DSN: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Admin
  CACHE_ADMIN_USER_IDS: z.string().optional(),

  // Privacy (added by migration 12 + privacy module)
  DATA_RETENTION_ENABLED: z.string().optional(),
  NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL: z.string().optional(),
  PII_IP_HASH_SALT: z.string().optional(),

  // AI cost guard (see lib/ai-cost-guard.ts).
  // All optional — module defaults apply when unset.
  AI_DAILY_CAP_PER_USER: z.string().optional(),
  AI_HOURLY_CAP_PER_USER: z.string().optional(),
  AI_DAILY_CAP_GLOBAL: z.string().optional(),
  AI_DAILY_CAP_PROVIDER_GROQ: z.string().optional(),
  AI_DAILY_CAP_PROVIDER_REPLICATE: z.string().optional(),
  AI_DAILY_CAP_PROVIDER_VAPI: z.string().optional(),
  AI_COST_GUARD_FAIL_CLOSED: z.string().optional(),

  // CRM Email Outbound
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Next.js phase (set automatically by Next.js during build)
  NEXT_PHASE: z.string().optional(),
});

export type EnvSchema = z.infer<typeof envSchema>;

/**
 * The keys that MUST be set when APP_ENV is 'production' or 'staging'.
 * If any of these is missing at boot, the process refuses to start.
 */
const REQUIRED_IN_PROD: Array<keyof EnvSchema> = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CHANNEL_TOKEN_ENCRYPTION_KEY",
  "CHANNEL_OAUTH_STATE_SECRET",
  "CRON_SECRET",
  "CLERK_WEBHOOK_SECRET",
  "INNGEST_EVENT_KEY",
  "INNGEST_SIGNING_KEY",
];

/**
 * Defaults that MUST be overridden in prod/staging. Shipping the default
 * value is treated as "not set" in prod/staging so an operator cannot
 * accidentally deploy with a widely-known placeholder.
 *
 * Extend this map when adding any env with a public-facing default.
 */
const PROD_FORBIDDEN_DEFAULTS: Partial<Record<keyof EnvSchema, string>> = {
  META_WEBHOOK_VERIFY_TOKEN: "lemon_ai_webhook",
};

// ---------------------------------------------------------------------------
// Parsing & memoized accessor
// ---------------------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  env: EnvSchema | null;
  /** Names of keys that failed schema validation. NEVER contains values. */
  missing: string[];
  /** Names of prod-required keys that were empty at boot. */
  missingInProd: string[];
  /** True when running during `next build`. Errors are downgraded to warnings. */
  isBuildPhase: boolean;
}

/**
 * Pure validator: takes an arbitrary source object (defaults to process.env),
 * returns a structured result. Never throws. Safe to call from tests.
 */
export function validateEnv(source: NodeJS.ProcessEnv = process.env): ValidationResult {
  const isBuildPhase = source.NEXT_PHASE === "phase-production-build";

  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    // Extract only the failing keys — NEVER the offending value.
    const missing = Array.from(
      new Set(
        parsed.error.issues
          .map((iss) => iss.path.join("."))
          .filter((k) => k.length > 0)
      )
    );
    return {
      ok: false,
      env: null,
      missing,
      missingInProd: [],
      isBuildPhase,
    };
  }

  // Success on the always-required bucket. Now check the prod-required
  // bucket against the effective APP_ENV.
  const env = parsed.data;
  const effective = env.APP_ENV;
  const isProdLike = effective === "production" || effective === "staging";

  const missingInProd = isProdLike
    ? REQUIRED_IN_PROD.filter((k) => {
        const v = env[k];
        return typeof v !== "string" || v.trim().length === 0;
      }).map(String)
    : [];

  // In prod/staging, treat "still-set-to-shipped-default" as missing. This
  // catches the classic mistake of deploying with a public placeholder like
  // META_WEBHOOK_VERIFY_TOKEN=lemon_ai_webhook.
  if (isProdLike) {
    for (const [key, forbidden] of Object.entries(PROD_FORBIDDEN_DEFAULTS)) {
      const value = env[key as keyof EnvSchema];
      if (typeof value === "string" && value.trim() === forbidden) {
        missingInProd.push(`${key} (still set to shipped default; rotate)`);
      }
    }
  }

  return {
    ok: missingInProd.length === 0,
    env,
    missing: [],
    missingInProd,
    isBuildPhase,
  };
}

// Memoized cache so repeated `env.X` reads don't re-parse.
let cached: EnvSchema | null = null;
let cachedFailed = false;

/**
 * Typed, memoized accessor. Returns the parsed env or falls back to
 * `process.env` if validation failed. Call sites that want strict access
 * should call `assertEnv()` before reading.
 */
export function getEnv(): EnvSchema {
  if (cached) return cached;
  const result = validateEnv();
  if (result.ok && result.env) {
    cached = result.env;
    cachedFailed = false;
    return cached;
  }
  cachedFailed = true;
  // Return best-effort casted process.env so callers that don't care about
  // validation still work. This is the "fail-open in dev" behavior.
  return process.env as unknown as EnvSchema;
}

/** True when the last validation attempt did not pass strictly. */
export function envIsValid(): boolean {
  if (!cached) validateEnv();
  return !cachedFailed;
}

// ---------------------------------------------------------------------------
// Boot-time entry point
// ---------------------------------------------------------------------------

export interface BootOptions {
  /** Where to log/exit — override in tests. */
  logger?: {
    error: (msg: string) => void;
    warn: (msg: string) => void;
    info: (msg: string) => void;
  };
  /** Called when validation fails hard in prod. Defaults to process.exit(1). */
  onFatal?: (missing: string[]) => void;
}

const defaultLogger = {
  error: (m: string) => console.error(m),
  warn: (m: string) => console.warn(m),
  info: (m: string) => console.log(m),
};

/**
 * Runs the full validation at server start and takes the appropriate action
 * for the effective environment:
 *
 *   • development / test  → warn on missing prod-only vars, continue.
 *   • staging / production → hard-fail: log redacted error and exit(1),
 *                            unless we are inside `next build` (in which case
 *                            we downgrade to a warning so CI can succeed).
 *
 * Call this from `instrumentation.ts` — Next.js invokes it once per server
 * process.
 */
export function validateEnvOnBoot(opts: BootOptions = {}): ValidationResult {
  const logger = opts.logger ?? defaultLogger;
  const result = validateEnv();

  // Cache the parsed shape (even on partial success) so getEnv() sees it.
  if (result.env) {
    cached = result.env;
    cachedFailed = !result.ok;
  }

  // Schema-level failures (missing required-always keys).
  if (result.missing.length > 0) {
    const list = result.missing.join(", ");
    const msg =
      `[env] FATAL: Missing or invalid required environment variable(s): ${list}. ` +
      `See .env.example for the complete list. Values are not shown for security.`;

    if (result.isBuildPhase) {
      logger.warn(msg);
      logger.warn("[env] Build phase — downgrading to warning so CI can complete.");
      return result;
    }

    logger.error(msg);
    (opts.onFatal ?? ((_missing) => process.exit(1)))(result.missing);
    return result;
  }

  // Prod / staging enforcement.
  if (result.missingInProd.length > 0) {
    const list = result.missingInProd.join(", ");
    const app = result.env?.APP_ENV ?? "unknown";
    const msg =
      `[env] FATAL: APP_ENV="${app}" requires the following secret(s) to be set: ${list}. ` +
      `Configure them in your deployment environment before starting the server.`;

    if (result.isBuildPhase) {
      logger.warn(msg);
      logger.warn("[env] Build phase — downgrading to warning so CI can complete.");
      return result;
    }

    logger.error(msg);
    (opts.onFatal ?? ((_missing) => process.exit(1)))(result.missingInProd);
    return result;
  }

  const app = result.env?.APP_ENV ?? "unknown";

  // Advisory warnings — never fatal — for operational best practices that
  // are technically optional but strongly recommended in prod/staging.
  if (result.env && (app === "production" || app === "staging")) {
    const upstashConfigured = Boolean(
      result.env.UPSTASH_REDIS_REST_URL && result.env.UPSTASH_REDIS_REST_TOKEN
    );
    if (!upstashConfigured) {
      logger.warn(
        `[env] APP_ENV="${app}" without Upstash Redis: rate limits and AI ` +
          `response cache degrade to per-instance in-memory storage, which is ` +
          `effectively empty on Vercel cold starts. Set ` +
          `UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN to enable shared state.`
      );
    }

    if (!result.env.SENTRY_DSN) {
      logger.warn(
        `[env] APP_ENV="${app}" without SENTRY_DSN: errors are logged to ` +
          `stdout only. Configure Sentry for production alerting.`
      );
    }
  }

  logger.info(`[env] Environment validation OK. APP_ENV=${app}`);
  return result;
}

/**
 * Test-only helper — clears the memoized env so a subsequent `getEnv()` call
 * re-reads `process.env`. Not intended for production use.
 */
export function __resetEnvCacheForTests(): void {
  cached = null;
  cachedFailed = false;
}
