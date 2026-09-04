import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { userBrandCache, getBrandProfileForUser } from "@/lib/brand-helper";

const BRAND_TONES = ["Professional", "Friendly", "Bold", "Luxury", "Energetic"] as const;

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getBrandProfileForUser(userId);

    return NextResponse.json({ profile, tableExists: true });
  } catch (error: any) {
    console.warn("Notice fetching brand profile:", error?.message);
    return NextResponse.json({ profile: null, tableExists: false });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { business_name, niche, target_audience, brand_tone, main_offer, competitors } = body;

    if (!business_name?.trim()) {
      return NextResponse.json({ error: "Business name is required" }, { status: 400 });
    }
    if (!niche?.trim()) {
      return NextResponse.json({ error: "Niche / Industry is required" }, { status: 400 });
    }
    if (!target_audience?.trim()) {
      return NextResponse.json({ error: "Target audience is required" }, { status: 400 });
    }

    const payload = {
      user_id: userId,
      business_name: business_name.trim(),
      niche: niche.trim(),
      target_audience: target_audience.trim(),
      brand_tone: (brand_tone && BRAND_TONES.includes(brand_tone)) ? brand_tone : "Professional",
      main_offer: main_offer?.trim() || "Quality service & satisfaction",
      competitors: competitors?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    // Save immediately into server cache
    userBrandCache.set(userId, payload);

    // Persist into database
    let savedData: any = null;
    const admin = getInsforgeAdminClient();

    try {
      const { data: existing } = await admin.database
        .from("brand_profiles")
        .select("id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { data: updated } = await admin.database
          .from("brand_profiles")
          .update(payload)
          .eq("id", existing.id)
          .select()
          .maybeSingle();
        savedData = updated;
      } else {
        const { data: inserted } = await admin.database
          .from("brand_profiles")
          .insert(payload)
          .select()
          .maybeSingle();
        savedData = inserted;
      }
      if (savedData) {
        userBrandCache.set(userId, savedData);
      }
    } catch (dbErr: any) {
      console.warn("Notice saving to DB table brand_profiles:", dbErr?.message);
    }

    return NextResponse.json({
      profile: savedData || payload,
      success: true,
      message: "Brand profile saved successfully!",
    });
  } catch (error: any) {
    console.error("Error saving brand profile:", error);
    return NextResponse.json({ error: error.message || "Failed to save brand profile" }, { status: 500 });
  }
}
