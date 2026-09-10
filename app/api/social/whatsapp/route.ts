import { NextRequest, NextResponse } from "next/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { callResilientCompletion } from "@/lib/ai-gateway";
import { evaluateBANTLeadScore } from "@/lib/lead-scoring";
import { userBrandCache } from "@/lib/brand-helper";
import {
  getLeadsForUser,
  createLead,
  updateLead,
  recordActivity,
} from "@/lib/crm-service";

export const maxDuration = 30;

// ─── Date / Time Extraction for WhatsApp Booking ────────────────────────────
function extractAppointmentDateTime(text: string): { dateText: string | null; isExplicit: boolean } {
  const patterns = [
    /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+\d{4})?(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm|hrs)?)?/i,
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+\d{4})?(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i,
    /\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:morning|afternoon|evening|night))?(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm))?/i,
    /\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i,
  ];

  for (const pat of patterns) {
    const match = text.match(pat);
    if (match) {
      return { dateText: match[0].trim(), isExplicit: true };
    }
  }
  return { dateText: null, isExplicit: false };
}

// GET: Webhook verification by Meta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken =
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
    process.env.WHATSAPP_VERIFY_TOKEN ||
    "lemon_ai_whatsapp";

  if (mode === "subscribe" && token === verifyToken) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST: Incoming WhatsApp messages (both Meta Cloud API and Dashboard Simulator)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const admin = getInsforgeAdminClient();

    // Check if this is a test from the dashboard WhatsApp simulator
    const isSimulator = Boolean(body.isSimulator || body.message);

    let from: string = "";
    let text: string = "";
    let phoneNumberId: string | null = null;
    let senderName: string = "WhatsApp User";
    let tenantUserId: string = "";

    if (isSimulator) {
      text = String(body.message || "").trim();
      from = String(body.from || "+15550198342").trim();
      tenantUserId = String(body.userId || "usr_lemon_demo").trim();
      senderName = body.senderName || `WhatsApp User ${from.slice(-4)}`;
    } else {
      // Official Meta WhatsApp Cloud API webhook format
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (!message || message.type !== "text") {
        return NextResponse.json({ status: "no_text_message" }, { status: 200 });
      }

      from = message.from;
      text = message.text?.body || "";
      phoneNumberId = value?.metadata?.phone_number_id || null;
      senderName = value?.contacts?.[0]?.profile?.name || `WhatsApp User ${from.slice(-4)}`;

      // 1. Multi-Tenant Lookup
      const { searchParams } = new URL(req.url);
      let detectedId = searchParams.get("userId") || searchParams.get("tenantId");

      if (!detectedId && phoneNumberId) {
        // Try brand_profiles.whatsapp_phone_number_id first
        const { data: brandMatch } = await admin.database
          .from("brand_profiles")
          .select("user_id")
          .eq("whatsapp_phone_number_id", phoneNumberId)
          .maybeSingle();

        if (brandMatch?.user_id) {
          detectedId = brandMatch.user_id;
        } else {
          // Fallback to user_channels
          const { data: channel } = await admin.database
            .from("user_channels")
            .select("user_id")
            .eq("provider_account_id", phoneNumberId)
            .limit(1)
            .maybeSingle();
          if (channel?.user_id) detectedId = channel.user_id;
        }
      }

      if (!detectedId && process.env.NODE_ENV === "development") {
        detectedId = "user_lemon_default";
      }

      if (!detectedId) {
        console.warn(`[WhatsApp Webhook] Unregistered tenant for phone number ID: ${phoneNumberId}`);
        return NextResponse.json({ status: "unregistered_tenant" }, { status: 200 });
      }

      tenantUserId = detectedId;
    }

    if (!text) {
      return NextResponse.json({ error: "Empty message text" }, { status: 400 });
    }

    // 2. Fetch brand profile for the resolved tenant
    let brand: any = null;
    try {
      const { data } = await admin.database
        .from("brand_profiles")
        .select("user_id, business_name, niche, main_offer, brand_tone, booking_url, products_services, pricing_details, location")
        .eq("user_id", tenantUserId)
        .maybeSingle();
      brand = data || userBrandCache.get(tenantUserId) || null;
    } catch {
      brand = userBrandCache.get(tenantUserId) || null;
    }

    const businessName = brand?.business_name || "Lemon AI Business Hub";
    const niche = brand?.niche || "AI Automation & Growth Marketing";
    const bookingLink = brand?.booking_url || "";
    const products = brand?.products_services || "";

    // 3. Detect intents and entities
    const lowerMsg = text.toLowerCase();
    const isSlotQuery = /(?:slot|available time|when are you free|timings|working hours|opening hours|open slots|free slot|available slot)/i.test(lowerMsg);
    const isIdeaQuery = /(?:idea|suggest|strategy|brainstorm|how can i|give me some|recommendation|advice|tips|creative|campaign idea)/i.test(lowerMsg);
    const isBookingIntent = /(?:book|appointment|schedule|meeting|consultation|session|call|calendar)/i.test(lowerMsg);

    const bookingDateTime = extractAppointmentDateTime(text);

    // Extract potential contact details from message
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = text.match(/(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}/);
    const extractedEmail = emailMatch ? emailMatch[0] : null;
    const extractedPhone = phoneMatch ? phoneMatch[0] : (from.startsWith("+") ? from : `+${from}`);

    const nameMatch = text.match(/(?:my name is|i am|i'm|name[:\-]?|appointment(?:\s+for)?)[\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
    const leadName = nameMatch ? nameMatch[1].trim() : senderName;

    // 4. Generate AI reply grounded in WhatsApp sales persona
    const systemPrompt = `You are the lead WhatsApp AI Sales and Booking Concierge for ${businessName}.
Brand Tone: ${brand?.brand_tone || "Helpful, energetic, and professional"}.
Niche: ${niche}.
Main Offer: ${brand?.main_offer || "High-converting AI automations and business scaling solutions"}.
${products ? `Products & Services Catalog:\n${products}` : ""}
${brand?.pricing_details ? `Pricing Details: ${brand.pricing_details}` : ""}
${bookingLink ? `Official Calendar Booking Link: ${bookingLink}` : ""}

YOUR CORE WHATSAPP CAPABILITIES:
1. CONSULTATION SLOTS & SCHEDULING:
   - Working Hours: Monday through Saturday, 10:00 AM to 7:00 PM.
   - Available Slots: 10:00 AM, 11:30 AM, 2:00 PM, 3:30 PM, 5:00 PM, and 7:00 PM.
   - When asked "What slots are available?" or about timings, list the available slots clearly and ask which slot works best.
   - When a user asks to book an appointment (e.g., "book appointment for Friday 4pm"):
     * Confirm the booking enthusiastically, state that their slot is reserved in the CRM, and ask for their email to send the calendar invite.
     * If booking link exists (${bookingLink || "available"}), mention they can also pick an instant slot directly.

2. CREATIVE IDEA MACHINE:
   - When visitors ask for ideas, strategies, or tips (marketing, AI automations, scaling, campaigns):
     * Share 2-3 high-impact, actionable ideas with concise bullets.
     * Then offer: "We can help you set up and automate these exact strategies. Would you like to schedule a quick 1-on-1 strategy call? I can reserve a slot for you right here on WhatsApp!"

WHATSAPP FORMATTING RULES:
- Keep answers conversational, crisp, under 70 words.
- Use bolding like *this* for key words.`;

    let reply = "";
    try {
      const completion = await callResilientCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.6,
      });

      if (completion.content && completion.content.trim()) {
        reply = completion.content.trim();
      }
    } catch (err) {
      console.warn("[WhatsApp Bot] AI generation notice, applying fallback:", err);
    }

    // 5. Intelligent Fallback if AI credits exhausted or call timed out
    if (!reply) {
      if (isSlotQuery) {
        reply = `Hello! 👋 We have consultation slots available Monday to Saturday:\n\n• *Morning:* 10:00 AM, 11:30 AM\n• *Afternoon:* 2:00 PM, 3:30 PM\n• *Evening:* 5:00 PM, 7:00 PM\n\nWhich slot or day works best for you? Let me know and I'll lock it in!${bookingLink ? `\n\nOr book directly: ${bookingLink}` : ""}`;
      } else if (isIdeaQuery) {
        reply = `Here are 2 high-impact growth ideas for your business:\n\n1. *AI WhatsApp Sales Concierge:* Engage incoming leads within 30 seconds, qualify them with BANT, and book appointments automatically 24/7.\n2. *Omnichannel Lead Magnet:* Use Instagram DM automation to deliver guides and drive qualified prospects straight into your calendar.\n\nWould you like to explore these in a 30-min strategy session? I can schedule a slot for you right now!`;
      } else if (bookingDateTime.dateText) {
        reply = `🎉 Fantastic! Your appointment is confirmed for *${bookingDateTime.dateText}* with ${businessName}! We have logged this directly into our CRM calendar. Could you also share your *email* so we can send the calendar invite?`;
      } else {
        reply = `Hello! Thank you for contacting ${businessName}! 👋 I can share creative growth ideas, tell you our available consultation slots, or book your appointment directly. How can I help you today?${bookingLink ? `\n\nCalendar Link: ${bookingLink}` : ""}`;
      }
    }

    // 6. Send reply via official WhatsApp Cloud API (if real webhook and token configured)
    const waToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!isSimulator && waToken && phoneNumberId) {
      try {
        await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${waToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: { body: reply },
          }),
        });
      } catch (sendErr) {
        console.warn("[WhatsApp Webhook] Failed to send message via Graph API:", sendErr);
      }
    }

    // 7. Log Lead and Appointment in CRM
    const isBooked = Boolean(bookingDateTime.dateText);
    const targetStage = isBooked ? "booked" : "new";
    let leadId: string | null = null;

    try {
      const existingLeads = await getLeadsForUser(tenantUserId);
      const existingLead = existingLeads.find(
        (l) =>
          (extractedPhone && l.phone === extractedPhone) ||
          (extractedEmail && l.email?.toLowerCase() === extractedEmail.toLowerCase())
      );

      const bookingInfoPayload = isBooked
        ? {
            dateText: bookingDateTime.dateText || "Upcoming Consultation",
            scheduledAt: bookingDateTime.dateText || new Date().toISOString(),
            status: "confirmed" as const,
            bookingSource: "whatsapp_bot",
            bookedAt: new Date().toISOString(),
            topic: isIdeaQuery ? "WhatsApp Strategy Session" : "WhatsApp Discovery Consultation",
            notes: `Booked via WhatsApp AI Sales Bot. Message: "${text}"`,
          }
        : existingLead?.metadata?.bookingInfo;

      if (existingLead?.id) {
        leadId = existingLead.id;
        const currentMeta = existingLead.metadata || {};
        await updateLead(
          leadId,
          {
            score: isBooked ? 10 : Math.max(existingLead.score || 0, 7),
            stage: isBooked ? "booked" : existingLead.stage === "booked" ? "booked" : targetStage,
            deal_value: isBooked ? Math.max(Number(existingLead.deal_value) || 0, 5000) : existingLead.deal_value,
            metadata: {
              ...currentMeta,
              bookingInfo: bookingInfoPayload || currentMeta.bookingInfo,
            },
          },
          tenantUserId
        );
      } else {
        const newLead = await createLead({
          user_id: tenantUserId,
          name: leadName,
          phone: extractedPhone,
          email: extractedEmail,
          source: "whatsapp",
          stage: targetStage,
          score: isBooked ? 10 : 7,
          deal_value: isBooked ? 5000 : 2500,
          metadata: {
            bookingInfo: bookingInfoPayload,
          },
        });
        leadId = newLead.id;
      }

      // Record Activity in CRM Activities table and local store
      if (leadId && isBooked) {
        await recordActivity({
          user_id: tenantUserId,
          lead_id: leadId,
          type: "appointment",
          title: `Appointment Booked via WhatsApp: ${leadName}`,
          description: `Scheduled for ${bookingDateTime.dateText} via WhatsApp AI Sales Bot. Phone: ${extractedPhone}`,
          metadata: {
            dateText: bookingDateTime.dateText,
            phone: extractedPhone,
            source: "whatsapp_bot",
          },
        });
      }

      // Log conversation in crm_conversations and crm_messages
      try {
        const { data: conv } = await admin.database
          .from("crm_conversations")
          .select("id")
          .eq("user_id", tenantUserId)
          .eq("channel", "whatsapp")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let convId = conv?.id;
        if (!convId) {
          const { data: newConv } = await admin.database
            .from("crm_conversations")
            .insert({
              user_id: tenantUserId,
              lead_id: leadId || null,
              channel: "whatsapp",
              status: "open",
              is_ai_active: true,
              last_message_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          convId = newConv?.id;
        } else if (leadId) {
          await admin.database
            .from("crm_conversations")
            .update({ lead_id: leadId, last_message_at: new Date().toISOString() })
            .eq("id", convId);
        }

        if (convId) {
          await admin.database.from("crm_messages").insert([
            { conversation_id: convId, sender_type: "lead", content: text },
            { conversation_id: convId, sender_type: "ai_assistant", content: reply },
          ]);
        }
      } catch (convErr) {
        console.warn("[WhatsApp Bot] CRM conversation logging notice:", convErr);
      }
    } catch (crmErr) {
      console.warn("[WhatsApp Bot] CRM lead capture warning:", crmErr);
    }

    return NextResponse.json({
      reply,
      isSlotQuery,
      isIdeaQuery,
      isBooked,
      bookingDate: bookingDateTime.dateText,
      status: "ok",
    });
  } catch (e: any) {
    console.error("WhatsApp webhook error:", e);
    return NextResponse.json({ status: "error", error: e?.message }, { status: 200 });
  }
}
