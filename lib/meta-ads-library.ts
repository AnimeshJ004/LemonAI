import { getInsforgeAdminClient, getInsforgeServerClient } from "./insforge-server";

export interface TrendingAd {
  id: string;
  advertiserName: string;
  headline: string;
  primaryText: string;
  callToAction: string;
  imageUrl?: string;
  estimatedSpendTier: "LOW" | "MEDIUM" | "HIGH";
  isActive: boolean;
  startDate?: string;
  platforms: string[];
  whyItWorks?: string;
}

/**
 * Fetches trending competitor ads from Meta Ads Archive API
 * Falls back to AI-generated competitive intelligence if API unavailable
 */
export async function fetchTrendingMetaAds(params: {
  niche: string;
  country: string;
  userId: string;
}): Promise<TrendingAd[]> {
  const { niche, country, userId } = params;
  const admin = getInsforgeAdminClient();

  // Check cache first (valid for 6 hours)
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  try {
    const { data: cached } = await admin.database
      .from("meta_ads_library_cache")
      .select("ads_data, fetched_at")
      .eq("user_id", userId)
      .eq("niche", niche)
      .eq("country", country)
      .gte("fetched_at", sixHoursAgo)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.ads_data && Array.isArray(cached.ads_data) && cached.ads_data.length > 0) {
      return cached.ads_data as TrendingAd[];
    }
  } catch (err) {
    console.warn("Error querying meta_ads_library_cache:", err);
  }

  // Try Meta Ads Archive API (requires META_ADS_ACCESS_TOKEN env var)
  let ads: TrendingAd[] = [];
  const metaToken = process.env.META_ADS_ACCESS_TOKEN;

  if (metaToken) {
    try {
      const searchQuery = encodeURIComponent(niche);
      const url = `https://graph.facebook.com/v22.0/ads_archive?access_token=${metaToken}&ad_type=ALL&ad_reached_countries=["${country}"]&search_terms=${searchQuery}&fields=id,page_name,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_captions,ad_delivery_start_time,publisher_platforms,currency,impressions&limit=10`;
      
      const res = await fetch(url, { next: { revalidate: 0 } });
      if (res.ok) {
        const json = await res.json();
        ads = (json.data || []).slice(0, 6).map((ad: any, i: number) => ({
          id: ad.id || `meta-${i}`,
          advertiserName: ad.page_name || "Competitor Brand",
          headline: ad.ad_creative_link_titles?.[0] || "Check this out",
          primaryText: ad.ad_creative_bodies?.[0] || ad.ad_creative_link_captions?.[0] || "",
          callToAction: "LEARN_MORE",
          estimatedSpendTier: i < 2 ? "HIGH" : i < 4 ? "MEDIUM" : "LOW",
          isActive: true,
          startDate: ad.ad_delivery_start_time,
          platforms: ad.publisher_platforms || ["facebook", "instagram"],
        }));
      }
    } catch (e) {
      console.warn("Meta Ads Archive API error, falling back to AI:", e);
    }
  }

  // AI Fallback: Generate realistic competitive ad intelligence
  if (ads.length === 0) {
    try {
      const { insforge } = await getInsforgeServerClient();
      const completion = await insforge.ai.chat.completions.create({
        model: "google/gemini-3.8-flash",
        messages: [{
          role: "user",
          content: `Generate 6 realistic trending Meta ads for the "${niche}" niche targeting ${country}. Return ONLY valid JSON array:
[
  {
    "id": "ad_1",
    "advertiserName": "Brand Name",
    "headline": "Short punchy headline",
    "primaryText": "Ad body copy (2-3 sentences)",
    "callToAction": "LEARN_MORE",
    "estimatedSpendTier": "HIGH",
    "isActive": true,
    "platforms": ["instagram", "facebook"],
    "whyItWorks": "Brief explanation of why this ad format is performing well"
  }
]`
        }]
      });
      const raw = completion.choices[0]?.message?.content || "[]";
      const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();
      try { ads = JSON.parse(clean); } catch {}
    } catch (err) {
      console.warn("AI generation failed for trending ads:", err);
    }
  }

  // Fallback mock ads if both API and AI fail
  if (!ads || ads.length === 0) {
    ads = [
      {
        id: "ad_fallback_1",
        advertiserName: `${niche} Pro`,
        headline: `Transform Your ${niche} Results Today`,
        primaryText: `Stop struggling with outdated strategies. Discover how leading brands in ${niche} achieve 3x ROI with our automated solutions.`,
        callToAction: "LEARN_MORE",
        estimatedSpendTier: "HIGH",
        isActive: true,
        platforms: ["instagram", "facebook"],
        whyItWorks: "Strong hook addressing direct pain points with clear social proof.",
      },
      {
        id: "ad_fallback_2",
        advertiserName: `Apex ${niche}`,
        headline: `Limited Spots: Premium ${niche} Growth`,
        primaryText: `Get access to the exact framework that scaled 500+ businesses this year. Claim your free consultation today.`,
        callToAction: "BOOK_NOW",
        estimatedSpendTier: "MEDIUM",
        isActive: true,
        platforms: ["instagram", "facebook"],
        whyItWorks: "Urgency combined with risk-free introductory offer.",
      },
    ];
  }

  // Cache results if possible
  if (ads.length > 0) {
    try {
      await admin.database.from("meta_ads_library_cache").insert({
        user_id: userId,
        niche,
        country,
        ads_data: ads,
      });
    } catch (err) {
      console.warn("Failed to cache meta ads in DB:", err);
    }
  }

  return ads;
}
