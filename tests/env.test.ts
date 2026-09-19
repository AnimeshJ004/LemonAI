import { describe, it, expect, beforeEach } from "vitest";
import {
  validateEnv,
  validateEnvOnBoot,
  getEnv,
  __resetEnvCacheForTests,
} from "@/lib/env";

/**
 * A minimal set of env vars that satisfies the "required-always" bucket.
 * Individual tests spread over this and override / delete as needed.
 */
function baseEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "development",
    APP_ENV: "development",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_abc",
    CLERK_SECRET_KEY: "sk_test_abc",
    NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon_abc",
    GROQ_API_KEY: "gsk_test_abc",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  } as NodeJS.ProcessEnv;
}

describe("lib/env: validateEnv", () => {
  beforeEach(() => {
    __resetEnvCacheForTests();
  });

  it("accepts a valid development environment", () => {
    const res = validateEnv(baseEnv());
    expect(res.ok).toBe(true);
    expect(res.missing).toEqual([]);
    expect(res.missingInProd).toEqual([]);
    expect(res.env?.APP_ENV).toBe("development");
  });

  it("reports the failing keys (never values) when required vars are missing", () => {
    const env = baseEnv();
    delete env.GROQ_API_KEY;
    delete env.CLERK_SECRET_KEY;
    const res = validateEnv(env);
    expect(res.ok).toBe(false);
    expect(res.env).toBeNull();
    expect(res.missing).toContain("GROQ_API_KEY");
    expect(res.missing).toContain("CLERK_SECRET_KEY");
    // Values must never appear
    for (const m of res.missing) {
      expect(m).not.toMatch(/gsk_|sk_test/);
    }
  });

  it("flags every required-in-prod key when APP_ENV=production", () => {
    const env = { ...baseEnv(), APP_ENV: "production" } as NodeJS.ProcessEnv;
    const res = validateEnv(env);
    expect(res.ok).toBe(false);
    expect(res.missingInProd).toEqual(
      expect.arrayContaining([
        "SUPABASE_SERVICE_ROLE_KEY",
        "CHANNEL_TOKEN_ENCRYPTION_KEY",
        "CHANNEL_OAUTH_STATE_SECRET",
        "CRON_SECRET",
        "CLERK_WEBHOOK_SECRET",
        "INNGEST_EVENT_KEY",
        "INNGEST_SIGNING_KEY",
      ])
    );
  });

  it("also enforces prod-required keys when APP_ENV=staging", () => {
    const env = { ...baseEnv(), APP_ENV: "staging" } as NodeJS.ProcessEnv;
    const res = validateEnv(env);
    expect(res.ok).toBe(false);
    expect(res.missingInProd.length).toBeGreaterThan(0);
  });

  it("passes when all prod-required keys are set", () => {
    const env: NodeJS.ProcessEnv = {
      ...baseEnv(),
      APP_ENV: "production",
      SUPABASE_SERVICE_ROLE_KEY: "srv_key",
      CHANNEL_TOKEN_ENCRYPTION_KEY: "a_valid_key_at_least_16_chars",
      CHANNEL_OAUTH_STATE_SECRET: "state_secret",
      CRON_SECRET: "cron_secret_at_least_16_chars",
      CLERK_WEBHOOK_SECRET: "whsec_test",
      INNGEST_EVENT_KEY: "evt_key",
      INNGEST_SIGNING_KEY: "sig_key",
      META_WEBHOOK_VERIFY_TOKEN: "rotated_meta_verify_token_abc123",
    };
    const res = validateEnv(env);
    expect(res.ok).toBe(true);
    expect(res.missingInProd).toEqual([]);
  });

  it("rejects a CHANNEL_TOKEN_ENCRYPTION_KEY shorter than 16 chars", () => {
    const env: NodeJS.ProcessEnv = {
      ...baseEnv(),
      CHANNEL_TOKEN_ENCRYPTION_KEY: "shortkey",
    };
    const res = validateEnv(env);
    expect(res.ok).toBe(false);
    expect(res.missing).toContain("CHANNEL_TOKEN_ENCRYPTION_KEY");
  });

  it("recognizes build phase so caller can downgrade to warning", () => {
    const env: NodeJS.ProcessEnv = {
      ...baseEnv(),
      NEXT_PHASE: "phase-production-build",
    };
    const res = validateEnv(env);
    expect(res.isBuildPhase).toBe(true);
  });

  it("populates defaults for optional string fields", () => {
    const res = validateEnv(baseEnv());
    expect(res.env?.CLERK_SUPABASE_TEMPLATE).toBe("supabase");
    expect(res.env?.NEXT_PUBLIC_CLERK_SIGN_IN_URL).toBe("/sign-in");
    expect(res.env?.META_WEBHOOK_VERIFY_TOKEN).toBe("lemon_ai_webhook");
  });

  it("refuses shipped-default META_WEBHOOK_VERIFY_TOKEN in production", () => {
    const env: NodeJS.ProcessEnv = {
      ...baseEnv(),
      APP_ENV: "production",
      SUPABASE_SERVICE_ROLE_KEY: "srv_key",
      CHANNEL_TOKEN_ENCRYPTION_KEY: "a_valid_key_at_least_16_chars",
      CHANNEL_OAUTH_STATE_SECRET: "state_secret",
      CRON_SECRET: "cron_secret_at_least_16_chars",
      CLERK_WEBHOOK_SECRET: "whsec_test",
      INNGEST_EVENT_KEY: "evt_key",
      INNGEST_SIGNING_KEY: "sig_key",
      // Intentionally left at the shipped default.
      META_WEBHOOK_VERIFY_TOKEN: "lemon_ai_webhook",
    };
    const res = validateEnv(env);
    expect(res.ok).toBe(false);
    expect(res.missingInProd.some((k) => k.startsWith("META_WEBHOOK_VERIFY_TOKEN"))).toBe(true);
  });

  it("accepts a rotated META_WEBHOOK_VERIFY_TOKEN in production", () => {
    const env: NodeJS.ProcessEnv = {
      ...baseEnv(),
      APP_ENV: "production",
      SUPABASE_SERVICE_ROLE_KEY: "srv_key",
      CHANNEL_TOKEN_ENCRYPTION_KEY: "a_valid_key_at_least_16_chars",
      CHANNEL_OAUTH_STATE_SECRET: "state_secret",
      CRON_SECRET: "cron_secret_at_least_16_chars",
      CLERK_WEBHOOK_SECRET: "whsec_test",
      INNGEST_EVENT_KEY: "evt_key",
      INNGEST_SIGNING_KEY: "sig_key",
      META_WEBHOOK_VERIFY_TOKEN: "some_rotated_random_hex_value_1234567890",
    };
    const res = validateEnv(env);
    expect(res.ok).toBe(true);
    expect(res.missingInProd).toEqual([]);
  });
});

describe("lib/env: validateEnvOnBoot", () => {
  const originalEnv = { ...process.env };

  // Every prod-required key the schema enforces. We explicitly delete these
  // in beforeEach so that pollution from other test files (e.g.
  // encryption.test.ts sets CHANNEL_TOKEN_ENCRYPTION_KEY) cannot bleed in.
  const PROD_REQUIRED_KEYS = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "CHANNEL_TOKEN_ENCRYPTION_KEY",
    "CHANNEL_OAUTH_STATE_SECRET",
    "CRON_SECRET",
    "CLERK_WEBHOOK_SECRET",
    "INNGEST_EVENT_KEY",
    "INNGEST_SIGNING_KEY",
  ] as const;

  beforeEach(() => {
    __resetEnvCacheForTests();
    process.env = { ...originalEnv };
    for (const k of PROD_REQUIRED_KEYS) delete process.env[k];
  });

  function captureLogger() {
    const errors: string[] = [];
    const warnings: string[] = [];
    const infos: string[] = [];
    return {
      logger: {
        error: (m: string) => errors.push(m),
        warn: (m: string) => warnings.push(m),
        info: (m: string) => infos.push(m),
      },
      errors,
      warnings,
      infos,
    };
  }

  it("logs an info message on valid dev environment and returns ok=true", () => {
    Object.assign(process.env, baseEnv());
    const { logger, errors, warnings, infos } = captureLogger();
    let fatalCalled = false;
    const res = validateEnvOnBoot({ logger, onFatal: () => (fatalCalled = true) });
    expect(res.ok).toBe(true);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(infos.length).toBe(1);
    expect(fatalCalled).toBe(false);
  });

  it("calls onFatal in production when a prod-required secret is missing", () => {
    Object.assign(process.env, baseEnv(), { APP_ENV: "production" });
    const { logger, errors } = captureLogger();
    const fatal: string[][] = [];
    const res = validateEnvOnBoot({ logger, onFatal: (m) => fatal.push(m) });
    expect(res.ok).toBe(false);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('APP_ENV="production"');
    expect(fatal.length).toBe(1);
    expect(fatal[0]).toContain("CHANNEL_TOKEN_ENCRYPTION_KEY");
  });

  it("downgrades prod-required errors to warnings when NEXT_PHASE=phase-production-build", () => {
    Object.assign(process.env, baseEnv(), {
      APP_ENV: "production",
      NEXT_PHASE: "phase-production-build",
    });
    const { logger, errors, warnings } = captureLogger();
    let fatalCalled = false;
    validateEnvOnBoot({ logger, onFatal: () => (fatalCalled = true) });
    expect(errors).toEqual([]);
    expect(warnings.length).toBeGreaterThan(0);
    expect(fatalCalled).toBe(false);
  });

  it("calls onFatal for schema-level failures in a non-build phase", () => {
    Object.assign(process.env, baseEnv());
    delete process.env.GROQ_API_KEY;
    const { logger } = captureLogger();
    const fatal: string[][] = [];
    validateEnvOnBoot({ logger, onFatal: (m) => fatal.push(m) });
    expect(fatal.length).toBe(1);
    expect(fatal[0]).toContain("GROQ_API_KEY");
  });

  it("does NOT include secret values in error messages", () => {
    Object.assign(process.env, baseEnv(), {
      APP_ENV: "production",
      CHANNEL_TOKEN_ENCRYPTION_KEY: "super_secret_but_too_short",
    });
    const { logger, errors } = captureLogger();
    validateEnvOnBoot({ logger, onFatal: () => {} });
    const combined = errors.join(" ");
    expect(combined).not.toContain("super_secret_but_too_short");
  });
});

describe("lib/env: getEnv (memoized accessor)", () => {
  beforeEach(() => __resetEnvCacheForTests());

  it("returns the parsed env after successful validation", () => {
    Object.assign(process.env, baseEnv());
    validateEnvOnBoot({
      logger: { error: () => {}, warn: () => {}, info: () => {} },
      onFatal: () => {},
    });
    const env = getEnv();
    expect(env.GROQ_API_KEY).toBe("gsk_test_abc");
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });
});
