import { NextRequest, NextResponse } from "next/server";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";

export const maxDuration = 30;

// GET: Webhook verification by Meta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "lemon_ai_whatsapp";
  if (mode === "subscribe" && token === verifyToken) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST: Incoming WhatsApp messages
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

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

    // Query brand profile matching WhatsApp phone number ID or fallback to latest brand
    let brand: any = null;
    try {
      if (phoneNumberId) {
        const { data } = await admin.database
          .from("brand_profiles")
          .select("user_id, business_name, niche, main_offer")
          .eq("whatsapp_phone_number_id", phoneNumberId)
          .maybeSingle();
        brand = data;
      }

      if (!brand) {
        const { data } = await admin.database
          .from("brand_profiles")
          .select("user_id, business_name, niche, main_offer")
          .limit(1)
          .maybeSingle();
        brand = data;
      }
    } catch (e) {
      console.warn("Error fetching brand for WhatsApp:", e);
    }

    // Generate AI reply
    let reply = "Hello! Thank you for reaching out to us. How can we help you today?";
    try {
      const { insforge } = await getInsforgeServerClient();
      const completion = await insforge.ai.chat.completions.create({
        model: "google/gemini-3.8-flash",
        messages: [
          {
            role: "system",
            content: `You are a courteous WhatsApp sales representative for ${brand?.business_name || "our company"}.
Be brief, friendly, and under 80 words.
Business: ${brand?.niche || "Professional Services"}.
Offer: ${brand?.main_offer || "Premium products and solutions"}.`
          },
          { role: "user", content: text }
        ],
      });
      reply = completion.choices[0]?.message?.content || reply;
    } catch (err) {
      console.warn("AI generation failed for WhatsApp:", err);
    }

    // Send reply via WhatsApp Cloud API if configured
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

    // Attempt to log into CRM conversations (Member 3)
    if (brand?.user_id) {
      try {
        await admin.database.from("crm_conversations").upsert({
          user_id: brand.user_id,
          channel: "whatsapp",
          status: "ai_handling",
          last_message_at: new Date().toISOString(),
        }, { onConflict: "user_id,channel" });
      } catch (crmErr) {
        // Safe to ignore if table doesn't exist
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error("WhatsApp webhook error:", e);
    // Return 200 to satisfy Meta webhook retry policy
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}
