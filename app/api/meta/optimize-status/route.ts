import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { evaluateCampaignsForOptimization, applyOptimizationAction } from "@/lib/ad-optimizer";

/**
 * GET /api/meta/optimize-status
 * Fetches real-time AI optimization recommendations across all user campaigns.
 *
 * POST /api/meta/optimize-status
 * Executes an optimization action (SCALE_BUDGET or PAUSE_CAMPAIGN) immediately.
 */

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recommendations, summary } = await evaluateCampaignsForOptimization(targetUserId);

    return NextResponse.json({
      recommendations,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Optimize Status API] GET error:", error);
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

    const body = await req.json();
    const { campaignId, action } = body;

    if (!campaignId || !action) {
      return NextResponse.json({ error: "campaignId and action are required" }, { status: 400 });
    }

    const result = await applyOptimizationAction(targetUserId, campaignId, action);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Optimize Status API] POST error:", error);
    return NextResponse.json({ error: error.message || "Failed to apply optimization" }, { status: 500 });
  }
}
