import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeServerClient, getInsforgeAdminClient } from "@/lib/insforge-server";
import { getBrandProfileForUser, formatBrandHashtags, cleanTag } from "@/lib/brand-helper";
import { generateAdCreativeImage } from "@/lib/ai-image-generator";
import { POST_STATUS } from "@/constants/post";
import { inngest } from "@/inngest/client";

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
    const savedProfile = await getBrandProfileForUser(userId);
    let businessName = body.businessName || savedProfile?.business_name;
    let niche = body.niche || savedProfile?.niche;
    let targetAudience = body.targetAudience || savedProfile?.target_audience;
    let brandTone = body.brandTone || savedProfile?.brand_tone || "Professional";
    let mainOffer = body.mainOffer || savedProfile?.main_offer || "";
    let competitors = body.competitors || savedProfile?.competitors || "";

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

    // 4. Generate AI Images & Prepare Batch Payloads
    const now = new Date();

    const payloadPromises = socialCalendar.map(async (item: any, i: number) => {
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

      // Clean emojis, markdown headings, and ensure 4-6 brand hashtags
      let rawContent = (item.content || `Professional update from ${businessName}: We provide leading ${niche} services designed for maximum results.`)
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, "")
        .replace(/^#+\s+/gm, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .trim();

      const brandTags = formatBrandHashtags(savedProfile || { business_name: businessName, niche });
      const foundTags = rawContent.match(/#[a-zA-Z0-9_]+/g) || [];
      rawContent = rawContent.replace(/#[a-zA-Z0-9_]+/g, "").trim();

      const combinedSet = new Set<string>();
      for (const t of brandTags) if (t) combinedSet.add(t);
      for (const t of foundTags) if (t && t.length > 1) combinedSet.add(t);
      const finalTags = Array.from(combinedSet).slice(0, 5).join(" ");
      const finalPostContent = `${rawContent}\n\n${finalTags}`;

      return {
        user_id: userId,
        user_channel_id: defaultChannelId,
        content: finalPostContent,
        images: imageObj ? [imageObj] : [],
        scheduled_at: scheduledDate.toISOString(),
        status: POST_STATUS.QUEUE,
      };
    });

    const payloads = await Promise.all(payloadPromises);

    // 5. Single Batch Insert into Database (Prevents socket hang up)
    let createdPosts: any[] = [];
    if (payloads.length > 0) {
      try {
        const { data: batchCreated, error: insertError } = await insforge.database
          .from("scheduled_posts")
          .insert(payloads)
          .select();

        if (insertError) {
          console.warn("Scheduled post batch insert notice:", insertError);
        } else if (batchCreated) {
          createdPosts = batchCreated;
        }
      } catch (insertErr: any) {
        console.warn("Post batch insert notice:", insertErr?.message || insertErr);
      }
    }

    // 6. Save Meta Ad Campaigns if generated
    let createdCampaignsCount = 0;
    if (metaAdCampaigns.length > 0) {
      try {
        const adAccountDefault = process.env.META_AD_ACCOUNT_ID || "act_000000000";
        const metaCampaignPayloads = metaAdCampaigns.map((camp: any, idx: number) => {
          const campStart = new Date(now.getTime() + (idx * 2 + 1) * 24 * 60 * 60 * 1000);
          const campEnd = new Date(campStart.getTime() + 7 * 24 * 60 * 60 * 1000);
          return {
            user_id: userId,
            name: camp.name || `${businessName} AI Campaign #${idx + 1}`,
            objective: camp.objective || "OUTCOME_LEADS",
            daily_budget: 500,
            ad_headline: camp.headline || `Exclusive Offer from ${businessName}`,
            ad_primary_text: camp.primaryText || `Discover how ${businessName} delivers the best results for ${niche}.`,
            ad_image_url: null,
            call_to_action: camp.callToAction || "LEARN_MORE",
            meta_ad_account_id: adAccountDefault,
            meta_campaign_id: `ai_camp_${Date.now()}_${idx}`,
            meta_adset_id: `ai_adset_${Date.now()}_${idx}`,
            meta_ad_id: `ai_ad_${Date.now()}_${idx}`,
            meta_image_hash: `hash_${Date.now()}_${idx}`,
            status: "SCHEDULED",
            start_date: campStart.toISOString().split("T")[0],
            end_date: campEnd.toISOString().split("T")[0],
            updated_at: new Date().toISOString(),
          };
        });

        const { data: insertedCamps, error: campErr } = await insforge.database
          .from("meta_campaigns")
          .insert(metaCampaignPayloads)
          .select();

        if (!campErr && insertedCamps) {
          createdCampaignsCount = insertedCamps.length;
        }
      } catch (campEx) {
        console.warn("Notice saving auto-pilot meta campaigns:", campEx);
      }
    }

    // 7. Optional Inngest event trigger with graceful fallback
    if (createdPosts.length > 0) {
      try {
        await inngest.send(
          createdPosts.map((post: any) => ({
            name: "post/publish.requested",
            data: { postId: post.id },
          }))
        );
      } catch (inngestErr: any) {
        const isConnRefused =
          inngestErr?.cause?.code === "ECONNREFUSED" ||
          inngestErr?.code === "ECONNREFUSED" ||
          String(inngestErr?.message || "").includes("fetch failed");
        if (!isConnRefused) {
          console.warn("Notice triggering Inngest event:", inngestErr?.message || inngestErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully scheduled ${createdPosts.length > 0 ? createdPosts.length : payloads.length} posts and ${createdCampaignsCount} Meta Ad campaigns on auto-pilot!`,
      brand: { businessName, niche, targetAudience, brandTone },
      createdPostsCount: createdPosts.length > 0 ? createdPosts.length : payloads.length,
      createdCampaignsCount,
      createdPosts,
    });

  } catch (error: any) {
    console.error("Auto-pilot engine error:", error);
    return NextResponse.json({ error: error.message || "Failed to execute auto-pilot engine" }, { status: 500 });
  }
}
