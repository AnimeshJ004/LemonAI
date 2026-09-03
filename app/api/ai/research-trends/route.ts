import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { researchMarketTrends, TrendResearchParams } from "@/lib/trend-researcher";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: TrendResearchParams = await request.json();
    if (!body.niche || !body.targetAudience) {
      return NextResponse.json(
        { error: "Missing required fields: niche and targetAudience are required" },
        { status: 400 }
      );
    }

    const researchResponse = await researchMarketTrends({
      businessName: body.businessName || "My Business",
      niche: body.niche,
      targetAudience: body.targetAudience,
      competitors: body.competitors || [],
      competitorSampleText: body.competitorSampleText || "",
      targetRegion: body.targetRegion || "India",
    });

    if (!researchResponse.success || !researchResponse.data) {
      return NextResponse.json(
        { error: "Failed to generate market research. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      research: researchResponse.data,
      metrics: researchResponse.metrics,
    });
  } catch (error: any) {
    console.error("[Research Trends API Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
