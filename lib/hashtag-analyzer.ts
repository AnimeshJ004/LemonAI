import { routeAICall, constrainPrompt } from "./ai-router";
import { cleanTag } from "./brand-helper";

export interface HashtagIntelligenceOptions {
  brandProfile?: {
    business_name?: string;
    niche?: string;
    target_audience?: string;
    brand_tone?: string;
    main_offer?: string;
    location?: string;
    competitors?: string;
    products_services?: string;
  } | null;
  topicOrContent?: string;
  targetChannel?: string;
  region?: string;
}

export interface CategorizedHashtags {
  viral: string[];
  niche: string[];
  community: string[];
  branded: string[];
}

export interface HashtagIntelligenceResult {
  viralityScore: number;
  recommendedBundle: string[];
  categories: CategorizedHashtags;
  platformRules: {
    platform: string;
    optimalCount: string;
    recommendation: string;
  };
  reasoning: string;
  trendingContext?: string;
}

export function getPlatformHashtagRules(channelType?: string): {
  platform: string;
  optimalCount: string;
  maxCount: number;
  recommendation: string;
} {
  const type = (channelType || "instagram").toLowerCase();

  if (type.includes("linkedin")) {
    return {
      platform: "LinkedIn",
      optimalCount: "3-5",
      maxCount: 5,
      recommendation: "Use 3 to 5 targeted professional and industry hashtags at the end of your post for maximum algorithmic discoverability without appearing spammy.",
    };
  }
  if (type.includes("twitter") || type.includes("x")) {
    return {
      platform: "X / Twitter",
      optimalCount: "1-2",
      maxCount: 2,
      recommendation: "Use strictly 1 to 2 punchy, high-volume viral hashtags. The algorithm penalizes tweets with hashtag clutter and character count is limited.",
    };
  }
  if (type.includes("threads") || type.includes("bluesky")) {
    return {
      platform: "Threads / Bluesky",
      optimalCount: "1-2",
      maxCount: 2,
      recommendation: "Keep it minimal with 1 to 2 conversational discovery tags to maintain an authentic dialogue style.",
    };
  }
  if (type.includes("facebook")) {
    return {
      platform: "Facebook",
      optimalCount: "2-3",
      maxCount: 3,
      recommendation: "Use 2 to 3 community and location-focused tags to attract local and topical engagement.",
    };
  }
  if (type.includes("youtube")) {
    return {
      platform: "YouTube",
      optimalCount: "3-5",
      maxCount: 5,
      recommendation: "Place 3 to 5 search-intent and trending topic hashtags for Shorts discovery.",
    };
  }

  return {
    platform: "Instagram",
    optimalCount: "5-8",
    maxCount: 8,
    recommendation: "Use a curated cluster of 5 to 8 hashtags mixing broad viral reach, specific niche authority, and your branded tag at the bottom.",
  };
}

/**
 * Generates heuristic, profile-grounded viral hashtags when offline or as a fallback.
 */
export function generateHeuristicHashtags(options: HashtagIntelligenceOptions): HashtagIntelligenceResult {
  const { brandProfile, topicOrContent, targetChannel } = options;
  const businessName = brandProfile?.business_name || "Brand";
  const niche = brandProfile?.niche || "Business";
  const audience = brandProfile?.target_audience || "Entrepreneurs";
  const location = brandProfile?.location || "";

  const cleanBrand = cleanTag(businessName, "Brand");
  const cleanNiche = cleanTag(niche, "Business");
  const cleanAudience = cleanTag(audience.split(" ")[0], "Pro");
  const cleanLoc = cleanTag(location, "");

  const branded: string[] = [
    `#${cleanBrand}`,
    `#${cleanBrand}Official`,
    cleanLoc ? `#${cleanBrand}${cleanLoc}` : `#${cleanBrand}Team`,
  ].filter(Boolean);

  const nicheTags: string[] = [
    `#${cleanNiche}`,
    `#${cleanNiche}Tips`,
    `#${cleanNiche}Strategy`,
    `#${cleanNiche}Life`,
    `#${cleanNiche}Growth`,
    `#${cleanAudience}Tips`,
  ];

  const viralTags: string[] = [
    `#TrendingNow`,
    `#ViralReels`,
    `#BusinessGrowth`,
    `#ExplorePage`,
    `#Innovation`,
    `#GrowthMindset`,
  ];

  const communityTags: string[] = [
    `#${cleanNiche}Community`,
    `#DailyInspiration`,
    `#BehindTheScenes`,
    `#SuccessMindset`,
    cleanLoc ? `#${cleanLoc}Business` : `#CommunityFirst`,
  ].filter(Boolean);

  // If topic or content is provided, extract potential keyword tags
  if (topicOrContent) {
    const words = topicOrContent
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4 && !["about", "their", "there", "which", "would", "could"].includes(w));

    for (const w of words.slice(0, 3)) {
      const tag = `#${cleanTag(w)}`;
      if (tag.length > 3 && !nicheTags.includes(tag)) {
        nicheTags.unshift(tag);
      }
    }
  }

  const rules = getPlatformHashtagRules(targetChannel);
  const bundle: string[] = [];

  // Build balanced bundle according to platform limit
  if (branded[0]) bundle.push(branded[0]);
  if (nicheTags[0]) bundle.push(nicheTags[0]);
  if (nicheTags[1] && bundle.length < rules.maxCount) bundle.push(nicheTags[1]);
  if (viralTags[0] && bundle.length < rules.maxCount) bundle.push(viralTags[0]);
  if (communityTags[0] && bundle.length < rules.maxCount) bundle.push(communityTags[0]);
  if (viralTags[1] && bundle.length < rules.maxCount) bundle.push(viralTags[1]);
  if (nicheTags[2] && bundle.length < rules.maxCount) bundle.push(nicheTags[2]);

  return {
    viralityScore: 91,
    recommendedBundle: bundle.slice(0, rules.maxCount),
    categories: {
      viral: viralTags.slice(0, 6),
      niche: nicheTags.slice(0, 6),
      community: communityTags.slice(0, 5),
      branded: branded.slice(0, 3),
    },
    platformRules: rules,
    reasoning: `Selected high-velocity hashtags tailored to ${businessName}'s ${niche} niche, balancing discovery reach with targeted buyer engagement.`,
    trendingContext: `High algorithmic demand for ${niche} solutions among ${audience}.`,
  };
}

/**
 * Deep AI Viral Hashtag Intelligence Engine.
 * Analyzes the user's brand profile, niche, target audience, and active post content
 * to produce categorized, high-virality hashtags optimized for social algorithms.
 */
export async function analyzeViralHashtagsForProfile(
  options: HashtagIntelligenceOptions
): Promise<HashtagIntelligenceResult> {
  const { brandProfile, topicOrContent, targetChannel, region } = options;
  const rules = getPlatformHashtagRules(targetChannel);

  const businessName = brandProfile?.business_name || "My Business";
  const niche = brandProfile?.niche || "Professional Services";
  const targetAudience = brandProfile?.target_audience || "General Clients & Customers";
  const brandTone = brandProfile?.brand_tone || "High-Value & Engaging";
  const location = brandProfile?.location || region || "Global";
  const mainOffer = brandProfile?.main_offer || "Flagship Products / Services";
  const competitors = brandProfile?.competitors || "Top category leaders";

  const systemPrompt = `You are an elite Social Media Growth Scientist and Viral Algorithm Strategist.
Your expertise is reverse-engineering trending hashtags on Instagram, LinkedIn, X (Twitter), Facebook, and TikTok.

Analyze the given Brand Profile DNA and current post draft (if any).
Discover the highest-performing, trending, and viral hashtags specifically relevant to this entity.

Categorize the hashtags into 4 strategic buckets:
1. "viral": Broad reach, trending algorithm discovery tags (high search & explore page volume).
2. "niche": Hyper-targeted, high-intent niche hashtags for this specific industry and audience.
3. "community": High engagement, bookmark, share, and discussion triggers.
4. "branded": Custom brand authority tags (e.g. #${cleanTag(businessName)}, #${cleanTag(businessName)}Tips).

Also provide:
- "recommendedBundle": Exactly ${rules.optimalCount} hashtags balanced with 1 branded, 2-3 niche authority, and 1-2 viral discovery tags best suited for ${rules.platform}.
- "viralityScore": An integer between 85 and 99 representing the virality potential index.
- "reasoning": A 1-2 sentence breakdown explaining why this exact mix will beat algorithmic reach suppression.
- "trendingContext": A brief statement on what is currently trending in this niche.

Return ONLY a valid JSON object matching this schema:
{
  "viralityScore": 95,
  "recommendedBundle": ["#Tag1", "#Tag2", "#Tag3", "#Tag4", "#Tag5"],
  "categories": {
    "viral": ["#Trending1", "#Trending2", "#Trending3", "#Trending4", "#Trending5"],
    "niche": ["#Niche1", "#Niche2", "#Niche3", "#Niche4", "#Niche5"],
    "community": ["#Community1", "#Community2", "#Community3", "#Community4"],
    "branded": ["#BrandTag1", "#BrandTag2"]
  },
  "reasoning": "...",
  "trendingContext": "..."
}`;

  const userPrompt = `Brand Profile DNA:
- Business Name: ${businessName}
- Industry / Niche: ${niche}
- Target Audience: ${targetAudience}
- Tone of Voice: ${brandTone}
- Core Offer / Value Prop: ${mainOffer}
- Location / Target Market: ${location}
- Competitors / Space: ${competitors}
- Target Platform: ${rules.platform} (Optimal count: ${rules.optimalCount})
${topicOrContent ? `\nCurrent Post Draft / Topic: ${constrainPrompt(topicOrContent, 1000)}` : ""}`;

  try {
    const aiResponse = await routeAICall<{
      viralityScore: number;
      recommendedBundle: string[];
      categories: CategorizedHashtags;
      reasoning: string;
      trendingContext?: string;
    }>({
      task: "HASHTAG_EXTRACTION",
      preferredTier: "TIER_1_FAST",
      jsonMode: true,
      systemPrompt,
      userPrompt,
      temperature: 0.6,
    });

    if (aiResponse.success && aiResponse.data) {
      const data = aiResponse.data;

      // Clean all tags to ensure valid hashtag format #alphanumeric
      const sanitizeList = (list?: string[]): string[] => {
        if (!list || !Array.isArray(list)) return [];
        return list
          .map((t) => {
            const raw = String(t).trim();
            const clean = raw.replace(/^#+/, "").replace(/[^a-zA-Z0-9_]/g, "");
            return clean ? `#${clean}` : "";
          })
          .filter(Boolean);
      };

      const viral = sanitizeList(data.categories?.viral);
      const nicheList = sanitizeList(data.categories?.niche);
      const community = sanitizeList(data.categories?.community);
      const branded = sanitizeList(data.categories?.branded);
      let bundle = sanitizeList(data.recommendedBundle);

      if (bundle.length === 0) {
        bundle = [...branded.slice(0, 1), ...nicheList.slice(0, 3), ...viral.slice(0, 2)];
      }

      return {
        viralityScore: Math.min(100, Math.max(70, Number(data.viralityScore) || 92)),
        recommendedBundle: bundle.slice(0, rules.maxCount),
        categories: {
          viral: viral.length > 0 ? viral : [`#${cleanTag(niche)}Trends`, "#BusinessGrowth", "#ViralPost"],
          niche: nicheList.length > 0 ? nicheList : [`#${cleanTag(niche)}`, `#${cleanTag(niche)}Tips`],
          community: community.length > 0 ? community : [`#${cleanTag(niche)}Community`, "#SuccessMindset"],
          branded: branded.length > 0 ? branded : [`#${cleanTag(businessName, "Brand")}`],
        },
        platformRules: rules,
        reasoning: data.reasoning || `AI-curated viral hashtags aligned with ${businessName}'s ${niche} audience.`,
        trendingContext: data.trendingContext || `High search volume and conversation around ${niche}.`,
      };
    }
  } catch (error) {
    console.warn("[Hashtag Analyzer] AI call failed, falling back to heuristic engine:", error);
  }

  return generateHeuristicHashtags(options);
}
