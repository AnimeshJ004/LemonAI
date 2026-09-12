import { researchMarketTrends } from "./trend-researcher";
import { routeAICall } from "./ai-router";
import { getInsforgeAdminClient, getInsforgeServerClient } from "./insforge-server";
import { getBrandProfileForUser, getBrandBrainSummary, cleanTag } from "./brand-helper";
import {
  generateAdCreativeImage,
  CURATED_COMMERCIAL_PHOTOS,
  CURATED_VERTICAL_REELS,
} from "./ai-image-generator";
import { publishPostDirectly } from "./direct-publisher";
import { addDays } from "date-fns";
import { getPlatformPeakTime, adaptCaptionForPlatform, getPlatformStaggeredDate } from "./platform-adapt-helper";

export interface FlywheelRequest {
  userId: string;
  businessName?: string;
  niche?: string;
  targetAudience?: string;
  competitors?: string[];
  targetRegion?: string;
  daysToSchedule?: number;
  postsPerDay?: number;
  customTimeSlots?: string[];
  generateImages?: boolean;
  postStatus?: "queue" | "draft";
  autoDraftMetaAd?: boolean;
  selectedChannelIds?: string[];
  clientTimezoneOffset?: number;
  clientLocalToday?: { year: number; month: number; date: number };
  customMix?: {
    reelsCount?: number;
    imagePostsCount?: number;
    carouselsCount?: number;
  };
}

export interface FlywheelStepProgress {
  step: "RESEARCH" | "STRATEGY" | "CONTENT" | "DISTRIBUTION" | "ADS" | "COMPLETED";
  message: string;
  timestamp: string;
}

export interface FlywheelCarouselSlide {
  slideNumber: number;
  type: "COVER" | "CONTENT" | "CTA";
  headline: string;
  subtext?: string;
  bulletPoints?: string[];
  swipePrompt?: string;
}

export interface FlywheelTargetChannelResult {
  id: string;
  channelId: string;
  channelName: string;
  channelType: string;
  handle?: string;
  status: "published" | "queue" | "failed";
  publishedUrl?: string | null;
  errorMessage?: string | null;
}

export interface FlywheelContentPiece {
  id?: string;
  allPostIds?: string[];
  dayNumber: number;
  title: string;
  type: "FEED_POST" | "REEL_SCRIPT" | "CAROUSEL";
  previewText: string;
  caption: string;
  script?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  carouselSlides?: FlywheelCarouselSlide[];
  mediaPrompt?: string;
  status?: "published" | "queue" | "failed";
  publishedUrl?: string | null;
  channelName?: string;
  targetChannels?: FlywheelTargetChannelResult[];
  errorMessage?: string | null;
}

export interface FlywheelResult {
  success: boolean;
  niche: string;
  businessName: string;
  postsScheduledCount: number;
  contentPieces: FlywheelContentPiece[];
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
  const postsPerDay = params.postsPerDay || 1;

  // Build target format sequence based on user's custom mix (or balanced default)
  const requestedReels = params.customMix?.reelsCount !== undefined ? Math.max(0, params.customMix.reelsCount) : null;
  const requestedImages = params.customMix?.imagePostsCount !== undefined ? Math.max(0, params.customMix.imagePostsCount) : null;
  const requestedCarousels = params.customMix?.carouselsCount !== undefined ? Math.max(0, params.customMix.carouselsCount) : null;

  let targetFormats: ("REEL" | "IMAGE_POST" | "CAROUSEL")[] = [];

  if (requestedReels !== null || requestedImages !== null || requestedCarousels !== null) {
    const reels = requestedReels ?? 0;
    const images = requestedImages ?? 0;
    const carousels = requestedCarousels ?? 0;

    for (let r = 0; r < reels; r++) targetFormats.push("REEL");
    for (let img = 0; img < images; img++) targetFormats.push("IMAGE_POST");
    for (let car = 0; car < carousels; car++) targetFormats.push("CAROUSEL");

    if (targetFormats.length === 0) {
      targetFormats = Array(params.daysToSchedule || 7).fill("IMAGE_POST");
    }
  } else {
    const defaultDays = params.daysToSchedule || 7;
    const defaultRotation: ("REEL" | "IMAGE_POST" | "CAROUSEL")[] = ["REEL", "IMAGE_POST", "CAROUSEL"];
    targetFormats = Array.from({ length: defaultDays }, (_, i) => defaultRotation[i % defaultRotation.length]);
  }

  const days = targetFormats.length;

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

  // 2. STEP 2: Content Studio (Synthesizes dynamic multi-day content pieces: Reels, Image Posts, Carousels)
  console.log(`[Flywheel] Phase 2: Content Studio synthesizing ${days}-day cross-platform content assets (Formats: ${targetFormats.join(", ")})...`);
  const brandBrainText = getBrandBrainSummary(brand);

  const formatListText = targetFormats.map((f, i) => `Day ${i + 1}: format must be "${f}"`).join("\n");

  const contentPrompt = `You are an elite autonomous social content engine for Lemon AI.
Based on the following verified market intelligence:
${brandBrainText}

Top Hook Line: "${topHook}"
Target Pain Point: "${primaryPainPoint}"
Winning Angle: "${winningAngle}"
Hashtags: ${research.recommendedHashtags?.slice(0, 5).join(" ") || "#Growth #Business"}
Duration: ${days} day(s)

Generate a structured daily social media campaign plan for exactly ${days} day(s).
Strict Rules:
1. Every single day MUST have a COMPLETELY DIFFERENT, unique title, topic, and opening hook.
   - Day 1: Contrarian Industry Truth / Pain Point
   - Day 2: 3 Costly Inefficiencies & Hidden Bottlenecks
   - Day 3: Step-by-Step Tactical Framework
   - Day 4: Real-World Case Study / Before-and-After
   - Day 5: Top Industry Myth vs Reality
   - Day 6: Future Trend & Operational Shift
   - Day 7: Direct High-Value Consultation & Offer
2. NEVER repeat the same headline, title, or opening phrase across days.
3. You MUST follow the EXACT format requested for each day below:
${formatListText}

Format definitions:
- "REEL": Vertical video reel with clean caption and director voiceover script ([0:00-0:03] Hook, [0:04-0:18] Spoken Value, [0:19-0:30] CTA).
- "IMAGE_POST": Captivating punchy headline, problem-solution copy, high-converting CTA, and hashtags.
- "CAROUSEL": 5-slide educational breakdown with slide-by-slide headlines, subtext, bullets, and swipe cues.

Return ONLY valid JSON matching this schema:
{
  "posts": [
    {
      "dayNumber": 1,
      "format": "REEL",
      "title": "Unique distinct headline for Day 1",
      "caption": "Clean social media post caption starting with a unique scroll-stopping hook and ready to publish",
      "script": "Actor voiceover script with [0:00-0:03] Hook, [0:04-0:18] Spoken Value, [0:19-0:30] CTA (Only for REEL, omit for others)",
      "carouselSlides": [
        {
          "slideNumber": 1,
          "type": "COVER",
          "headline": "Main slide headline",
          "subtext": "Supporting sentence",
          "bulletPoints": ["Key takeaway 1", "Key takeaway 2"],
          "swipePrompt": "Swipe to begin ->"
        }
      ],
      "mediaPrompt": "Detailed visual photography or video prompt describing what should be shown"
    }
  ]
}`;

  const contentRes = await routeAICall<{
    posts: {
      dayNumber: number;
      format: "REEL" | "IMAGE_POST" | "CAROUSEL";
      title: string;
      caption: string;
      script?: string;
      carouselSlides?: FlywheelCarouselSlide[];
      mediaPrompt: string;
    }[];
  }>({
    task: "DEEP_SCRIPTWRITING",
    systemPrompt: "You are an elite direct-response social copywriter and performance strategist. Return ONLY valid JSON.",
    userPrompt: contentPrompt,
    preferredTier: "TIER_2_SMART",
    jsonMode: true,
  });

  const buildDefaultCarousel = (topic: string, dayNum: number): FlywheelCarouselSlide[] => [
    {
      slideNumber: 1,
      type: "COVER",
      headline: topic || `5 Essential Shifts for ${niche}`,
      subtext: `The Operational Strategy by ${businessName}`,
      swipePrompt: "Swipe to begin →",
    },
    {
      slideNumber: 2,
      type: "CONTENT",
      headline: `Step 1: Confront ${primaryPainPoint}`,
      subtext: `Why conventional ${niche} tactics stall growth before reaching scale.`,
      bulletPoints: ["Audit unmonitored inefficiencies", "Stop guessing your unit economics"],
      swipePrompt: "Next Step →",
    },
    {
      slideNumber: 3,
      type: "CONTENT",
      headline: `Step 2: Deploy ${winningAngle}`,
      subtext: "Shift focus from raw output to systematic leverage.",
      bulletPoints: ["Automate recurring friction points", "Enforce high-converting standards"],
      swipePrompt: "Next Step →",
    },
    {
      slideNumber: 4,
      type: "CONTENT",
      headline: "Step 3: Measure Velocity & ROAS",
      subtext: "Track weekly conversion metrics that directly move revenue.",
      bulletPoints: ["Response times cut by 80%", "Predictable client acquisition"],
      swipePrompt: "Next Step →",
    },
    {
      slideNumber: 5,
      type: "CTA",
      headline: `Ready to Scale Your ${niche}?`,
      subtext: `Save this post and follow ${businessName} for weekly frameworks!`,
      swipePrompt: "Save & Share",
    },
  ];

  // Distinct daily themes rotation
  const dailyThemes = [
    { title: `The Hidden Growth Bottleneck in ${niche}`, hook: `Stop burning time on broken ${niche} systems.` },
    { title: `3 Costly Inefficiencies in ${niche}`, hook: `Most ${targetAudience} lose 10+ hours a week to avoidable friction.` },
    { title: `The 4-Step Blueprint to Solve ${primaryPainPoint}`, hook: `Here is the exact framework ${businessName} uses to guarantee results.` },
    { title: `Real Case Study: How We Scaled ${niche}`, hook: `What happens when you replace manual guesswork with ${winningAngle}?` },
    { title: `The Biggest Myth in ${niche} Debunked`, hook: `You don't need more complexity to scale—you need automated leverage.` },
    { title: `The 80/20 Leverage Rule for ${niche}`, hook: `Focusing on these 2 key levers will double your output this quarter.` },
    { title: `Ready to Scale ${businessName}? Let's Talk`, hook: `If you are tired of inconsistent results, claim your strategic roadmap today.` },
  ];

  // Fallback posts if AI output is empty or truncated
  let generatedPosts = contentRes.data?.posts || [];
  if (!generatedPosts || generatedPosts.length === 0) {
    generatedPosts = Array.from({ length: days }, (_, i) => {
      const dayNum = i + 1;
      const formats: ("REEL" | "IMAGE_POST" | "CAROUSEL")[] = ["REEL", "IMAGE_POST", "CAROUSEL"];
      const format = formats[i % formats.length];
      const theme = dailyThemes[i % dailyThemes.length];
      const tagLine = research.recommendedHashtags?.slice(0, 4).join(" ") || `#${cleanTag(niche)} #Growth #${cleanTag(businessName)}`;

      if (format === "REEL") {
        return {
          dayNumber: dayNum,
          format,
          title: theme.title,
          caption: `${theme.title}\n\n${theme.hook}\n\nThe real challenge isn't effort—it's ${primaryPainPoint}. When you deploy ${winningAngle}, execution becomes seamless.\n\nSave this reel and take action today!\n\n${tagLine}`,
          script: `[0:00-0:03] Hook: ${theme.hook}\n\n[0:04-0:18] Spoken Value: Across our client audits in ${niche}, teams lose critical velocity to ${primaryPainPoint}. The solution is ${winningAngle}.\n\n[0:19-0:30] Call to Action: Comment 'ROADMAP' below or DM ${businessName} for the playbook.`,
          mediaPrompt: `Cinematic 9:16 vertical commercial video of modern professional working in ${niche}, high resolution`,
        };
      } else if (format === "CAROUSEL") {
        return {
          dayNumber: dayNum,
          format,
          title: theme.title,
          caption: `${theme.title}\n\n${theme.hook}\n\nSwipe through for the complete breakdown!\n\nWhich slide resonates most with your goals? Drop a comment below.\n\n${tagLine}`,
          carouselSlides: buildDefaultCarousel(theme.title, dayNum),
          mediaPrompt: `Minimalist high-contrast educational graphic typography for ${niche}, 4:5 aspect ratio`,
        };
      } else {
        return {
          dayNumber: dayNum,
          format,
          title: theme.title,
          caption: `${theme.title}\n\n${theme.hook}\n\nHere is how ${businessName} tackles ${primaryPainPoint}:\n1. Identify root constraints\n2. Enforce standard systems\n3. Leverage ${winningAngle}\n\nSend us a DM or book a strategy call to get started!\n\n${tagLine}`,
          mediaPrompt: `Ultra-clean commercial photorealistic editorial image representing ${niche} and ${businessName}`,
        };
      }
    });
  }

  // 3. STEP 3: Distribution Agent (Auto-Schedule into scheduled_posts table & Publish Day 1 Immediately)
  console.log(`[Flywheel] Phase 3: Distribution Agent scheduling ${generatedPosts.length} posts into calendar...`);
  let postsScheduled = 0;
  let day1PublishedCount = 0;
  const now = new Date();

  // Find all active and connected channels for this user
  let activeUserChannels: any[] = [];
  try {
    const { data: channels } = await admin.database
      .from("user_channels")
      .select("id, handle, is_connected, is_active, channel_types(id, type, name)")
      .eq("user_id", params.userId)
      .eq("is_connected", true);
    activeUserChannels = channels || [];
  } catch { }

  // Fallback: if is_connected flag wasn't set, find any user channel with access_token
  if (activeUserChannels.length === 0) {
    try {
      const { data: fallbackChannels } = await admin.database
        .from("user_channels")
        .select("id, handle, is_connected, is_active, channel_types(id, type, name)")
        .eq("user_id", params.userId)
        .not("access_token", "is", null);
      activeUserChannels = fallbackChannels || [];
    } catch { }
  }

  // Filter by selected channel IDs if provided by user
  if (params.selectedChannelIds && params.selectedChannelIds.length > 0) {
    const selectedSet = new Set(params.selectedChannelIds);
    const filtered = activeUserChannels.filter(
      (c) =>
        selectedSet.has(c.id) ||
        selectedSet.has((c as any).channel_type_id) ||
        selectedSet.has(c.channel_types?.id)
    );
    if (filtered.length > 0) {
      activeUserChannels = filtered;
    }
  }

  // Never fall back to another user's channels. Multi-tenant isolation is strictly enforced.
  if (activeUserChannels.length === 0) {
    console.log(
      `[Flywheel] User ${params.userId} has no active connected social channels. Posts will not be published to other tenants.`
    );
  }

  console.log(`[Flywheel] Found ${activeUserChannels.length} active channel(s) owned by user to target for publishing:`,
    activeUserChannels.map(c => `${c.channel_types?.name || c.channel_types?.type} (${c.handle})`));

  // Generate visual assets for the first batch of posts in parallel (capped for speed)
  const visualAssets = await Promise.all(
    generatedPosts.slice(0, 5).map((p) =>
      generateAdCreativeImage({
        prompt: `${niche} ${p.mediaPrompt || p.title}`,
        aspectRatio: p.format === "REEL" ? "9:16" : p.format === "CAROUSEL" ? "4:5" : "1:1",
        userId: params.userId,
        niche,
      }).catch(() => null)
    )
  );

  const postTrackingRecords = new Map<number, {
    primaryId: string;
    allPostIds: string[];
    overallStatus: "published" | "queue" | "failed";
    publishedUrl?: string | null;
    channelName?: string;
    errorMessage?: string | null;
    channels: FlywheelTargetChannelResult[];
  }>();

  for (let i = 0; i < generatedPosts.length; i++) {
    const post = generatedPosts[i];
    const asset = visualAssets[i] || visualAssets[i % visualAssets.length];

    // Day 1 (i === 0) is scheduled for right now; subsequent days are scheduled at 10:00 AM UTC.
    // Using setUTCHours (not setHours) so the time is server-timezone-independent.
    // 10:00 UTC = 3:30 PM IST, 6:00 AM EST — consistent across all deployments.
    const scheduleDate = i === 0 ? new Date() : addDays(now, i);
    if (i > 0) {
      scheduleDate.setUTCHours(10, 0, 0, 0);
    }

    const isReel = post.format === "REEL";
    const isCarousel = post.format === "CAROUSEL";
    const videoUrl = isReel ? CURATED_VERTICAL_REELS[i % CURATED_VERTICAL_REELS.length] : null;
    const imageUrl = asset?.imageUrl || (
      isCarousel
        ? CURATED_COMMERCIAL_PHOTOS.marketing[i % CURATED_COMMERCIAL_PHOTOS.marketing.length]
        : isReel
          ? CURATED_COMMERCIAL_PHOTOS.business[i % CURATED_COMMERCIAL_PHOTOS.business.length]
          : CURATED_COMMERCIAL_PHOTOS.default[i % CURATED_COMMERCIAL_PHOTOS.default.length]
    );

    // Prepare media items for scheduled_posts table
    const mediaItems: { url: string; key: string; media_type: "image" | "video"; thumbnail_url?: string }[] = [];
    if (isReel && videoUrl) {
      mediaItems.push({
        url: videoUrl,
        key: `reel-video-${i}`,
        media_type: "video",
        thumbnail_url: imageUrl,
      });
      if (imageUrl) {
        mediaItems.push({
          url: imageUrl,
          key: `reel-cover-${i}`,
          media_type: "image",
        });
      }
    } else if (imageUrl) {
      mediaItems.push({
        url: imageUrl,
        key: `${post.format.toLowerCase()}-${i}`,
        media_type: "image",
      });
    }

    // Schedule to all active user channels
    for (let cIdx = 0; cIdx < activeUserChannels.length; cIdx++) {
      const channel = activeUserChannels[cIdx];
      if (!channel.id) continue;

      const rawType = channel.channel_types?.type || "TWITTER";
      const chType = String(rawType).toUpperCase();

      // 1. Silently adapt caption specifically for this social media platform
      const platformCaption = adaptCaptionForPlatform(post.caption, chType, {
        business_name: businessName,
        niche,
      });

      // 2. Schedule at user-defined custom time slot (e.g. 2:30 PM / 14:30) or platform's peak engagement time
      const slotStr = params.customTimeSlots && params.customTimeSlots.length > 0
        ? params.customTimeSlots[(i % postsPerDay) % params.customTimeSlots.length]
        : undefined;

      const dayOffset = Math.floor(i / postsPerDay);
      const baseDayDate = addDays(now, dayOffset);
      const chScheduleDate = getPlatformStaggeredDate(
        baseDayDate,
        chType,
        cIdx,
        i % postsPerDay,
        slotStr,
        params.clientTimezoneOffset,
        params.clientLocalToday,
        dayOffset
      );

      const postDesiredStatus = params.postStatus || "queue";

      try {
        const { data: insertedPost } = await admin.database
          .from("scheduled_posts")
          .insert({
            user_id: params.userId,
            user_channel_id: channel.id,
            content: platformCaption,
            images: mediaItems,
            scheduled_at: chScheduleDate.toISOString(),
            status: postDesiredStatus,
          })
          .select("id, status, scheduled_at")
          .maybeSingle();

        if (insertedPost?.id) {
          postsScheduled++;
          let publishStatus: "published" | "queue" | "failed" = "queue";
          let liveUrl: string | null = null;
          let failureMsg: string | null = null;

          // Only publish immediately if the post's scheduled time has already arrived today
          const isDueNow = chScheduleDate.getTime() <= Date.now() + 60_000;
          if (isDueNow && postDesiredStatus === "queue") {
            console.log(`[Flywheel] Immediately executing publish for due post ${insertedPost.id} to ${channel.channel_types?.name} (${channel.handle})...`);
            try {
              const pubRes = await publishPostDirectly(insertedPost.id);
              console.log(`[Flywheel] Direct publish result:`, pubRes);
              if (pubRes.success) {
                publishStatus = "published";
                liveUrl = pubRes.publishedUrl || null;
                day1PublishedCount++;
              } else {
                publishStatus = "failed";
                failureMsg = pubRes.error || "Publishing failed";
              }
            } catch (pubErr: any) {
              publishStatus = "failed";
              failureMsg = pubErr?.message || "Publish exception";
            }
          }

          const chResult: FlywheelTargetChannelResult = {
            id: insertedPost.id,
            channelId: channel.id,
            channelName: channel.channel_types?.name || channel.channel_types?.type || "Social Channel",
            channelType: chType,
            handle: channel.handle || undefined,
            status: publishStatus,
            publishedUrl: liveUrl,
            errorMessage: failureMsg,
          };

          const existingRecord = postTrackingRecords.get(i);
          if (!existingRecord) {
            postTrackingRecords.set(i, {
              primaryId: insertedPost.id,
              allPostIds: [insertedPost.id],
              overallStatus: publishStatus,
              publishedUrl: liveUrl,
              channelName: channel.channel_types?.name,
              errorMessage: failureMsg,
              channels: [chResult],
            });
          } else {
            existingRecord.allPostIds.push(insertedPost.id);
            existingRecord.channels.push(chResult);
            if (publishStatus === "published") {
              existingRecord.overallStatus = "published";
              if (!existingRecord.publishedUrl) existingRecord.publishedUrl = liveUrl;
            }
            existingRecord.channelName = existingRecord.channels.map((c) => c.channelName).join(", ");
            if (failureMsg && !existingRecord.errorMessage) {
              existingRecord.errorMessage = failureMsg;
            }
          }
        }
      } catch (insertErr) {
        console.warn("[Flywheel] Notice scheduling post to channel:", insertErr);
      }
    }
  }

  // 4. STEP 4: Advertising Agent (Turns top organic angle into a high-ROAS Meta Ad Draft)
  let createdAd: FlywheelResult["metaCampaignCreated"] = null;
  if (params.autoDraftMetaAd !== false) {
    console.log("[Flywheel] Phase 4: Advertising Agent generating high-intent Meta Ad campaign...");
    const topReel = generatedPosts.find((p) => p.format === "REEL") || generatedPosts[0];
    const adHeadline = topReel?.title?.slice(0, 45) || `Transform Your ${niche}`;
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
        day1PublishedCount,
      },
    });
  } catch { }

  console.log(`[Flywheel] Completed successfully in ${executionTimeMs}ms! Scheduled ${postsScheduled} posts, published ${day1PublishedCount} immediately, created Ad campaign.`);

  const summaryText = day1PublishedCount > 0
    ? `Autonomous Campaign Engine completed in ${(executionTimeMs / 1000).toFixed(1)}s. Day 1 post was published immediately to your connected social accounts, and ${postsScheduled} posts across ${days} day(s) have been scheduled onto your social calendar.`
    : postsScheduled > 0
      ? `Autonomous Campaign Engine completed in ${(executionTimeMs / 1000).toFixed(1)}s. Scheduled ${postsScheduled} posts across ${days} day(s) onto your social calendar.`
      : `Autonomous Campaign Engine generated ${generatedPosts.length} strategic content pieces in ${(executionTimeMs / 1000).toFixed(1)}s. Connect your social channels in Settings to auto-publish directly to your accounts.`;

  return {
    success: true,
    niche,
    businessName,
    postsScheduledCount: postsScheduled,
    contentPieces: generatedPosts.map((p, idx) => {
      const isReel = p.format === "REEL";
      const isCarousel = p.format === "CAROUSEL";
      const assignedVideo = isReel ? CURATED_VERTICAL_REELS[idx % CURATED_VERTICAL_REELS.length] : null;
      const assignedImage = visualAssets[idx]?.imageUrl || (
        isCarousel
          ? CURATED_COMMERCIAL_PHOTOS.marketing[idx % CURATED_COMMERCIAL_PHOTOS.marketing.length]
          : isReel
            ? CURATED_COMMERCIAL_PHOTOS.business[idx % CURATED_COMMERCIAL_PHOTOS.business.length]
            : CURATED_COMMERCIAL_PHOTOS.default[idx % CURATED_COMMERCIAL_PHOTOS.default.length]
      );

      const record = postTrackingRecords.get(idx);

      return {
        id: record?.primaryId,
        allPostIds: record?.allPostIds || (record?.primaryId ? [record.primaryId] : []),
        dayNumber: p.dayNumber || idx + 1,
        title: p.title,
        type: isReel ? ("REEL_SCRIPT" as const) : isCarousel ? ("CAROUSEL" as const) : ("FEED_POST" as const),
        previewText: (p.caption || "").slice(0, 140) + "...",
        caption: p.caption,
        script: p.script || (isReel ? p.caption : undefined),
        imageUrl: assignedImage,
        videoUrl: assignedVideo,
        carouselSlides: p.carouselSlides || (isCarousel ? buildDefaultCarousel(p.title, p.dayNumber || idx + 1) : undefined),
        mediaPrompt: p.mediaPrompt,
        status: record?.overallStatus || "queue",
        publishedUrl: record?.publishedUrl || null,
        channelName: record?.channelName || "All Channels",
        targetChannels: record?.channels || [],
        errorMessage: record?.errorMessage || null,
      };
    }),
    metaCampaignCreated: createdAd,
    researchHighlights: {
      topHook,
      primaryPainPoint,
      winningAngle,
    },
    executionTimeMs,
    summary: summaryText,
  };
}
