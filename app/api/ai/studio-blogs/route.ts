import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";
import { getBrandProfileForUser } from "@/lib/brand-helper";

export const maxDuration = 90;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { topic, keyword, wordCount } = body;

    if (!topic) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }

    const brand = await getBrandProfileForUser(userId);
    const { insforge } = await getInsforgeServerClient();

    const completion = await insforge.ai.chat.completions.create({
      model: "google/gemini-3.8-flash",
      messages: [
        {
          role: "system",
          content: `You are an expert SEO content writer. Write a complete long-form blog article.
Return ONLY valid JSON with this exact structure (no markdown, no extra text):
{
  "title": "SEO-optimised H1 title",
  "metaDescription": "Compelling meta description under 155 chars",
  "slug": "url-friendly-slug",
  "readTime": "8 min read",
  "sections": [
    { "type": "INTRO", "h2": null, "content": "Engaging opening paragraph (2-3 sentences)" },
    { "type": "SECTION", "h2": "H2 section heading", "content": "Full body content for this section (3-5 sentences)" },
    { "type": "FAQ", "h2": "Frequently Asked Questions", "faqs": [{"q": "Question?", "a": "Answer."}] },
    { "type": "CTA", "h2": null, "content": "Closing paragraph with clear CTA" }
  ],
  "socialSnippets": ["Short tweet version", "LinkedIn post version", "Instagram caption version"]
}
Include 3-4 SECTION types between INTRO and FAQ.`,
        },
        {
          role: "user",
          content: `Business: ${brand?.business_name || "My Business"}
Niche: ${brand?.niche || "business"}
Blog Topic: ${topic}
Focus Keyword: ${keyword || topic}
Target Word Count: ~${wordCount || 1200} words
Target Audience: ${brand?.target_audience || "general audience"}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "";
    const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();

    try {
      const blog = JSON.parse(clean);

      try {
        const admin = getInsforgeAdminClient();
        await admin.database.from("studio_drafts").insert({
          user_id: userId,
          type: "BLOG",
          title: topic,
          content_data: blog,
        });
      } catch {}

      return NextResponse.json({ success: true, blog });
    } catch {
      return NextResponse.json(
        { error: "AI response could not be parsed. Please try again.", raw },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("[studio-blogs] Error:", err);
    return NextResponse.json({ error: err?.message || "Generation failed" }, { status: 500 });
  }
}
