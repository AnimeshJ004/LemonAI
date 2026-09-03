import { getInsforgeServerClient } from "@/lib/insforge-server";
import { NextRequest, NextResponse } from "next/server";

const BRAND_TONES = ["Professional", "Friendly", "Bold", "Luxury", "Energetic"] as const;

export async function GET() {
  try {
    const { insforge, userId } = await getInsforgeServerClient();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await insforge.database
      .from("brand_profiles")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      // Table might not exist yet — return null profile gracefully
      if (error.code === "42P01") {
        return NextResponse.json({ profile: null, tableExists: false });
      }
      throw error;
    }

    return NextResponse.json({ profile: data ?? null, tableExists: true });
  } catch (error) {
    console.error("Error fetching brand profile:", error);
    return NextResponse.json({ error: "Failed to fetch brand profile" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { insforge, userId } = await getInsforgeServerClient();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
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
    if (!main_offer?.trim()) {
      return NextResponse.json({ error: "Main offer is required" }, { status: 400 });
    }
    if (brand_tone && !BRAND_TONES.includes(brand_tone)) {
      return NextResponse.json({ error: "Invalid brand tone" }, { status: 400 });
    }

    const payload = {
      user_id: userId,
      business_name: business_name.trim(),
      niche: niche.trim(),
      target_audience: target_audience.trim(),
      brand_tone: brand_tone ?? "Professional",
      main_offer: main_offer.trim(),
      competitors: competitors?.trim() ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await insforge.database
      .from("brand_profiles")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json(
          {
            error:
              "Database table 'brand_profiles' not found. Please run the migration SQL in your InsForge dashboard.",
            sqlFile: "lib/db/create-brand-profiles-and-meta-ads-tables.sql",
          },
          { status: 503 }
        );
      }
      throw error;
    }

    return NextResponse.json({ profile: data, success: true });
  } catch (error) {
    console.error("Error saving brand profile:", error);
    return NextResponse.json({ error: "Failed to save brand profile" }, { status: 500 });
  }
}
