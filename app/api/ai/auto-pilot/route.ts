import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeServerClient, getInsforgeAdminClient } from "@/lib/insforge-server";
import { generateAdCreativeImage } from "@/lib/ai-image-generator";
import { POST_STATUS } from "@/constants/post";

export interface AutoPilotRequest {
  businessName?: string;
  niche?: string;
  targetAudience?: string;
  brandTone?: string;
  mainOffer?: string;
  competitors?: string;
  daysToGenerate?: number; // default: 7
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { insforge } = await getInsforgeServerClient().catch(() => ({
      insforge: getInsforgeAdminClient(),
    }));

    const body: AutoPilotRequest = await req.json().catch(() => ({}));

    // 1. Fetch saved brand profile if not fully provided in body
    let businessName = body.businessName;
    let niche = body.niche;
    let targetAudience = body.targetAudience;
    let brandTone = body.brandTone || "Professional";
    let mainOffer = body.mainOffer || "";
    let competitors = body.competitors || "";

    if (!businessName || !niche) {
      const { data: profile } = await insforge.database
        .from("brand_profiles")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (profile) {
        businessName = businessName || profile.business_name;
        niche = niche || profile.niche;
        targetAudience = targetAudience || profile.target_audience;
        brandTone = brandTone || profile.brand_tone || "Professional";
        mainOffer = mainOffer || profile.main_offer || "";
        competitors = competitors || profile.competitors || "";
      }
    }

    if (!businessName || !niche) {
      return NextResponse.json(
        { error: "Business Name and Niche are required. Please set up your Brand Profile first." },
        { status: 400 }
      );
    }

    // 2. Fetch user's connected social channels
    const { data: userChannels } = await insforge.database
      .from("user_channels")
      .select("id, channel_type_id, channel_types(type, name, character_limit)")
      .eq("user_id", userId);

    const defaultChannelId = userChannels?.[0]?.id || null;
    const defaultChannelTypeId = userChannels?.[0]?.channel_type_id || null;

    // 3. AI Autonomous Calendar & Ad Strategy Formulation
    const daysCount = body.daysToGenerate || 7;
    const systemPrompt = `You are an elite Autonomous Marketing Director and Copywriting Agent for ${businessName} in the ${niche} industry.
Tone: ${brandTone}.
Target Audience: ${targetAudience || "Target consumers and professionals"}.
Primary Offer: ${mainOffer || "Top quality service and customer satisfaction"}.
Competitor References: ${competitors || "Top industry brands"}.

Generate a complete autonomous marketing package consisting of:
1. Exactly ${daysCount} distinct, high-converting social media posts spread over the next ${daysCount} days.
   - Each post must have engaging copy, hashtags, a specific commercial visual photo description, and a day offset (1 to ${daysCount}).
2. Three direct-response Meta Ad campaign variants (1: Leads, 2: Sales/Offer, 3: Retargeting/Social Proof) with primary ad copy, punchy 5-7 word CTR headlines, and CTA button.

Return ONLY a valid JSON object matching this schema without any markdown formatting:
{
  "socialCalendar": [
    {
      "dayOffset": 1,
      "timeSlot": "10:00 AM",
      "content": "Post caption with hashtags here",
      "visualPrompt": "Authentic professional commercial photo of...",
      "aspectRatio": "1:1"
    }
  ],
  "metaAdCampaigns": [
    {
      "name": "High-Converting Leads Campaign",
      "objective": "OUTCOME_LEADS",
      "headline": "5-7 Word Punchy Headline",
      "primaryText": "Persuasive direct response primary text with hook and CTA",
      "callToAction": "BOOK_NOW",
      "visualPrompt": "Authentic commercial advertising photography of...",
      "aspectRatio": "1:1"
    }
  ]
}`;

    const completion = await insforge.ai.chat.completions.create({
      model: "google/gemini-3.8-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate the full autonomous marketing package for ${businessName}.` },
      ],
    }).catch(() => {
      return insforge.ai.chat.completions.create({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate the full autonomous marketing package for ${businessName}.` },
        ],
      });
    });

    const rawResponse = completion.choices[0]?.message?.content ?? "";
    const cleanJson = rawResponse.replace(/```(?:json)?\s*|\s*```/g, "").trim();
    let generatedData: any = {};

    try {
      generatedData = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.warn("Auto-pilot JSON parse fallback:", parseErr);
      return NextResponse.json({ error: "Failed to parse AI marketing package" }, { status: 500 });
    }

    const socialCalendar = generatedData.socialCalendar || [];
    const metaAdCampaigns = generatedData.metaAdCampaigns || [];

    // 4. Generate AI Images and Insert Posts into Calendar Table (`posts`) in Parallel
    const now = new Date();

    const postPromises = socialCalendar.map(async (item: any, i: number) => {
      const offsetDays = item.dayOffset || (i + 1);
      const scheduledDate = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);

      // Parse time (e.g. 10:00 AM, 3:30 PM)
      const timeParts = (item.timeSlot || "10:00 AM").match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (timeParts) {
        let hour = parseInt(timeParts[1], 10);
        const min = parseInt(timeParts[2], 10) || 0;
        const meridiem = timeParts[3]?.toUpperCase() || "AM";
        if (meridiem === "PM" && hour < 12) hour += 12;
        if (meridiem === "AM" && hour === 12) hour = 0;
        scheduledDate.setHours(hour, min, 0, 0);
      }

      // Generate 8K Photorealistic Image for the post
      let imageObj: { url: string; key: string } | null = null;
      if (item.visualPrompt) {
        try {
          const imgResult = await generateAdCreativeImage({
            prompt: item.visualPrompt,
            aspectRatio: item.aspectRatio || "1:1",
            userId,
            niche,
          });
          if (imgResult.success && imgResult.imageUrl) {
            imageObj = {
              url: imgResult.imageUrl,
              key: imgResult.storageKey || `autopilot-${Date.now()}-${i}`,
            };
          }
        } catch (imgErr) {
          console.warn("Auto-pilot image generation error:", imgErr);
        }
      }

      // Insert post into InsForge database
      try {
        const { data: postRecord } = await insforge.database
          .from("posts")
          .insert({
            user_id: userId,
            user_channel_id: defaultChannelId,
            channel_type_id: defaultChannelTypeId,
            content: item.content,
            images: imageObj ? [imageObj] : [],
            scheduled_at: scheduledDate.toISOString(),
            status: POST_STATUS.QUEUE,
          })
          .select()
          .maybeSingle();

        return postRecord || null;
      } catch (insertErr) {
        console.warn("Post insert error in auto-pilot:", insertErr);
        return null;
      }
    });

    const results = await Promise.all(postPromises);
    const createdPosts = results.filter(Boolean);

    return NextResponse.json({
      success: true,
      message: `Successfully generated ${createdPosts.length} scheduled posts and ${metaAdCampaigns.length} Meta Ad campaigns on auto-pilot!`,
      brand: { businessName, niche, targetAudience, brandTone },
      createdPostsCount: createdPosts.length,
      createdPosts,
      metaAdCampaigns,
    });
  } catch (error: any) {
    console.error("Auto-pilot engine error:", error);
    return NextResponse.json({ error: error.message || "Failed to execute auto-pilot engine" }, { status: 500 });
  }
}
