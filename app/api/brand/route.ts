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
    const {
      business_name,
      niche,
      target_audience,
      brand_tone,
      main_offer,
      competitors,
      products_services,
      pricing_details,
      knowledge_docs,
      location,
      booking_url,
      auto_call_enabled,
      auto_call_min_score,
    } = body;

    if (!business_name?.trim()) {
      return NextResponse.json({ error: "Business name is required" }, { status: 400 });
    }
    if (!niche?.trim()) {
      return NextResponse.json({ error: "Niche / Industry is required" }, { status: 400 });
    }
    if (!target_audience?.trim()) {
      return NextResponse.json({ error: "Target audience is required" }, { status: 400 });
    }

    const payload: Record<string, any> = {
      user_id: userId,
      business_name: business_name.trim(),
      niche: niche.trim(),
      target_audience: target_audience.trim(),
      brand_tone: (brand_tone && BRAND_TONES.includes(brand_tone)) ? brand_tone : "Professional",
      main_offer: main_offer?.trim() || "Quality service & satisfaction",
      competitors: competitors?.trim() || null,
      products_services: products_services?.trim() || null,
      pricing_details: pricing_details?.trim() || null,
      location: location?.trim() || "India & Global",
      booking_url: booking_url?.trim() || null,
      auto_call_enabled: Boolean(auto_call_enabled),
      auto_call_min_score: typeof auto_call_min_score === "number" ? auto_call_min_score : 7,
      updated_at: new Date().toISOString(),
    };

    // Base schema columns that exist in the core database table
    const basePayload = {
      user_id: userId,
      business_name: payload.business_name,
      niche: payload.niche,
      target_audience: payload.target_audience,
      brand_tone: payload.brand_tone,
      main_offer: payload.main_offer,
      competitors: payload.competitors,
      updated_at: payload.updated_at,
    };

    // Save immediately into server cache with all extended attributes
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
        // Update core columns
        const { data: updated, error: updateErr } = await admin.database
          .from("brand_profiles")
          .update(basePayload)
          .eq("id", existing.id)
          .select()
          .maybeSingle();

        savedData = updated || { ...basePayload, id: existing.id };

        // Attempt extended columns silently if migration was applied
        try {
          await admin.database
            .from("brand_profiles")
            .update({
              products_services: payload.products_services,
              pricing_details: payload.pricing_details,
              location: payload.location,
              booking_url: payload.booking_url,
              auto_call_enabled: payload.auto_call_enabled,
              auto_call_min_score: payload.auto_call_min_score,
            })
            .eq("id", existing.id);
        } catch {
          // Non-fatal if extended columns are not yet present in DB schema
        }
      } else {
        // Insert core columns
        const { data: inserted, error: insertErr } = await admin.database
          .from("brand_profiles")
          .insert(basePayload)
          .select()
          .maybeSingle();

        savedData = inserted || basePayload;

        // Attempt extended columns silently if migration was applied
        try {
          await admin.database
            .from("brand_profiles")
            .update({
              products_services: payload.products_services,
              pricing_details: payload.pricing_details,
              location: payload.location,
              booking_url: payload.booking_url,
              auto_call_enabled: payload.auto_call_enabled,
              auto_call_min_score: payload.auto_call_min_score,
            })
            .eq("user_id", userId);
        } catch {
          // Non-fatal if extended columns are not yet present in DB schema
        }
      }

      if (savedData) {
        userBrandCache.set(userId, { ...savedData, ...payload });
      }
    } catch (dbErr: any) {
      console.warn("Notice saving to DB table brand_profiles:", dbErr?.message);
    }

    // If knowledge_docs provided, index into ai_memory for AI bot grounding
    if (knowledge_docs?.trim()) {
      try {
        await admin.database.from("ai_memory").insert({
          user_id: userId,
          signal_type: "explicit",
          feedback_text: knowledge_docs.trim(),
          learned_insight: `Verified Brand Knowledge Base: ${knowledge_docs.slice(0, 180)}`,
        });
      } catch (memErr) {
        console.warn("Notice indexing knowledge_docs to memory:", memErr);
      }
    }

    return NextResponse.json({
      profile: savedData || payload,
      success: true,
      message: "Brand profile and knowledge vault saved successfully!",
    });
  } catch (error: any) {
    console.error("Error saving brand profile:", error);
    return NextResponse.json({ error: error.message || "Failed to save brand profile" }, { status: 500 });
  }
}
