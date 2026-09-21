import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getBrandProfileForUser } from "@/lib/brand-helper";
import { analyzeViralHashtagsForProfile } from "@/lib/hashtag-analyzer";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      content,
      topic,
      platform = "INSTAGRAM",
      brandProfile: overrideProfile,
    } = body;

    // 1. Resolve Brand Profile (DB or override)
    let profile = overrideProfile;
    if (!profile) {
      profile = await getBrandProfileForUser(userId);
    }

    // 2. Perform Profile-Driven Viral Hashtag Analysis
    const textContext = content || topic || "";
    const result = await analyzeViralHashtagsForProfile({
      brandProfile: profile,
      topicOrContent: textContext,
      targetChannel: platform,
      region: profile?.location,
    });

    return NextResponse.json({
      success: true,
      profile: {
        business_name: profile?.business_name || "Brand",
        niche: profile?.niche || "Business",
        target_audience: profile?.target_audience || "General Audience",
        location: profile?.location || "",
      },
      viralityScore: result.viralityScore,
      recommendedBundle: result.recommendedBundle,
      categories: result.categories,
      platformRules: result.platformRules,
      reasoning: result.reasoning,
      trendingContext: result.trendingContext,
    });
  } catch (error: any) {
    console.error("[Trending Hashtags API Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to analyze trending hashtags" },
      { status: 500 }
    );
  }
}
