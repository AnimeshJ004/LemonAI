import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { getBrandProfileForUser } from "@/lib/brand-helper";
import { callResilientCompletion } from "@/lib/ai-gateway";
import { validateInputLengths } from "@/lib/validate-inputs";

export const maxDuration = 90;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { topic, keyword, secondaryKeywords, wordCount, searchIntent } = body;

    if (!topic) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }

    const invalid = validateInputLengths(body, { topic: 500, keyword: 200 });
    if (invalid) return invalid;

    const brand = await getBrandProfileForUser(userId);
    const targetWordCount = Math.min(Math.max(Number(wordCount || 1200), 600), 2500);
    const focusKeyword = (keyword || topic).trim();
    const secKeywordsList = Array.isArray(secondaryKeywords)
      ? secondaryKeywords.map((k: any) => String(k).trim()).filter(Boolean)
      : typeof secondaryKeywords === "string"
      ? secondaryKeywords.split(",").map((k) => k.trim()).filter(Boolean)
      : [];
    const intent = searchIntent || "Informational / How-To";

    const completion = await callResilientCompletion({
      jsonMode: true,
      messages: [
        {
          role: "system",
          content: `You are an elite SEO content strategist and technical copywriter. Write a comprehensive, high-ranking long-form SEO blog article designed to capture Google Featured Snippets and drive organic conversions.
Return ONLY valid JSON with this exact structure (no markdown wrapper, no extra text):
{
  "title": "SEO-optimized H1 title under 60 chars containing primary keyword",
  "metaDescription": "Compelling meta description between 120-155 characters containing primary keyword and clear click incentive",
  "slug": "url-friendly-slug",
  "readTime": "7 min read",
  "searchIntent": "${intent}",
  "focusKeyword": "${focusKeyword}",
  "secondaryKeywords": ${JSON.stringify(secKeywordsList)},
  "keyTakeaways": [
    "Crucial takeaway point 1 for quick executive summary",
    "Crucial takeaway point 2",
    "Crucial takeaway point 3"
  ],
  "sections": [
    { "type": "INTRO", "h2": null, "content": "Compelling hook, industry context, the core problem statement, and thesis preview (3-5 sentences)" },
    { "type": "SECTION", "h2": "1. Strategic Foundation & First Principles", "content": "Comprehensive deep-dive paragraph explaining the core methodology, why traditional methods fall short, and actionable tactical guidelines." },
    { "type": "SECTION", "h2": "2. Step-by-Step Implementation Framework", "content": "Detailed, practical execution steps. Include specific benchmarks, metrics, and workflows." },
    { "type": "SECTION", "h2": "3. Common Pitfalls & How to Avoid Them", "content": "The biggest mistakes practitioners make and counter-intuitive lessons learned from real-world testing." },
    { "type": "SECTION", "h2": "4. Scaling and Measuring Compounding ROI", "content": "Long-term optimization strategy, key performance indicators (KPIs) to track weekly, and continuous iteration." },
    { "type": "FAQ", "h2": "Frequently Asked Questions", "faqs": [
      { "q": "High-intent question formulated for Google People Also Ask?", "a": "Direct, authoritative 2-3 sentence answer providing instant clarity." },
      { "q": "Second common customer question?", "a": "Concise, actionable answer." },
      { "q": "Third practical question?", "a": "Clear answer with practical benchmark." }
    ]},
    { "type": "CTA", "h2": null, "content": "Inspiring closing summary with a strong, actionable conversion call-to-action." }
  ],
  "socialSnippets": [
    "Engaging Twitter/X thread hook summarizing the core takeaway",
    "LinkedIn leadership breakdown post with 3 key lessons",
    "Instagram carousel caption with hook and call-to-comment"
  ],
  "seoMetrics": {
    "estimatedWordCount": ${targetWordCount},
    "readingLevel": "Grade 8 (Optimal for general industry readability)",
    "recommendedInternalLinks": ["Strategic Guide", "Automation Framework", "Case Studies"]
  }
}
Write substantive, in-depth paragraphs for every section to meet ~${targetWordCount} words. Include at least 4 SECTION items between INTRO and FAQ.`,
        },
        {
          role: "user",
          content: `Business: ${brand?.business_name || "My Business"}
Niche: ${brand?.niche || "business"}
Blog Topic: ${topic}
Focus Keyword: ${focusKeyword}
Secondary Keywords: ${secKeywordsList.length > 0 ? secKeywordsList.join(", ") : "None specified"}
Target Word Count: ~${targetWordCount} words
Search Intent: ${intent}
Target Audience: ${brand?.target_audience || "general audience"}`,
        },
      ],
    });

    let blog = completion.data;
    if (!blog || !Array.isArray(blog.sections) || blog.sections.length === 0) {
      const safeSlug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
      blog = {
        title: `The Ultimate Guide to ${topic}: Proven Strategies That Scale`,
        metaDescription: `Master ${focusKeyword} with our proven step-by-step playbook. Learn actionable frameworks, avoid common mistakes, and maximize your growth today.`,
        slug: safeSlug || "seo-blog-guide",
        readTime: `${Math.max(5, Math.round(targetWordCount / 200))} min read`,
        searchIntent: intent,
        focusKeyword: focusKeyword,
        secondaryKeywords: secKeywordsList.length > 0 ? secKeywordsList : ["growth strategy", "optimization", "automation"],
        keyTakeaways: [
          `Mastering ${focusKeyword} requires systematic execution rather than disconnected manual tactics.`,
          `High-performing teams automate low-leverage distribution to focus 80% of effort on core content quality.`,
          `Tracking leading velocity metrics weekly ensures you identify bottlenecks before they compound into missed pipeline goals.`
        ],
        sections: [
          {
            type: "INTRO",
            h2: null,
            content: `In modern competitive markets, mastering ${topic} is no longer merely an experimental advantage—it is the foundational pillar separating market leaders from those plagued by stagnation. When executing correctly, your distribution compounds exponentially; when ignored, you spend immense resources chasing diminishing returns. In this comprehensive guide, we dissect the battle-tested mechanisms required to scale ${focusKeyword} sustainably.`,
          },
          {
            type: "SECTION",
            h2: `1. The Strategic Paradigm Shift in ${focusKeyword}`,
            content: `Most practitioners approach ${focusKeyword} by copying surface-level tactics without understanding the underlying flywheel mechanics. To build lasting organic authority, your first step must be establishing clear audience resonance criteria. Rather than broadcasting generic messaging, identify the exact friction points and search intent triggers that compel decision-makers to act. By structuring your initial assets around these core themes, you systematically de-risk your content investment from day one.`,
          },
          {
            type: "SECTION",
            h2: "2. The Step-by-Step Implementation Framework",
            content: `Execution discipline is where true competitive moats are forged. Begin by auditing your existing baseline metrics: reach, conversion velocity, and engagement retention. Next, operationalize your weekly production cadence with modular templates and automated syndication workflows. When your workflow removes manual friction, your team can consistently deliver high-impact insights without suffering burnout or quality degradation.`,
          },
          {
            type: "SECTION",
            h2: "3. Crucial Bottlenecks & Common Traps to Eliminate",
            content: `Even seasoned teams stumble into preventable bottlenecks when scaling ${topic}. The most pervasive trap is premature channel fragmentation—spreading resources thin across five platforms before achieving repeatable predictability on one. The second fatal mistake is vanity metric chasing: optimizing for impressions that fail to generate pipeline. Focus relentlessly on qualified actions and high-intent engagement.`,
          },
          {
            type: "SECTION",
            h2: "4. Compounding Long-Term ROI and Continuous Optimization",
            content: `The true beauty of a disciplined approach to ${focusKeyword} lies in compounding returns over time. Every authoritative asset you publish acts as a permanent, non-depreciating distribution node that continues attracting organic traffic month after month. Schedule monthly optimization sprints to refresh older high-ranking pieces with new data, update internal linking architectures, and repurpose winning conclusions into social carousels and micro-content.`,
          },
          {
            type: "FAQ",
            h2: "Frequently Asked Questions",
            faqs: [
              {
                q: `How quickly can we expect measurable organic results with ${focusKeyword}?`,
                a: `While initial leading indicators such as engagement and search impressions typically emerge within 14 to 30 days, substantial compounding domain authority and conversion momentum generally mature between 60 to 90 days of consistent publishing.`,
              },
              {
                q: `What is the most critical factor for success with ${topic}?`,
                a: `Consistency of high-value insight combined with disciplined distribution. Producing one exceptional, comprehensive asset per week outperforms publishing superficial daily posts that fail to solve tangible reader problems.`,
              },
              {
                q: `How do we track and attribute real revenue back to this strategy?`,
                a: `Implement unified UTM parameter tagging and monitor CRM deal velocity for prospects who interacted with your educational assets prior to booking discovery calls.`,
              },
            ],
          },
          {
            type: "CTA",
            h2: null,
            content: `Scaling your reach with ${topic} doesn't have to be a guessing game. Take these frameworks, integrate them into your weekly workflow, and start turning your content into a predictable growth engine today. Have questions about tailoring this to your specific niche? Reach out to our strategy team for a personalized audit.`,
          },
        ],
        socialSnippets: [
          `Why do 90% of teams fail at ${topic}? They copy tactics instead of systems. Here is the 4-step framework we used to turn ${focusKeyword} into a compounding pipeline engine: [Read Guide]`,
          `Stop treating ${focusKeyword} like an afterthought. Here are the 3 non-negotiable shifts high-growth teams make to capture organic market share in 2026. Breakdown in comments 🧵👇`,
          `New Deep Dive: The complete playbook on mastering ${topic} without burnout. Swipe through for the core takeaways or read the full article via the link in our bio.`,
        ],
        seoMetrics: {
          estimatedWordCount: targetWordCount,
          readingLevel: "Grade 8 (Plain, actionable English)",
          recommendedInternalLinks: ["Lead Generation Playbook", "Content Repurposing Guide", "Conversion Funnel Optimization"],
        },
      };
    }

    // Ensure fallback fields exist if partial JSON was returned
    if (!blog.focusKeyword) blog.focusKeyword = focusKeyword;
    if (!blog.searchIntent) blog.searchIntent = intent;
    if (!blog.keyTakeaways || !Array.isArray(blog.keyTakeaways)) {
      blog.keyTakeaways = [
        `Systematic execution of ${focusKeyword} creates long-term organic authority.`,
        `Focusing on high-intent search problems accelerates qualified lead acquisition.`,
        `Continuous updating and syndication compound organic returns over time.`
      ];
    }
    if (!blog.seoMetrics) {
      blog.seoMetrics = {
        estimatedWordCount: targetWordCount,
        readingLevel: "Grade 8",
        recommendedInternalLinks: ["Growth Playbook", "Content Strategy"],
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
