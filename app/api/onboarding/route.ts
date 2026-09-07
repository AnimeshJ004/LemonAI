import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { userBrandCache } from "@/lib/brand-helper";

/** 1-year cookie options — onboarding is a one-time event */
const ONBOARDED_COOKIE = "lemon_ai_onboarded";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365, // 1 year
  path: "/",
};


/**
 * GET /api/onboarding
 * Check if the current user has completed onboarding.
 * Returns { completed: boolean }
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ completed: false, authenticated: false }, { status: 401 });
    }

    const admin = getInsforgeAdminClient();
    const { data: profile, error } = await admin.database
      .from("brand_profiles")
      .select("id, business_name, onboarding_completed")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !profile) {
      return NextResponse.json({ completed: false });
    }

    // Consider completed if they have onboarding_completed = true OR
    // if they already filled out the brand profile manually (business_name exists)
    const completed = Boolean(profile.onboarding_completed || profile.business_name?.trim());

    const res = NextResponse.json({ completed });

    // Set the cookie so the middleware can skip the DB check for future requests
    if (completed) {
      res.cookies.set(ONBOARDED_COOKIE, "1", COOKIE_OPTIONS);
    }

    return res;
  } catch (error: any) {
    console.error("[Onboarding GET] Error:", error);
    return NextResponse.json({ completed: false });
  }
}

/**
 * POST /api/onboarding
 * Save the full onboarding brand data and mark onboarding as complete.
 *
 * Body: {
 *   business_name: string
 *   niche: string
 *   target_audience: string
 *   brand_tone: string
 *   main_offer: string
 *   competitors: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      business_name,
      niche,
      target_audience,
      brand_tone,
      main_offer,
      competitors,
    } = body;

    if (!business_name?.trim()) {
      return NextResponse.json({ error: "Business name is required" }, { status: 400 });
    }

    const payload = {
      user_id: userId,
      business_name: business_name.trim(),
      niche: (niche || "").trim(),
      target_audience: (target_audience || "").trim(),
      brand_tone: brand_tone || "Professional",
      main_offer: (main_offer || "").trim(),
      competitors: (competitors || "").trim() || null,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    };

    const admin = getInsforgeAdminClient();

    // Check if profile already exists
    const { data: existing } = await admin.database
      .from("brand_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    let savedData: any = null;

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

    // Update in-memory cache so other routes see the new profile immediately
    if (savedData) {
      userBrandCache.set(userId, savedData);
    }

    const res = NextResponse.json({
      success: true,
      profile: savedData || payload,
      message: "Onboarding completed! Welcome to Lemon AI 🍋",
    });

    // Set permanent onboarding cookie so middleware doesn't redirect again
    res.cookies.set(ONBOARDED_COOKIE, "1", COOKIE_OPTIONS);

    return res;
  } catch (error: any) {
    console.error("[Onboarding POST] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save onboarding data" },
      { status: 500 }
    );
  }
}
