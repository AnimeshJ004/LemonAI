import { NextRequest, NextResponse } from "next/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";

/**
 * Public Pricing Endpoint
 *
 *   GET /api/lead-form/pricing?user={userId}
 *     → { packages: PricingPackage[], currency: string, brand: { business_name } }
 *
 * Powers the post-submit pricing display on the public /lead-form page.
 * Unauthenticated — the prospect who submitted the form is not signed in.
 * Only active packages are returned, ordered by display_order.
 *
 * Follows the same pattern as /api/lead-form/brand: uses the admin client to
 * bypass RLS, returns {} gracefully when the brand hasn't configured any
 * packages so the UI can render a sensible fallback.
 */
export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get("user");
  if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 400 });

  try {
    const admin = getInsforgeAdminClient();

    // Fetch active packages ordered for display.
    const { data: packages } = await admin.database
      .from("brand_pricing_packages")
      .select(
        "id, name, price_display, price_amount, currency, billing_period, features, cta_label, is_featured, display_order"
      )
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    // Fetch brand name for header display.
    const { data: brand } = await admin.database
      .from("brand_profiles")
      .select("business_name")
      .eq("user_id", userId)
      .maybeSingle();

    const list = packages || [];
    // Best-effort currency — take the first non-empty one, default INR.
    const currency = list.find((p: any) => p?.currency)?.currency || "INR";

    return NextResponse.json({
      packages: list,
      currency,
      brand: brand || null,
    });
  } catch (err: any) {
    console.warn("[Lead Form Pricing GET] notice:", err?.message);
    return NextResponse.json({ packages: [], currency: "INR", brand: null });
  }
}
