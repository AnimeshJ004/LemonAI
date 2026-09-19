import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { getBrandProfileForUser } from "@/lib/brand-helper";
import { callResilientCompletion } from "@/lib/ai-gateway";
import { validateInputLengths } from "@/lib/validate-inputs";

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

    const invalid = validateInputLengths(body, { topic: 500 });
    if (invalid) return invalid;

    const slideCount = Math.min(Math.max(Number(slides || 7), 5), 10);
    const brand = await getBrandProfileForUser(userId);
    const targetPlatform = platform || "Instagram";

    const completion = await callResilientCompletion({
      jsonMode: true,
      messages: [
        {
          role: "system",
          content: `You are a world-class social media carousel designer and strategist.
Create an engaging, viral ${slideCount}-slide carousel for ${targetPlatform} in portrait 4:5 format.
Vary the slide layouts to maximize retention! Use these slide types:
- "COVER": The hook cover slide with high-contrast headline and curiosity subtext.
- "CONTENT": Actionable tactical step with headline and 2-3 concise bullets.
- "STAT_CALLOUT": A punchy data-backed slide featuring a big metric/stat (e.g. "73%", "3.4x", "$100k") with explanatory label and takeaway.
- "QUOTE": An insightful quote or contrarian rule with attribution.
- "CTA": Final slide driving saves, shares, and conversion.

Return ONLY valid JSON with this exact structure (no markdown wrapper, no extra text):
{
  "title": "Clear punchy carousel topic title",
  "slides": [
    {
      "slideNumber": 1,
      "type": "COVER",
      "headline": "Bold high-retention cover hook",
      "subtext": "Why 90% fail and the 1 system that works (Swipe →)",
      "swipePrompt": "Swipe to begin →",
      "visualSuggestion": "High-contrast minimalist dark typography"
    },
    {
      "slideNumber": 2,
      "type": "STAT_CALLOUT",
      "headline": "The Hidden Cost of Friction",
      "statNumber": "84%",
      "statLabel": "of leads abandon complex funnels",
      "subtext": "Most businesses solve the wrong problem by throwing ad spend at leaky conversion flows.",
      "swipePrompt": "The 3-step fix →"
    },
    {
      "slideNumber": 3,
      "type": "CONTENT",
      "headline": "01. Automate The First 5 Minutes",
      "bulletPoints": [
        "Inbound leads contact 7 competitors simultaneously",
        "Responding in <5 mins boosts qualification by 391%",
        "Deploy instant automated routing before manual review"
      ],
      "swipePrompt": "Next principle →"
    },
    {
      "slideNumber": 4,
      "type": "CONTENT",
      "headline": "02. Build Repeatable Delivery SOPs",
      "bulletPoints": [
        "Document every winning conversation pattern",
        "Turn top objection responses into modular macros",
        "Never answer the same question from scratch twice"
      ],
      "swipePrompt": "Swipe for metric tracking →"
    },
    {
      "slideNumber": 5,
      "type": "QUOTE",
      "headline": "The Golden Rule of Distribution",
      "quoteText": "You don't need more leads. You need a system that converts the ones you already have.",
      "quoteAuthor": "Modern Growth Playbook",
      "swipePrompt": "Final takeaway →"
    },
    {
      "slideNumber": 6,
      "type": "CTA",
      "headline": "Ready to scale without the headache?",
      "subtext": "Bookmark this playbook so you have it for your next planning session.",
      "bulletPoints": [
        "Bookmark this post for reference",
        "Share with a founder who needs this",
        "Follow for weekly playbooks"
      ],
      "swipePrompt": "Save for later"
    }
  ],
  "caption": "Complete social media caption with hook, emojis, breakdown summary, call-to-action, and 5-8 relevant hashtags",
  "cta": "Save this carousel and follow for more!"
}
Generate exactly ${slideCount} slides. Make slide 1 COVER, last slide CTA, and include at least one STAT_CALLOUT or QUOTE slide.`,
        },
        {
          role: "user",
          content: `Business: ${brand?.business_name || "My Brand"}
Niche: ${brand?.niche || "business"}
Topic: ${topic}
Slides: ${slideCount}
Platform: ${targetPlatform}
Audience: ${brand?.target_audience || "Entrepreneurs, creators and business builders"}`,
        },
      ],
    });

    let carousel = completion.data;
    if (!carousel || !Array.isArray(carousel.slides) || carousel.slides.length === 0) {
      carousel = {
        title: topic,
        slides: [
          {
            slideNumber: 1,
            type: "COVER",
            headline: topic,
            subtext: "The definitive playbook for modern operators (Swipe to learn →)",
            swipePrompt: "Swipe to begin →",
            visualSuggestion: "High contrast typography with bold accent",
          },
          {
            slideNumber: 2,
            type: "STAT_CALLOUT",
            headline: "The Cost of Inaction",
            statNumber: "78%",
            statLabel: "of deals go to the first responsive brand",
            subtext: "Speed of execution and systemized delivery beat pure talent every time.",
            swipePrompt: "Step 1 breakdown →",
          },
          {
            slideNumber: 3,
            type: "CONTENT",
            headline: "01. Eliminate Low-Value Friction",
            bulletPoints: [
              "Audit your customer journey for unnecessary hurdles",
              "Cut manual data entry with automated pipeline sync",
              "Focus 80% of human energy on high-touch closing",
            ],
            swipePrompt: "Next: The distribution engine →",
          },
          {
            slideNumber: 4,
            type: "CONTENT",
            headline: "02. Build Repeatable Content Loops",
            bulletPoints: [
              "Repurpose 1 deep-dive asset into 10 multi-format micro-posts",
              "Distribute across Instagram, LinkedIn, and X automatically",
              "Maintain consistent publishing without creator burnout",
            ],
            swipePrompt: "Next: The compounding rule →",
          },
          {
            slideNumber: 5,
            type: "QUOTE",
            headline: "The Core Principle",
            quoteText: "Systems beat motivation every single day. Build the machine first, scale the fuel second.",
            quoteAuthor: "Growth Architecture",
            swipePrompt: "Final takeaway →",
          },
          {
            slideNumber: 6,
            type: "CTA",
            headline: "Found this breakdown valuable?",
            subtext: "Integrate these frameworks into your weekly workflow to unlock compounding growth.",
            bulletPoints: [
              "Save this post to revisit during planning",
              "Share with your team or co-founder",
              "Follow for weekly growth playbooks",
            ],
            swipePrompt: "Save for later",
          },
        ],
        caption: `📑 How to master ${topic} in 2026.\n\nMost teams struggle because they focus on symptoms instead of building repeatable mechanisms. Swipe through the full breakdown above!\n\nWhich slide surprised you most? Drop your thoughts below 👇\n\n#Carousel #GrowthStrategy #BusinessPlaybook #Productivity #MarketingStrategy`,
        cta: "Save this carousel and follow for weekly playbooks!",
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
