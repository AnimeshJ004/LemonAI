import { NextResponse } from "next/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";

/**
 * GET /api/health
 *
 * Public, unauthenticated liveness + readiness probe for uptime monitors
 * (Better Stack, Pingdom, UptimeRobot, Vercel's built-in monitor) and CI
 * post-deploy smoke checks.
 *
 * Signals (all optional to prevent one flaky dep from failing the probe):
 *   • db        — Supabase reachability + query latency
 *   • upstash   — Redis reachability, only if configured
 *   • inngest   — event key presence (env-check only, no external call)
 *   • env       — required-in-prod env vars present
 *
 * Overall status:
 *   • 200 "ok"        — every checked signal is healthy
 *   • 200 "degraded"  — one or more optional signals failed but the app
 *                       is still able to serve traffic
 *   • 503 "down"      — the primary DB is unreachable
 *
 * The response body is intentionally small and cache-disabled so uptime
 * checks see fresh data on every hit.
 */

// Health checks must never sit in the 60 s pool. Keep them snappy.
export const maxDuration = 10;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface CheckResult {
  ok: boolean;
  latencyMs?: number;
  detail?: string;
}

async function checkDb(): Promise<CheckResult> {
  const started = Date.now();
  try {
    const admin = getInsforgeAdminClient();
    // Cheapest possible read: HEAD on channel_types (a small seeded lookup).
    const { error } = await admin.database
      .from("channel_types")
      .select("id", { count: "exact", head: true });
    if (error) {
      return { ok: false, detail: error.message, latencyMs: Date.now() - started };
    }
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err: any) {
    return {
      ok: false,
      detail: err?.message || "db error",
      latencyMs: Date.now() - started,
    };
  }
}

async function checkUpstash(): Promise<CheckResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null; // not configured — omit from response
  const started = Date.now();
  try {
    // PING is the canonical Redis liveness command.
    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(2000),
    });
    return {
      ok: res.ok,
      latencyMs: Date.now() - started,
      detail: res.ok ? "PONG" : `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      detail: err?.message || "upstash error",
    };
  }
}

function checkEnv(): CheckResult {
  // Minimal preflight — only checks presence, not validity. Full validation
  // is performed at boot by lib/env.ts via instrumentation.ts.
  const required = ["GROQ_API_KEY", "CLERK_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_URL"];
  const missing = required.filter((k) => !process.env[k]);
  return {
    ok: missing.length === 0,
    detail: missing.length ? `missing: ${missing.join(", ")}` : "ok",
  };
}

function checkInngest(): CheckResult {
  // A live Inngest health call would need a signed request; a config-level
  // check is sufficient for uptime monitors. In dev INNGEST_EVENT_KEY may be
  // absent — treat that as ok when NODE_ENV !== 'production'.
  const key = process.env.INNGEST_EVENT_KEY;
  const isProd = process.env.APP_ENV === "production" || process.env.APP_ENV === "staging";
  const ok = Boolean(key) || !isProd;
  return {
    ok,
    detail: ok ? "configured" : "INNGEST_EVENT_KEY missing in prod/staging",
  };
}

export async function GET() {
  const startedAt = Date.now();

  const [db, upstash] = await Promise.all([checkDb(), checkUpstash()]);
  const env = checkEnv();
  const inngest = checkInngest();

  // DB is the only mandatory signal. Everything else is advisory.
  let status: "ok" | "degraded" | "down" = "ok";
  if (!db.ok) {
    status = "down";
  } else if ((upstash && !upstash.ok) || !env.ok || !inngest.ok) {
    status = "degraded";
  }

  const httpStatus = status === "down" ? 503 : 200;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      version: {
        appEnv: process.env.APP_ENV || "development",
        nodeVersion: process.version,
        // The BUILD_ID file is produced by `next build`. Read via require
        // to survive lint tree-shaking; falls back gracefully in dev.
        buildId: readBuildId(),
      },
      checks: {
        db,
        env,
        inngest,
        ...(upstash ? { upstash } : {}),
      },
    },
    {
      status: httpStatus,
      headers: {
        "Cache-Control": "no-store, must-revalidate",
        "Content-Type": "application/json",
      },
    }
  );
}

function readBuildId(): string | null {
  try {
    // Runtime-only require — never bundled or tree-shaken in a way that
    // fails when the file is absent (dev mode).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path") as typeof import("path");
    const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
    if (fs.existsSync(buildIdPath)) {
      return fs.readFileSync(buildIdPath, "utf-8").trim();
    }
    return null;
  } catch {
    return null;
  }
}
