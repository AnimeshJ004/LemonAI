import { NextRequest, NextResponse } from "next/server";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";
import { decrypt } from "@/lib/encryption";
import { routeAICall } from "@/lib/ai-router";

export const maxDuration = 60;

/**
 * Meta Webhook Verification (GET)
 * Configured in Meta Developers Dashboard under Webhooks -> Instagram / Page.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken =
    process.env.META_WEBHOOK_VERIFY_TOKEN ||
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
    "lemon_ai_webhook";

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * Real-Time Meta Webhook Ingestion (POST)
 * Handles incoming Instagram comments, Facebook comments, and DMs.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const entries = body?.entry || [];

    if (entries.length === 0) {
      return NextResponse.json({ status: "acknowledged_empty" });
    }

    const admin = getInsforgeAdminClient();

    for (const entry of entries) {
      const targetAccountId = entry.id; // Page ID or Instagram Business Account ID

      // 1. Resolve SaaS Tenant via user_channels
      const { data: channel } = await admin.database
        .from("user_channels")
        .select("user_id, access_token, channel_types(type)")
        .eq("provider_account_id", targetAccountId)
        .maybeSingle();

      if (!channel || !channel.access_token) {
        console.warn(`[Meta Webhook] No matching user_channel found for account ID: ${targetAccountId}`);
        continue;
      }

      const tenantUserId = channel.user_id;
      const accessToken = decrypt(channel.access_token);
      const platformType = (channel.channel_types as any)?.type || "INSTAGRAM";

      // 2. Fetch Brand Profile to ground AI persona
      const { data: brand } = await admin.database
        .from("brand_profiles")
        .select("business_name, niche, brand_tone, main_offer")
        .eq("user_id", tenantUserId)
        .maybeSingle();

      const brandName = brand?.business_name || "Our Business";
      const brandTone = brand?.brand_tone || "Professional and friendly";

      // ─── A. Handle Comments (changes array) ──────────────────────────────────
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field === "comments" || change.field === "feed") {
          const val = change.value;
          const commentId = val?.comment_id || val?.id;
          const commentText = val?.text || val?.message;
          const senderUsername = val?.from?.username || val?.from?.name || "User";
          const mediaId = val?.media?.id || val?.post_id;

          // Skip if this is our own comment/reply
          if (!commentId || !commentText || val?.from?.id === targetAccountId) continue;

          // Check if already processed to prevent duplicate replies
          const { data: existing } = await admin.database
            .from("social_comments")
            .select("id")
            .eq("platform_comment_id", commentId)
            .maybeSingle();

          if (existing) continue;

          // Generate autonomous brand reply using AI Router
          const aiResponse = await routeAICall<{
            sentiment: "INQUIRY" | "PRAISE" | "COMPLAINT" | "SPAM" | "NEUTRAL";
            reply: string;
            shouldSendDM: boolean;
            dmMessage?: string;
          }>({
            task: "FAST_CLASSIFICATION",
            preferredTier: "TIER_1_FAST",
            jsonMode: true,
            systemPrompt: `You are the social media manager for ${brandName}.
Tone: ${brandTone}.
Niche: ${brand?.niche || "Business"}.
Main Offer: ${brand?.main_offer || "Premium services"}.

Respond politely to public comments under 140 characters. If purchase intent is detected, set shouldSendDM to true.
Return valid JSON:
{
  "sentiment": "INQUIRY",
  "reply": "Thank you! Check your DMs for details.",
  "shouldSendDM": true,
  "dmMessage": "Hi! Saw your comment. Here is the link: ..."
}`,
            userPrompt: `Commenter: @${senderUsername}
Comment: "${commentText}"`,
          });

          const result = aiResponse.data || {
            sentiment: "NEUTRAL",
            reply: `Thanks for connecting with ${brandName}! 🙏`,
            shouldSendDM: false,
          };

          // Post public reply via Meta Graph API
          try {
            await fetch(`https://graph.facebook.com/v22.0/${commentId}/replies`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: result.reply,
                access_token: accessToken,
              }),
            });
          } catch (postErr) {
            console.error(`[Meta Webhook] Failed to post reply to comment ${commentId}:`, postErr);
          }

          // Record in social_comments
          await admin.database.from("social_comments").insert({
            user_id: tenantUserId,
            platform: platformType,
            platform_comment_id: commentId,
            commenter_handle: senderUsername,
            comment_text: commentText,
            sentiment: result.sentiment,
            reply_text: result.reply,
            dm_sent: result.shouldSendDM || false,
            status: "replied",
          });
        }
      }

      // ─── B. Handle DMs / Direct Messages (messaging array) ───────────────────
      const messaging = entry.messaging || [];
      for (const msgItem of messaging) {
        const senderId = msgItem?.sender?.id;
        const recipientId = msgItem?.recipient?.id;
        const msgText = msgItem?.message?.text;

        // Skip bot's own outgoing messages
        if (!senderId || !msgText || senderId === targetAccountId) continue;

        // Find or create lead & conversation
        let leadId: string | null = null;
        const { data: existingLead } = await admin.database
          .from("leads")
          .select("id")
          .eq("user_id", tenantUserId)
          .eq("source", platformType.toLowerCase())
          .limit(1)
          .maybeSingle();

        if (existingLead?.id) {
          leadId = existingLead.id;
        }

        // Find or create conversation
        let convId: string | null = null;
        const { data: conv } = await admin.database
          .from("crm_conversations")
          .select("id")
          .eq("user_id", tenantUserId)
          .eq("channel", platformType.toLowerCase())
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (conv?.id) {
          convId = conv.id;
        } else {
          const { data: newConv } = await admin.database
            .from("crm_conversations")
            .insert({
              user_id: tenantUserId,
              lead_id: leadId,
              channel: platformType.toLowerCase(),
              status: "open",
              is_ai_active: true,
              last_message_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          convId = newConv?.id || null;
        }

        // Generate AI direct reply
        const aiResponse = await routeAICall({
          task: "FAST_CLASSIFICATION",
          preferredTier: "TIER_1_FAST",
          systemPrompt: `You are the direct messaging concierge for ${brandName}.
Tone: ${brandTone}.
Niche: ${brand?.niche || "Professional Services"}.
Main Offer: ${brand?.main_offer || "Premium growth solutions"}.
Answer clearly and warmly under 80 words. If they want to book or buy, invite them to share their email or phone number.`,
          userPrompt: `Customer message: "${msgText}"`,
        });

        const replyText = aiResponse.rawText || `Hi there! Thanks for reaching out to ${brandName}. How can we best help you today?`;

        // Send DM response back via Meta Graph API
        try {
          await fetch(`https://graph.facebook.com/v22.0/me/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: { id: senderId },
              message: { text: replyText },
              access_token: accessToken,
            }),
          });
        } catch (dmErr) {
          console.error(`[Meta Webhook] Failed to send DM to ${senderId}:`, dmErr);
        }

        // Log messages in CRM
        if (convId) {
          await admin.database.from("crm_messages").insert([
            { conversation_id: convId, sender_type: "lead", content: msgText },
            { conversation_id: convId, sender_type: "ai_assistant", content: replyText },
          ]);
        }
      }
    }

    return NextResponse.json({ status: "processed" }, { status: 200 });
  } catch (err: any) {
    console.error("[Meta Webhook] Error processing event:", err);
    return NextResponse.json({ error: err?.message || "Webhook processing error" }, { status: 500 });
  }
}
