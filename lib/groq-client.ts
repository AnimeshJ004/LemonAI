/**
 * Groq AI Client — Primary content-generation engine.
 *
 * Uses Groq's OpenAI GPT-OSS PRODUCTION (General Access) models.
 *
 * NOTE (2026): Groq deprecated `llama-3.3-70b-versatile` and
 * `llama-3.1-8b-instant` for Free/Developer-tier keys on 2026-08-16 — those
 * IDs now return HTTP 404 `model_not_found` on non-Enterprise accounts. Groq's
 * official migration points production traffic to `openai/gpt-oss-120b`
 * (flagship, replaces the 70B tier) and `openai/gpt-oss-20b` (fast/cheap,
 * replaces the 8B tier). See https://console.groq.com/docs/models.
 *
 * Ordered from highest capability → fastest/cheapest so the default caller
 * (no explicit `model`) picks the strongest available option first, with
 * automatic cascade if that specific model rate-limits or errors.
 */

export const GROQ_MODELS = [
  // High-capability / reasoning tier (GPT-OSS 120B — Groq Production GA)
  "openai/gpt-oss-120b",   // High-level: Deep reasoning & complex content generation
  "groq/compound",         // High-level fallback: Groq Compound reasoning model

  // Fast / low-cost tier (GPT-OSS 20B — Groq Production GA)
  "openai/gpt-oss-20b",    // Low-level: Ultra-fast & low-cost classification, hooks & cleanup
  "groq/compound-mini",    // Low-level fallback: Groq Compound Mini fast model
];

/**
 * Named model constants — use these in tier-aware routing instead of raw strings
 * so the whole codebase updates from one place if Groq changes their IDs.
 */
export const GROQ_FAST_MODELS = [
  "openai/gpt-oss-20b",
  "groq/compound-mini",
] as const;

export const GROQ_THINKING_MODELS = [
  "openai/gpt-oss-120b",
  "groq/compound",
  "openai/gpt-oss-20b", // cross-tier last-resort so thinking calls always get an answer
] as const;

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqCompletionOptions {
  messages: GroqMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface GroqCompletionResult<T = any> {
  success: boolean;
  content: string;
  data: T | null;
  modelUsed: string;
  error?: string;
}

/**
 * Returns whether a Groq API key is present in environment variables.
 */
export function isGroqConfigured(): boolean {
  const key = process.env.GROQ_API_KEY;
  return Boolean(key && key.trim().length > 0);
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
 * Executes chat completion directly against Groq Cloud API with automatic multi-model waterfall.
 */
export async function callGroqChatCompletion<T = any>(
  options: GroqCompletionOptions
): Promise<GroqCompletionResult<T>> {
  const apiKey = (process.env.GROQ_API_KEY || "").trim();

  if (!apiKey) {
    return {
      success: false,
      content: "",
      data: null,
      modelUsed: "none",
      error: "Missing GROQ_API_KEY environment variable",
    };
  }

  const candidateModels = options.model
    ? [options.model, ...GROQ_MODELS.filter((m) => m !== options.model)]
    : GROQ_MODELS;

  let lastError = "";

  for (const modelName of candidateModels) {
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

      const bodyPayload: Record<string, any> = {
        model: modelName,
        messages,
        temperature: options.temperature ?? 0.7,
      };

      if (options.maxTokens) {
        bodyPayload.max_tokens = options.maxTokens;
      }

      if (options.jsonMode) {
        bodyPayload.response_format = { type: "json_object" };
      }

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Groq HTTP ${res.status}: ${errText}`);
      }

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content ?? "";

      if (content) {
        const data = options.jsonMode ? extractJsonFromText<T>(content) : (content as unknown as T);
        return {
          success: true,
          content,
          data,
          modelUsed: `groq/${modelName}`,
        };
      }
    } catch (err: any) {
      lastError = err?.message || String(err);
      console.warn(`[Groq AI] Model ${modelName} failed, cascading:`, lastError);
    }
  }

  return {
    success: false,
    content: "",
    data: null,
    modelUsed: "none",
    error: lastError || "All Groq models failed",
  };
}
