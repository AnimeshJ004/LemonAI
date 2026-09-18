import { getInsforgeServerClient, getInsforgeAdminClient } from "@/lib/insforge-server";
import {
  buildCacheKey,
  getCachedAIResponse,
  setCachedAIResponse,
} from "@/lib/ai-cache";

/**
 * Priority waterfall of AI models supported by InsForge / Gemini Gateway.
 * Cascades automatically from fastest/smartest to standard fallback models.
 */
export const MODEL_WATERFALL = [
  "google/gemini-3.8-flash",
  "google/gemini-3.7-flash",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "deepseek/deepseek-chat",
];

export interface ResilientCompletionOptions {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface ResilientCompletionResult<T = any> {
  success: boolean;
  content: string;
  data: T | null;
  modelUsed: string;
  cacheHit: boolean; // true when served from in-memory cache
}

/**
 * Cleanly extracts and parses JSON from raw LLM output, stripping markdown formatting.
 */
export function extractJsonFromText<T = any>(raw: string): T | null {
  if (!raw) return null;
  const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();
  try {
    return JSON.parse(clean) as T;
  } catch {
    // Attempt relaxed regex search for outermost object or array
    const match = clean.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Executes a resilient AI chat completion with automatic model waterfall fallbacks.
 * Prevents 500 errors when a single model endpoint is unavailable, rate-limited, or deprecated.
 * Results are cached in-memory to avoid redundant API calls for identical prompts.
 */
export async function callResilientCompletion<T = any>(
  options: ResilientCompletionOptions
): Promise<ResilientCompletionResult<T>> {
  // ── Cache lookup ──────────────────────────────────────────────────────────
  const systemMsg = options.messages.find((m) => m.role === "system")?.content ?? "";
  const userMsg = options.messages.find((m) => m.role === "user")?.content ?? "";
  const cacheKey = buildCacheKey({
    systemPrompt: systemMsg,
    userPrompt: userMsg,
    temperature: options.temperature,
    jsonMode: options.jsonMode,
    maxTokens: options.maxTokens,
  });

  const cached = getCachedAIResponse<T>(cacheKey);
  if (cached) {
    console.log(`[AI Gateway] Cache HIT (model: ${cached.model})`);
    return {
      success: true,
      content: cached.rawText,
      data: cached.data,
      modelUsed: cached.model,
      cacheHit: true,
    };
  }
  // ─────────────────────────────────────────────────────────────────────────

  const { insforge } = await getInsforgeServerClient().catch(() => ({
    insforge: getInsforgeAdminClient(),
  }));

  let lastError: any = null;

  for (const modelName of MODEL_WATERFALL) {
    try {
      const messages = [...options.messages];
      if (options.jsonMode && messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (!lastMsg.content.toLowerCase().includes("json")) {
          messages[messages.length - 1] = {
            ...lastMsg,
            content: `${lastMsg.content}\n\nReturn ONLY valid JSON without markdown formatting.`,
          };
        }
      }

      const completion = await insforge.ai.chat.completions.create({
        model: modelName,
        messages,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens,
      });

      const content = completion.choices[0]?.message?.content ?? "";
      if (content) {
        const data = options.jsonMode ? extractJsonFromText<T>(content) : (content as unknown as T);
        // Store in cache before returning (data is non-null here: content is truthy)
        setCachedAIResponse<T>(cacheKey, data!, content, modelName, "GENERIC");
        return {
          success: true,
          content,
          data,
          modelUsed: modelName,
          cacheHit: false,
        };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[AI Gateway] Model ${modelName} failed, cascading to next model:`, err?.message || err);
    }
  }

  console.error("[AI Gateway] All models in waterfall failed:", lastError);
  return {
    success: false,
    content: "",
    data: null,
    modelUsed: "none",
    cacheHit: false,
  };
}
