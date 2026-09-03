import { NextRequest, NextResponse } from "next/server";
import { 
  routeAICall, 
  generateCostEffectiveIdeas, 
  generateAdScriptAndHooks, 
  analyzeCompetitorHooks 
} from "@/lib/ai-router";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action = "ideas", businessName = "Apex Dental Studio", niche = "Cosmetic Dentistry", targetAudience = "Adults 25-45 looking for smile makeovers", productOffer = "Get 20% off Teeth Whitening & Invisible Aligners" } = body;

    if (action === "ad_script") {
      // Test Tier 2 Smart LLM (Ad Strategy & Creative Prompts)
      const result = await generateAdScriptAndHooks({
        businessName,
        niche,
        targetAudience,
        productOffer,
        goal: "LEADS",
      });
      return NextResponse.json({
        type: "Tier 2 Smart LLM (Meta Ad Script & Hooks)",
        ...result,
      });
    }

    if (action === "competitor_analysis") {
      // Test Tier 2 Competitor Analysis
      const sampleCompetitorAd = "Are you hiding your smile in photos? Our invisible braces straighten your teeth in 6 months without anyone noticing. Book a free 3D scan today!";
      const result = await analyzeCompetitorHooks({
        competitorContent: body.competitorContent || sampleCompetitorAd,
        industry: niche,
      });
      return NextResponse.json({
        type: "Tier 2 Competitor Research & Hook Extraction",
        ...result,
      });
    }

    // Default: Test Tier 1 Fast & Low-Cost LLM (Ideas generation)
    const result = await generateCostEffectiveIdeas({
      businessType: niche,
      targetAudience,
      count: 3,
    });

    return NextResponse.json({
      type: "Tier 1 Fast & Budget-Friendly LLM (Viral Ideas)",
      ...result,
    });
  } catch (error: any) {
    console.error("AI Router Test error:", error);
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}

export async function GET() {
  // Quick GET test running Tier 1 & Tier 2 comparison
  const ideaTest = await generateCostEffectiveIdeas({
    businessType: "Fitness Gym & Personal Training",
    targetAudience: "Young professionals looking to lose weight",
    count: 2,
  });

  return NextResponse.json({
    message: "Multi-Tier LLM Cost Router is active & functioning!",
    sampleTier1Run: ideaTest,
  });
}
