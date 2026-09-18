import { NextRequest, NextResponse } from "next/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createLead, updateLead, recordActivity } from "@/lib/crm-service";

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, {
      limit: 10,
      windowMs: 60_000,
      namespace: "lead-form-submit",
    });
    if (limited) return limited;

    const body = await req.json();
    const { userId, type, source, name, email, phone, service, message, budgetRange, timeline, preferredDate, preferredTimeSlot, selectedPackageId } = body;

    if (!userId || !name || !email || !phone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = getInsforgeAdminClient();

    // If a package was selected, look it up so we can seed deal_value from its
    // real numeric price (more accurate than the budget-range heuristic).
    let selectedPackage: {
      id: string;
      name: string;
      price_display: string;
      price_amount: number | null;
    } | null = null;

    if (selectedPackageId) {
      try {
        const { data: pkg } = await admin.database
          .from("brand_pricing_packages")
          .select("id, name, price_display, price_amount, user_id")
          .eq("id", selectedPackageId)
          .maybeSingle();

        // Guard: package must belong to the same user_id the form was submitted for.
        if (pkg && pkg.user_id === userId) {
          selectedPackage = {
            id: pkg.id,
            name: pkg.name,
            price_display: pkg.price_display,
            price_amount:
              typeof pkg.price_amount === "number" ? pkg.price_amount : null,
          };
        }
      } catch (pkgErr: any) {
        console.warn("[Lead Form Submit] Package lookup notice:", pkgErr?.message);
      }
    }

    // Estimate deal value from budget range
    const budgetDealValue = budgetRange?.includes("1,00,000+") ? 150000
      : budgetRange?.includes("50,000") ? 75000
      : budgetRange?.includes("20,000") ? 35000
      : budgetRange?.includes("5,000") ? 12000
      : 5000;

    // Prefer the real package price when available; otherwise use the budget heuristic.
    const dealValue =
      selectedPackage?.price_amount && selectedPackage.price_amount > 0
        ? selectedPackage.price_amount
        : budgetDealValue;

    const isBooking = type === "booking" && Boolean(preferredDate);
    const stage = isBooking ? "booked" : "qualified";

    const normalizedSource = String(source || "instagram").toLowerCase().replace(/[^a-z_]/g, "");
    const crmSource = ["instagram", "facebook", "instagram_dm", "facebook_dm"].includes(normalizedSource)
      ? normalizedSource
      : "instagram";

    const notes = type === "pricing"
      ? `Pricing enquiry via lead form. Budget: ${budgetRange || "N/A"}. Timeline: ${timeline || "N/A"}. Service: ${service}.${
          selectedPackage ? ` Selected package: ${selectedPackage.name} (${selectedPackage.price_display}).` : ""
        } Message: ${message || ""}`
      : `Appointment request via lead form. Service: ${service}. Date: ${preferredDate || "TBD"}. Slot: ${preferredTimeSlot || "TBD"}. Notes: ${message || ""}`;

    const metadata: Record<string, any> = {
      leadFormSource: source,
      service,
      formType: type,
    };

    if (isBooking) {
      metadata.bookingInfo = {
        dateText: `${preferredDate}${preferredTimeSlot ? " at " + preferredTimeSlot : ""}`,
        scheduledAt: preferredDate,
        timeSlot: preferredTimeSlot,
        topic: service,
        bookingSource: `lead_form_${crmSource}`,
        bookedAt: new Date().toISOString(),
        status: "confirmed",
        notes: message || "",
      };
    }

    if (type === "pricing") {
      metadata.pricingInquiry = {
        budgetRange,
        timeline,
        service,
        message,
        receivedAt: new Date().toISOString(),
        selectedPackageId: selectedPackage?.id || null,
        selectedPackageName: selectedPackage?.name || null,
        selectedPackagePriceDisplay: selectedPackage?.price_display || null,
      };
    }

    // Check for existing lead with same email
    const { data: existing } = await admin.database
      .from("leads")
      .select("id")
      .eq("user_id", userId)
      .eq("email", email)
      .limit(1);

    let leadId: string;

    if (existing && existing.length > 0 && existing[0]?.id) {
      leadId = existing[0].id;
      await updateLead(leadId, {
        name,
        phone,
        stage,
        score: isBooking ? 9 : 7,
        deal_value: dealValue,
        metadata: {
          ...metadata,
          notes,
        },
      });
    } else {
      const lead = await createLead({
        user_id: userId,
        name,
        email,
        phone,
        source: crmSource,
        stage,
        score: isBooking ? 9 : 7,
        deal_value: dealValue,
        notes,
        metadata: {
          ...metadata,
          notes,
        },
      });
      leadId = lead.id;
    }

    await recordActivity({
      user_id: userId,
      lead_id: leadId,
      type: isBooking ? "meeting_scheduled" : "lead_created",
      title: isBooking
        ? `Appointment booked by ${name} via ${source} Lead Form`
        : `Pricing enquiry from ${name} via ${source} Lead Form`,
      description: notes.slice(0, 200),
      metadata: { formType: type, source, service },
    });

    return NextResponse.json({ success: true, leadId, stage });
  } catch (err: any) {
    console.error("[Lead Form Submit] Error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
