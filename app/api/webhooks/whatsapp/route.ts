import { NextRequest, NextResponse } from "next/server";
import {
  verifyWhatsAppWebhook,
  parseInboundWhatsAppPayload,
  sendWhatsAppMessage,
} from "@/lib/whatsapp-client";
import {
  findOrCreateLeadByContact,
  createConversation,
  getConversationsForUser,
  addMessage,
  getConversationWithMessages,
} from "@/lib/crm-service";
import { getBrandProfileForUser } from "@/lib/brand-helper";
import { routeAICall } from "@/lib/ai-router";
import { scoreAndUpdateLead } from "@/lib/lead-scoring";

/**
 * Meta Webhook Verification (GET)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifiedChallenge = verifyWhatsAppWebhook(mode, token, challenge);
  if (verifiedChallenge) {
    return new Response(verifiedChallenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

/**
 * Inbound WhatsApp Messages (POST)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsedMessages = parseInboundWhatsAppPayload(body);

    if (parsedMessages.length === 0) {
      return NextResponse.json({ status: "ignored_or_ack" });
    }

    // Process each inbound message
    for (const msg of parsedMessages) {
      let targetUserId = "user_lemon_default";
      try {
        const { data: latestBrand } = await getBrandProfileForUser("");
        // Query latest brand profile from DB
        const admin = (await import("@/lib/insforge-server")).getInsforgeAdminClient();
        const { data: b } = await admin.database
          .from("brand_profiles")
          .select("user_id")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (b?.user_id) targetUserId = b.user_id;
      } catch {}

      // 1. Find or create lead
      const lead = await findOrCreateLeadByContact({
        user_id: targetUserId,
        name: msg.name || "WhatsApp Lead",
        phone: `+${msg.from}`,
        source: "whatsapp",
      });

      // 2. Find or create WhatsApp conversation
      const allConvs = await getConversationsForUser(targetUserId);
      let conv = allConvs.find((c) => c.lead_id === lead.id && c.channel === "whatsapp");

      if (!conv) {
        conv = await createConversation({
          user_id: targetUserId,
          lead_id: lead.id,
          channel: "whatsapp",
          is_ai_active: true,
        });
      }

      // 3. Save incoming message
      await addMessage({
        conversation_id: conv.id,
        sender_type: "lead",
        content: msg.text,
      });

      // 4. Auto-reply if AI is active
      if (conv.is_ai_active !== false) {
        const brand = await getBrandProfileForUser(targetUserId);
        const brandName = brand?.business_name || "Lemon AI";
        const brandTone = brand?.brand_tone || "Friendly and Professional";

        const { messages: history } = await getConversationWithMessages(conv.id, targetUserId);
        const historyContext = (history || [])
          .slice(-5)
          .map((m) => `${m.sender_type === "lead" ? "Customer" : "Assistant"}: ${m.content}`)
          .join("\n");

        const aiRes = await routeAICall({
          task: "FAST_CLASSIFICATION",
          systemPrompt: `You are the automated WhatsApp Assistant for ${brandName}. Tone: ${brandTone}.
Answer the customer warmly, concisely (under 60 words), and ask if they would like a quote or discovery call.`,
          userPrompt: `${historyContext}\nCustomer: ${msg.text}\nAssistant:`,
          preferredTier: "TIER_1_FAST",
          temperature: 0.4,
        });

        const replyText =
          aiRes.data && typeof aiRes.data === "string"
            ? aiRes.data.trim()
            : `Hello ${msg.name || "there"}! Thank you for contacting ${brandName}. How can we best assist your business today?`;

        await addMessage({
          conversation_id: conv.id,
          sender_type: "ai_assistant",
          content: replyText,
        });

        await sendWhatsAppMessage({
          to: msg.from,
          text: replyText,
        });

        // 5. Trigger lead qualification scoring
        scoreAndUpdateLead(lead, `${historyContext}\n${msg.text}`, brand?.niche).catch(console.error);
      }
    }

    return NextResponse.json({ status: "success", count: parsedMessages.length });
  } catch (err: any) {
    console.error("WhatsApp webhook error:", err);
    return NextResponse.json({ error: err?.message || "Webhook processing failed" }, { status: 500 });
  }
}
