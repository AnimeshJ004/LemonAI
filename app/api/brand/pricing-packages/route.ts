import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";

/**
 * Brand Pricing Packages API
 *
 * Authenticated CRUD used by the brand-profile settings UI.
 *
 *   GET     /api/brand/pricing-packages
 *     → returns { packages: PricingPackage[] } for the current user
 *
 *   POST    /api/brand/pricing-packages
 *     body: { packages: PricingPackage[] }
 *     → bulk-replaces the user's package list (simplest UX: user edits the
 *       list in-place and hits Save once). Existing rows for the user are
 *       deleted, then the new list is inserted with fresh IDs.
 *
 *   DELETE  /api/brand/pricing-packages?id={uuid}
 *     → deletes a single package (only if it belongs to the current user)
 */

interface IncomingPackage {
  id?: string;
  name: string;
  price_display: string;
  price_amount?: number | null;
  currency?: string;
  billing_period?: string;
  features?: string[];
  cta_label?: string;
  is_featured?: boolean;
  display_order?: number;
  is_active?: boolean;
}

function sanitize(pkg: IncomingPackage, userId: string, index: number) {
  return {
    user_id: userId,
    name: String(pkg.name || "").trim().slice(0, 80),
    price_display: String(pkg.price_display || "").trim().slice(0, 60),
    price_amount:
      typeof pkg.price_amount === "number" && isFinite(pkg.price_amount)
        ? pkg.price_amount
        : null,
    currency: (pkg.currency || "INR").toString().trim().toUpperCase().slice(0, 6),
    billing_period: pkg.billing_period?.toString().trim().slice(0, 30) || null,
    features: Array.isArray(pkg.features)
      ? pkg.features.map((f) => String(f).trim()).filter(Boolean).slice(0, 20)
      : [],
    cta_label: pkg.cta_label?.toString().trim().slice(0, 40) || null,
    is_featured: Boolean(pkg.is_featured),
    display_order: typeof pkg.display_order === "number" ? pkg.display_order : index,
    is_active: pkg.is_active === false ? false : true,
    updated_at: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getInsforgeAdminClient();
    const { data, error } = await admin.database
      .from("brand_pricing_packages")
      .select("*")
      .eq("user_id", userId)
      .order("display_order", { ascending: true });

    if (error) {
      // Table may not exist yet in some environments — return empty gracefully.
      console.warn("[Pricing Packages GET] Insforge notice:", error?.message);
      return NextResponse.json({ packages: [], tableExists: false });
    }

    return NextResponse.json({ packages: data || [], tableExists: true });
  } catch (err: any) {
    console.error("[Pricing Packages GET] Error:", err);
    return NextResponse.json({ packages: [], tableExists: false });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const incoming: IncomingPackage[] = Array.isArray(body?.packages) ? body.packages : [];

    // Validate: each package must have a name + price_display.
    const rows = incoming
      .map((p, i) => sanitize(p, userId, i))
      .filter((p) => p.name && p.price_display);

    if (incoming.length > 0 && rows.length === 0) {
      return NextResponse.json(
        { error: "Every package must include both a name and a price_display." },
        { status: 400 }
      );
    }

    if (rows.length > 12) {
      return NextResponse.json(
        { error: "You can save at most 12 pricing packages." },
        { status: 400 }
      );
    }

    const admin = getInsforgeAdminClient();

    // Bulk-replace strategy: delete all existing rows for the user, insert the new list.
    // This keeps the UI simple (edit-in-place, single Save button) and avoids
    // stale rows lingering when the user removes a tier.
    try {
      await admin.database.from("brand_pricing_packages").delete().eq("user_id", userId);
    } catch (delErr: any) {
      console.warn("[Pricing Packages POST] delete-existing notice:", delErr?.message);
    }

    if (rows.length > 0) {
      const { data: inserted, error: insertErr } = await admin.database
        .from("brand_pricing_packages")
        .insert(rows)
        .select();

      if (insertErr) {
        console.error("[Pricing Packages POST] insert failed:", insertErr.message);
        return NextResponse.json(
          { error: insertErr.message || "Failed to save packages." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        packages: inserted || rows,
        success: true,
        message: `Saved ${rows.length} pricing package(s).`,
      });
    }

    // Empty list: user cleared all packages.
    return NextResponse.json({
      packages: [],
      success: true,
      message: "Cleared all pricing packages.",
    });
  } catch (err: any) {
    console.error("[Pricing Packages POST] Error:", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const admin = getInsforgeAdminClient();
    const { error } = await admin.database
      .from("brand_pricing_packages")
      .delete()
      .eq("id", id)
      .eq("user_id", userId); // defense in depth beyond RLS

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Pricing Packages DELETE] Error:", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
