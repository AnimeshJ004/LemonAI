import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getCacheMetrics,
  clearAICache,
  listCacheEntries,
} from "@/lib/ai-cache";
import { writeAuditEntry, AUDIT_EVENT } from "@/lib/audit-log";

/**
 * Determines whether a given user is permitted to view/clear AI cache stats.
 * In non-production environments any authenticated user is allowed (dev convenience).
 * In production the userId must be present in the comma-separated
 * CACHE_ADMIN_USER_IDS environment variable.
 */
function isCacheAdmin(userId: string): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  const allowed = (process.env.CACHE_ADMIN_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return allowed.includes(userId);
}

/**
 * GET /api/ai/cache-stats
 *
 * Returns current AI response cache metrics.
 * Requires the user to be authenticated.
 *
 * Response shape:
 * {
 *   hits: number,
 *   misses: number,
 *   evictions: number,
 *   totalEntries: number,
 *   hitRate: "72.34%",
 *   estimatedMemoryKB: number,
 *   entries: [{ key, taskType, model, createdAt, expiresAt, ttlRemainingMs }]
 * }
 */
export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCacheAdmin(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const includeEntries = searchParams.get("entries") === "true";

  const metrics = getCacheMetrics();

  const entries = includeEntries
    ? listCacheEntries().map(({ key, entry }) => ({
        keyPrefix: key.slice(0, 12) + "…", // Truncate hash for readability
        taskType: entry.taskType,
        model: entry.model,
        createdAt: new Date(entry.createdAt).toISOString(),
        expiresAt: new Date(entry.expiresAt).toISOString(),
        ttlRemainingMs: Math.max(0, entry.expiresAt - Date.now()),
      }))
    : undefined;

  // NOTE: This route is auth-gated (admin-gate applied above). Cache metrics
  // are per-instance and are NOT shared across serverless instances.
  return NextResponse.json(
    {
      ...metrics,
      ...(entries !== undefined ? { entries } : {}),
      note:
        process.env.NODE_ENV === "production"
          ? "Metrics are per-instance (not shared across serverless instances)"
          : "Dev instance cache",
      generatedAt: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        // Cache stats themselves must never be cached
        "Cache-Control": "no-store",
      },
    }
  );
}

/**
 * DELETE /api/ai/cache-stats
 *
 * Clears the entire AI response cache. Auth-gated.
 * Useful after deploying a major prompt change to ensure stale results are discarded.
 */
export async function DELETE() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCacheAdmin(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  clearAICache();

  void writeAuditEntry({
    userId,
    actorType: "admin",
    event: AUDIT_EVENT.ADMIN_CACHE_CLEARED,
    resourceType: "ai_cache",
    metadata: { source: "api/ai/cache-stats" },
  });

  return NextResponse.json(
    { success: true, message: "AI response cache cleared." },
    { status: 200 }
  );
}
