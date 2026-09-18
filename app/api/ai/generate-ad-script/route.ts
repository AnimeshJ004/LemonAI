import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/observability";
import { generateAdScriptAndHooks } from "@/lib/ai-router";

export interface GenerateAdScriptRequest {
  businessName: string;
  niche: string;
  targetAudience: string;
  productOffer: string;
  goal?: "LEADS" | "SALES" | "AWARENESS";
  competitorAngle?: string;
  brandTone?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(request, {
      limit: 30,
      windowMs: 60_000,
      namespace: "ai",
    });
    if (limited) return limited;

    const body: GenerateAdScriptRequest = await request.json();
    if (!body.businessName || !body.niche || !body.targetAudience || !body.productOffer) {
      return NextResponse.json(
        { error: "Missing required fields: businessName, niche, targetAudience, and productOffer are required." },
        { status: 400 }
      );
    }

    // Input length validation to prevent oversized prompts / abuse
    if (
      (body.businessName?.length ?? 0) > 100 ||
      (body.niche?.length ?? 0) > 200 ||
      (body.targetAudience?.length ?? 0) > 200 ||
      (body.productOffer?.length ?? 0) > 500 ||
      (body.competitorAngle?.length ?? 0) > 1000
    ) {
      return NextResponse.json(
        {
          error:
            "Input too long. Limits: businessName 100, niche 200, targetAudience 200, productOffer 500, competitorAngle 1000 characters.",
        },
        { status: 400 }
      );
    }

    const result = await generateAdScriptAndHooks({
      businessName: body.businessName,
      niche: body.niche,
      targetAudience: body.targetAudience,
      productOffer: body.productOffer,
      goal: body.goal || "LEADS",
      competitorAngle: body.competitorAngle,
    });

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: "Failed to generate ad scripts. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      campaign: result.data,
      metrics: result.metrics,
    });
  } catch (error: any) {
    await reportError(error, { scope: "api/ai/generate-ad-script" });
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
