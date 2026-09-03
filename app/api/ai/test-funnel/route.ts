import { NextRequest, NextResponse } from "next/server";
import { runFullMarketingFunnel } from "@/lib/full-funnel";

export async function GET(request: NextRequest) {
  const industryParam = request.nextUrl.searchParams.get("industry") || "fitness";

  const TEST_BUSINESSES: Record<string, any> = {
    fitness: {
      businessName: "IronFit Gym & Performance",
      niche: "Fitness & Personal Training",
      targetAudience: "Working professionals (22-40) wanting to lose weight & build muscle",
      productOffer: "Get 3 Free Personal Training Sessions + Flat 40% Off Annual Membership",
      competitors: ["@cultfit", "@goldgym"],
      goal: "LEADS",
    },
    realestate: {
      businessName: "Skyline Luxury Residences",
      niche: "Luxury Real Estate",
      targetAudience: "High net-worth families looking for 3BHK smart homes",
      productOffer: "Pay 10% Now & Zero EMI Until Possession + Free Modular Kitchen",
      competitors: ["@lodha", "@dlf"],
      goal: "LEADS",
    },
    ecommerce: {
      businessName: "Aura Streetwear",
      niche: "Oversized Fashion Apparel",
      targetAudience: "Gen-Z and college students interested in anime & hip-hop streetwear",
      productOffer: "Buy 2 Oversized Tees & Get 1 Free + Free Shipping",
      competitors: ["@bonkerscorner", "@snitch"],
      goal: "SALES",
    },
    dental: {
      businessName: "SmileCraft Dental Studio",
      niche: "Cosmetic Dentistry & Clear Aligners",
      targetAudience: "Adults self-conscious about crooked or stained teeth",
      productOffer: "Free 3D Intraoral Scan + ₹10,000 Off Invisible Aligners",
      competitors: ["@clove", "@toothsi"],
      goal: "LEADS",
    },
  };

  const selectedBusiness = TEST_BUSINESSES[industryParam.toLowerCase()] || TEST_BUSINESSES.fitness;

  try {
    const funnel = await runFullMarketingFunnel({
      ...selectedBusiness,
      generateImages: true,
    });

    return NextResponse.json({
      status: "SUCCESS",
      industryTested: industryParam,
      businessDetails: selectedBusiness,
      funnelOutput: funnel,
      benchmarkSummary: {
        totalCostINR: `₹${funnel.costAndSavingsAnalytics.totalCostINR}`,
        clientSavingsVsAgency: `₹${funnel.costAndSavingsAnalytics.savingsVsClaudeAgencyINR}`,
        executionTime: `${(funnel.costAndSavingsAnalytics.executionTimeMs / 1000).toFixed(2)}s`,
        isBudgetFriendly: funnel.costAndSavingsAnalytics.totalCostINR < 2.0,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Test failed" }, { status: 500 });
  }
}
