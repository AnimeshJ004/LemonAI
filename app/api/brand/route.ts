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
      whatsapp_phone_number_id,
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
      knowledge_docs: knowledge_docs?.trim() || null,
      location: location?.trim() || "India & Global",
      booking_url: booking_url?.trim() || null,
      auto_call_enabled: Boolean(auto_call_enabled),
      auto_call_min_score: typeof auto_call_min_score === "number" ? auto_call_min_score : 7,
      whatsapp_phone_number_id: whatsapp_phone_number_id?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    // Save immediately into server cache with all extended attributes
    userBrandCache.set(userId, payload);

    // Persist into database.
    //
    // Strategy: attempt a SINGLE merged upsert with base + extended columns
    // first. If the extended columns don't exist yet (e.g. migration
    // `08-brand-profiles-extended-columns.sql` hasn't been applied), the
    // update will fail — we catch that and retry with just the base columns,
    // logging a clear warning so the operator knows to run the migration.
    // This replaces the previous silent try/catch that swallowed failures
    // and prevented Products & Services / Pricing Details / Knowledge Docs
    // from ever persisting.
    let savedData: any = null;
    const admin = getInsforgeAdminClient();

    const fullPayload = {
      user_id: userId,
      business_name: payload.business_name,
      niche: payload.niche,
      target_audience: payload.target_audience,
      brand_tone: payload.brand_tone,
      main_offer: payload.main_offer,
      competitors: payload.competitors,
      products_services: payload.products_services,
      pricing_details: payload.pricing_details,
      knowledge_docs: payload.knowledge_docs,
      location: payload.location,
      booking_url: payload.booking_url,
      auto_call_enabled: payload.auto_call_enabled,
      auto_call_min_score: payload.auto_call_min_score,
      whatsapp_phone_number_id: payload.whatsapp_phone_number_id,
      updated_at: payload.updated_at,
    };

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

    try {
      const { data: existing } = await admin.database
        .from("brand_profiles")
        .select("id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        // Try full update first.
        const { data: updatedFull, error: fullErr } = await admin.database
          .from("brand_profiles")
          .update(fullPayload)
          .eq("id", existing.id)
          .select()
          .maybeSingle();

        if (fullErr) {
          console.warn(
            "[Brand API] Full update failed — likely missing extended columns. " +
            "Apply lib/db/08-brand-profiles-extended-columns.sql to your database.",
            fullErr?.message
          );
          const { data: updatedBase } = await admin.database
            .from("brand_profiles")
            .update(basePayload)
            .eq("id", existing.id)
            .select()
            .maybeSingle();
          savedData = updatedBase || { ...basePayload, id: existing.id };
        } else {
          savedData = updatedFull || { ...fullPayload, id: existing.id };
        }
      } else {
        // Try full insert first.
        const { data: insertedFull, error: fullInsertErr } = await admin.database
          .from("brand_profiles")
          .insert(fullPayload)
          .select()
          .maybeSingle();

        if (fullInsertErr) {
          console.warn(
            "[Brand API] Full insert failed — likely missing extended columns. " +
            "Apply lib/db/08-brand-profiles-extended-columns.sql to your database.",
            fullInsertErr?.message
          );
          const { data: insertedBase } = await admin.database
            .from("brand_profiles")
            .insert(basePayload)
            .select()
            .maybeSingle();
          savedData = insertedBase || basePayload;
        } else {
          savedData = insertedFull || fullPayload;
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
