/**
 * AI Prompt Memory — Core Helper Library
 *
 * This module implements zero-cost "Prompt Memory" for the AI:
 * - Records user feedback signals (edit, like, dislike, delete, explicit)
 * - Retrieves recent memories for a user
 * - Builds a memory block string injected into AI system prompts
 * - Optionally generates a 1-line insight summary via Gemini (tiny call, negligible cost)
 *
 * No external vector DB or embedding service required — pure Postgres + prompt injection.
 */

export interface MemorySignal {
  signalType: "positive" | "edited" | "deleted" | "explicit";
  originalContent?: string;
  finalContent?: string;
  feedbackText?: string;
  contextNiche?: string;
  contextTone?: string;
  postId?: string;
}

export interface AIMemoryRow {
  id: string;
  user_id: string;
  signal_type: string;
  original_content: string | null;
  final_content: string | null;
  feedback_text: string | null;
  learned_insight: string | null;
  context_niche: string | null;
  context_tone: string | null;
  post_id: string | null;
  created_at: string;
}

/**
 * Save a feedback signal into ai_memory table.
 * Also auto-generates a 1-line insight if content was edited.
 */
export async function recordMemorySignal(
  userId: string,
  signal: MemorySignal,
  insforge: any
): Promise<void> {
  try {
    let learnedInsight: string | null = null;

    // For edits: auto-generate a 1-line insight using a tiny Gemini call
    if (
      signal.signalType === "edited" &&
      signal.originalContent &&
      signal.finalContent &&
      signal.originalContent.trim() !== signal.finalContent.trim()
    ) {
      learnedInsight = await generateInsight(
        signal.originalContent,
        signal.finalContent,
        signal.feedbackText,
        insforge
      );
    } else if (signal.signalType === "positive") {
      learnedInsight = derivePositiveInsight(signal.finalContent || signal.originalContent || "");
    } else if (signal.signalType === "deleted") {
      learnedInsight = "User rejected this style — avoid similar content in future";
    } else if (signal.signalType === "explicit" && signal.feedbackText) {
      learnedInsight = `User preference: ${signal.feedbackText}`;
    }

    await insforge.database.from("ai_memory").insert({
      user_id: userId,
      signal_type: signal.signalType,
      original_content: signal.originalContent?.slice(0, 1000) || null,
      final_content: signal.finalContent?.slice(0, 1000) || null,
      feedback_text: signal.feedbackText?.slice(0, 500) || null,
      learned_insight: learnedInsight?.slice(0, 500) || null,
      context_niche: signal.contextNiche || null,
      context_tone: signal.contextTone || null,
      post_id: signal.postId || null,
    });
  } catch (err: any) {
    // Non-fatal: memory recording should never break the main flow
    console.warn("[AI Memory] Failed to record signal:", err?.message || err);
  }
}

/**
 * Fetch the most recent memories for a user (max 15 for prompt efficiency).
 * Prioritizes: explicit > edited > positive > deleted
 */
export async function getUserMemoryContext(
  userId: string,
  insforge: any
): Promise<AIMemoryRow[]> {
  try {
    const { data, error } = await insforge.database
      .from("ai_memory")
      .select("*")
      .eq("user_id", userId)
      .not("learned_insight", "is", null)
      .order("created_at", { ascending: false })
      .limit(15);

    if (error) {
      console.warn("[AI Memory] Fetch error:", error.message);
      return [];
    }
    return (data as AIMemoryRow[]) || [];
  } catch (err: any) {
    console.warn("[AI Memory] Fetch exception:", err?.message || err);
    return [];
  }
}

/**
 * Build a formatted memory block to inject into AI system prompts.
 * Returns empty string if no memories (no impact on prompt).
 */
export function buildMemoryPromptBlock(memories: AIMemoryRow[]): string {
  if (!memories || memories.length === 0) return "";

  // Deduplicate insights and group by signal type
  const positiveInsights: string[] = [];
  const editInsights: string[] = [];
  const avoidInsights: string[] = [];
  const explicitPrefs: string[] = [];

  const seen = new Set<string>();
  for (const m of memories) {
    const insight = m.learned_insight?.trim();
    if (!insight || seen.has(insight)) continue;
    seen.add(insight);

    switch (m.signal_type) {
      case "positive":
        positiveInsights.push(`- ${insight}`);
        break;
      case "edited":
        editInsights.push(`- ${insight}`);
        break;
      case "deleted":
        avoidInsights.push(`- ${insight}`);
        break;
      case "explicit":
        explicitPrefs.push(`- ${insight}`);
        break;
    }
  }

  const sections: string[] = [];

  if (explicitPrefs.length > 0) {
    sections.push(`EXPLICIT USER PREFERENCES (highest priority):\n${explicitPrefs.join("\n")}`);
  }
  if (editInsights.length > 0) {
    sections.push(`LEARNED FROM PAST EDITS (apply strictly):\n${editInsights.join("\n")}`);
  }
  if (positiveInsights.length > 0) {
    sections.push(`CONTENT STYLES USER APPROVES:\n${positiveInsights.join("\n")}`);
  }
  if (avoidInsights.length > 0) {
    sections.push(`CONTENT STYLES TO AVOID:\n${avoidInsights.join("\n")}`);
  }

  if (sections.length === 0) return "";

  return `\n\n=== PERSONALIZED AI MEMORY (learned from this user's past interactions) ===\n${sections.join("\n\n")}\n=== END MEMORY ===\n`;
}

/**
 * Generate a 1-line insight from an edit using a minimal Gemini call.
 * This is extremely cheap (~100 tokens max).
 */
async function generateInsight(
  original: string,
  edited: string,
  feedbackText: string | undefined,
  insforge: any
): Promise<string | null> {
  try {
    const prompt = `A user edited an AI-generated social media post.

ORIGINAL: "${original.slice(0, 300)}"
EDITED TO: "${edited.slice(0, 300)}"${feedbackText ? `\nUSER COMMENT: "${feedbackText}"` : ""}

In ONE short sentence (max 15 words), what did the user prefer differently?
Examples: "User prefers shorter sentences" / "User wants casual tone, not formal" / "User adds specific numbers/stats"

Answer:`;

    const completion = await insforge.ai.chat.completions.create({
      model: "google/gemini-3.8-flash",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 60,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";
    // Clean any quotes or extra formatting
    return raw.replace(/^["']|["']$/g, "").trim() || null;
  } catch {
    // Fallback: derive simple insight without AI
    return deriveEditInsight(original, edited);
  }
}

/**
 * Simple rule-based insight for edits (fallback when Gemini fails).
 */
function deriveEditInsight(original: string, edited: string): string {
  const origLen = original.length;
  const editLen = edited.length;

  if (editLen < origLen * 0.6) return "User prefers shorter, more concise posts";
  if (editLen > origLen * 1.4) return "User prefers more detailed, longer posts";

  const origHashtags = (original.match(/#[a-zA-Z0-9_]+/g) || []).length;
  const editHashtags = (edited.match(/#[a-zA-Z0-9_]+/g) || []).length;

  if (editHashtags < origHashtags) return "User prefers fewer hashtags";
  if (editHashtags > origHashtags) return "User prefers more hashtags";

  return "User refined the tone or wording of generated posts";
}

/**
 * Derive a simple positive insight from liked content.
 */
function derivePositiveInsight(content: string): string {
  const len = content.length;
  const hasQuestion = content.includes("?");
  const hashtagCount = (content.match(/#[a-zA-Z0-9_]+/g) || []).length;

  if (hasQuestion && len < 200) return "User likes short posts with question hooks";
  if (len < 150) return "User approves concise, punchy posts";
  if (hashtagCount >= 4) return "User likes posts with multiple relevant hashtags";
  return "User approved this content style and length";
}
