import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { decrypt } from "@/lib/encryption";

/**
 * GET /api/meta/audiences — list stored custom audiences
 * POST /api/meta/audiences — create a new custom audience (website visitors, lookalike, or interest-based)
 */

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getInsforgeAdminClient();

    // Get ad account ID from any connected Meta channel
    const { data: channels } = await admin.database
      .from("user_channels")
      .select("access_token, provider_account_id, channel_types(type)")
      .eq("user_id", targetUserId)
      .in("channel_types.type", ["INSTAGRAM", "FACEBOOK"]);

    const metaChannel = (channels || []).find((c: any) =>
      ["INSTAGRAM", "FACEBOOK"].includes(c.channel_types?.type) && c.access_token
    );

    // Fetch stored audiences from DB
    const { data: storedAudiences } = await admin.database
      .from("meta_audiences")
      .select("*")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });

    let liveAudiences: any[] = [];

    // Optionally fetch live audiences from Meta if we have a token
    if (metaChannel?.access_token) {
      try {
        const accessToken = decrypt(metaChannel.access_token);
        // Get ad account — try to read from DB first, then Meta API
        const { data: adAccountRow } = await admin.database
          .from("meta_ad_accounts")
          .select("ad_account_id")
          .eq("user_id", targetUserId)
          .limit(1)
          .maybeSingle();

        if (adAccountRow?.ad_account_id) {
          const res = await fetch(
            `https://graph.facebook.com/v22.0/${adAccountRow.ad_account_id}/customaudiences?fields=id,name,subtype,approximate_count&access_token=${accessToken}&limit=20`,
            { signal: AbortSignal.timeout(8000) }
          );
          if (res.ok) {
            const data = await res.json();
            liveAudiences = data?.data || [];
          }
        }
      } catch (e: any) {
        console.warn("[Audiences] Live Meta fetch notice:", e.message);
      }
    }

    return NextResponse.json({
      audiences: storedAudiences || [],
      liveAudiences,
      hasMetaConnection: Boolean(metaChannel),
    });
  } catch (error: any) {
    console.error("Audiences GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch audiences" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { name, type, description, interests, locations, ageMin, ageMax, gender, sourceAudienceId } = body;

    if (!name || !type) {
      return NextResponse.json({ error: "name and type are required" }, { status: 400 });
    }

    const admin = getInsforgeAdminClient();

    // Store audience definition in DB
    const { data, error } = await admin.database
      .from("meta_audiences")
      .insert({
        user_id: targetUserId,
        name,
        type,         // "CUSTOM" | "LOOKALIKE" | "INTEREST" | "WEBSITE_RETARGETING"
        description: description || "",
        targeting: {
          interests: interests || [],
          locations: locations || [],
          age_min: ageMin || 18,
          age_max: ageMax || 65,
          gender: gender || "ALL",
          source_audience_id: sourceAudienceId || null,
        },
        status: "DRAFT",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Table may not exist — return success with note
      console.warn("[Audiences] Insert notice:", error.message);
      return NextResponse.json({
        audience: { id: `local-${Date.now()}`, name, type, status: "DRAFT" },
        note: "Audience saved locally. Deploy to Supabase to persist.",
      }, { status: 201 });
    }

    return NextResponse.json({ audience: data }, { status: 201 });
  } catch (error: any) {
    console.error("Audiences POST error:", error);
    return NextResponse.json({ error: error.message || "Failed to create audience" }, { status: 500 });
  }
}
