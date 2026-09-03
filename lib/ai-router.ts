import { getInsforgeServerClient, getInsforgeAdminClient } from "@/lib/insforge-server";

/**
 * Multi-Tier Budget-Friendly LLM Cost Router
 * Designed to deliver high quality AI outputs while keeping client API bills minimal (< ₹1 per generation).
 */

export type AITier = "TIER_1_FAST" | "TIER_2_SMART";

export type AITaskType =
  | "FAST_CLASSIFICATION"
  | "HASHTAG_EXTRACTION"
  | "JSON_CLEANUP"
  | "QUICK_IDEA"
  | "SHORTEN_REPHRASE"
  | "DEEP_SCRIPTWRITING"
  | "AD_COPY_HOOKS"
  | "COMPETITOR_RESEARCH"
  | "FULL_FUNNEL"
  | "CAMPAIGN_TARGETING";

export interface AIModelConfig {
  name: string;
  tier: AITier;
  inputCostPer1M: number; // in USD
  outputCostPer1M: number; // in USD
  maxTokens: number;
}

// Model registry optimized for low-cost SaaS operation
export const MODEL_REGISTRY: Record<string, AIModelConfig> = {
  // Tier 1: Ultra-Low Cost / Fast (~₹0.01 - ₹0.02 per request)
  "google/gemini-2.5-flash-lite": {
    name: "google/gemini-2.5-flash-lite",
    tier: "TIER_1_FAST",
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.30,
    maxTokens: 4096,
  },
  // Tier 2: High Intelligence / Gemini 3.7 Flash & 2.5 Flash (~₹0.04 - ₹0.08 per request)
  "google/gemini-3.7-flash": {
    name: "google/gemini-3.7-flash",
    tier: "TIER_2_SMART",
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
    maxTokens: 8192,
  },
  "google/gemini-3.7-flash-thinking": {
    name: "google/gemini-3.7-flash-thinking",
    tier: "TIER_2_SMART",
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
    maxTokens: 8192,
  },
  "google/gemini-2.5-flash": {
    name: "google/gemini-2.5-flash",
    tier: "TIER_2_SMART",
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
    maxTokens: 8192,
  },
  "deepseek/deepseek-chat": {
    name: "deepseek/deepseek-chat",
    tier: "TIER_2_SMART",
    inputCostPer1M: 0.14,
    outputCostPer1M: 0.28,
    maxTokens: 8192,
  },
};

// Default tier assignment by task complexity
export const TASK_TIER_MAPPING: Record<AITaskType, AITier> = {
  FAST_CLASSIFICATION: "TIER_1_FAST",
  HASHTAG_EXTRACTION: "TIER_1_FAST",
  JSON_CLEANUP: "TIER_1_FAST",
  QUICK_IDEA: "TIER_1_FAST",
  SHORTEN_REPHRASE: "TIER_1_FAST",
  DEEP_SCRIPTWRITING: "TIER_2_SMART",
  AD_COPY_HOOKS: "TIER_2_SMART",
  COMPETITOR_RESEARCH: "TIER_2_SMART",
  FULL_FUNNEL: "TIER_2_SMART",
  CAMPAIGN_TARGETING: "TIER_2_SMART",
};

export interface AICallRequest {
  task: AITaskType;
  systemPrompt: string;
  userPrompt: string;
  preferredTier?: AITier;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface AICallResponse<T = any> {
  success: boolean;
  data: T | null;
  rawText: string;
  metrics: {
    model: string;
    tier: AITier;
    estimatedTokens: number;
    costUSD: number;
    costINR: number;
    savingsVsClaudeINR: number; // Demonstrates cost-efficiency to clients
    latencyMs: number;
  };
}

/**
 * Constrains and formats prompt length to prevent token wastage and oversized bills.
 */
export function constrainPrompt(text: string, maxCharacters = 4000): string {
  if (!text) return "";
  const cleaned = text.trim().replace(/\s+/g, " ");
  return cleaned.length > maxCharacters ? cleaned.slice(0, maxCharacters) + "..." : cleaned;
}

/**
 * Safely parses JSON from LLM response, stripping markdown backticks if present.
 */
export function cleanAndParseJSON<T = any>(text: string): T | null {
  if (!text) return null;
  try {
    let clean = text.trim();
    // Remove markdown code blocks like ```json ... ```
    if (clean.startsWith("```")) {
      clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    }
    return JSON.parse(clean.trim()) as T;
  } catch (err) {
    // Attempt relaxed extraction of first JSON object or array
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Routes AI request to the most cost-effective LLM based on task complexity.
 */
export async function routeAICall<T = any>(req: AICallRequest): Promise<AICallResponse<T>> {
  const startTime = Date.now();
  const tier = req.preferredTier || TASK_TIER_MAPPING[req.task] || "TIER_1_FAST";
  
  // Select optimal model: Gemini 3.7 / 2.5 Flash for Smart Tier, Gemini 2.5 Flash Lite for Fast Tier
  const candidateModels = tier === "TIER_1_FAST" 
    ? ["google/gemini-2.5-flash-lite"] 
    : ["google/gemini-3.7-flash", "google/gemini-2.5-flash", "deepseek/deepseek-chat"];

  const { insforge } = await getInsforgeServerClient().catch(() => ({
    insforge: getInsforgeAdminClient()
  }));

  let lastError: any = null;

  for (const modelToTry of candidateModels) {
    try {
      const result = await insforge.ai.chat.completions.create({
        model: modelToTry,
        messages: [
          {
            role: "system",
            content: req.systemPrompt + (req.jsonMode ? "\nReturn ONLY raw valid JSON without markdown formatting." : ""),
          },
          {
            role: "user",
            content: constrainPrompt(req.userPrompt),
          },
        ],
        temperature: req.temperature ?? (tier === "TIER_1_FAST" ? 0.3 : 0.7),
      });

      const rawText = result.choices[0]?.message?.content ?? "";
      const parsedData = req.jsonMode ? cleanAndParseJSON<T>(rawText) : (rawText as unknown as T);
      const latencyMs = Date.now() - startTime;

      // Estimate token usage & cost metrics
      const estInputTokens = Math.ceil((req.systemPrompt.length + req.userPrompt.length) / 4);
      const estOutputTokens = Math.ceil(rawText.length / 4);
      const totalTokens = estInputTokens + estOutputTokens;

      const modelConfig = MODEL_REGISTRY[modelToTry] || MODEL_REGISTRY["google/gemini-2.5-flash-lite"];
      const costUSD = (estInputTokens * modelConfig.inputCostPer1M + estOutputTokens * modelConfig.outputCostPer1M) / 1_000_000;
      const costINR = Number((costUSD * 86.5).toFixed(4));

      // Compare with Claude 3.5 Sonnet ($3.00/1M input + $15.00/1M output)
      const claudeCostUSD = (estInputTokens * 3.0 + estOutputTokens * 15.0) / 1_000_000;
      const claudeCostINR = Number((claudeCostUSD * 86.5).toFixed(4));
      const savingsVsClaudeINR = Number(Math.max(0, claudeCostINR - costINR).toFixed(4));

      return {
        success: true,
        data: parsedData,
        rawText,
        metrics: {
          model: modelToTry,
          tier,
          estimatedTokens: totalTokens,
          costUSD,
          costINR,
          savingsVsClaudeINR,
          latencyMs,
        },
      };
    } catch (err: any) {
      lastError = err;
      console.warn(`[AI Router] Model ${modelToTry} attempt notice, trying next candidate:`, err?.message || err);
    }
  }

  console.error(`[AI Router] All candidate models failed for task ${req.task}:`, lastError);

  return {
    success: false,
    data: null,
    rawText: "",
    metrics: {
      model: "google/gemini-2.5-flash-lite",
      tier,
      estimatedTokens: 0,
      costUSD: 0,
      costINR: 0,
      savingsVsClaudeINR: 0,
      latencyMs: Date.now() - startTime,
    },
  };
}

/**
 * Domain Helper 1: Fast & Cost-Effective Idea Generator
 */
export async function generateCostEffectiveIdeas(params: {
  businessType: string;
  targetAudience: string;
  tone?: string;
  count?: number;
}) {
  const count = params.count || 3;
  return routeAICall<{ ideas: { title: string; description: string; hook: string; suggestedVisual: string }[] }>({
    task: "QUICK_IDEA",
    jsonMode: true,
    systemPrompt: `You are a social media viral growth strategist.
Generate ${count} creative, practical content ideas for social media.
Return valid JSON format only:
{
  "ideas": [
    {
      "title": "Short catchy title",
      "hook": "Scroll-stopping first sentence",
      "description": "Brief post explanation and value delivery",
      "suggestedVisual": "Visual idea for image or reel"
    }
  ]
}`,
    userPrompt: `Business Niche: ${params.businessType}. Target Audience: ${params.targetAudience}. Tone: ${params.tone || "Professional yet engaging"}.`,
  });
}

/**
 * Domain Helper 2: High-Converting Ad Script & Hook Generator (Tier 2 Smart LLM)
 */
export async function generateAdScriptAndHooks(params: {
  businessName: string;
  niche: string;
  targetAudience: string;
  productOffer: string;
  goal?: "LEADS" | "SALES" | "AWARENESS";
  competitorAngle?: string;
}) {
  return routeAICall<{
    campaignObjective: string;
    targetAgeRange: string;
    targetInterests: string[];
    adVariants: {
      headline: string;
      primaryText: string;
      callToAction: string;
      visualBannerPrompt: string;
      aspectRatio: "1:1" | "9:16";
    }[];
  }>({
    task: "AD_COPY_HOOKS",
    jsonMode: true,
    systemPrompt: `You are a world-class Direct Response Copywriter and Meta Ads Specialist.
Create 2 high-converting Meta Ad variations with compelling hooks, persuasive body copy, and visual prompts for AI image generation.
Return valid JSON format only:
{
  "campaignObjective": "${params.goal || "LEADS"}",
  "targetAgeRange": "22-45",
  "targetInterests": ["Interest 1", "Interest 2", "Interest 3"],
  "adVariants": [
    {
      "headline": "Punchy 5-7 word headline with high CTR",
      "primaryText": "Persuasive ad copy solving customer pain point with strong call to action",
      "callToAction": "Learn More",
      "visualBannerPrompt": "Detailed descriptive visual prompt for AI image generator to create a banner without text",
      "aspectRatio": "1:1"
    }
  ]
}`,
    userPrompt: `Business: ${params.businessName} (${params.niche})
Target Audience: ${params.targetAudience}
Product/Offer: ${params.productOffer}
Goal: ${params.goal || "LEADS"}
${params.competitorAngle ? `Competitor Angle to outperform: ${params.competitorAngle}` : ""}`,
  });
}

/**
 * Domain Helper 3: Competitor & Trend Hook Extractor
 */
export async function analyzeCompetitorHooks(params: {
  competitorContent: string;
  industry: string;
}) {
  return routeAICall<{
    winningHooks: string[];
    painPointsAddressed: string[];
    suggestedAnglesToDifferentiate: string[];
  }>({
    task: "COMPETITOR_RESEARCH",
    jsonMode: true,
    systemPrompt: `You are a competitive intelligence marketing expert.
Analyze competitor ad copy and extract winning hooks, user pain points, and suggest better angles.
Return valid JSON format only:
{
  "winningHooks": ["Hook 1", "Hook 2"],
  "painPointsAddressed": ["Pain point 1", "Pain point 2"],
  "suggestedAnglesToDifferentiate": ["Unique angle 1", "Unique angle 2"]
}`,
    userPrompt: `Industry: ${params.industry}
Competitor Copy/Ad: ${constrainPrompt(params.competitorContent, 2000)}`,
  });
}
