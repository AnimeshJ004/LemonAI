import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getBrandProfileForUser, formatBrandHashtags } from "@/lib/brand-helper";
import { generateAdCreativeImage } from "@/lib/ai-image-generator";
import { callResilientCompletion } from "@/lib/ai-gateway";

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      topic = "",
      postType = "QUOTE", // "QUOTE" | "TIP" | "FRAMEWORK" | "MYTH_BUST" | "MINDSET"
      aspectRatio = "4:5", // "4:5" | "1:1"
      customHandle = "",
      customBrandName = "",
    } = body;

    // 1. Fetch Brand Profile
    const brandProfile = await getBrandProfileForUser(userId);
    const brandName = customBrandName || brandProfile?.business_name || "Modern Brand";
    const brandNiche = brandProfile?.niche || "Business & Growth";
    const brandTone = brandProfile?.brand_tone || "Luxury, professional, authoritative";
    const targetAudience = brandProfile?.target_audience || "Entrepreneurs & modern professionals";
    const mainOffer = brandProfile?.main_offer || brandProfile?.products_services || "High-value digital solutions";
    const brandHashtags = formatBrandHashtags(brandProfile);

    // Instagram handle fallback
    const suggestedHandle = customHandle || (brandName.toLowerCase().replace(/[^a-z0-9]/g, "") ? `@${brandName.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "@lemon_ai");

    // 2. Synthesize High-Impact Overlay Copy & Context
    const systemPrompt = `You are a world-class Instagram creative director and copywriter for luxury brands, creators, and modern founders.
Your job is to generate a viral, high-retention Instagram visual post concept with overlay text tailored to this specific Brand Profile:
- Brand Name: ${brandName}
- Industry / Niche: ${brandNiche}
- Audience: ${targetAudience}
- Tone / Vibe: ${brandTone}
- Core Offer: ${mainOffer}

Format & Type requested: ${postType} (Aspect ratio: ${aspectRatio})
Specific Topic or Direction: ${topic ? `"${topic}"` : "Derive the single most viral, high-value insight for this brand"}

Return ONLY a valid JSON object matching this structure:
{
  "category": "Short 2-3 word uppercase category/pill (e.g., 'FOUNDER LESSON', 'GROWTH FRAMEWORK', 'UNPOPULAR TRUTH', 'PRO TIP')",
  "headline": "A punchy, viral 8-15 word statement or quote that stops the scroll. Clean, impactful, thought-provoking.",
  "subtext": "A 1-2 sentence supporting takeaway or action step (max 25 words).",
  "callToAction": "Short swipe or save prompt (e.g. 'Save this for your next sprint', 'Double tap if you agree')",
  "backgroundVisualIdea": "A 1-2 sentence real-world commercial architectural, office, or product photography scene with generous negative copy space for text overlay (e.g. 'Minimalist concrete architectural workspace with warm afternoon window shadows and clean open wall'). Must be real-life photography taken with a camera. Do NOT use drawings or character art.",
  "caption": "A full Instagram caption with hook line, 3 value bullet points, call to action, and hashtags."
}`;

    const completion = await callResilientCompletion<{
      category: string;
      headline: string;
      subtext: string;
      callToAction: string;
      backgroundVisualIdea: string;
      caption: string;
    }>({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate the Instagram branded post text & visual direction for: ${topic || brandNiche}` },
      ],
      jsonMode: true,
      temperature: 0.7,
      maxTokens: 600,
    });

    let generatedContent = completion.content;
    if (typeof generatedContent === "string") {
      try {
        const clean = (generatedContent as string).replace(/```json|```/g, "").trim();
        generatedContent = JSON.parse(clean);
      } catch {
        generatedContent = {
          category: "FOUNDER INSIGHT",
          headline: "The difference between consistency and failure is doing it when you don't feel like it.",
          subtext: "Master the fundamentals before trying to optimize the edge cases.",
          callToAction: "Save this reminder for later.",
          backgroundVisualIdea: "Minimalist architectural studio setting with soft natural light.",
          caption: `Success isn't accidental. It is built one intentional decision at a time.\n\nSave this if you agree!\n\n${brandHashtags.join(" ")}`,
        } as any;
      }
    }

    const payload = generatedContent as {
      category?: string;
      headline?: string;
      subtext?: string;
      callToAction?: string;
      backgroundVisualIdea?: string;
      caption?: string;
    };

    // 3. Generate Brand Aligned Background Image with generous negative space
    const imagePrompt = payload.backgroundVisualIdea || `${brandNiche} minimalist aesthetic photography, commercial studio setting with soft diffused lighting and negative space for text overlay`;
    
    const imageResult = await generateAdCreativeImage({
      prompt: imagePrompt,
      aspectRatio: aspectRatio as any,
      userId,
      niche: brandNiche,
      brandProfile,
    });

    return NextResponse.json({
      success: true,
      data: {
        category: payload.category || "STRATEGY TIP",
        headline: payload.headline || "Consistency builds empires.",
        subtext: payload.subtext || "Stay focused on what moves the needle.",
        callToAction: payload.callToAction || "Save & share this with a peer.",
        caption: payload.caption || `Level up with ${brandName}.\n\n${brandHashtags.join(" ")}`,
        brandName,
        suggestedHandle,
        imageUrl: imageResult.imageUrl,
        aspectRatio,
        provider: imageResult.provider,
        hashtags: brandHashtags,
      },
    });
  } catch (error: any) {
    console.error("[Branded Post API Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate branded post" },
      { status: 500 }
    );
  }
}
