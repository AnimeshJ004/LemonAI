import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { getBrandProfileForUser } from "@/lib/brand-helper";
import { callResilientCompletion } from "@/lib/ai-gateway";

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

    const completion = await callResilientCompletion({
      jsonMode: true,
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

    let blog = completion.data;
    if (!blog || !Array.isArray(blog.sections)) {
      blog = {
        title: `The Ultimate Guide to ${topic}: Strategies That Actually Work`,
        metaDescription: `Discover the proven framework to master ${topic}. Actionable steps, expert insights, and real-world implementation strategies.`,
        slug: topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50),
        readTime: "7 min read",
        sections: [
          {
            type: "INTRO",
            h2: null,
            content: `In today's fast-moving market, excelling at ${topic} is no longer optional—it is a core competitive advantage. Here is what separates top performers from those who struggle with inconsistency.`,
          },
          {
            type: "SECTION",
            h2: "1. The Fundamental Shift in Strategy",
            content: `Most practitioners focus on superficial hacks rather than establishing solid systems. By structuring your approach around clear milestones, you eliminate friction and accelerate outcomes significantly.`,
          },
          {
            type: "SECTION",
            h2: "2. Automating High-Value Workflows",
            content: `Execution speed dictates market capture. Implementing modern automation and intelligent tooling frees your team to focus on strategic initiatives rather than repetitive manual tasks.`,
          },
          {
            type: "SECTION",
            h2: "3. Measuring and Compounding Real ROI",
            content: `Tracking leading indicators weekly ensures you adjust course before bottlenecks compound. Consistently review high-performing channels to double down on what works.`,
          },
          {
            type: "FAQ",
            h2: "Frequently Asked Questions",
            faqs: [
              {
                q: `How quickly can we see results with ${topic}?`,
                a: `Most teams begin seeing measurable improvements in reach and pipeline velocity within the first 14 to 30 days of consistent implementation.`,
              },
              {
                q: "What is the biggest mistake to avoid?",
                a: "Avoid spreading your resources across too many disconnected channels before perfecting your core conversion funnel.",
              },
            ],
          },
          {
            type: "CTA",
            h2: null,
            content: `Ready to accelerate your results? Contact our strategy team today to schedule your personalized roadmap consultation.`,
          },
        ],
        socialSnippets: [
          `Struggling with ${topic}? Here are the 3 foundational shifts that actually move the needle: [Read full guide]`,
          `Why most companies fail at ${topic} (and how to fix it in 30 days): A breakdown of our proven framework.`,
          `New Playbook: The complete guide to ${topic} for high-growth businesses. Link in bio!`,
        ],
      };
    }

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
  } catch (err: any) {
    console.error("[studio-blogs] Error:", err);
    return NextResponse.json({ error: err?.message || "Generation failed" }, { status: 500 });
  }
}
