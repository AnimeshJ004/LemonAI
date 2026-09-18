import crypto from "crypto";
import { AITaskType } from "./ai-router";

/**
 * AI Response Cache — In-Memory LRU Cache with Per-Task TTL
 *
 * Caches identical AI prompt responses to avoid redundant API calls,
 * saving cost and latency. Keyed by a SHA-256 hash of the full request.
 *
 * - Max 500 entries (LRU eviction when full)
 * - Per-task TTLs tuned to content freshness requirements
 * - Thread-safe for Next.js server runtime (single-process, no race conditions)
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
}

let _metrics: CacheMetrics = {
  hits: 0,
  misses: 0,
  evictions: 0,
  totalEntries: 0,
};

// ---------------------------------------------------------------------------
// In-memory LRU cache (Map preserves insertion order; we delete+re-insert on hit)
// ---------------------------------------------------------------------------
const _cache = new Map<string, CacheEntry>();

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

/**
 * Generates a stable SHA-256 cache key from request parameters.
 * Normalises whitespace so minor formatting differences don't cause misses.
 */
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

/** Promotes a key to the "most recently used" position. */
function _promote(key: string, entry: CacheEntry): void {
  _cache.delete(key);
  _cache.set(key, entry);
}

/** Evicts the least recently used entry when the cache is full. */
function _evictLRU(): void {
  const lruKey = _cache.keys().next().value;
  if (lruKey !== undefined) {
    _cache.delete(lruKey);
    _metrics.evictions++;
    _metrics.totalEntries = _cache.size;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieves a cached AI response if it exists and has not expired.
 * Returns `null` on miss or expiry.
 */
export function getCachedAIResponse<T = any>(key: string): CacheEntry<T> | null {
  const entry = _cache.get(key) as CacheEntry<T> | undefined;

  if (!entry) {
    _metrics.misses++;
    return null;
  }

  // Check expiry
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    _metrics.misses++;
    _metrics.totalEntries = _cache.size;
    return null;
  }

  // Promote to MRU position and record hit
  _promote(key, entry);
  _metrics.hits++;
  return entry;
}

/**
 * Stores an AI response in the cache.
 *
 * @param key    - Cache key (from `buildCacheKey`)
 * @param data   - Parsed data (typed response from LLM)
 * @param rawText - Raw LLM text output
 * @param model  - Model name used for this response
 * @param task   - AITaskType used to determine TTL
 */
export function setCachedAIResponse<T = any>(
  key: string,
  data: T,
  rawText: string,
  model: string,
  task: AITaskType | string
): void {
  // Evict LRU if at capacity
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
}

/**
 * Returns a snapshot of current cache metrics.
 */
export function getCacheMetrics(): CacheMetrics & {
  hitRate: string;
  estimatedMemoryKB: number;
} {
  const total = _metrics.hits + _metrics.misses;
  const hitRate = total === 0 ? "0.00%" : `${(((_metrics.hits / total) * 100).toFixed(2))}%`;

  // Rough memory estimate: average ~2 KB per entry
  const estimatedMemoryKB = _cache.size * 2;

  return {
    ..._metrics,
    hitRate,
    estimatedMemoryKB,
  };
}

/**
 * Clears all cached entries and resets metrics.
 * Useful for testing or manual invalidation.
 */
export function clearAICache(): void {
  _cache.clear();
  _metrics = { hits: 0, misses: 0, evictions: 0, totalEntries: 0 };
}

/**
 * Returns all non-expired cache entries as an array (for debugging).
 */
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
