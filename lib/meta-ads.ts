/**
 * Meta Marketing API Service
 * Handles: Ad Account discovery, Campaign creation, AdSet, Image upload, and Ad Creative publishing
 * Supports both LIVE mode (Meta Graph API v21.0) and SANDBOX mode (when META_CLIENT_ID is missing)
 */

const META_GRAPH_BASE = "https://graph.facebook.com/v21.0";
const SANDBOX_AD_ACCOUNT = "act_000000000";
const SANDBOX_PAGE_ID = "102345678901234";

export type MetaObjective =
  | "OUTCOME_LEADS"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_SALES"
  | "OUTCOME_ENGAGEMENT"
  | "OUTCOME_AWARENESS";

export type MetaCTA =
  | "LEARN_MORE"
  | "BOOK_NOW"
  | "SHOP_NOW"
  | "SIGN_UP"
  | "CONTACT_US"
  | "GET_QUOTE"
  | "SUBSCRIBE";

export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string;
  account_status: number;
}

export interface MetaCampaignResult {
  id: string;
  name: string;
  status: string;
  sandbox?: boolean;
}

export interface MetaAdSetResult {
  id: string;
  name: string;
  sandbox?: boolean;
}

export interface MetaImageUploadResult {
  hash: string;
  url: string;
  sandbox?: boolean;
}

export interface MetaAdCreativeResult {
  id: string;
  sandbox?: boolean;
}

export interface MetaAdResult {
  id: string;
  name: string;
  status: string;
  preview_url: string;
  sandbox?: boolean;
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function isSandboxMode(): boolean {
  return !process.env.META_CLIENT_ID || !process.env.META_AD_ACCOUNT_ID;
}

async function metaFetch(endpoint: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${META_GRAPH_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const json = (await res.json()) as { error?: { message: string; code: number } };
  if (!res.ok || (json as Record<string, unknown>).error) {
    const err = json.error;
    throw new Error(`Meta API Error [${err?.code ?? res.status}]: ${err?.message ?? "Unknown error"}`);
  }
  return json;
}

// ─── 1. Get Ad Accounts ───────────────────────────────────────────────────────
export async function getMetaAdAccounts(accessToken?: string): Promise<MetaAdAccount[]> {
  if (isSandboxMode() || !accessToken) {
    return [
      {
        id: SANDBOX_AD_ACCOUNT,
        name: "Lemon AI Demo Account (Sandbox)",
        currency: "INR",
        account_status: 1,
      },
    ];
  }

  const data = (await metaFetch(
    `/me/adaccounts?fields=id,name,currency,account_status&access_token=${accessToken}`
  )) as { data: MetaAdAccount[] };
  return data.data ?? [];
}

// ─── 2. Create Campaign ────────────────────────────────────────────────────────
export async function createMetaCampaign(
  adAccountId: string,
  {
    name,
    objective,
    dailyBudget,
    accessToken,
  }: {
    name: string;
    objective: MetaObjective;
    dailyBudget: number;
    accessToken?: string;
  }
): Promise<MetaCampaignResult> {
  if (isSandboxMode() || !accessToken) {
    return {
      id: `sandbox_campaign_${Date.now()}`,
      name,
      status: "PAUSED",
      sandbox: true,
    };
  }

  const result = (await metaFetch(`/${adAccountId}/campaigns`, {
    method: "POST",
    body: JSON.stringify({
      name,
      objective,
      status: "PAUSED",
      special_ad_categories: [],
      access_token: accessToken,
    }),
  })) as MetaCampaignResult;

  return result;
}

// ─── 3. Create AdSet ───────────────────────────────────────────────────────────
export async function createMetaAdSet(
  adAccountId: string,
  {
    campaignId,
    name,
    targetAgeMin,
    targetAgeMax,
    targetInterests,
    dailyBudget,
    startTime,
    endTime,
    accessToken,
  }: {
    campaignId: string;
    name: string;
    targetAgeMin?: number;
    targetAgeMax?: number;
    targetInterests?: string[];
    dailyBudget: number;
    startTime?: string;
    endTime?: string;
    accessToken?: string;
  }
): Promise<MetaAdSetResult> {
  if (isSandboxMode() || !accessToken) {
    return {
      id: `sandbox_adset_${Date.now()}`,
      name,
      sandbox: true,
    };
  }

  const targeting: Record<string, unknown> = {
    age_min: targetAgeMin ?? 18,
    age_max: targetAgeMax ?? 65,
    geo_locations: { countries: ["IN"] },
  };
  if (targetInterests && targetInterests.length > 0) {
    targeting.interests = targetInterests.map((i) => ({ name: i }));
  }

  const result = (await metaFetch(`/${adAccountId}/adsets`, {
    method: "POST",
    body: JSON.stringify({
      name,
      campaign_id: campaignId,
      daily_budget: dailyBudget * 100, // Meta expects paise
      billing_event: "IMPRESSIONS",
      optimization_goal: "REACH",
      targeting,
      status: "PAUSED",
      start_time: startTime ?? new Date().toISOString(),
      end_time: endTime,
      access_token: accessToken,
    }),
  })) as MetaAdSetResult;

  return result;
}

// ─── 4. Upload Image to Meta ───────────────────────────────────────────────────
export async function uploadAdImageToMeta(
  adAccountId: string,
  imageUrl: string,
  accessToken?: string
): Promise<MetaImageUploadResult> {
  if (isSandboxMode() || !accessToken) {
    return {
      hash: `sandbox_hash_${Date.now()}`,
      url: imageUrl,
      sandbox: true,
    };
  }

  // Fetch image as buffer
  const imageRes = await fetch(imageUrl);
  const arrayBuffer = await imageRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");

  const result = (await metaFetch(`/${adAccountId}/adimages`, {
    method: "POST",
    body: JSON.stringify({
      bytes: base64,
      access_token: accessToken,
    }),
  })) as { images: { bytes: { hash: string; url: string } } };

  const imageData = Object.values(result.images)[0] as { hash: string; url: string };
  return { hash: imageData.hash, url: imageData.url };
}

// ─── 5. Create Ad Creative ─────────────────────────────────────────────────────
export async function createMetaAdCreative(
  adAccountId: string,
  {
    imageHash,
    imageUrl,
    headline,
    primaryText,
    callToAction,
    pageId,
    websiteUrl,
    accessToken,
  }: {
    imageHash: string;
    imageUrl: string;
    headline: string;
    primaryText: string;
    callToAction: MetaCTA;
    pageId?: string;
    websiteUrl?: string;
    accessToken?: string;
  }
): Promise<MetaAdCreativeResult> {
  if (isSandboxMode() || !accessToken) {
    return { id: `sandbox_creative_${Date.now()}`, sandbox: true };
  }

  const effectivePageId = pageId ?? process.env.META_PAGE_ID ?? SANDBOX_PAGE_ID;

  const result = (await metaFetch(`/${adAccountId}/adcreatives`, {
    method: "POST",
    body: JSON.stringify({
      name: `Lemon AI Creative - ${headline.substring(0, 30)}`,
      object_story_spec: {
        page_id: effectivePageId,
        link_data: {
          image_hash: imageHash,
          link: websiteUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com",
          message: primaryText,
          name: headline,
          call_to_action: {
            type: callToAction,
            value: { link: websiteUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com" },
          },
        },
      },
      access_token: accessToken,
    }),
  })) as MetaAdCreativeResult;

  return result;
}

// ─── 6. Create Final Ad ────────────────────────────────────────────────────────
export async function createMetaAd(
  adAccountId: string,
  {
    adSetId,
    creativeId,
    name,
    accessToken,
  }: {
    adSetId: string;
    creativeId: string;
    name: string;
    accessToken?: string;
  }
): Promise<MetaAdResult> {
  const previewUrl = `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${adAccountId.replace("act_", "")}`;

  if (isSandboxMode() || !accessToken) {
    return {
      id: `sandbox_ad_${Date.now()}`,
      name,
      status: "DRAFT",
      preview_url: previewUrl,
      sandbox: true,
    };
  }

  const result = (await metaFetch(`/${adAccountId}/ads`, {
    method: "POST",
    body: JSON.stringify({
      name,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: "PAUSED",
      access_token: accessToken,
    }),
  })) as { id: string; name: string; status: string };

  return { ...result, preview_url: previewUrl };
}
