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
  scrapedCompetitorContext?: string;
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
 * Scrapes live competitor websites or profiles to ground AI reasoning in real market copy.
 * Uses Jina Reader API with fast HTML extraction fallback.
 */
export async function scrapeCompetitorMetadata(urls: string[]): Promise<string> {
  if (!urls || urls.length === 0) return "";

  const cleanUrls = urls
    .map((u) => u.trim())
    .filter((u) => u.startsWith("http://") || u.startsWith("https://") || u.includes("."));

  if (cleanUrls.length === 0) return "";

  const results: string[] = [];

  for (const rawUrl of cleanUrls.slice(0, 3)) {
    const targetUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    try {
      // 1. Try Jina Reader API for clean Markdown extraction
      const jinaUrl = `https://r.jina.ai/${encodeURI(targetUrl)}`;
      const jinaRes = await fetch(jinaUrl, {
        headers: { Accept: "text/plain", "User-Agent": "LemonAI-CompetitorResearcher/1.0" },
        signal: AbortSignal.timeout(5000),
      });

      if (jinaRes.ok) {
        const text = await jinaRes.text();
        const snippet = text.replace(/\s+/g, " ").slice(0, 800);
        results.push(`[Competitor: ${targetUrl}]\n${snippet}`);
        continue;
      }
    } catch {
      // Fallback to direct fetch
    }

    try {
      const res = await fetch(targetUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const html = await res.text();
        // Extract title, description, and headings
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        const h1Matches = Array.from(html.matchAll(/<h[12][^>]*>([^<]+)<\/h[12]>/gi))
          .map((m) => m[1].trim())
          .slice(0, 3)
          .join(" | ");

        const parts = [
          titleMatch ? `Title: ${titleMatch[1].trim()}` : "",
          descMatch ? `Description: ${descMatch[1].trim()}` : "",
          h1Matches ? `Headlines: ${h1Matches}` : "",
        ].filter(Boolean);

        if (parts.length > 0) {
          results.push(`[Competitor: ${targetUrl}]\n${parts.join(" | ")}`);
        }
      }
    } catch {
      // Non-fatal if specific URL is unreachable
    }
  }

  return results.join("\n\n");
}

/**
 * AI Trend & Competitor Intelligence Engine
 * Reverse engineers winning social media angles and competitor strategies for any niche.
 */
export async function researchMarketTrends(params: TrendResearchParams) {
  const region = params.targetRegion || "India & Global";
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().toLocaleString("default", { month: "long" });

  // 1. Live Web Inspection / Scraping of competitor URLs if provided
  let liveScrapedText = "";
  if (params.competitors && params.competitors.length > 0) {
    try {
      liveScrapedText = await scrapeCompetitorMetadata(params.competitors);
    } catch (scrapeErr) {
      console.warn("[Trend Researcher] Competitor live scraping notice:", scrapeErr);
    }
  }

  const competitorsList = params.competitors && params.competitors.length > 0
    ? `Target Competitor Entities: ${params.competitors.join(", ")}`
    : "Key Competitors: Top 3 market leaders in this category";

  const competitorContext = [
    competitorsList,
    liveScrapedText ? `VERIFIED LIVE COMPETITOR COPY & POSITIONING:\n${liveScrapedText}` : "",
    params.competitorSampleText ? `User Provided Sample Copy: ${constrainPrompt(params.competitorSampleText, 1000)}` : "",
  ].filter(Boolean).join("\n\n");

  return routeAICall<TrendResearchResult>({
    task: "COMPETITOR_RESEARCH",
    preferredTier: "TIER_2_SMART",
    jsonMode: true,
    systemPrompt: `You are an elite Performance Marketing & Social Trend Intelligence Strategist (${currentMonth} ${currentYear}).
Ground your analysis in actual, active social media algorithms, current high-performing short-form video hooks (0-3s pattern interrupts), high-ROAS Meta Ads Library tactics, and buyer psychology.
${liveScrapedText ? "Analyze the provided VERIFIED LIVE COMPETITOR COPY to find specific gaps, exaggerated claims, or missing proofs that this brand can exploit." : ""}
Do not return generic advice. Return hyper-specific, actionable competitive intelligence.

Return ONLY valid JSON matching this schema:
{
  "niche": "${params.niche}",
  "targetRegion": "${region}",
  "topTrendingHooks": [
    {
      "hook": "Specific scroll-stopping first 3 seconds hook line",
      "hookType": "PATTERN_INTERRUPT",
      "targetEmotion": "Curiosity/Relief/Status",
      "whyItWorks": "Algorithm and psychological rationale"
    }
  ],
  "audiencePainPoints": [
    {
      "painPoint": "Specific frustrating bottleneck",
      "agitation": "Why current alternative solutions fail",
      "proposedSolutionAngle": "How this business positions its unique mechanism"
    }
  ],
  "competitorWeaknessesToExploit": [
    "Specific vulnerability identified in competitor copy or organic hooks",
    "Missing proof element in competitor offers"
  ],
  "recommendedContentAngles": [
    {
      "angleTitle": "Concept angle",
      "suggestedFormat": "REEL",
      "shortHook": "Hook opener"
    }
  ],
  "recommendedHashtags": ["#TrendingTag1", "#NicheTag2", "#ViralTag3", "#TargetTag4", "#GrowthTag5"]
}`,
    userPrompt: `Business Name: ${params.businessName}
Industry / Niche: ${params.niche}
Target Audience: ${params.targetAudience}
Target Geography / Region: ${region}
Current Period: ${currentMonth} ${currentYear}

${competitorContext}`,
  });
}
