import { routeAICall } from "./ai-router";
import { updateLead, Lead, BANTBreakdown } from "./crm-service";
import { triggerOutboundQualificationCall } from "./vapi-client";

export interface BANTEvaluationResult {
  score: number; // 1 to 10
  budgetScore: number;
  authorityScore: number;
  needScore: number;
  timingScore: number;
  reasoning: string;
  isQualified: boolean;
}

/**
 * Evaluates a conversation transcript or lead interaction using BANT framework
 * (Budget, Authority, Need, Timing) via low-latency Gemini LLM.
 */
export async function evaluateBANTLeadScore(params: {
  leadName?: string;
  company?: string;
  transcript: string;
  niche?: string;
}): Promise<BANTEvaluationResult> {
  const { leadName, company, transcript, niche } = params;

  if (!transcript || transcript.trim().length < 10) {
    return {
      score: 5,
      budgetScore: 5,
      authorityScore: 5,
      needScore: 5,
      timingScore: 5,
      reasoning: "Insufficient interaction history to formulate deep BANT score. Assigned baseline intent score.",
      isQualified: false,
    };
  }

  const systemPrompt = `You are an elite B2B and High-Ticket Lead Qualification AI Auditor.
Analyze the provided customer conversation and evaluate the lead using the BANT framework:
1. Budget (1-10): Does the lead have the budget, funds, or willingness to invest in high-tier solutions?
2. Authority (1-10): Is the lead a decision maker (Founder, CEO, VP, Director, Owner) or someone who controls purchasing?
3. Need (1-10): How acute is their pain point, problem, or demand for automation/social marketing?
4. Timing (1-10): What is their purchasing horizon? (Urgent/this month = 8-10; 6 months / casually browsing = 2-4).

Calculate overall score as: round((Budget * 0.3) + (Authority * 0.25) + (Need * 0.3) + (Timing * 0.15)) bounded between 1 and 10.

Output strictly JSON with this exact schema:
{
  "budgetScore": number (1-10),
  "authorityScore": number (1-10),
  "needScore": number (1-10),
  "timingScore": number (1-10),
  "overallScore": number (1-10),
  "reasoning": "1-2 sentences summarizing key factors and qualification verdict"
}`;

  const userPrompt = `Lead Name: ${leadName || "Unknown"}
Company: ${company || "Unknown"}
Industry Niche: ${niche || "General"}

Conversation History / Transcript:
${transcript}`;

  try {
    const aiResponse = await routeAICall<{
      budgetScore: number;
      authorityScore: number;
      needScore: number;
      timingScore: number;
      overallScore: number;
      reasoning: string;
    }>({
      task: "FAST_CLASSIFICATION",
      systemPrompt,
      userPrompt,
      preferredTier: "TIER_1_FAST",
      jsonMode: true,
      temperature: 0.2,
    });

    if (aiResponse.success && aiResponse.data) {
      const data = aiResponse.data;
      const score = Math.max(1, Math.min(10, Math.round(data.overallScore || 5)));
      return {
        score,
        budgetScore: Math.max(1, Math.min(10, data.budgetScore || 5)),
        authorityScore: Math.max(1, Math.min(10, data.authorityScore || 5)),
        needScore: Math.max(1, Math.min(10, data.needScore || 5)),
        timingScore: Math.max(1, Math.min(10, data.timingScore || 5)),
        reasoning: data.reasoning || "Scored via autonomous BANT evaluation.",
        isQualified: score >= 7,
      };
    }
  } catch (err) {
    console.error("Error evaluating BANT lead score:", err);
  }

  // Heuristic fallback
  const lower = transcript.toLowerCase();
  let score = 5;
  if (lower.includes("price") || lower.includes("cost") || lower.includes("demo") || lower.includes("quote")) score += 1;
  if (lower.includes("founder") || lower.includes("ceo") || lower.includes("owner") || lower.includes("director")) score += 2;
  if (lower.includes("urgent") || lower.includes("asap") || lower.includes("this month") || lower.includes("immediately")) score += 1;
  if (lower.includes("@") && /\d{3}/.test(lower)) score += 1;

  score = Math.min(10, score);
  return {
    score,
    budgetScore: score,
    authorityScore: score,
    needScore: score,
    timingScore: score,
    reasoning: `Calculated via heuristic pattern matching (Score: ${score}/10).`,
    isQualified: score >= 7,
  };
}

/**
 * Scores an existing lead, updates CRM record, and dispatches automated voice call if score >= 7.
 */
export async function scoreAndUpdateLead(
  lead: Lead,
  transcript: string,
  niche?: string
): Promise<{ lead: Lead; evaluation: BANTEvaluationResult }> {
  const evaluation = await evaluateBANTLeadScore({
    leadName: lead.name || undefined,
    company: lead.metadata?.company,
    transcript,
    niche,
  });

  const bantData: BANTBreakdown = {
    budgetScore: evaluation.budgetScore,
    authorityScore: evaluation.authorityScore,
    needScore: evaluation.needScore,
    timingScore: evaluation.timingScore,
    summary: evaluation.reasoning,
    evaluatedAt: new Date().toISOString(),
  };

  const currentMeta = lead.metadata || {};
  const updatedMeta = {
    ...currentMeta,
    bant: bantData,
  };

  // If score >= 7 and stage is 'new' or 'contacted', promote to 'qualified'
  const newStage = evaluation.isQualified && (lead.stage === "new" || lead.stage === "contacted")
    ? "qualified"
    : lead.stage;

  const updatedLead = await updateLead(
    lead.id,
    {
      score: evaluation.score,
      stage: newStage,
      metadata: updatedMeta,
    },
    lead.user_id
  );

  const finalLead = updatedLead || lead;

  // Trigger outbound voice calling agent if high intent (>= 7) and lead has phone
  if (evaluation.isQualified && finalLead.phone) {
    try {
      await triggerOutboundQualificationCall({
        leadId: finalLead.id,
        leadName: finalLead.name || "Customer",
        phone: finalLead.phone,
        company: finalLead.metadata?.company,
        userId: finalLead.user_id,
        contextNotes: evaluation.reasoning,
      });
    } catch (callErr) {
      console.warn("Could not dispatch automated voice call:", callErr);
    }
  }

  return { lead: finalLead, evaluation };
}
