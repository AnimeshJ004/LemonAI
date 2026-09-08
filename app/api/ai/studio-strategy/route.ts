import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getBrandProfileForUser } from "@/lib/brand-helper";
import { callResilientCompletion } from "@/lib/ai-gateway";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { goal, timeframe, platforms } = body;

    const brand = await getBrandProfileForUser(userId);

    const completion = await callResilientCompletion({
      jsonMode: true,
      messages: [
        {
          role: "system",
          content: `You are a senior social media strategist. Create a complete content strategy.
Return ONLY valid JSON with this exact structure (no markdown, no extra text):
{
  "strategyOverview": "2-sentence executive summary of the strategy",
  "contentPillars": [
    {
      "name": "Pillar name",
      "percentage": 30,
      "description": "What type of content to post under this pillar",
      "exampleTopics": ["Topic 1", "Topic 2", "Topic 3"]
    }
  ],
  "weeklySchedule": [
    { "day": "Monday", "contentType": "REEL", "pillar": "Educational", "topic": "Specific topic idea for this day" }
  ],
  "kpis": [
    { "metric": "Reach", "target": "10,000/month", "howToMeasure": "Instagram Insights → Reach" }
  ],
  "quickWins": ["Actionable thing to do today", "Actionable thing to do this week"],
  "monthlyMilestones": [
    { "week": "Week 1", "focus": "What to focus on", "goal": "Specific measurable goal" }
  ]
}
Create 3-4 content pillars that add up to 100%. Weekly schedule should have 5-7 days.`,
        },
        {
          role: "user",
          content: `Business: ${brand?.business_name || "My Business"}
Niche: ${brand?.niche || "business"}
Primary Goal: ${goal || "Brand Awareness & Lead Generation"}
Timeframe: ${timeframe || "30 days"}
Target Platforms: ${Array.isArray(platforms) ? platforms.join(", ") : "Instagram, Facebook"}
Target Audience: ${brand?.target_audience || "target customers"}`,
        },
      ],
    });

    if (completion.success && completion.data) {
      return NextResponse.json({ success: true, strategy: completion.data });
    }

    // High quality fallback strategy if API gateway is unavailable
    const fallbackStrategy = {
      strategyOverview: `Comprehensive growth strategy for ${brand?.business_name || "our business"} focused on ${goal || "lead generation"} across ${Array.isArray(platforms) ? platforms.join(", ") : "social channels"}.`,
      contentPillars: [
        {
          name: "Industry Authority & Proof",
          percentage: 40,
          description: "Establish undeniable competence with case studies, real metrics, and breakdown of common bottlenecks.",
          exampleTopics: ["The #1 reason strategies fail", "Step-by-step framework to 3x efficiency", "Client turnaround case study"],
        },
        {
          name: "Educational Action Guides",
          percentage: 35,
          description: "Step-by-step actionable tutorials and checklists that prospects bookmark and share.",
          exampleTopics: ["5 tools to automate workflow", "The checklist we use before every campaign", "Avoid these 3 rookie mistakes"],
        },
        {
          name: "Direct Offer & Call-to-Action",
          percentage: 25,
          description: "Direct conversion drivers prompting appointment bookings, demo requests, and consultation calls.",
          exampleTopics: ["Exclusive consultation availability", "Limited-time offer for new partners", "Direct link to book strategy session"],
        },
      ],
      weeklySchedule: [
        { day: "Monday", contentType: "CAROUSEL", pillar: "Educational Action Guides", topic: "5-Step Checklist for Maximum Results" },
        { day: "Tuesday", contentType: "REEL", pillar: "Industry Authority & Proof", topic: "The biggest bottleneck in our industry right now" },
        { day: "Wednesday", contentType: "FEED_POST", pillar: "Educational Action Guides", topic: "How to fix underperforming outreach in 24 hours" },
        { day: "Thursday", contentType: "REEL", pillar: "Direct Offer & Call-to-Action", topic: "Behind the scenes: how we deliver results for clients" },
        { day: "Friday", contentType: "CAROUSEL", pillar: "Industry Authority & Proof", topic: "3 Case Studies with verifiable numbers" },
      ],
      kpis: [
        { metric: "Profile Reach", target: "15,000/month", howToMeasure: "Instagram / LinkedIn Analytics" },
        { metric: "Direct Inquiries", target: "25 leads/month", howToMeasure: "CRM Inbound Leads Table" },
        { metric: "Saved Posts", target: "120+ saves", howToMeasure: "Platform Post Insights" },
      ],
      quickWins: [
        "Audit existing bio with single clear CTA link to calendar",
        "Publish 1 high-retention reel addressing the #1 customer objection",
      ],
      monthlyMilestones: [
        { week: "Week 1", focus: "Authority Building & Core Assets", goal: "Publish 3 cornerstone posts" },
        { week: "Week 2", focus: "Engagement & Community Outreaches", goal: "Reach 50+ prospective decision-makers" },
        { week: "Week 3", focus: "Direct Inbound Lead Conversion", goal: "Book 10 discovery calls" },
        { week: "Week 4", focus: "Retargeting & Winning Post Repurposing", goal: "Turn winning angle into an ad draft" },
      ],
    };

    return NextResponse.json({ success: true, strategy: fallbackStrategy });
  } catch (err: any) {
    console.error("[studio-strategy] Error:", err);
    return NextResponse.json({ error: err?.message || "Generation failed" }, { status: 500 });
  }
}
