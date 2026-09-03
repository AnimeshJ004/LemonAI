import { routeAICall, constrainPrompt } from "./ai-router";

export interface TrendResearchParams {
  businessName: string;
  niche: string;
  targetAudience: string;
  competitors?: string[];
  competitorSampleText?: string;
  targetRegion?: string;
}

export interface TrendResearchResult {
  niche: string;
  targetRegion: string;
  topTrendingHooks: {
    hook: string;
    hookType: "PATTERN_INTERRUPT" | "QUESTION" | "STATISTIC" | "STORY" | "PAIN_POINT";
    targetEmotion: string;
    whyItWorks: string;
  }[];
  audiencePainPoints: {
    painPoint: string;
    agitation: string;
    proposedSolutionAngle: string;
  }[];
  competitorWeaknessesToExploit: string[];
  recommendedContentAngles: {
    angleTitle: string;
    suggestedFormat: "REEL" | "CAROUSEL" | "FEED_POST" | "META_AD";
    shortHook: string;
  }[];
  recommendedHashtags: string[];
}

/**
 * AI Trend & Competitor Intelligence Engine
 * Reverse engineers winning social media angles and competitor ad strategies for any niche.
 */
export async function researchMarketTrends(params: TrendResearchParams) {
  const region = params.targetRegion || "India & Global";
  const competitorsText = params.competitors && params.competitors.length > 0 
    ? `Key Competitors: ${params.competitors.join(", ")}` 
    : "";

  return routeAICall<TrendResearchResult>({
    task: "COMPETITOR_RESEARCH",
    preferredTier: "TIER_2_SMART",
    jsonMode: true,
    systemPrompt: `You are a Senior Viral Social Media & Performance Marketing Strategist.
Analyze current high-performing market trends, viral competitor hooks, and buyer psychology for the given industry.
Return ONLY valid JSON with this exact schema:
{
  "niche": "${params.niche}",
  "targetRegion": "${region}",
  "topTrendingHooks": [
    {
      "hook": "Scroll-stopping first 3 seconds hook",
      "hookType": "PATTERN_INTERRUPT",
      "targetEmotion": "Curiosity/FOMO/Relief",
      "whyItWorks": "Psychological explanation of high CTR"
    }
  ],
  "audiencePainPoints": [
    {
      "painPoint": "Deep frustration or problem customer faces",
      "agitation": "Why waiting or choosing wrong option makes it worse",
      "proposedSolutionAngle": "How the business position solves it uniquely"
    }
  ],
  "competitorWeaknessesToExploit": [
    "Weakness 1 in generic competitor messaging",
    "Weakness 2 in competitor offer or customer experience"
  ],
  "recommendedContentAngles": [
    {
      "angleTitle": "Angle concept",
      "suggestedFormat": "META_AD",
      "shortHook": "Catchy starting line"
    }
  ],
  "recommendedHashtags": ["#Tag1", "#Tag2", "#Tag3", "#Tag4", "#Tag5"]
}`,
    userPrompt: `Business Name: ${params.businessName}
Industry / Niche: ${params.niche}
Target Audience: ${params.targetAudience}
Target Geography / Region: ${region}
${competitorsText}
${params.competitorSampleText ? `Competitor Ad Copy Sample: ${constrainPrompt(params.competitorSampleText, 1500)}` : ""}`,
  });
}
