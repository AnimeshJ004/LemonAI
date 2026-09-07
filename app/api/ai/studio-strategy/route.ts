import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeServerClient } from "@/lib/insforge-server";
import { getBrandProfileForUser } from "@/lib/brand-helper";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { goal, timeframe, platforms } = body;

    const brand = await getBrandProfileForUser(userId);
    const { insforge } = await getInsforgeServerClient();

    const completion = await insforge.ai.chat.completions.create({
      model: "google/gemini-3.8-flash",
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

    const raw = completion.choices[0]?.message?.content || "";
    const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();

    try {
      const strategy = JSON.parse(clean);
      return NextResponse.json({ success: true, strategy });
    } catch {
      return NextResponse.json(
        { error: "AI response could not be parsed. Please try again.", raw },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("[studio-strategy] Error:", err);
    return NextResponse.json({ error: err?.message || "Generation failed" }, { status: 500 });
  }
}
