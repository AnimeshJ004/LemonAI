import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * Lightweight rate limiting.
 *
 * Default backend is an in-memory fixed-window counter, which protects a single
 * server instance from abuse and accidental request storms. For multi-instance
 * / serverless deployments where a shared limiter is required, set
 * UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN and the limiter will use
 * Upstash Redis automatically (via REST, no extra dependency).
 *
 * Note: on serverless, in-memory counters are per-instance and reset on cold
 * start — they are a best-effort safety net, not a strict global quota. Use the
 * Upstash backend for strict, shared limits.
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms when the window resets
}

export interface RateLimitOptions {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
  /** Namespace to isolate different limiters (e.g. "ai", "public"). */
  namespace?: string;
}

// ---- In-memory fixed-window store ----
interface WindowEntry {
  count: number;
  reset: number;
}
const memoryStore = new Map<string, WindowEntry>();

// Periodically evict expired entries to bound memory (only in long-lived procs).
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, entry] of memoryStore) {
    if (entry.reset <= now) memoryStore.delete(key);
  }
}

async function upstashLimit(
  key: string,
  opts: RateLimitOptions
): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const windowSec = Math.ceil(opts.windowMs / 1000);
  try {
    // INCR then set EXPIRE on first hit, via Upstash REST pipeline.
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, windowSec, "NX"],
        ["PTTL", key],
      ]),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const data: Array<{ result: number }> = await res.json();
    const count = Number(data?.[0]?.result ?? 0);
    const pttl = Number(data?.[2]?.result ?? opts.windowMs);
    const reset = Date.now() + (pttl > 0 ? pttl : opts.windowMs);
    return {
      success: count <= opts.limit,
      limit: opts.limit,
      remaining: Math.max(0, opts.limit - count),
      reset,
    };
  } catch {
    return null; // Fall back to in-memory on any Upstash error.
  }
}

function memoryLimitCheck(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const entry = memoryStore.get(key);

  if (!entry || entry.reset <= now) {
    const reset = now + opts.windowMs;
    memoryStore.set(key, { count: 1, reset });
    return { success: true, limit: opts.limit, remaining: opts.limit - 1, reset };
  }

  entry.count += 1;
  const remaining = Math.max(0, opts.limit - entry.count);
  return {
    success: entry.count <= opts.limit,
    limit: opts.limit,
    remaining,
    reset: entry.reset,
  };
}

/**
 * Check the rate limit for a given identifier.
 */
export async function checkRateLimit(
  identifier: string,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const key = `rl:${opts.namespace || "default"}:${identifier}`;
  const upstash = await upstashLimit(key, opts);
  if (upstash) return upstash;
  return memoryLimitCheck(key, opts);
}

/**
 * Resolve a stable client identifier for rate limiting: prefer the
 * authenticated user id, then fall back to the client IP.
 */
export async function getClientIdentifier(req: NextRequest): Promise<string> {
  try {
    const { userId } = await auth();
    if (userId) return `user:${userId}`;
  } catch {
    // Not authenticated / no Clerk context — fall through to IP.
  }
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return `ip:${ip}`;
}

/**
 * Convenience guard for route handlers. Returns a 429 NextResponse when the
 * limit is exceeded, or null when the request may proceed.
 *
 * Usage:
 *   const limited = await enforceRateLimit(request, { limit: 20, windowMs: 60_000, namespace: "ai" });
 *   if (limited) return limited;
 */
export async function enforceRateLimit(
  req: NextRequest,
  opts: RateLimitOptions
): Promise<NextResponse | null> {
  const identifier = await getClientIdentifier(req);
  const result = await checkRateLimit(identifier, opts);

  if (!result.success) {
    const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Rate limit exceeded. Please slow down and try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": String(result.remaining),
          "X-RateLimit-Reset": String(result.reset),
        },
      }
    );
  }
  return null;
}
