import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runFullMarketingFunnel, FullFunnelRequest } from "@/lib/full-funnel";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: FullFunnelRequest = await request.json();
    if (!body.businessName || !body.niche || !body.targetAudience || !body.productOffer) {
      return NextResponse.json(
        {
          error: "Missing required fields: businessName, niche, targetAudience, and productOffer are required.",
        },
        { status: 400 }
      );
    }

    const funnelOutput = await runFullMarketingFunnel({
      businessName: body.businessName,
      niche: body.niche,
      targetAudience: body.targetAudience,
      productOffer: body.productOffer,
      goal: body.goal || "LEADS",
      competitors: body.competitors || [],
      competitorSampleText: body.competitorSampleText || "",
      targetRegion: body.targetRegion || "India",
      generateImages: body.generateImages !== false,
      userId,
    });

    return NextResponse.json({
      success: true,
      funnel: funnelOutput,
    });
  } catch (error: any) {
    console.error("[Full Funnel API Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
