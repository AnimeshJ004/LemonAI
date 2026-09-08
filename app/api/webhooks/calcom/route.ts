import { NextRequest, NextResponse } from "next/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { updateLead, Lead } from "@/lib/crm-service";

export const maxDuration = 30;

/**
 * Cal.com Webhook Handler
 * Receives BOOKING_CREATED, BOOKING_RESCHEDULED, and BOOKING_CANCELLED events.
 * Automatically updates lead pipeline stage to 'booked'.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const event = body?.triggerEvent || body?.event || "BOOKING_CREATED";
    const payload = body?.payload || body;

    const attendee = payload?.attendees?.[0];
    const attendeeEmail = attendee?.email || payload?.email;
    const attendeeName = attendee?.name || payload?.name || "Scheduled Prospect";
    const startTime = payload?.startTime || payload?.start || new Date().toISOString();
    const meetingUrl = payload?.location || payload?.meetingUrl || `https://cal.com/meeting/${payload?.uid || Date.now()}`;
    const bookingId = String(payload?.id || payload?.uid || Date.now());

    if (!attendeeEmail) {
      return NextResponse.json({ error: "Missing attendee email in webhook payload" }, { status: 400 });
    }

    const admin = getInsforgeAdminClient();

    // 1. Search for matching lead across the database by email
    const { data: matchedLead, error: searchError } = await admin.database
      .from("leads")
      .select("*")
      .ilike("email", attendeeEmail.trim())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (matchedLead) {
      // 2. Update existing lead to 'booked'
      const currentMeta = (matchedLead.metadata as any) || {};
      const updatedMeta = {
        ...currentMeta,
        bookingInfo: {
          bookingId,
          scheduledAt: startTime,
          calLink: meetingUrl,
          notes: `Cal.com appointment confirmed for ${new Date(startTime).toLocaleString()}`,
        },
      };

      const updated = await updateLead(
        matchedLead.id,
        {
          stage: "booked",
          metadata: updatedMeta,
        },
        matchedLead.user_id
      );

      return NextResponse.json({
        success: true,
        action: "lead_updated",
        leadId: matchedLead.id,
        stage: "booked",
      });
    }

    // 3. Resolve tenant user_id strictly via query parameter (?userId=...) or organizer email
    const { searchParams } = new URL(req.url);
    let tenantUserId = searchParams.get("userId") || searchParams.get("tenantId");

    // Attempt to match by organizer email in brand_profiles if query param not provided
    if (!tenantUserId) {
      const organizerEmail = payload?.organizer?.email || payload?.user?.email;
      if (organizerEmail) {
        const { data: matchedBrand } = await admin.database
          .from("brand_profiles")
          .select("user_id")
          .ilike("booking_url", `%${organizerEmail.split("@")[0]}%`)
          .limit(1)
          .maybeSingle();
        if (matchedBrand?.user_id) {
          tenantUserId = matchedBrand.user_id;
        }
      }
    }

    if (!tenantUserId) {
      console.warn("[Cal.com Webhook] Rejected: Unable to safely identify tenant user ID for booking:", bookingId);
      return NextResponse.json(
        { error: "Tenant user ID required. Please configure webhook URL with ?userId=<YOUR_CLERK_USER_ID>" },
        { status: 400 }
      );
    }

    const { data: newLead } = await admin.database
      .from("leads")
      .insert({
        user_id: tenantUserId,
        name: attendeeName,
        email: attendeeEmail,
        source: "website",
        stage: "booked",
        score: 9,
        deal_value: 10000,
        metadata: {
          bookingInfo: {
            bookingId,
            scheduledAt: startTime,
            calLink: meetingUrl,
            notes: `Auto-created from inbound Cal.com booking.`,
          },
        },
      })
      .select("*")
      .single();

    return NextResponse.json({
      success: true,
      action: "lead_created",
      leadId: newLead?.id,
      stage: "booked",
    });
  } catch (err: any) {
    console.error("[Cal.com Webhook] Error:", err);
    return NextResponse.json({ error: err?.message || "Webhook processing error" }, { status: 500 });
  }
}
