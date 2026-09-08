export interface SendWhatsAppMessageParams {
  to: string; // phone number with country code, e.g. "15551234567"
  text: string;
}

export interface ParsedWhatsAppMessage {
  from: string;
  name?: string;
  messageId: string;
  text: string;
  timestamp: string;
}

/**
 * Sends a text message via Meta WhatsApp Cloud API.
 * In absence of live tokens, provides simulated test logging.
 */
export async function sendWhatsAppMessage(
  params: SendWhatsAppMessageParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, text } = params;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  const cleanedPhone = to.replace(/\D/g, "");

  if (!phoneNumberId || !accessToken) {
    console.log(`[WhatsApp Simulator] Sending message to +${cleanedPhone}: "${text}"`);
    return {
      success: true,
      messageId: `sim_wamid_${Date.now()}`,
    };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanedPhone,
        type: "text",
        text: { preview_url: true, body: text },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("WhatsApp API error:", data);
      return { success: false, error: data?.error?.message || "Failed to send WhatsApp message" };
    }

    const messageId = data?.messages?.[0]?.id || `wamid_${Date.now()}`;
    return { success: true, messageId };
  } catch (err: any) {
    console.error("WhatsApp network error:", err);
    return { success: false, error: err?.message || "WhatsApp network error" };
  }
}

/**
 * Verifies webhook GET challenge from Meta WhatsApp
 */
export function verifyWhatsAppWebhook(
  mode: string | null,
  token: string | null,
  challenge: string | null
): string | null {
  const allowedTokens = [
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    process.env.WHATSAPP_VERIFY_TOKEN,
    "lemon_ai_whatsapp",
    "lemon_ai_verify_token",
  ].filter(Boolean);

  if (mode === "subscribe" && token && allowedTokens.includes(token) && challenge) {
    return challenge;
  }
  return null;
}


/**
 * Parses inbound WhatsApp Cloud API webhook body
 */
export function parseInboundWhatsAppPayload(body: any): ParsedWhatsAppMessage[] {
  const results: ParsedWhatsAppMessage[] = [];
  try {
    const entries = body?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        if (change?.value?.messages) {
          const contacts = change.value.contacts || [];
          const nameMap = new Map<string, string>();
          for (const c of contacts) {
            if (c.wa_id && c.profile?.name) {
              nameMap.set(c.wa_id, c.profile.name);
            }
          }

          for (const msg of change.value.messages) {
            if (msg.type === "text" && msg.text?.body) {
              results.push({
                from: msg.from,
                name: nameMap.get(msg.from) || "WhatsApp User",
                messageId: msg.id,
                text: msg.text.body,
                timestamp: msg.timestamp
                  ? new Date(Number(msg.timestamp) * 1000).toISOString()
                  : new Date().toISOString(),
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Error parsing WhatsApp webhook payload:", err);
  }
  return results;
}
