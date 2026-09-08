import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { evaluateCampaignsForOptimization, applyOptimizationAction } from "@/lib/ad-optimizer";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);

    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await evaluateCampaignsForOptimization(targetUserId);

    return NextResponse.json({
      success: true,
      recommendations: result.recommendations,
      summary: result.summary,
    });
  } catch (error: any) {
    console.error("Ad optimizer GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to evaluate campaigns" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);

    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { campaignId, action } = body;

    if (!campaignId || !action) {
      return NextResponse.json({ error: "campaignId and action required" }, { status: 400 });
    }

    const result = await applyOptimizationAction(targetUserId, campaignId, action);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Ad optimizer POST error:", error);
    return NextResponse.json({ error: error.message || "Failed to execute optimization" }, { status: 500 });
  }
}
