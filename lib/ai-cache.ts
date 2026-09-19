import crypto from "crypto";
import { AITaskType } from "./ai-router";

/**
 * AI Response Cache — Two-tier: in-memory LRU + optional Upstash Redis.
 *
 * The in-memory tier is a fast single-instance LRU (max 500 entries) with
 * per-task TTLs tuned to content freshness. When `UPSTASH_REDIS_REST_URL`
 * and `UPSTASH_REDIS_REST_TOKEN` are configured, the cache is promoted to a
 * write-through Redis cache so hits survive cold starts across every
 * serverless instance.
 *
 *   READ path:  in-memory HIT → return
 *               in-memory MISS → Upstash GET → populate in-memory → return
 *   WRITE path: in-memory SET → Upstash SET (fire-and-forget, EX=ttlSec)
 *
 * Public API is intentionally backward-compatible with the pre-Upstash
 * version. `getCachedAIResponse` remains synchronous and covers the
 * in-memory tier only. `getCachedAIResponseAsync` (new) additionally checks
 * Redis. `setCachedAIResponse` writes to both tiers.
 *
 * When Upstash is not configured the module behaves exactly like the
 * previous in-memory-only implementation — no runtime cost.
 */

// ---------------------------------------------------------------------------
// TTL configuration per task type (in milliseconds)
// ---------------------------------------------------------------------------
export const CACHE_TTL_MS: Record<AITaskType, number> = {
  // Stable competitive/strategic data — refresh every 6 hours
  COMPETITOR_RESEARCH: 6 * 60 * 60 * 1000,
  FULL_FUNNEL: 6 * 60 * 60 * 1000,
  CAMPAIGN_TARGETING: 6 * 60 * 60 * 1000,

  // Creative content — refresh every 2 hours
  DEEP_SCRIPTWRITING: 2 * 60 * 60 * 1000,
  AD_COPY_HOOKS: 2 * 60 * 60 * 1000,

  // Quick ideas — refresh every 30 minutes
  QUICK_IDEA: 30 * 60 * 1000,
  HASHTAG_EXTRACTION: 30 * 60 * 1000,
  CHATBOT_REPLY: 30 * 60 * 1000,

  // Ultra-fast utility tasks — refresh every 15 minutes
  FAST_CLASSIFICATION: 15 * 60 * 1000,
  JSON_CLEANUP: 15 * 60 * 1000,
  SHORTEN_REPHRASE: 15 * 60 * 1000,
};

// Default TTL fallback for unknown tasks
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Maximum number of cached entries before LRU eviction kicks in
const MAX_CACHE_SIZE = 500;

// Redis key prefix. Rotate this to invalidate all cached responses at once
// (e.g. after a major prompt change).
const REDIS_KEY_PREFIX = "aic:v1:";

// ---------------------------------------------------------------------------
// Cache entry type
// ---------------------------------------------------------------------------
export interface CacheEntry<T = any> {
  data: T;
  rawText: string;
  model: string;
  createdAt: number;
  expiresAt: number;
  taskType: AITaskType | string;
}

// ---------------------------------------------------------------------------
// Global metrics (reset on server restart)
// ---------------------------------------------------------------------------
export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  totalEntries: number;
  /** Redis reads that returned a hit (subset of `hits`). */
  redisHits: number;
  /** Redis writes that succeeded. */
  redisWrites: number;
  /** Redis errors (network failure, timeout). */
  redisErrors: number;
}

let _metrics: CacheMetrics = {
  hits: 0,
  misses: 0,
  evictions: 0,
  totalEntries: 0,
  redisHits: 0,
  redisWrites: 0,
  redisErrors: 0,
};

// ---------------------------------------------------------------------------
// In-memory LRU cache (Map preserves insertion order; delete+re-insert on hit)
// ---------------------------------------------------------------------------
const _cache = new Map<string, CacheEntry>();

// ---------------------------------------------------------------------------
// Upstash helpers
// ---------------------------------------------------------------------------

function upstashEnabled(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

async function upstashGet(key: string): Promise<CacheEntry | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(REDIS_KEY_PREFIX + key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: string | null };
    if (!body || typeof body.result !== "string") return null;

    const parsed = JSON.parse(body.result) as CacheEntry;
    if (typeof parsed?.expiresAt === "number" && Date.now() > parsed.expiresAt) {
      // Stale entry — treat as miss. Upstash TTL should have expired it too.
      return null;
    }
    return parsed;
  } catch {
    _metrics.redisErrors++;
    return null;
  }
}

/**
 * Fire-and-forget Upstash SET with TTL. Never awaited by the caller so a
 * slow Redis does not add latency to the LLM response path.
 */
function upstashSet(key: string, entry: CacheEntry, ttlMs: number): void {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;

  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
  const value = encodeURIComponent(JSON.stringify(entry));
  const fullKey = encodeURIComponent(REDIS_KEY_PREFIX + key);

  // Use the SETEX-equivalent `set/{key}/{value}?EX={ttl}` REST endpoint.
  fetch(`${url}/set/${fullKey}/${value}?EX=${ttlSec}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(2000),
  })
    .then((r) => {
      if (r.ok) _metrics.redisWrites++;
      else _metrics.redisErrors++;
    })
    .catch(() => {
      _metrics.redisErrors++;
    });
}

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

export function buildCacheKey(params: {
  task?: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  jsonMode?: boolean;
  maxTokens?: number;
}): string {
  const normalised = {
    task: params.task || "GENERIC",
    sys: params.systemPrompt.replace(/\s+/g, " ").trim(),
    usr: params.userPrompt.replace(/\s+/g, " ").trim(),
    temp: params.temperature ?? 0,
    json: params.jsonMode ?? false,
    maxTok: params.maxTokens ?? 0,
  };
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(normalised))
    .digest("hex");
}

// ---------------------------------------------------------------------------
// LRU helpers
// ---------------------------------------------------------------------------

function _promote(key: string, entry: CacheEntry): void {
  _cache.delete(key);
  _cache.set(key, entry);
}

function _evictLRU(): void {
  const lruKey = _cache.keys().next().value;
  if (lruKey !== undefined) {
    _cache.delete(lruKey);
    _metrics.evictions++;
    _metrics.totalEntries = _cache.size;
  }
}

// ---------------------------------------------------------------------------
// Public API — in-memory only (backward compatible)
// ---------------------------------------------------------------------------

/**
 * Synchronous read of the in-memory tier only. Callers that want the full
 * two-tier read (in-memory → Upstash) should use `getCachedAIResponseAsync`.
 */
export function getCachedAIResponse<T = any>(key: string): CacheEntry<T> | null {
  const entry = _cache.get(key) as CacheEntry<T> | undefined;

  if (!entry) {
    _metrics.misses++;
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    _metrics.misses++;
    _metrics.totalEntries = _cache.size;
    return null;
  }

  _promote(key, entry);
  _metrics.hits++;
  return entry;
}

/**
 * Two-tier read: check the in-memory LRU first, then Upstash Redis when
 * configured. A Redis hit populates the in-memory tier so subsequent reads
 * on the same instance are fast.
 *
 * Falls back to `getCachedAIResponse` (in-memory only) when Upstash is not
 * configured — this is the identity function in dev / local.
 */
export async function getCachedAIResponseAsync<T = any>(
  key: string
): Promise<CacheEntry<T> | null> {
  // In-memory first — near-instant.
  const memHit = _cache.get(key) as CacheEntry<T> | undefined;
  if (memHit && Date.now() <= memHit.expiresAt) {
    _promote(key, memHit);
    _metrics.hits++;
    return memHit;
  }
  if (memHit) {
    _cache.delete(key);
    _metrics.totalEntries = _cache.size;
  }

  // Upstash tier (when configured).
  if (upstashEnabled()) {
    const redisHit = await upstashGet(key);
    if (redisHit) {
      // Populate in-memory so subsequent hits on this instance are fast.
      if (_cache.size >= MAX_CACHE_SIZE) _evictLRU();
      _cache.set(key, redisHit);
      _metrics.totalEntries = _cache.size;
      _metrics.hits++;
      _metrics.redisHits++;
      return redisHit as CacheEntry<T>;
    }
  }

  _metrics.misses++;
  return null;
}

/**
 * Stores an AI response in both tiers. In-memory write is synchronous;
 * Upstash write is fire-and-forget so the caller does not wait for Redis.
 */
export function setCachedAIResponse<T = any>(
  key: string,
  data: T,
  rawText: string,
  model: string,
  task: AITaskType | string
): void {
  if (_cache.size >= MAX_CACHE_SIZE) {
    _evictLRU();
  }

  const ttl = CACHE_TTL_MS[task as AITaskType] ?? DEFAULT_TTL_MS;
  const now = Date.now();

  const entry: CacheEntry<T> = {
    data,
    rawText,
    model,
    createdAt: now,
    expiresAt: now + ttl,
    taskType: task,
  };

  _cache.set(key, entry);
  _metrics.totalEntries = _cache.size;

  // Fire-and-forget Upstash write when configured.
  if (upstashEnabled()) {
    upstashSet(key, entry, ttl);
  }
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export function getCacheMetrics(): CacheMetrics & {
  hitRate: string;
  estimatedMemoryKB: number;
  upstashEnabled: boolean;
} {
  const total = _metrics.hits + _metrics.misses;
  const hitRate = total === 0 ? "0.00%" : `${(((_metrics.hits / total) * 100).toFixed(2))}%`;
  return {
    ..._metrics,
    hitRate,
    estimatedMemoryKB: _cache.size * 2,
    upstashEnabled: upstashEnabled(),
  };
}

export function clearAICache(): void {
  _cache.clear();
  _metrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalEntries: 0,
    redisHits: 0,
    redisWrites: 0,
    redisErrors: 0,
  };
}

export function listCacheEntries(): { key: string; entry: CacheEntry }[] {
  const now = Date.now();
  const results: { key: string; entry: CacheEntry }[] = [];
  for (const [key, entry] of _cache.entries()) {
    if (now <= entry.expiresAt) {
      results.push({ key, entry });
    }
  }
  return results;
}
