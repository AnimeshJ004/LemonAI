import { getInsforgeServerClient, getInsforgeAdminClient } from "@/lib/insforge-server";
import { callGroqChatCompletion, isGroqConfigured } from "@/lib/groq-client";

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
 * Cascades through InsForge Gemini models, then automatically fails over to Groq AI (Llama 3.3 70B / 3.1 8B).
 * Prevents 500 errors when a single model endpoint is unavailable, rate-limited, or deprecated.
 */
export async function callResilientCompletion<T = any>(
  options: ResilientCompletionOptions
): Promise<ResilientCompletionResult<T>> {
  let insforgeClient: any = null;
  try {
    const { insforge } = await getInsforgeServerClient().catch(() => ({
      insforge: getInsforgeAdminClient(),
    }));
    insforgeClient = insforge;
  } catch (err) {
    console.warn("[AI Gateway] Insforge client initialization notice:", err);
  }

  let lastError: any = null;

  // 1. Try InsForge AI Gateway waterfall first
  if (insforgeClient?.ai?.chat?.completions) {
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

        const completion = await insforgeClient.ai.chat.completions.create({
          model: modelName,
          messages,
          temperature: options.temperature ?? 0.7,
          maxTokens: options.maxTokens,
        });

        const content = completion?.choices?.[0]?.message?.content ?? "";
        if (content) {
          const data = options.jsonMode ? extractJsonFromText<T>(content) : (content as unknown as T);
          return {
            success: true,
            content,
            data,
            modelUsed: modelName,
          };
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI Gateway] InsForge model ${modelName} failed, cascading:`, err?.message || err);
      }
    }
  }

  // 2. Cascade fallback to Groq AI Cloud if InsForge fails or limits out
  if (isGroqConfigured()) {
    console.log("[AI Gateway] Cascading to Groq AI fallback...");
    try {
      const groqRes = await callGroqChatCompletion<T>({
        messages: options.messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        jsonMode: options.jsonMode,
      });

      if (groqRes.success && groqRes.content) {
        return {
          success: true,
          content: groqRes.content,
          data: groqRes.data,
          modelUsed: groqRes.modelUsed,
        };
      }
    } catch (groqErr) {
      console.error("[AI Gateway] Groq fallback error:", groqErr);
    }
  }

  console.error("[AI Gateway] All models in waterfall (InsForge + Groq) failed:", lastError);
  return {
    success: false,
    content: "",
    data: null,
    modelUsed: "none",
  };
}
