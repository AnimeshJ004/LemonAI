import { NextRequest, NextResponse } from "next/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { callResilientCompletion } from "@/lib/ai-gateway";
import { evaluateBANTLeadScore } from "@/lib/lead-scoring";

export const maxDuration = 30;

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

// POST: Incoming WhatsApp messages
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message || message.type !== "text") {
      return NextResponse.json({ status: "no_text_message" });
    }

    const from = message.from; // Sender WhatsApp phone number
    const text = message.text?.body || "";
    const phoneNumberId = value?.metadata?.phone_number_id;

    const admin = getInsforgeAdminClient();

    // 1. Multi-Tenant Lookup: Match phoneNumberId to user_channels or brand_profiles
    let tenantUserId: string | null = null;
    let brand: any = null;

    if (phoneNumberId) {
      const { data: channel } = await admin.database
        .from("user_channels")
        .select("user_id")
        .eq("provider_account_id", phoneNumberId)
        .maybeSingle();

      if (channel?.user_id) {
        tenantUserId = channel.user_id;
      }
    }

    // If resolved, fetch brand profile for this tenant
    if (tenantUserId) {
      const { data } = await admin.database
        .from("brand_profiles")
        .select("user_id, business_name, niche, main_offer, brand_tone, booking_url, products_services, pricing_details, location")
        .eq("user_id", tenantUserId)
        .maybeSingle();
      brand = data;
    }

    // Fallback: If no channel matched by phoneNumberId, query latest active brand profile
    if (!brand) {
      const { data } = await admin.database
        .from("brand_profiles")
        .select("user_id, business_name, niche, main_offer, brand_tone, booking_url, products_services, pricing_details, location")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        brand = data;
        tenantUserId = data.user_id;
      }
    }

    const bookingLink = brand?.booking_url || "";
    const products = brand?.products_services || "";

    // 2. Generate AI reply grounded in this tenant's brand voice
    let reply = `Hello! Thank you for reaching out to ${brand?.business_name || "our team"}. How can we assist you today?`;
    try {
      const completion = await callResilientCompletion({
        messages: [
          {
            role: "system",
            content: `You are a courteous, professional WhatsApp sales representative for ${brand?.business_name || "our business"}.
Tone: ${brand?.brand_tone || "Helpful and friendly"}.
Niche: ${brand?.niche || "Professional Services"}.
Main Offer: ${brand?.main_offer || "High-converting solutions"}.
${products ? `Products & Services:\n${products}` : ""}
${brand?.pricing_details ? `Pricing Structure: ${brand.pricing_details}` : ""}
${bookingLink ? `Official Calendar Booking Link: ${bookingLink}` : ""}

Keep responses conversational, concise, and under 60 words.
If the customer wants to book a call, consultation, or check availability${bookingLink ? `, provide their booking link: ${bookingLink}` : ""}.`,
          },
          { role: "user", content: text },
        ],
      });
      if (completion.content) {
        reply = completion.content;
      }
    } catch (err) {
      console.warn("AI generation failed for WhatsApp:", err);
    }

    // 3. Send reply via WhatsApp Cloud API
    const waToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (waToken && phoneNumberId) {
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
        console.warn("Failed to send WhatsApp message via Graph API:", sendErr);
      }
    }

    // 4. Log lead and conversation in CRM with BANT Evaluation
    if (tenantUserId) {
      try {
        // Find or create lead
        const formattedPhone = from.startsWith("+") ? from : `+${from}`;
        const contactName = value?.contacts?.[0]?.profile?.name || `WhatsApp User ${from.slice(-4)}`;

        const { data: existingLead } = await admin.database
          .from("leads")
          .select("id, metadata, score, stage")
          .eq("user_id", tenantUserId)
          .eq("phone", formattedPhone)
          .maybeSingle();

        // Evaluate BANT intent score
        const bant = await evaluateBANTLeadScore({
          leadName: contactName,
          transcript: text,
          niche: brand?.niche,
        });

        let leadId = existingLead?.id;
        if (!leadId) {
          const { data: newLead } = await admin.database
            .from("leads")
            .insert({
              user_id: tenantUserId,
              name: contactName,
              phone: formattedPhone,
              source: "whatsapp",
              stage: bant.isQualified ? "qualified" : "new",
              score: bant.score,
              deal_value: bant.isQualified ? 5000 : 0,
              metadata: {
                bant,
              },
            })
            .select("id")
            .single();
          leadId = newLead?.id;
        } else if (existingLead) {
          // Update existing lead with latest BANT score
          const currentMeta = existingLead.metadata || {};
          await admin.database
            .from("leads")
            .update({
              score: Math.max(existingLead.score || 0, bant.score),
              stage: bant.isQualified ? "qualified" : existingLead.stage,
              metadata: {
                ...currentMeta,
                bant,
              },
            })
            .eq("id", leadId);
        }

        // Find or create conversation
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
        }

        if (convId) {
          await admin.database.from("crm_messages").insert([
            { conversation_id: convId, sender_type: "lead", content: text },
            { conversation_id: convId, sender_type: "ai_assistant", content: reply },
          ]);
        }
      } catch (crmErr) {
        console.warn("CRM auto-log warning:", crmErr);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error("WhatsApp webhook error:", e);
    // Return 200 to satisfy Meta webhook retry policy
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}

