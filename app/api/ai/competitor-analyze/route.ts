import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { researchMarketTrends } from "@/lib/trend-researcher";
import { getBrandProfileForUser } from "@/lib/brand-helper";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { niche, competitorUrls, targetAudience, country, businessName } = body;

    if (!niche || !targetAudience) {
      return NextResponse.json(
        { error: "niche and targetAudience are required" },
        { status: 400 }
      );
    }

    // Get brand profile to enrich the research with actual business context
    const brand = await getBrandProfileForUser(userId);

    const parsedCompetitors = Array.isArray(competitorUrls)
      ? competitorUrls
      : typeof competitorUrls === "string"
        ? competitorUrls.split(/[,\n]/).map((u) => u.trim()).filter(Boolean)
        : [];

    const result = await researchMarketTrends({
      businessName: businessName || brand?.business_name || "My Business",
      niche: niche || brand?.niche || "general business",
      targetAudience: targetAudience || brand?.target_audience || "general audience",
      competitors: parsedCompetitors,
      targetRegion: country || "IN",
    });

    if (!result.success) {
      return NextResponse.json({ error: "AI research failed. Please try again." }, { status: 500 });
    }

    // Save research to database
    try {
      const admin = getInsforgeAdminClient();
      await admin.database.from("competitor_researches").insert({
        user_id: userId,
        niche,
        target_audience: targetAudience,
        country: country || "IN",
        competitor_urls: Array.isArray(competitorUrls) ? competitorUrls : [],
        research_data: result.data,
      });
    } catch (dbErr) {
      // Non-fatal — still return the research even if save fails
      console.warn("[competitor-analyze] DB save error:", dbErr);
    }

    return NextResponse.json({ success: true, research: result.data });
  } catch (err: any) {
    console.error("[competitor-analyze] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Research failed" },
      { status: 500 }
    );
  }
}
