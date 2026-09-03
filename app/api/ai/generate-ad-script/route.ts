import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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

    const body: GenerateAdScriptRequest = await request.json();
    if (!body.businessName || !body.niche || !body.targetAudience || !body.productOffer) {
      return NextResponse.json(
        { error: "Missing required fields: businessName, niche, targetAudience, and productOffer are required." },
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
    console.error("[Generate Ad Script API Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
