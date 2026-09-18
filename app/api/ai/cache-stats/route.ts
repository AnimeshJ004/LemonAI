import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getCacheMetrics,
  clearAICache,
  listCacheEntries,
} from "@/lib/ai-cache";

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

  return NextResponse.json(
    {
      ...metrics,
      ...(entries !== undefined ? { entries } : {}),
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

  clearAICache();

  return NextResponse.json(
    { success: true, message: "AI response cache cleared." },
    { status: 200 }
  );
}
