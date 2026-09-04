import { getInsforgeAdminClient } from "./insforge-server";

// In-memory brand cache shared across API routes in the same Node process
export const userBrandCache = new Map<string, any>();

export async function getBrandProfileForUser(userId: string) {
  if (!userId) return null;

  // 1. Check in-memory cache first
  const cached = userBrandCache.get(userId);

  // 2. Fetch latest from database
  try {
    const admin = getInsforgeAdminClient();
    const { data: profile, error } = await admin.database
      .from("brand_profiles")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (profile && !error) {
      userBrandCache.set(userId, profile);
      return profile;
    }
  } catch (err: any) {
    console.warn("Notice loading brand profile from DB:", err?.message);
  }

  // Fallback to cache if DB query failed
  return cached || null;
}

export function cleanTag(str?: string, fallback: string = ""): string {
  if (!str) return fallback;
  return str.replace(/[^a-zA-Z0-9]/g, "");
}

export function formatBrandHashtags(brandProfile?: any): string[] {
  const brandName = cleanTag(brandProfile?.business_name, "Brand");
  const niche = cleanTag(brandProfile?.niche, "Business");
  
  const tags = new Set<string>();
  if (brandName) tags.add(`#${brandName}`);
  if (niche) tags.add(`#${niche}`);
  if (niche && niche.length > 2) tags.add(`#${niche}Tips`);
  if (brandName && niche) tags.add(`#${brandName}${niche}`);
  tags.add(`#${niche || "Business"}Growth`);
  tags.add(`#Trending`);

  return Array.from(tags).slice(0, 5);
}
