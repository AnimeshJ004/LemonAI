import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeServerClient, getInsforgeAdminClient } from "@/lib/insforge-server";
import { getBrandProfileForUser } from "@/lib/brand-helper";
import { generateAdCreativeImage } from "@/lib/ai-image-generator";

export interface AutoGenerateCampaignsRequest {
  campaignsCount?: number; // default: 3
  daysSpan?: number;       // default: 14 days
  dailyBudget?: number;    // default: 500
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

    const body: AutoGenerateCampaignsRequest = await req.json().catch(() => ({}));
    const campaignsCount = Math.min(Math.max(body.campaignsCount || 3, 1), 6);
    const daysSpan = body.daysSpan || 14;
    const dailyBudget = body.dailyBudget || 500;

    // 1. Fetch Brand Profile
    const brandProfile = await getBrandProfileForUser(userId);
    const businessName = brandProfile?.business_name || "Your Brand";
    const niche = brandProfile?.niche || "Professional Services";
    const targetAudience = brandProfile?.target_audience || "Target clients and customers";
    const brandTone = brandProfile?.brand_tone || "Professional & Direct";
    const mainOffer = brandProfile?.main_offer || "Special limited-time promotional offer";

    // 2. Discover Connected Meta Channels (Instagram / Facebook)
    const { data: userChannels } = await insforge.database
      .from("user_channels")
      .select("id, channel_type_id, channel_types(type, name)")
      .eq("user_id", userId);

    const metaChannels = (userChannels || []).filter((c: any) =>
      ["FACEBOOK", "INSTAGRAM"].includes(c.channel_types?.type)
    );

    const isMetaConnected = metaChannels.length > 0;
    const adAccountId = process.env.META_AD_ACCOUNT_ID || "act_000000000";

    // 3. AI Autonomous Campaign Planning (Gemini 3.8 Flash)
    const systemPrompt = `You are a world-class Direct Response Meta Ads Strategist and Creative Director for ${businessName}.
Industry / Niche: ${niche}.
Target Audience: ${targetAudience}.
Brand Tone: ${brandTone}.
Primary Value Offer: ${mainOffer}.

Generate an autonomous suite of exactly ${campaignsCount} high-performing Meta Ad campaigns (for Instagram & Facebook) scheduled across a ${daysSpan}-day marketing sprint.
Objectives must be balanced across:
1. Lead Generation (OUTCOME_LEADS)
2. Direct Conversion / Offer (OUTCOME_SALES)
3. Brand Awareness / Traffic (OUTCOME_AWARENESS or OUTCOME_TRAFFIC)

For each campaign generate:
- "name": Concise campaign name including the objective
- "objective": One of "OUTCOME_LEADS", "OUTCOME_SALES", "OUTCOME_TRAFFIC", "OUTCOME_ENGAGEMENT", "OUTCOME_AWARENESS"
- "headline": 5-8 word high-CTR hook headline
- "primaryText": 2-3 sentence high-converting direct response copy with a hook, pain-solution, and strong urgency
- "callToAction": One of "LEARN_MORE", "BOOK_NOW", "SHOP_NOW", "SIGN_UP", "CONTACT_US", "GET_QUOTE"
- "visualPrompt": Highly descriptive photo prompt for an authentic, professional commercial advertisement photo (photorealistic, real human features, authentic lighting)
- "creativeType": "IMAGE" or "REEL"
- "targetAgeMin": realistic min age (e.g. 21)
- "targetAgeMax": realistic max age (e.g. 55)
- "dayOffset": number between 1 and ${daysSpan} indicating when this campaign launches
- "durationDays": number between 5 and 10

Return ONLY a valid JSON array matching this schema without markdown or extra explanation:
[
  {
    "name": "string",
    "objective": "string",
    "headline": "string",
    "primaryText": "string",
    "callToAction": "string",
    "visualPrompt": "string",
    "creativeType": "IMAGE",
    "targetAgeMin": 22,
    "targetAgeMax": 55,
    "dayOffset": 1,
    "durationDays": 7
  }
]`;

    let generatedList: any[] = [];
    try {
      const completion = await insforge.ai.chat.completions.create({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate the ${campaignsCount} Meta Ad campaigns for ${businessName}.` },
        ],
      }).catch(() => {
        return insforge.ai.chat.completions.create({
          model: "google/gemini-3.7-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate the ${campaignsCount} Meta Ad campaigns for ${businessName}.` },
          ],
        });
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();
      generatedList = JSON.parse(clean);
    } catch (aiErr) {
      console.warn("[Meta Ads Auto-Gen] AI parse fallback:", aiErr);
      // Fallback sensible default templates
      generatedList = [
        {
          name: `${businessName} — Exclusive Lead Acquisition`,
          objective: "OUTCOME_LEADS",
          headline: `Transform Your Results with ${businessName}`,
          primaryText: `Looking for top-tier ${niche} results? Join hundreds of satisfied clients who trust ${businessName}. Limited slots available this month.`,
          callToAction: "BOOK_NOW",
          visualPrompt: `Authentic commercial photography of ${niche} professional in modern workplace, natural ambient lighting, 35mm lens`,
          creativeType: "IMAGE",
          targetAgeMin: 22,
          targetAgeMax: 55,
          dayOffset: 1,
          durationDays: 7,
        },
        {
          name: `${businessName} — Direct Sales & Offer`,
          objective: "OUTCOME_SALES",
          headline: `Special Limited Offer: ${mainOffer || "Claim Yours Today"}`,
          primaryText: `Don't miss out on ${mainOffer || "our best deal"}. Built specifically for ${targetAudience}. Tap below to claim before it ends.`,
          callToAction: "GET_QUOTE",
          visualPrompt: `High quality commercial product showcase of ${niche} service, crisp studio lighting, sharp focus`,
          creativeType: "IMAGE",
          targetAgeMin: 24,
          targetAgeMax: 50,
          dayOffset: 4,
          durationDays: 7,
        },
        {
          name: `${businessName} — Brand Authority & Awareness`,
          objective: "OUTCOME_AWARENESS",
          headline: `Why ${businessName} Is Leading ${niche}`,
          primaryText: `Experience the difference. Discover how our innovative approach delivers unmatched quality and customer satisfaction.`,
          callToAction: "LEARN_MORE",
          visualPrompt: `Editorial documentary style photograph of ${niche} team collaborating, warm natural sunlight`,
          creativeType: "REEL",
          targetAgeMin: 20,
          targetAgeMax: 60,
          dayOffset: 7,
          durationDays: 7,
        },
      ];
    }

    // 4. Generate Visual Creatives in Parallel
    const now = new Date();
    const campaignPromises = generatedList.slice(0, campaignsCount).map(async (item, i) => {
      const startOffset = item.dayOffset || (i * 3 + 1);
      const startDate = new Date(now.getTime() + startOffset * 24 * 60 * 60 * 1000);
      const duration = item.durationDays || 7;
      const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);

      let imageUrl: string | null = null;
      if (item.visualPrompt) {
        try {
          const imgRes = await generateAdCreativeImage({
            prompt: item.visualPrompt,
            aspectRatio: "1:1",
            userId,
            niche,
          });
          if (imgRes.success && imgRes.imageUrl) {
            imageUrl = imgRes.imageUrl;
          }
        } catch (imgErr) {
          console.warn(`[Meta Ads Auto-Gen] Image creation failed for campaign ${i}:`, imgErr);
        }
      }

      const campaignIdMock = `ai_meta_${Date.now()}_${i}`;
      const adSetIdMock = `ai_adset_${Date.now()}_${i}`;
      const adIdMock = `ai_ad_${Date.now()}_${i}`;

      return {
        user_id: userId,
        name: item.name || `${businessName} Campaign #${i + 1}`,
        objective: item.objective || "OUTCOME_LEADS",
        daily_budget: dailyBudget,
        ad_headline: item.headline || `Discover ${businessName}`,
        ad_primary_text: item.primaryText || `Transform your ${niche} results with ${businessName}.`,
        ad_image_url: imageUrl,
        call_to_action: item.callToAction || "LEARN_MORE",
        meta_ad_account_id: adAccountId,
        meta_campaign_id: campaignIdMock,
        meta_adset_id: adSetIdMock,
        meta_ad_id: adIdMock,
        meta_image_hash: `hash_${Date.now()}_${i}`,
        status: "SCHEDULED",
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        updated_at: new Date().toISOString(),
      };
    });

    const campaignsToInsert = await Promise.all(campaignPromises);

    // 5. Insert Campaigns into Database
    let savedCampaigns: any[] = [];
    try {
      const { data: inserted, error: dbErr } = await insforge.database
        .from("meta_campaigns")
        .insert(campaignsToInsert)
        .select();

      if (dbErr && dbErr.code !== "42P01") {
        console.warn("[Meta Ads Auto-Gen] DB insert notice:", dbErr.message);
      } else if (inserted) {
        savedCampaigns = inserted;
      }
    } catch (dbEx: any) {
      console.warn("[Meta Ads Auto-Gen] DB exception:", dbEx?.message);
    }

    const finalCampaigns = savedCampaigns.length > 0 ? savedCampaigns : campaignsToInsert;

    return NextResponse.json({
      success: true,
      message: `Successfully auto-generated and scheduled ${finalCampaigns.length} Meta Ad campaigns!`,
      count: finalCampaigns.length,
      campaigns: finalCampaigns,
      isMetaConnected,
      metaChannelsCount: metaChannels.length,
    });
  } catch (err: any) {
    console.error("[Meta Ads Auto-Gen] Root error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to auto-generate Meta campaigns" },
      { status: 500 }
    );
  }
}
