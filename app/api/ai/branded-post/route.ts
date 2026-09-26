import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getBrandProfileForUser, formatBrandHashtags } from "@/lib/brand-helper";
import { generateAdCreativeImage, detectProfileCategory } from "@/lib/ai-image-generator";
import { callResilientCompletion } from "@/lib/ai-gateway";
import { validateInputLengths } from "@/lib/validate-inputs";

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

    // 2. Detect Profile Category for Context-Aware Copy Generation
    const profileCategory = detectProfileCategory(brandProfile, brandNiche);

    // Category-specific copy voice and pill label guidelines
    const CATEGORY_COPY_GUIDES: Record<string, { voice: string; pillExamples: string; captionStyle: string }> = {
      software_tech: {
        voice: "Intelligent, product-led, developer-centric. Use technical precision, innovation language, and outcomes-focused messaging. Reference efficiency, velocity, automation, and competitive advantage.",
        pillExamples: "'DEVOPS INSIGHT', 'SAAS GROWTH', 'PRODUCT LAUNCH', 'TECH TREND', 'FOUNDER MODE'",
        captionStyle: "Lead with a product truth or technical insight. Use numbered bullet points for actionable tips. End with a clear product CTA.",
      },
      influencer_creator: {
        voice: "Authentic, aspirational, vibrant, personal and relatable. Use 'I discovered', 'here's what changed everything', real story-driven language, and community-building CTAs.",
        pillExamples: "'CREATOR INSIGHT', 'COLLAB ALERT', 'BEHIND THE LENS', 'LIFESTYLE TIP', 'CONTENT SECRET'",
        captionStyle: "Start with a personal hook story. Use casual, authentic language. End with 'save this' or 'comment below' community CTA.",
      },
      philosopher_thinker: {
        voice: "Profound, contemplative, Socratic. Use timeless wisdom, paradoxes, philosophical inquiry, and deep human truths. Reference Stoicism, Existentialism, or universal principles. Never use business jargon.",
        pillExamples: "'STOIC WISDOM', 'ANCIENT TRUTH', 'DEEP THOUGHT', 'PHILOSOPHY', 'EXAMINED LIFE'",
        captionStyle: "Open with a paradox or provocative question. Expand with philosophical reasoning. End with an introspective question for the reader.",
      },
      writer_author: {
        voice: "Literary, lyrical, evocative. Use vivid imagery, storytelling craft, narrative tension, and the craft of writing itself. Reference books, characters, and the creative process.",
        pillExamples: "'WRITING CRAFT', 'STORY TRUTH', 'AUTHOR INSIGHT', 'LITERARY TIP', 'FIRST DRAFT'",
        captionStyle: "Open with a vivid one-line story hook. Share a writing insight or technique. End with a reading or writing challenge for the audience.",
      },
      fitness_health: {
        voice: "Energetic, motivational, science-backed. Use action verbs, transformation language, athletic identity, and real results. Be direct and no-fluff. Reference reps, consistency, and discipline.",
        pillExamples: "'TRAINING TIP', 'NUTRITION HACK', 'MINDSET SHIFT', 'RECOVERY WIN', 'FORM CHECK'",
        captionStyle: "Open with a bold motivational hook. List 3 specific actionable tips. End with an accountability CTA like 'comment your goal below'.",
      },
      ecommerce_fashion: {
        voice: "Aspirational, trend-forward, aesthetic. Use desire-building language, style authority, and FOMO-driven copy. Reference seasons, exclusivity, and editorial quality.",
        pillExamples: "'STYLE EDIT', 'NEW DROP', 'TREND ALERT', 'WARDROBE TIP', 'EDITORIAL PICK'",
        captionStyle: "Open with an aspirational style statement. Describe the aesthetic feeling. End with a shop/discover CTA.",
      },
      finance_consulting: {
        voice: "Authoritative, trust-building, outcome-focused. Use wealth creation language, ROI-driven insights, risk management, and executive-level thinking. Be precise and cite frameworks.",
        pillExamples: "'WEALTH INSIGHT', 'STRATEGY BRIEF', 'MARKET TRUTH', 'EXEC LESSON', 'ROI FRAMEWORK'",
        captionStyle: "Open with a bold financial truth. Break down 3 key principles. End with a consultation or discovery CTA.",
      },
      food_restaurant: {
        voice: "Sensory-rich, appetizing, artisan. Use descriptive taste language, culinary craftsmanship, and farm-to-table authenticity. Make the reader taste and smell the content.",
        pillExamples: "'CHEF SECRET', 'TODAY\\'S SPECIAL', 'RECIPE TIP', 'FOOD STORY', 'KITCHEN WISDOM'",
        captionStyle: "Open with a vivid sensory description. Share the story behind the dish. End with a reservation, order, or recipe CTA.",
      },
      real_estate: {
        voice: "Aspirational, architectural, investment-minded. Use luxury property language, lifestyle aspiration, location prestige, and value creation. Make the reader envision living there.",
        pillExamples: "'PROPERTY INSIGHT', 'MARKET REPORT', 'DESIGN TIP', 'LUXURY LIVING', 'INVESTMENT WIN'",
        captionStyle: "Open with a lifestyle aspiration hook. Highlight 3 property or market insights. End with a viewing or consultation CTA.",
      },
      general: {
        voice: "Professional, modern, growth-oriented. Use aspirational business language, leadership insights, and value-creation messaging.",
        pillExamples: "'FOUNDER INSIGHT', 'GROWTH TIP', 'STRATEGY WIN', 'BUSINESS TRUTH', 'PRO TIP'",
        captionStyle: "Open with a bold insight hook. List 3 value bullet points. End with a save/share CTA.",
      },
    };

    const copyGuide = CATEGORY_COPY_GUIDES[profileCategory] || CATEGORY_COPY_GUIDES.general;

    // 3. Synthesize High-Impact Category-Aware Overlay Copy
    const systemPrompt = `You are a world-class Instagram creative director and copywriter specializing in the "${copyGuide.voice.split(".")[0]}" space.
Your job is to generate a viral, high-retention Instagram visual post concept with overlay text perfectly tailored to this specific Brand Profile and its industry:

Brand Profile:
- Brand Name: ${brandName}
- Profile Category: ${profileCategory.replace(/_/g, " ").toUpperCase()} (${copyGuide.voice.split(".")[0]})
- Industry / Niche: ${brandNiche}
- Audience: ${targetAudience}
- Tone / Vibe: ${brandTone}
- Core Offer: ${mainOffer}

COPY VOICE: ${copyGuide.voice}

Format & Type requested: ${postType} (Aspect ratio: ${aspectRatio})
Specific Topic or Direction: ${topic ? `"${topic}"` : `Derive the single most viral, high-value insight for this ${profileCategory.replace(/_/g, " ")} brand`}

Return ONLY a valid JSON object matching this structure:
{
  "category": "Short 2-3 word uppercase category pill. Examples for this profile type: ${copyGuide.pillExamples}",
  "headline": "A punchy, viral 8-15 word statement perfectly aligned with the ${profileCategory.replace(/_/g, " ")} voice. Stops the scroll.",
  "subtext": "A 1-2 sentence supporting insight or action step in the ${profileCategory.replace(/_/g, " ")} voice (max 25 words).",
  "callToAction": "Short save or engagement prompt fitting the ${profileCategory.replace(/_/g, " ")} audience style.",
  "backgroundVisualIdea": "A 1-2 sentence real-world commercial photography scene that fits the ${profileCategory.replace(/_/g, " ")} aesthetic with generous negative copy space. Must be real-life photography taken with a camera. Do NOT use drawings or character art.",
  "caption": "${copyGuide.captionStyle} Write a full Instagram caption with hook line, 3 value bullet points, call to action, and relevant hashtags."
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
        { role: "user", content: `Generate the Instagram branded post text & visual direction for: ${topic || brandNiche} (Profile type: ${profileCategory.replace(/_/g, " ")})` },
      ],
      jsonMode: true,
      temperature: 0.7,
      maxTokens: 700,
    });

    let generatedContent = completion.content;
    if (typeof generatedContent === "string") {
      try {
        const clean = (generatedContent as string).replace(/```json|```/g, "").trim();
        generatedContent = JSON.parse(clean);
      } catch {
        generatedContent = {
          category: copyGuide.pillExamples.split(",")[0].replace(/['"]/g, "").trim(),
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

    // 4. Generate Category-Matched Background Image with generous negative space
    const imagePrompt = payload.backgroundVisualIdea || `${brandNiche} ${profileCategory.replace(/_/g, " ")} aesthetic photography, commercial studio setting with soft diffused lighting and negative space for text overlay`;

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
        imageUrl: imageResult.imageUrls?.[0],
        aspectRatio,
        provider: imageResult.provider,
        hashtags: brandHashtags,
        profileCategory,
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
