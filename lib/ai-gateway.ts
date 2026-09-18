import { callGroqChatCompletion, isGroqConfigured, GROQ_THINKING_MODELS } from "@/lib/groq-client";

/**
 * Resilient AI completion — Groq (GPT-OSS) direct.
 *
 * InsForge Gemini has been removed from the codepath. All content generation
 * routes through Groq's OpenAI GPT-OSS production models (openai/gpt-oss-120b
 * for reasoning, openai/gpt-oss-20b as an in-tier last resort). The public
 * signature of `callResilientCompletion` is intentionally unchanged so every
 * existing caller keeps working without edits.
 *
 * MODEL_WATERFALL is retained (as Groq GPT-OSS IDs) so callers that read it for
 * diagnostics still compile — but the internal loop now targets Groq only.
 */

// Retained for backward compatibility with any diagnostic caller that imports it.
// Populated from GROQ_THINKING_MODELS so it reflects the actual runtime waterfall.
export const MODEL_WATERFALL: readonly string[] = GROQ_THINKING_MODELS;

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
 * Executes a resilient AI chat completion using Groq GPT-OSS models exclusively.
 * Waterfall order: openai/gpt-oss-120b → openai/gpt-oss-20b.
 */
export async function callResilientCompletion<T = any>(
  options: ResilientCompletionOptions
): Promise<ResilientCompletionResult<T>> {
  if (!isGroqConfigured()) {
    console.error("[AI Gateway] GROQ_API_KEY is not configured. All content generation is disabled.");
    return {
      success: false,
      content: "",
      data: null,
      modelUsed: "none",
    };
  }

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

    console.error("[AI Gateway] Groq completion returned no content:", groqRes.error);
  } catch (groqErr) {
    console.error("[AI Gateway] Groq call threw:", groqErr);
  }

  return {
    success: false,
    content: "",
    data: null,
    modelUsed: "none",
  };
}
