import {
  createMetaCampaign,
  createMetaAdSet,
  uploadAdImageToMeta,
  createMetaAdCreative,
  createMetaAd,
  type MetaObjective,
  type MetaCTA,
} from "@/lib/meta-ads";
import { getInsforgeServerClient } from "@/lib/insforge-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { insforge, userId } = await getInsforgeServerClient();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      objective,
      daily_budget,
      ad_headline,
      ad_primary_text,
      ad_image_url,
      call_to_action,
      meta_ad_account_id,
      target_age_min,
      target_age_max,
      start_date,
      end_date,
    } = body;

    if (!name || !objective || !daily_budget || !ad_headline || !ad_primary_text) {
      return NextResponse.json({ error: "Missing required campaign fields" }, { status: 400 });
    }

    const adAccountId = meta_ad_account_id ?? process.env.META_AD_ACCOUNT_ID ?? "act_000000000";
    const isSandbox = !process.env.META_CLIENT_ID;

    // Step 1: Create Campaign
    const campaign = await createMetaCampaign(adAccountId, {
      name,
      objective: objective as MetaObjective,
      dailyBudget: daily_budget,
    });

    // Step 2: Create AdSet
    const adSet = await createMetaAdSet(adAccountId, {
      campaignId: campaign.id,
      name: `${name} - AdSet`,
      targetAgeMin: target_age_min ?? 18,
      targetAgeMax: target_age_max ?? 65,
      dailyBudget: daily_budget,
      startTime: start_date,
      endTime: end_date,
    });

    // Step 3: Upload Image
    let imageHash = `sandbox_hash_${Date.now()}`;
    if (ad_image_url) {
      const imageResult = await uploadAdImageToMeta(adAccountId, ad_image_url);
      imageHash = imageResult.hash;
    }

    // Step 4: Create Creative
    const creative = await createMetaAdCreative(adAccountId, {
      imageHash,
      imageUrl: ad_image_url ?? "",
      headline: ad_headline,
      primaryText: ad_primary_text,
      callToAction: (call_to_action ?? "LEARN_MORE") as MetaCTA,
      websiteUrl: process.env.NEXT_PUBLIC_APP_URL,
    });

    // Step 5: Create Ad
    const ad = await createMetaAd(adAccountId, {
      adSetId: adSet.id,
      creativeId: creative.id,
      name: `${name} - Ad`,
    });

    // Step 6: Store in DB
    const campaignRecord = {
      user_id: userId,
      name,
      objective,
      daily_budget,
      ad_headline,
      ad_primary_text,
      ad_image_url: ad_image_url ?? null,
      call_to_action: call_to_action ?? "LEARN_MORE",
      meta_ad_account_id: adAccountId,
      meta_campaign_id: campaign.id,
      meta_adset_id: adSet.id,
      meta_ad_id: ad.id,
      meta_image_hash: imageHash,
      status: isSandbox ? "DRAFT" : "ACTIVE",
      start_date: start_date ?? null,
      end_date: end_date ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data: savedCampaign, error: dbError } = await insforge.database
      .from("meta_campaigns")
      .insert(campaignRecord)
      .select()
      .single();

    if (dbError && dbError.code !== "42P01") {
      console.warn("DB save failed (table may not exist), returning campaign data anyway:", dbError);
    }

    const previewUrl = `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${adAccountId.replace("act_", "")}`;

    return NextResponse.json({
      success: true,
      sandbox: isSandbox,
      campaign: {
        ...(savedCampaign ?? campaignRecord),
        preview_url: previewUrl,
      },
      message: isSandbox
        ? "Campaign created in sandbox mode. Add your Meta credentials to deploy live."
        : "Campaign successfully pushed to Meta Ads Manager!",
    });
  } catch (error) {
    console.error("Error creating Meta campaign:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create campaign" },
      { status: 500 }
    );
  }
}
