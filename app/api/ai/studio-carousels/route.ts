import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { getBrandProfileForUser } from "@/lib/brand-helper";
import { callResilientCompletion } from "@/lib/ai-gateway";

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

    const completion = await callResilientCompletion({
      jsonMode: true,
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

    let carousel = completion.data;
    if (!carousel || !Array.isArray(carousel.slides)) {
      carousel = {
        title: topic,
        slides: [
          {
            slideNumber: 1,
            type: "COVER",
            headline: topic,
            subtext: "The definitive playbook for modern brands (Swipe to learn →)",
            visualSuggestion: "High-contrast clean typography with bold accent color",
          },
          {
            slideNumber: 2,
            type: "CONTENT",
            headline: "01. Identify The Real Bottleneck",
            bulletPoints: [
              "80% of teams optimize symptoms, not root causes",
              "Audit your conversion funnel weekly",
              "Fix friction points before scaling traffic",
            ],
            swipePrompt: "Next: The 3-step solution →",
          },
          {
            slideNumber: 3,
            type: "CONTENT",
            headline: "02. Build Repeatable Mechanisms",
            bulletPoints: [
              "Document winning procedures into strict SOPs",
              "Eliminate manual redundant handoffs",
              "Automate multi-channel distribution",
            ],
            swipePrompt: "Swipe for execution tactics →",
          },
          {
            slideNumber: 4,
            type: "CONTENT",
            headline: "03. Double Down on Winning Assets",
            bulletPoints: [
              "Track your top 20% highest converting posts",
              "Repurpose top organic posts into paid ad sets",
              "Consistently test 2-3 new angles every 14 days",
            ],
            swipePrompt: "Swipe for the final takeaway →",
          },
          {
            slideNumber: 5,
            type: "CTA",
            headline: "Found this breakdown valuable?",
            bulletPoints: [
              "Bookmark this post for your next strategy session",
              "Share with a founder or teammate",
              "Follow for weekly insights",
            ],
            swipePrompt: "Save for later",
          },
        ],
        caption: `📑 5 Critical Shifts to Master ${topic}.\n\nMost teams waste hundreds of hours because they skip step 2. Swipe through the full breakdown above!\n\nWhich step resonates with you most? Let us know below 👇\n\n#CarouselPost #BusinessGrowth #SaaS #StrategyPlaybook #MarketingTips`,
        cta: "Save this post and share with your team!",
      };
    }

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
  } catch (err: any) {
    console.error("[studio-carousels] Error:", err);
    return NextResponse.json({ error: err?.message || "Generation failed" }, { status: 500 });
  }
}
