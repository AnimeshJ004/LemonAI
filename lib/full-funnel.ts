import { researchMarketTrends } from "./trend-researcher";
import { generateAdScriptAndHooks } from "./ai-router";
import { generateAdCreativeImage } from "./ai-image-generator";

export interface FullFunnelRequest {
  businessName: string;
  niche: string;
  targetAudience: string;
  productOffer: string;
  goal?: "LEADS" | "SALES" | "AWARENESS";
  competitors?: string[];
  competitorSampleText?: string;
  targetRegion?: string;
  generateImages?: boolean;
  userId?: string;
}

export interface FullFunnelOutput {
  businessSummary: {
    name: string;
    niche: string;
    targetAudience: string;
    offer: string;
  };
  marketIntelligence: {
    topTrendingHooks: string[];
    primaryPainPoints: string[];
    competitorWeaknesses: string[];
    hashtags: string[];
  };
  metaAdCampaignPackage: {
    objective: string;
    suggestedAudienceTargeting: {
      ageRange: string;
      interests: string[];
    };
    adVariants: {
      headline: string;
      primaryText: string;
      callToAction: string;
      bannerImageUrl?: string | null;
      aspectRatio: "1:1" | "9:16";
    }[];
  };
  organicSocialPosts: {
    channelSuggestion: string;
    postText: string;
    suggestedHashtags: string[];
    imageUrl?: string | null;
  }[];
  costAndSavingsAnalytics: {
    totalEstimatedTokens: number;
    totalCostUSD: number;
    totalCostINR: number;
    savingsVsClaudeAgencyINR: number;
    executionTimeMs: number;
  };
}

/**
 * Autonomous 1-Click Marketing Funnel Generator
 * Combines Market Research + Direct Response Ad Copywriting + AI Visual Generation into a complete deployment-ready package.
 */
export async function runFullMarketingFunnel(params: FullFunnelRequest): Promise<FullFunnelOutput> {
  const startTime = Date.now();
  const generateImages = params.generateImages !== false;

  // Step 1: Run Market Trend & Competitor Intelligence (Parallel execution)
  const [trendRes, adScriptRes] = await Promise.all([
    researchMarketTrends({
      businessName: params.businessName,
      niche: params.niche,
      targetAudience: params.targetAudience,
      competitors: params.competitors,
      competitorSampleText: params.competitorSampleText,
      targetRegion: params.targetRegion,
    }),
    generateAdScriptAndHooks({
      businessName: params.businessName,
      niche: params.niche,
      targetAudience: params.targetAudience,
      productOffer: params.productOffer,
      goal: params.goal || "LEADS",
    }),
  ]);

  const trends = trendRes.data;
  const campaignData = adScriptRes.data;

  // Step 2: Generate AI Creative Banners if requested
  const adVariants = campaignData?.adVariants || [
    {
      headline: `Transform with ${params.businessName}`,
      primaryText: `Looking for top-tier ${params.niche}? ${params.productOffer}. Book today!`,
      callToAction: "Learn More",
      visualBannerPrompt: `Modern high-end commercial advertising photo representing ${params.niche}, sleek lighting, ultra-detailed`,
      aspectRatio: "1:1" as const,
    },
  ];

  let squareImageUrl: string | null = null;
  let verticalImageUrl: string | null = null;

  if (generateImages && adVariants.length > 0) {
    const prompt1 = adVariants[0]?.visualBannerPrompt || `${params.niche} commercial photography banner`;
    const [squareImg, verticalImg] = await Promise.allSettled([
      generateAdCreativeImage({
        prompt: prompt1,
        aspectRatio: "1:1",
        userId: params.userId,
        niche: params.niche,
      }),
      generateAdCreativeImage({
        prompt: prompt1,
        aspectRatio: "9:16",
        userId: params.userId,
        niche: params.niche,
      }),
    ]);

    if (squareImg.status === "fulfilled" && squareImg.value.imageUrl) {
      squareImageUrl = squareImg.value.imageUrl;
    }
    if (verticalImg.status === "fulfilled" && verticalImg.value.imageUrl) {
      verticalImageUrl = verticalImg.value.imageUrl;
    }
  }

  // Step 3: Format Meta Ad variants with images
  const formattedAdVariants = adVariants.map((v, idx) => ({
    headline: v.headline,
    primaryText: v.primaryText,
    callToAction: v.callToAction || "Learn More",
    bannerImageUrl: idx === 0 ? squareImageUrl : verticalImageUrl || squareImageUrl,
    aspectRatio: v.aspectRatio || "1:1",
  }));

  // Step 4: Format Organic Social Posts
  const organicSocialPosts = (trends?.topTrendingHooks || []).slice(0, 3).map((hookObj, idx) => ({
    channelSuggestion: idx === 0 ? "Instagram" : idx === 1 ? "LinkedIn / Facebook" : "Twitter / X",
    postText: `${hookObj.hook}\n\nAt ${params.businessName}, we help ${params.targetAudience} achieve their goals. Here's what sets our approach apart:\n• Proven results\n• Tailored solutions for ${params.niche}\n\n👉 ${params.productOffer}!`,
    suggestedHashtags: trends?.recommendedHashtags || ["#growth", "#marketing"],
    imageUrl: squareImageUrl || null,
  }));

  // Step 5: Calculate Aggregate Cost & Savings
  const totalTokens = (trendRes.metrics.estimatedTokens || 0) + (adScriptRes.metrics.estimatedTokens || 0);
  const totalCostUSD = (trendRes.metrics.costUSD || 0) + (adScriptRes.metrics.costUSD || 0);
  const totalCostINR = Number(((trendRes.metrics.costINR || 0) + (adScriptRes.metrics.costINR || 0)).toFixed(4));
  const savingsINR = Number(((trendRes.metrics.savingsVsClaudeINR || 0) + (adScriptRes.metrics.savingsVsClaudeINR || 0)).toFixed(4));

  return {
    businessSummary: {
      name: params.businessName,
      niche: params.niche,
      targetAudience: params.targetAudience,
      offer: params.productOffer,
    },
    marketIntelligence: {
      topTrendingHooks: trends?.topTrendingHooks.map((h) => h.hook) || [],
      primaryPainPoints: trends?.audiencePainPoints.map((p) => p.painPoint) || [],
      competitorWeaknesses: trends?.competitorWeaknessesToExploit || [],
      hashtags: trends?.recommendedHashtags || [],
    },
    metaAdCampaignPackage: {
      objective: campaignData?.campaignObjective || params.goal || "LEADS",
      suggestedAudienceTargeting: {
        ageRange: campaignData?.targetAgeRange || "22-45",
        interests: campaignData?.targetInterests || [params.niche, "Online Shopping", "Professional Services"],
      },
      adVariants: formattedAdVariants,
    },
    organicSocialPosts,
    costAndSavingsAnalytics: {
      totalEstimatedTokens: totalTokens,
      totalCostUSD,
      totalCostINR,
      savingsVsClaudeAgencyINR: savingsINR,
      executionTimeMs: Date.now() - startTime,
    },
  };
}
