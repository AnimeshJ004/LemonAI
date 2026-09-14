import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { researchMarketTrends } from "@/lib/trend-researcher";
import { routeAICall } from "@/lib/ai-router";
import { getBrandProfileForUser, getBrandBrainSummary, cleanTag } from "@/lib/brand-helper";

export const maxDuration = 90;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const brand = await getBrandProfileForUser(targetUserId);

    const businessName =
      body.business_name || body.businessName || brand?.business_name || "My Brand";
    const profileType =
      body.profile_type || body.profileType || (brand as any)?.profile_type || "Brand / Creator";
    const niche =
      body.niche || brand?.niche || "Content & Growth";
    const targetAudience =
      body.target_audience || body.targetAudience || brand?.target_audience || "Target Audience & Community";
    const brandTone =
      body.brand_tone || body.brandTone || brand?.brand_tone || "High-Energy & Engaging";
    const mainOffer =
      body.main_offer || body.mainOffer || brand?.main_offer || "Value & Growth";
    const preferredFormats =
      body.preferred_formats || body.preferredFormats || "🌟 All-in-One Balanced Mix";
    const competitors =
      body.competitors
        ? (Array.isArray(body.competitors)
            ? body.competitors
            : typeof body.competitors === "string"
            ? body.competitors.split(/[,\n]/).map((c: string) => c.trim()).filter(Boolean)
            : [])
        : (brand?.competitors ? [brand.competitors] : []);

    // 1. Run Autonomous Market & Viral Intelligence
    console.log(`[Viral Pipeline] Starting research for ${businessName} (${profileType} - ${niche})...`);
    const researchRes = await researchMarketTrends({
      businessName,
      niche,
      targetAudience,
      profileType,
      brandTone,
      mainOffer,
      competitors,
    });

    const research = researchRes.data || {
      niche,
      targetRegion: "Global & India",
      viralVsFlop: {
        whatGoesViral: [
          "0-3 second bold pattern-interrupt hook that challenges common beliefs",
          "Relatable storytelling showing real before-and-after transformations",
          "High-value tactical checklists that viewers immediately save and bookmark",
        ],
        whatFlops: [
          "Boring greetings like 'Hey guys, welcome back' that kill retention in 2 seconds",
          "Generic corporate announcements without any audience value or emotional hook",
        ],
      },
      topTrendingHooks: [
        {
          hook: `The #1 mistake 90% of people make with ${niche}`,
          hookType: "PATTERN_INTERRUPT" as const,
          targetEmotion: "Curiosity & Urgency",
          whyItWorks: "Triggers fear of missing out and pattern interruption.",
        },
        {
          hook: `Stop doing this in ${niche} if you want real results`,
          hookType: "PAIN_POINT" as const,
          targetEmotion: "Desire for Efficiency",
          whyItWorks: "Direct command hook creates instant authority.",
        },
        {
          hook: `3 secrets ${niche} pros never talk about publicly`,
          hookType: "STORY" as const,
          targetEmotion: "Insider Access",
          whyItWorks: "Curiosity gap that compels watch time to the end.",
        },
      ],
      audiencePainPoints: [
        {
          painPoint: `Wasting hours on trial-and-error in ${niche}`,
          agitation: "Conventional methods take months with minimal consistency",
          proposedSolutionAngle: `Automated and systematic execution by ${businessName}`,
        },
      ],
      competitorWeaknessesToExploit: [
        "Competitors post generic textbook advice without actionable step-by-step guidance",
        "Competitors fail to respond or build genuine community interaction",
      ],
      recommendedContentAngles: [
        { angleTitle: "Contrarian Truth", suggestedFormat: "REEL" as const, shortHook: `Why standard ${niche} advice fails` },
        { angleTitle: "Step-by-Step Blueprint", suggestedFormat: "CAROUSEL" as const, shortHook: `The 4-step framework you need` },
        { angleTitle: "Quick Win Insight", suggestedFormat: "FEED_POST" as const, shortHook: `One simple tweak that changes everything` },
      ],
      recommendedHashtags: [
        `#${cleanTag(niche)}`,
        `#${cleanTag(niche)}Tips`,
        `#${cleanTag(businessName)}`,
        "#ViralHacks",
        "#GrowthStrategies",
      ],
    };

    // Ensure viralVsFlop fallback if AI omitted it
    if (!research.viralVsFlop || !research.viralVsFlop.whatGoesViral?.length) {
      research.viralVsFlop = {
        whatGoesViral: [
          "0-3 second bold pattern-interrupt hook that challenges common beliefs",
          "Relatable storytelling showing real before-and-after transformations",
          "High-value tactical checklists that viewers immediately save and bookmark",
        ],
        whatFlops: [
          "Boring greetings like 'Hey guys, welcome back' that kill retention in 2 seconds",
          "Generic corporate announcements without any audience value or emotional hook",
        ],
      };
    }

    // 2. Synthesize 7 Days of Viral Niche Content based on preferred formats
    const topHooksList = research.topTrendingHooks?.map((h) => `"${h.hook}" (${h.whyItWorks})`).join("\n") || "";
    const tags = research.recommendedHashtags?.slice(0, 5).join(" ") || `#${cleanTag(niche)}`;

    const contentPrompt = `You are the Master AI Content Director & Growth Strategist for Lemon AI.
Your sole mission is to detect all strategic responsibilities for this entity and craft 7 COMPLETELY DISTINCT, non-repetitive, high-converting social media posts.

ENTITY PROFILE:
- Public Name / Channel: "${businessName}"
- Profile Category: "${profileType}"
- Niche & Industry: "${niche}"
- Target Audience & Viewers: "${targetAudience}"
- Tone of Voice: "${brandTone}"
- Primary Goal / Conversion Offer: "${mainOffer}"
- Format Preference: "${preferredFormats}"

ALGORITHMIC VIRAL INTELLIGENCE:
- Top Proven Viral Hooks:
${topHooksList}
- What Goes Viral in this Niche: ${research.viralVsFlop.whatGoesViral.join(" | ")}
- What Flops in this Niche: ${research.viralVsFlop.whatFlops.join(" | ")}
- Target Pain Points: ${research.audiencePainPoints?.map((p) => p.painPoint).join(", ")}
- Competitor Flaws: ${research.competitorWeaknessesToExploit.join(", ")}

STRICT ZERO-REPETITION MANDATE:
1. Every single day (Day 1 to 7) MUST have a COMPLETELY DIFFERENT title, different topic angle, different hook formula, different emojis, and different call-to-action. NEVER reuse titles or phrases like "The Truth About" or "5 Key Shifts" across multiple days.
2. The 7 days must follow this diverse editorial curriculum:
   - Day 1: Controversial / Contrarian Industry Truth (Bold pattern interrupt that shatters a common myth)
   - Day 2: Step-by-Step Tactical Framework (Actionable saveable checklist / carousel)
   - Day 3: Real Transformation & Case Study Proof (Before-and-after story breakdown)
   - Day 4: Top 3 Costly Bottlenecks / Mistakes (Direct warning hook)
   - Day 5: Deep-Dive Blueprint / Masterclass (High-value resource breakdown)
   - Day 6: Relatable Vulnerability / Behind-the-Scenes Journey (Human connection)
   - Day 7: Direct High-Value Consultation & Offer (Conversion-focused CTA aligned with "${mainOffer}")
3. SMALL MICRO-DETAILS FOR SOCIAL MEDIA:
   - Provide a specific "contentAngle" for each post.
   - Assign the "bestPlatform" (e.g. "Instagram Reels & YouTube Shorts", "LinkedIn Thought Leadership", "Instagram Carousel", "X / Twitter Thread").
   - Include a "soundMood" suggestion (e.g. "Trending Lo-Fi Hip Hop", "High-Energy Synth Pulse", "Chill Ambient Beat").
   - Include a unique "engagementQuestion" to trigger comments.
   - Line breaks and spacing for effortless mobile readability.

Return ONLY valid JSON matching this schema:
{
  "posts": [
    {
      "dayNumber": 1,
      "format": "REEL",
      "contentAngle": "Contrarian Industry Myth",
      "bestPlatform": "Instagram Reels & YouTube Shorts",
      "soundMood": "High-Energy Synth Pulse",
      "title": "Unique, scroll-stopping distinct title",
      "hook": "Opening 0-3 second pattern-interrupt hook line",
      "visualCue": "Specific camera framing, B-roll idea, or graphic overlay cue",
      "caption": "Full mobile-formatted caption with natural spacing, value points, engagement question, and tailored hashtags",
      "script": "[0:00-0:03] Hook: ...\\n[0:04-0:18] Spoken Value: ...\\n[0:19-0:30] CTA: ...",
      "engagementQuestion": "Specific debate/opinion question to drive comments",
      "callToAction": "Exact closing action for viewer aligned with ${mainOffer}",
      "targetEmotion": "Curiosity / Urgency / Status / Relief",
      "mediaPrompt": "Detailed cinematic prompt for AI image or video thumbnail generator",
      "carouselSlides": [
        {
          "slideNumber": 1,
          "type": "COVER",
          "headline": "Distinct slide title",
          "subtext": "Supporting insight",
          "swipePrompt": "Swipe to begin →"
        }
      ]
    }
  ]
}`;

    const contentRes = await routeAICall<{
      posts: {
        dayNumber: number;
        format: "REEL" | "CAROUSEL" | "FEED_POST";
        contentAngle?: string;
        bestPlatform?: string;
        soundMood?: string;
        title: string;
        hook: string;
        visualCue?: string;
        caption: string;
        script?: string;
        engagementQuestion?: string;
        callToAction?: string;
        targetEmotion?: string;
        mediaPrompt: string;
        carouselSlides?: any[];
      }[];
    }>({
      task: "DEEP_SCRIPTWRITING",
      preferredTier: "TIER_2_SMART",
      jsonMode: true,
      systemPrompt: "You are the Master AI Content Director for Lemon AI. You enforce 100% unique titles, varied angles, and platform-tailored nuances across every post. Return ONLY valid JSON.",
      userPrompt: contentPrompt,
    });

    let posts = contentRes.data?.posts || [];

    // Fallback if AI response was empty
    if (!posts || posts.length === 0) {
      posts = [
        {
          dayNumber: 1,
          format: "REEL",
          title: `The Truth About ${niche}`,
          hook: research.topTrendingHooks?.[0]?.hook || `Stop doing this in ${niche}!`,
          caption: `${research.topTrendingHooks?.[0]?.hook || `Stop doing this in ${niche}!`}\n\nMost people get stuck because they focus on the wrong lever. Here is what actually moves the needle for ${targetAudience}.\n\nSave this for later and drop your thoughts below! 👇\n\n${tags}`,
          script: `[0:00-0:03] Hook: ${research.topTrendingHooks?.[0]?.hook || `Stop doing this in ${niche}!`}\n\n[0:04-0:18] Spoken Value: If you are trying to succeed in ${niche}, the biggest bottleneck is trying to do everything manually. When you focus on high-leverage execution, results follow.\n\n[0:19-0:30] CTA: Tap follow or check out the link in bio for more daily insights!`,
          targetEmotion: "Curiosity & Urgency",
          mediaPrompt: `Modern cinematic 9:16 vertical video representing ${niche}, clean lighting`,
        },
        {
          dayNumber: 2,
          format: "CAROUSEL",
          title: `5 Key Shifts for ${niche}`,
          hook: `5 things I wish I knew earlier about ${niche}`,
          caption: `5 things I wish I knew earlier about ${niche}. Swipe through for the breakdown! 👉\n\nWhich slide hit home the most? Let me know below.\n\n${tags}`,
          carouselSlides: [
            { slideNumber: 1, type: "COVER", headline: `5 Key Shifts for ${niche}`, subtext: `By ${businessName}`, swipePrompt: "Swipe to begin →" },
            { slideNumber: 2, type: "CONTENT", headline: "1. Stop Guessing Your Metrics", subtext: "Track real output and engagement signals daily.", bulletPoints: ["Focus on retention", "Audit friction points"] },
            { slideNumber: 3, type: "CONTENT", headline: "2. Master The First 3 Seconds", subtext: "If your hook is weak, nobody sees the value.", bulletPoints: ["Use pattern interrupts", "Address real pain points"] },
            { slideNumber: 4, type: "CONTENT", headline: "3. Consistency Over Intensity", subtext: "Showing up 5 days a week beats once a month blitz.", bulletPoints: ["Build automated workflows", "Batch content ahead"] },
            { slideNumber: 5, type: "CTA", headline: `Ready to Level Up?`, subtext: `Save this post and follow ${businessName}!`, swipePrompt: "Save & Share" },
          ],
          targetEmotion: "Inspiration & Action",
          mediaPrompt: `Minimalist high-contrast graphic carousel cover for ${niche}`,
        },
        {
          dayNumber: 3,
          format: "FEED_POST",
          title: `Quick Win Framework for ${niche}`,
          hook: `Here is the framework that changed everything:`,
          caption: `Here is the framework that changed everything for ${businessName} in ${niche}:\n\n1. Cut unnecessary complexity\n2. Double down on what works\n3. Engage your audience genuinely\n\nWhat is your #1 priority right now? Let's discuss in the comments!\n\n${tags}`,
          targetEmotion: "Clarity & Confidence",
          mediaPrompt: `Editorial aesthetic photo representing ${niche}, crisp details`,
        },
      ];
    }

    // Attach suggested scheduled dates (starting tomorrow at 10:00 AM UTC / peak time)
    const baseNow = new Date();
    const enrichedPosts = posts.map((p, idx) => {
      const scheduleDate = addDays(baseNow, idx + 1);
      scheduleDate.setUTCHours(10, 0, 0, 0);

      return {
        ...p,
        id: `draft-post-${idx + 1}-${Date.now()}`,
        scheduledAt: scheduleDate.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      profile: {
        businessName,
        profileType,
        niche,
        targetAudience,
        brandTone,
        mainOffer,
      },
      research,
      posts: enrichedPosts,
    });
  } catch (error: any) {
    console.error("[Viral Pipeline API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate viral pipeline" },
      { status: 500 }
    );
  }
}
