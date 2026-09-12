import { NextRequest, NextResponse } from "next/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { createLead, updateLead, recordActivity } from "@/lib/crm-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, type, source, name, email, phone, service, message, budgetRange, timeline, preferredDate, preferredTimeSlot } = body;

    if (!userId || !name || !email || !phone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = getInsforgeAdminClient();

    // Estimate deal value from budget range
    const dealValue = budgetRange?.includes("1,00,000+") ? 150000
      : budgetRange?.includes("50,000") ? 75000
      : budgetRange?.includes("20,000") ? 35000
      : budgetRange?.includes("5,000") ? 12000
      : 5000;

    const isBooking = type === "booking" && Boolean(preferredDate);
    const stage = isBooking ? "booked" : "qualified";

    const normalizedSource = String(source || "instagram").toLowerCase().replace(/[^a-z_]/g, "");
    const crmSource = ["instagram", "facebook", "instagram_dm", "facebook_dm"].includes(normalizedSource)
      ? normalizedSource
      : "instagram";

    const notes = type === "pricing"
      ? `Pricing enquiry via lead form. Budget: ${budgetRange || "N/A"}. Timeline: ${timeline || "N/A"}. Service: ${service}. Message: ${message || ""}`
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
