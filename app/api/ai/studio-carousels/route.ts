import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";
import { getBrandProfileForUser } from "@/lib/brand-helper";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { topic, platform, slides } = body;

    if (!topic) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }

    const slideCount = Math.min(Math.max(Number(slides || 7), 5), 10);
    const brand = await getBrandProfileForUser(userId);
    const { insforge } = await getInsforgeServerClient();

    const completion = await insforge.ai.chat.completions.create({
      model: "google/gemini-3.8-flash",
      messages: [
        {
          role: "system",
          content: `You are a carousel content strategist. Generate a ${slideCount}-slide carousel for ${platform || "Instagram"}.
Return ONLY valid JSON with this exact structure (no markdown, no extra text):
{
  "title": "Carousel topic title",
  "slides": [
    {
      "slideNumber": 1,
      "type": "COVER",
      "headline": "Bold cover title",
      "subtext": "Sub line under headline",
      "visualSuggestion": "Design/layout idea"
    },
    {
      "slideNumber": 2,
      "type": "CONTENT",
      "headline": "Slide headline",
      "bulletPoints": ["Point 1", "Point 2", "Point 3"],
      "swipePrompt": "Swipe to see →"
    }
  ],
  "caption": "Full post caption with 5-8 hashtags",
  "cta": "Last slide CTA text"
}
Make slide 1 a COVER type, slides 2 to N-1 CONTENT type, and last slide CTA type.`,
        },
        {
          role: "user",
          content: `Business: ${brand?.business_name || "My Business"}
Niche: ${brand?.niche || "business"}
Topic: ${topic}
Slides: ${slideCount}
Platform: ${platform || "Instagram"}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "";
    const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();

    try {
      const carousel = JSON.parse(clean);

      try {
        const admin = getInsforgeAdminClient();
        await admin.database.from("studio_drafts").insert({
          user_id: userId,
          type: "CAROUSEL",
          title: topic,
          content_data: carousel,
        });
      } catch {}

      return NextResponse.json({ success: true, carousel });
    } catch {
      return NextResponse.json(
        { error: "AI response could not be parsed. Please try again.", raw },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("[studio-carousels] Error:", err);
    return NextResponse.json({ error: err?.message || "Generation failed" }, { status: 500 });
  }
}
