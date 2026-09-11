import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { callResilientCompletion } from "@/lib/ai-gateway";

/**
 * POST /api/onboarding/generate-question
 * Uses Gemini / Groq via AI gateway to generate a smart contextual
 * follow-up question based on previous answers from the onboarding wizard.
 *
 * Body: {
 *   questionIndex: number       // Which follow-up question (0, 1, 2)
 *   answers: Record<string, string>  // All answers collected so far
 * }
 *
 * Returns: {
 *   question: string
 *   placeholder: string
 *   hint: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { questionIndex = 0, answers = {} } = body;

    // Build a summary of what we know so far
    const answersText = Object.entries(answers)
      .filter(([, v]) => v?.toString().trim())
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");

    const prompt = `You are an AI business intelligence assistant onboarding a new user to a social media management platform called Lemon AI.

Here is what the user has told us about their business so far:
${answersText || "(No answers yet)"}

Generate follow-up question #${questionIndex + 1} that would help the AI better understand and serve this specific business.

Rules:
- Ask about something NOT already covered above
- Keep it concise and specific to their business type
- Make it feel natural and conversational, not like a form field
- Focus on: pricing model, content style preferences, biggest marketing challenge, or growth stage

Respond with ONLY a valid JSON object in this exact format (no markdown, no extra text):
{"question": "...", "placeholder": "e.g. ...", "hint": "Why we ask: ..."}`;

    const completion = await callResilientCompletion<{
      question: string;
      placeholder: string;
      hint: string;
    }>({
      jsonMode: true,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 150,
    });

    const raw = completion.content?.trim() || "";

    // Parse the JSON response
    let parsed: { question: string; placeholder: string; hint: string };
    try {
      // Remove potential markdown code fences
      const cleaned = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback if AI response isn't valid JSON
      const fallbacks = [
        {
          question: "What's your biggest marketing challenge right now?",
          placeholder: "e.g. Getting consistent leads, building brand awareness...",
          hint: "Why we ask: Helps us tailor AI-generated content to solve your real pain points",
        },
        {
          question: "How would you describe your brand's personality in 3 words?",
          placeholder: "e.g. Bold, innovative, approachable",
          hint: "Why we ask: Shapes the tone and voice of all your AI-generated posts",
        },
        {
          question: "What type of content performs best for your brand?",
          placeholder: "e.g. Educational how-tos, behind-the-scenes, testimonials...",
          hint: "Why we ask: The AI will prioritize these formats when generating your posts",
        },
      ];
      parsed = fallbacks[questionIndex % fallbacks.length];
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("[Onboarding Generate Question] Error:", error);

    // Return a safe fallback question on error
    return NextResponse.json({
      question: "What's your biggest challenge in growing your business?",
      placeholder: "e.g. Finding new customers, building brand trust, scaling...",
      hint: "Why we ask: Lets the AI focus your content strategy on what matters most",
    });
  }
}
