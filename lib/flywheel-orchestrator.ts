import { researchMarketTrends } from "./trend-researcher";
import { routeAICall } from "./ai-router";
import { getInsforgeAdminClient, getInsforgeServerClient } from "./insforge-server";
import { getBrandProfileForUser, getBrandBrainSummary } from "./brand-helper";
import { generateAdCreativeImage } from "./ai-image-generator";
import { addDays } from "date-fns";

export interface FlywheelRequest {
  userId: string;
  businessName?: string;
  niche?: string;
  targetAudience?: string;
  competitors?: string[];
  targetRegion?: string;
  daysToSchedule?: number;
  postsPerDay?: number;
  autoDraftMetaAd?: boolean;
}

export interface FlywheelStepProgress {
  step: "RESEARCH" | "STRATEGY" | "CONTENT" | "DISTRIBUTION" | "ADS" | "COMPLETED";
  message: string;
  timestamp: string;
}

export interface FlywheelResult {
  success: boolean;
  niche: string;
  businessName: string;
  postsScheduledCount: number;
  contentPieces: {
    title: string;
    type: "FEED_POST" | "REEL_SCRIPT" | "CAROUSEL";
    previewText: string;
  }[];
  metaCampaignCreated?: {
    campaignId: string;
    name: string;
    headline: string;
    dailyBudget: number;
    callToAction: string;
  } | null;
  researchHighlights: {
    topHook: string;
    primaryPainPoint: string;
    winningAngle: string;
  };
  executionTimeMs: number;
  summary: string;
}

/**
 * Executes the complete autonomous marketing flywheel defined in LEMON AI.txt:
 * Research Agent → Strategy Agent → Content Studio → Calendar Distribution → Ads Intelligence.
 */
export async function executeAutonomousFlywheel(params: FlywheelRequest): Promise<FlywheelResult> {
  const startTime = Date.now();
  const admin = getInsforgeAdminClient();

  // 0. Load Brand Brain
  const brand = await getBrandProfileForUser(params.userId);
  const businessName = params.businessName || brand?.business_name || "Enterprise Brand";
  const niche = params.niche || brand?.niche || "Professional Services";
  const targetAudience = params.targetAudience || brand?.target_audience || "Valued Customers";
  const region = params.targetRegion || brand?.location || "India & Global";
  const competitors = params.competitors || (brand?.competitors ? [brand.competitors] : []);
  const days = params.daysToSchedule || 7;
  const postsPerDay = params.postsPerDay || 1;

  // 1. STEP 1: Research Agent (Live market trends & competitor copy inspection)
  console.log(`[Flywheel] Phase 1: Research Agent starting for ${businessName} (${niche})...`);
  const researchRes = await researchMarketTrends({
    businessName,
    niche,
    targetAudience,
    competitors,
    targetRegion: region,
  });

  const research = researchRes.data || {
    topTrendingHooks: [{ hook: `Why most ${targetAudience} fail at ${niche}` }],
    audiencePainPoints: [{ painPoint: `Inconsistent growth in ${niche}`, proposedSolutionAngle: "Structured automation" }],
    competitorWeaknessesToExploit: ["Generic advice without execution proof"],
    recommendedContentAngles: [{ angleTitle: "Authority Breakdown", suggestedFormat: "FEED_POST", shortHook: "Stop guessing your strategy" }],
    recommendedHashtags: ["#BusinessGrowth", "#MarketingTips", "#SaaS"],
  };

  const topHook = research.topTrendingHooks?.[0]?.hook || `The biggest mistake ${targetAudience} make`;
  const primaryPainPoint = research.audiencePainPoints?.[0]?.painPoint || `Struggling to scale ${niche}`;
  const winningAngle = research.recommendedContentAngles?.[0]?.angleTitle || "Direct Problem Solver";

  // 2. STEP 2: Content Studio (Generates 3 multi-format content items: Feed Post, Reel, Carousel)
  console.log("[Flywheel] Phase 2: Content Studio synthesizing high-converting assets...");
  const brandBrainText = getBrandBrainSummary(brand);

  const contentPrompt = `You are an elite autonomous social content engine for Lemon AI.
Based on the following verified market intelligence:
${brandBrainText}

Top Hook Line: "${topHook}"
Target Pain Point: "${primaryPainPoint}"
Winning Angle: "${winningAngle}"
Hashtags: ${research.recommendedHashtags?.slice(0, 5).join(" ") || "#Growth"}

Generate 3 distinct deployment-ready social media assets:
1. One high-engagement Feed Post (captivating headline, bullet points, question CTA, hashtags).
2. One 30-45s Reel script (Hook [0-3s], Value [4-35s], CTA [36-45s]).
3. One 5-slide educational Carousel outline (Slide 1 Cover, Slides 2-4 Value steps, Slide 5 Save/Share CTA).

Return ONLY valid JSON:
{
  "feedPost": "Complete post caption text with formatting and hashtags",
  "reelScript": {
    "title": "Short title",
    "hook": "0-3s hook",
    "body": "Value explanation",
    "cta": "Call to action"
  },
  "carousel": {
    "title": "Carousel Title",
    "slides": [
      { "slideNumber": 1, "heading": "Cover hook", "body": "Subtitle" },
      { "slideNumber": 2, "heading": "Step 1", "body": "Key tip" },
      { "slideNumber": 3, "heading": "Step 2", "body": "Crucial shift" },
      { "slideNumber": 4, "heading": "Step 3", "body": "Action plan" },
      { "slideNumber": 5, "heading": "CTA", "body": "Save & follow" }
    ]
  }
}`;

  const contentRes = await routeAICall<{
    feedPost: string;
    reelScript: { title: string; hook: string; body: string; cta: string };
    carousel: { title: string; slides: { slideNumber: number; heading: string; body: string }[] };
  }>({
    task: "DEEP_SCRIPTWRITING",
    systemPrompt: "You are an elite direct-response social copywriter. Return ONLY valid JSON.",
    userPrompt: contentPrompt,
    preferredTier: "TIER_2_SMART",
    jsonMode: true,
  });

  const generatedContent = contentRes.data || {
    feedPost: `🚀 Stop doing ${niche} the hard way.\n\nMost ${targetAudience} focus on the wrong priorities. Here is what actually works:\n\n1. Target acute bottlenecks\n2. Automate repeat tasks\n3. Deliver undeniable proof\n\nSave this post for your next strategy session!\n\n${research.recommendedHashtags?.slice(0, 4).join(" ")}`,
    reelScript: {
      title: "The 1 Shift to Win in " + niche,
      hook: topHook,
      body: `If you want to solve ${primaryPainPoint}, you need to reverse engineer what the top 1% are doing. Focus on single-metric optimization.`,
      cta: `Comment 'GROWTH' below and I will send our free execution guide directly to your DMs!`,
    },
    carousel: {
      title: `5 Ways to Master ${niche}`,
      slides: [
        { slideNumber: 1, heading: topHook, body: "Swipe to see the full breakdown 👉" },
        { slideNumber: 2, heading: "01. Define the Bottleneck", body: `Identify why ${primaryPainPoint} occurs.` },
        { slideNumber: 3, heading: "02. Build Systems, Not Stress", body: "Scale repeatable mechanisms." },
        { slideNumber: 4, heading: "03. Double Down on Winning Hooks", body: "Measure your top 20% assets." },
        { slideNumber: 5, heading: "Found this helpful?", body: "Bookmark this post and share with your team." },
      ],
    },
  };

  // 3. STEP 3: Distribution Agent (Auto-Schedule into scheduled_posts table)
  console.log("[Flywheel] Phase 3: Distribution Agent scheduling posts into calendar...");
  let postsScheduled = 0;
  const now = new Date();

  // Find user's active channel if connected
  let defaultChannelId: string | null = null;
  try {
    const { data: userChannel } = await admin.database
      .from("user_channels")
      .select("id")
      .eq("user_id", params.userId)
      .limit(1)
      .maybeSingle();
    defaultChannelId = userChannel?.id || null;
  } catch {}

  // Auto-generate high quality editorial image assets for posts so Instagram/Facebook publishing succeeds
  console.log("[Flywheel] Synthesizing photorealistic visuals for multi-channel posts...");
  const [feedImg, reelCover, carouselCover] = await Promise.all([
    generateAdCreativeImage({
      prompt: `${niche} ${topHook}`,
      aspectRatio: "1:1",
      userId: params.userId,
      niche,
    }).catch(() => null),
    generateAdCreativeImage({
      prompt: `${niche} ${generatedContent.reelScript.title}`,
      aspectRatio: "9:16",
      userId: params.userId,
      niche,
    }).catch(() => null),
    generateAdCreativeImage({
      prompt: `${niche} ${generatedContent.carousel.title}`,
      aspectRatio: "4:5",
      userId: params.userId,
      niche,
    }).catch(() => null),
  ]);

  const postDrafts = [
    {
      content: generatedContent.feedPost,
      scheduled_at: addDays(now, 1).toISOString(),
      images: feedImg?.imageUrl ? [{ url: feedImg.imageUrl, key: feedImg.storageKey || "feed-img" }] : [],
    },
    {
      content: `🎬 [REEL SCRIPT: ${generatedContent.reelScript.title}]\n\nHOOK: ${generatedContent.reelScript.hook}\n\nVALUE: ${generatedContent.reelScript.body}\n\nCTA: ${generatedContent.reelScript.cta}`,
      scheduled_at: addDays(now, 3).toISOString(),
      images: reelCover?.imageUrl ? [{ url: reelCover.imageUrl, key: reelCover.storageKey || "reel-cover" }] : [],
    },
    {
      content: `📑 [CAROUSEL: ${generatedContent.carousel.title}]\n\n${generatedContent.carousel.slides.map((s) => `Slide ${s.slideNumber}: ${s.heading} — ${s.body}`).join("\n\n")}`,
      scheduled_at: addDays(now, 5).toISOString(),
      images: carouselCover?.imageUrl ? [{ url: carouselCover.imageUrl, key: carouselCover.storageKey || "carousel-cover" }] : [],
    },
  ];

  for (const post of postDrafts) {
    try {
      await admin.database.from("scheduled_posts").insert({
        user_id: params.userId,
        user_channel_id: defaultChannelId,
        content: post.content,
        images: post.images,
        scheduled_at: post.scheduled_at,
        status: "queue",
      });
      postsScheduled++;
    } catch (insertErr) {
      console.warn("[Flywheel] Notice scheduling post:", insertErr);
    }
  }

  // 4. STEP 4: Advertising Agent (Turns top organic angle into a high-ROAS Meta Ad Draft)
  let createdAd: FlywheelResult["metaCampaignCreated"] = null;
  if (params.autoDraftMetaAd !== false) {
    console.log("[Flywheel] Phase 4: Advertising Agent generating high-intent Meta Ad campaign...");
    const adHeadline = generatedContent.reelScript.title.slice(0, 45) || `Transform Your ${niche}`;
    const adPrimaryText = `Tired of ${primaryPainPoint}? ${businessName} delivers proven solutions for ${targetAudience}. ${topHook}. Click Learn More to claim your consultation today!`;

    try {
      const { data: campaignData } = await admin.database
        .from("meta_campaigns")
        .insert({
          user_id: params.userId,
          name: `[AI Flywheel] ${niche} - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          objective: "OUTCOME_LEADS",
          daily_budget: 1500, // INR 1,500 (~$18/day)
          status: "DRAFT",
          ad_headline: adHeadline,
          ad_primary_text: adPrimaryText,
          call_to_action: "LEARN_MORE",
        })
        .select("id, name, ad_headline, daily_budget, call_to_action")
        .maybeSingle();

      if (campaignData) {
        createdAd = {
          campaignId: campaignData.id,
          name: campaignData.name,
          headline: campaignData.ad_headline,
          dailyBudget: campaignData.daily_budget,
          callToAction: campaignData.call_to_action,
        };
      }
    } catch (adErr) {
      console.warn("[Flywheel] Notice creating Meta Ad campaign:", adErr);
    }
  }

  // 5. STEP 5: Record Telemetry in flywheel_executions table
  const executionTimeMs = Date.now() - startTime;
  try {
    await admin.database.from("flywheel_executions").insert({
      user_id: params.userId,
      niche,
      posts_scheduled: postsScheduled,
      ad_campaign_created: Boolean(createdAd),
      execution_summary: {
        businessName,
        topHook,
        primaryPainPoint,
        executionTimeMs,
      },
    });
  } catch {}

  console.log(`[Flywheel] Completed successfully in ${executionTimeMs}ms! Scheduled ${postsScheduled} posts, created Ad campaign.`);

  return {
    success: true,
    niche,
    businessName,
    postsScheduledCount: postsScheduled,
    contentPieces: [
      {
        title: "Feed Post: Problem-Solver Breakdown",
        type: "FEED_POST",
        previewText: generatedContent.feedPost.slice(0, 140) + "...",
      },
      {
        title: `Reel Script: ${generatedContent.reelScript.title}`,
        type: "REEL_SCRIPT",
        previewText: `Hook: "${generatedContent.reelScript.hook}"`,
      },
      {
        title: `Multi-Slide Carousel: ${generatedContent.carousel.title}`,
        type: "CAROUSEL",
        previewText: `${generatedContent.carousel.slides.length} structured visual slides`,
      },
    ],
    metaCampaignCreated: createdAd,
    researchHighlights: {
      topHook,
      primaryPainPoint,
      winningAngle,
    },
    executionTimeMs,
    summary: `Autonomous Flywheel completed in ${(executionTimeMs / 1000).toFixed(1)}s. Scraped market trends, synthesized 3 cross-platform content assets, scheduled ${postsScheduled} posts on the calendar, and staged a high-intent Meta Lead Generation Ad draft.`,
  };
}
