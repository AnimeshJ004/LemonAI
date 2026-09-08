import { updateLead, Lead } from "./crm-service";

export interface CalcomBookingParams {
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  startTime?: string;
  eventTypeId?: string | number;
}

export interface CalcomBookingResult {
  success: boolean;
  bookingId?: string;
  bookingUrl?: string;
  scheduledAt?: string;
  message: string;
}

import { generateCalcomBookingUrl } from "./calcom-url";
export { generateCalcomBookingUrl };

/**
 * Creates or schedules a booking via Cal.com API.
 * Falls back to dynamic link if no API key is provided.
 */
export async function createCalcomBooking(
  params: CalcomBookingParams
): Promise<CalcomBookingResult> {
  const apiKey = process.env.CALCOM_API_KEY;
  const eventTypeId = params.eventTypeId || process.env.CALCOM_EVENT_TYPE_ID || "12345";
  const bookingUrl = generateCalcomBookingUrl({
    leadName: params.name,
    email: params.email,
    phone: params.phone,
    notes: params.notes,
  });

  if (!apiKey) {
    // Return booking link for customer self-serve
    return {
      success: true,
      bookingUrl,
      scheduledAt: params.startTime || new Date(Date.now() + 86400000).toISOString(),
      message: "Generated instant Cal.com scheduling reservation.",
    };
  }

  try {
    const res = await fetch("https://api.cal.com/v1/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey,
        eventTypeId: Number(eventTypeId),
        start: params.startTime || new Date(Date.now() + 86400000).toISOString(),
        name: params.name,
        email: params.email,
        metadata: {
          phone: params.phone,
          notes: params.notes,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        bookingUrl,
        message: data?.message || "Failed to create booking on Cal.com",
      };
    }

    return {
      success: true,
      bookingId: String(data?.id || data?.booking?.id),
      bookingUrl,
      scheduledAt: data?.start || params.startTime,
      message: "Appointment successfully booked on Cal.com.",
    };
  } catch (err: any) {
    console.error("Cal.com booking error:", err);
    return {
      success: false,
      bookingUrl,
      message: err?.message || "Network error booking Cal.com event",
    };
  }
}

/**
 * Handles incoming Cal.com webhook (BOOKING_CREATED, BOOKING_RESCHEDULED)
 * and updates lead stage to "booked".
 */
export async function processCalcomWebhook(
  payload: any,
  allLeads: Lead[]
): Promise<{ updated: boolean; leadId?: string }> {
  try {
    const booking = payload?.payload || payload?.booking || payload;
    const attendeeEmail =
      booking?.attendees?.[0]?.email ||
      booking?.email ||
      booking?.user?.email;

    if (!attendeeEmail) return { updated: false };

    const matchedLead = allLeads.find(
      (l) => l.email && l.email.toLowerCase() === attendeeEmail.toLowerCase()
    );

    if (matchedLead) {
      const startTime = booking?.startTime || booking?.start || new Date().toISOString();
      const currentMeta = matchedLead.metadata || {};

      await updateLead(
        matchedLead.id,
        {
          stage: "booked",
          metadata: {
            ...currentMeta,
            bookingInfo: {
              bookingId: String(booking?.id || ""),
              scheduledAt: startTime,
              calLink: booking?.location || booking?.meetingUrl,
              notes: `Cal.com meeting scheduled for ${new Date(startTime).toLocaleString()}`,
            },
          },
        },
        matchedLead.user_id
      );

      return { updated: true, leadId: matchedLead.id };
    }
  } catch (err) {
    console.error("Error processing Cal.com webhook:", err);
  }
  return { updated: false };
}
