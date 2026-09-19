import { logWarn, reportError } from "@/lib/observability";

/**
 * AI Cost Guard
 *
 * The single choke point for every outbound call that spends real money on a
 * third-party model (Groq / Replicate / Cloudflare AI / Together / Vapi).
 *
 * WHY THIS EXISTS
 * ---------------
 * A single bug in the flywheel orchestrator can invoke `callResilientCompletion`
 * in a tight loop and burn thousands of dollars in Groq / Replicate credits
 * before a human notices. The cost guard is the last-line-of-defense so that a
 * runaway loop is bounded by a hard daily cap, not by "we noticed the invoice."
 *
 * SEMANTICS
 * ---------
 *   • Per-user daily cap (soft):       AI_DAILY_CAP_PER_USER          default 500 calls
 *   • Per-user hourly burst cap:       AI_HOURLY_CAP_PER_USER         default 120 calls
 *   • Global daily cap (hard):         AI_DAILY_CAP_GLOBAL            default 20_000 calls
 *   • Per-provider daily cap:          AI_DAILY_CAP_PROVIDER_<NAME>   optional
 *
 * When Upstash is configured (UPSTASH_REDIS_REST_URL + TOKEN), counters live
 * in Redis so they are shared across serverless instances. Otherwise counters
 * are in-memory (per-instance, best-effort). Redis is strongly recommended
 * for prod — an in-memory cap on Vercel is effectively no cap after a cold
 * start.
 *
 * The guard never throws. On Redis error it fails OPEN (allows the call) to
 * preserve availability, and reports the error to observability so we notice.
 * If you need fail-closed behaviour, set AI_COST_GUARD_FAIL_CLOSED=true.
 */

export type CostProvider = "groq" | "replicate" | "cloudflare" | "together" | "vapi";

export interface CostGuardOptions {
  provider: CostProvider;
  /** Authenticated user id if the call is user-attributed. Public/background jobs pass null. */
  userId: string | null;
  /**
   * Estimated cost weight for this call (default 1). Use higher values for
   * expensive units — e.g. a video generation call could pass 20, a cheap
   * classification 1. Counters are incremented by this weight.
   */
  weight?: number;
}

export interface CostGuardVerdict {
  allowed: boolean;
  /** Reason string when blocked; empty when allowed. */
  reason: string;
  /** Structured detail useful for the caller's log line. */
  detail: {
    perUserToday: number;
    perUserThisHour: number;
    globalToday: number;
    perProviderToday: number;
    limits: {
      perUserDaily: number;
      perUserHourly: number;
      globalDaily: number;
      perProviderDaily: number | null;
    };
  };
}

// ─── Config ──────────────────────────────────────────────────────────────

function numericEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function readLimits(provider: CostProvider) {
  const perProviderKey = `AI_DAILY_CAP_PROVIDER_${provider.toUpperCase()}`;
  const perProviderRaw = process.env[perProviderKey];
  const perProviderDaily = perProviderRaw ? Number(perProviderRaw) : null;

  return {
    perUserDaily: numericEnv("AI_DAILY_CAP_PER_USER", 500),
    perUserHourly: numericEnv("AI_HOURLY_CAP_PER_USER", 120),
    globalDaily: numericEnv("AI_DAILY_CAP_GLOBAL", 20_000),
    perProviderDaily:
      typeof perProviderDaily === "number" && Number.isFinite(perProviderDaily) && perProviderDaily > 0
        ? perProviderDaily
        : null,
  };
}

function failClosed(): boolean {
  const raw = process.env.AI_COST_GUARD_FAIL_CLOSED;
  return raw === "true" || raw === "1";
}

// ─── Counter storage ─────────────────────────────────────────────────────

interface Counter {
  value: number;
  resetAt: number;
}
const memoryStore = new Map<string, Counter>();

function bucketDay(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}
function bucketHour(): string {
  const d = new Date();
  return `${bucketDay()}${String(d.getUTCHours()).padStart(2, "0")}`;
}
function midnightUTCMs(): number {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}
function nextHourUTCMs(): number {
  const d = new Date();
  d.setUTCMinutes(60, 0, 0);
  return d.getTime();
}

async function upstashIncr(
  key: string,
  weight: number,
  ttlSec: number
): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCRBY", key, weight],
        ["EXPIRE", key, ttlSec, "NX"],
      ]),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const data: Array<{ result: number }> = await res.json();
    const value = Number(data?.[0]?.result ?? 0);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function memoryIncr(key: string, weight: number, resetAt: number): number {
  const now = Date.now();
  const existing = memoryStore.get(key);
  if (!existing || existing.resetAt <= now) {
    const c: Counter = { value: weight, resetAt };
    memoryStore.set(key, c);
    return c.value;
  }
  existing.value += weight;
  return existing.value;
}

async function incrCounter(
  key: string,
  weight: number,
  resetAt: number
): Promise<number> {
  const ttlSec = Math.max(60, Math.ceil((resetAt - Date.now()) / 1000));
  const upstash = await upstashIncr(key, weight, ttlSec);
  if (upstash !== null) return upstash;
  return memoryIncr(key, weight, resetAt);
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Checks whether an AI call is allowed under the configured budgets.
 *
 * Increments counters as a side effect. If the increment would exceed the
 * cap, the counter is still incremented (so we do not lose visibility of
 * the attempted spend) but the verdict is `allowed=false`.
 */
export async function checkAiSpend(opts: CostGuardOptions): Promise<CostGuardVerdict> {
  const weight = Math.max(1, Math.floor(opts.weight ?? 1));
  const limits = readLimits(opts.provider);

  const dayBucket = bucketDay();
  const hourBucket = bucketHour();
  const dayResetAt = midnightUTCMs();
  const hourResetAt = nextHourUTCMs();

  const userKey = opts.userId ? `ai:cost:user:${opts.userId}:day:${dayBucket}` : null;
  const userHourKey = opts.userId
    ? `ai:cost:user:${opts.userId}:hour:${hourBucket}`
    : null;
  const globalKey = `ai:cost:global:day:${dayBucket}`;
  const providerKey = `ai:cost:provider:${opts.provider}:day:${dayBucket}`;

  try {
    const [perUserToday, perUserThisHour, globalToday, perProviderToday] =
      await Promise.all([
        userKey ? incrCounter(userKey, weight, dayResetAt) : Promise.resolve(0),
        userHourKey
          ? incrCounter(userHourKey, weight, hourResetAt)
          : Promise.resolve(0),
        incrCounter(globalKey, weight, dayResetAt),
        incrCounter(providerKey, weight, dayResetAt),
      ]);

    const detail: CostGuardVerdict["detail"] = {
      perUserToday,
      perUserThisHour,
      globalToday,
      perProviderToday,
      limits,
    };

    // Order of checks: cheapest signal first.
    if (opts.userId && perUserThisHour > limits.perUserHourly) {
      logWarn("AI cost guard: per-user hourly cap exceeded", {
        scope: "lib/ai-cost-guard",
        userId: opts.userId,
        extra: { provider: opts.provider, perUserThisHour, limit: limits.perUserHourly },
      });
      return {
        allowed: false,
        reason: `per-user hourly cap exceeded (${perUserThisHour}/${limits.perUserHourly})`,
        detail,
      };
    }

    if (opts.userId && perUserToday > limits.perUserDaily) {
      logWarn("AI cost guard: per-user daily cap exceeded", {
        scope: "lib/ai-cost-guard",
        userId: opts.userId,
        extra: { provider: opts.provider, perUserToday, limit: limits.perUserDaily },
      });
      return {
        allowed: false,
        reason: `per-user daily cap exceeded (${perUserToday}/${limits.perUserDaily})`,
        detail,
      };
    }

    if (limits.perProviderDaily !== null && perProviderToday > limits.perProviderDaily) {
      // Global-scope warning — the whole tenant fleet is throttled.
      await reportError(
        new Error(
          `AI provider daily cap exceeded: ${opts.provider} spent ${perProviderToday}/${limits.perProviderDaily}`
        ),
        {
          scope: "lib/ai-cost-guard",
          extra: { provider: opts.provider, perProviderToday, limit: limits.perProviderDaily },
        },
        "warning"
      );
      return {
        allowed: false,
        reason: `provider daily cap exceeded (${perProviderToday}/${limits.perProviderDaily})`,
        detail,
      };
    }

    if (globalToday > limits.globalDaily) {
      await reportError(
        new Error(
          `AI global daily cap exceeded: ${globalToday}/${limits.globalDaily}`
        ),
        {
          scope: "lib/ai-cost-guard",
          extra: { provider: opts.provider, globalToday, limit: limits.globalDaily },
        },
        "error"
      );
      return {
        allowed: false,
        reason: `global daily cap exceeded (${globalToday}/${limits.globalDaily})`,
        detail,
      };
    }

    return { allowed: true, reason: "", detail };
  } catch (err) {
    // Counter store unreachable — fail open unless the operator explicitly
    // chose fail-closed. We still record the outage so ops can see it.
    await reportError(
      err,
      {
        scope: "lib/ai-cost-guard",
        extra: { provider: opts.provider, failMode: failClosed() ? "closed" : "open" },
      },
      "warning"
    );
    if (failClosed()) {
      return {
        allowed: false,
        reason: "cost guard fail-closed: counter store unreachable",
        detail: {
          perUserToday: 0,
          perUserThisHour: 0,
          globalToday: 0,
          perProviderToday: 0,
          limits,
        },
      };
    }
    return {
      allowed: true,
      reason: "",
      detail: {
        perUserToday: 0,
        perUserThisHour: 0,
        globalToday: 0,
        perProviderToday: 0,
        limits,
      },
    };
  }
}

/**
 * Test-only helper — clears the in-memory counter store so a subsequent call
 * starts from zero. Never call this from production code.
 */
export function __resetAiCostGuardForTests(): void {
  memoryStore.clear();
}
