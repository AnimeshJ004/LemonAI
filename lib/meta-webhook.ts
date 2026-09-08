import { NextRequest, NextResponse } from "next/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { callResilientCompletion } from "@/lib/ai-gateway";
import { decrypt } from "@/lib/encryption";

export const maxDuration = 60;

/**
 * Meta Webhook Verification (GET)
 * Configured in Meta Developers Dashboard under Webhooks -> Instagram / Page.
 */
export async function handleMetaWebhookGet(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken =
    process.env.META_WEBHOOK_VERIFY_TOKEN ||
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
    "lemon_ai_webhook";

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * Unified Real-Time Meta Webhook Ingestion (POST)
 * Handles incoming comments and direct messages for Instagram & Facebook.
 */
export async function handleMetaWebhookPost(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const entries = body?.entry || [];

    if (entries.length === 0) {
      return NextResponse.json({ status: "acknowledged_empty" });
    }

    const admin = getInsforgeAdminClient();

    for (const entry of entries) {
      const targetAccountId = String(entry.id || "").trim();

      // ─── 1. Robust Multi-Tenant Channel Resolution ─────────────────────────
      // NEVER use raw .single() or naked .maybeSingle() without .limit(1)
      // to avoid PGRST116 when multiple rows match the same provider_account_id.
      let userId: string | null = null;
      let accessToken: string | null = null;
      let channelId: string | null = null;
      let channelHandle: string | null = null;

      try {
        let channelRecord: any = null;

        // A. Primary: Match by provider_account_id for INSTAGRAM or FACEBOOK
        if (targetAccountId) {
          const { data: matched } = await admin.database
            .from("user_channels")
            .select("id, user_id, handle, access_token, channel_types!inner(type)")
            .eq("provider_account_id", targetAccountId)
            .in("channel_types.type", ["INSTAGRAM", "FACEBOOK"])
            .eq("is_connected", true)
            .order("updated_at", { ascending: false })
            .limit(1);

          if (matched && matched.length > 0) {
            channelRecord = matched[0];
          }
        }

        // B. Fallback: Most recently updated connected INSTAGRAM channel
        if (!channelRecord) {
          const { data: igFallback } = await admin.database
            .from("user_channels")
            .select("id, user_id, handle, access_token, channel_types!inner(type)")
            .eq("channel_types.type", "INSTAGRAM")
            .eq("is_connected", true)
            .order("updated_at", { ascending: false })
            .limit(1);

          if (igFallback && igFallback.length > 0) {
            channelRecord = igFallback[0];
            console.warn(`[Meta Webhook] Used fallback Instagram channel ${channelRecord.id} for target ${targetAccountId}`);
          }
        }

        // C. Secondary Fallback: Most recently updated connected FACEBOOK channel
        if (!channelRecord) {
          const { data: fbFallback } = await admin.database
            .from("user_channels")
            .select("id, user_id, handle, access_token, channel_types!inner(type)")
            .eq("channel_types.type", "FACEBOOK")
            .eq("is_connected", true)
            .order("updated_at", { ascending: false })
            .limit(1);

          if (fbFallback && fbFallback.length > 0) {
            channelRecord = fbFallback[0];
          }
        }

        if (channelRecord) {
          channelId = channelRecord.id;
          userId = channelRecord.user_id;
          channelHandle = channelRecord.handle;
          const rawToken = channelRecord.access_token;
          accessToken = decrypt(rawToken) || rawToken;
        }

        // D. Environment fallback if token missing
        if (!accessToken && process.env.META_ADS_ACCESS_TOKEN) {
          accessToken = process.env.META_ADS_ACCESS_TOKEN;
        }
      } catch (lookupErr) {
        console.error("[Meta Webhook] Tenant channel resolution error:", lookupErr);
      }

      if (!userId || !accessToken) {
        console.warn(`[Meta Webhook] Cannot resolve active channel/token for account ${targetAccountId}. Skipping entry.`);
        continue;
      }

      // Fetch Brand Profile to ground AI persona
      const { data: brand } = await admin.database
        .from("brand_profiles")
        .select("business_name, niche, brand_tone, main_offer")
        .eq("user_id", userId)
        .maybeSingle();

      const brandName = brand?.business_name || "Our Team";
      const brandTone = brand?.brand_tone || "Friendly, professional, and helpful";

      // ─── 2. Handle Comments (Instagram post comments & Facebook page feed) ───
      const changes = entry.changes || [];
      const COMMENT_FIELDS = ["comments", "feed", "live_comments", "mentions"];

      for (const change of changes) {
        if (!COMMENT_FIELDS.includes(change.field)) continue;

        const val = change.value;
        if (!val) continue;

        const commentId = String(val.id || val.comment_id || "").trim();
        const commentText = String(val.text || val.message || "").trim();
        const commenterHandle = val.from?.username || val.from?.name || "@user";
        const commenterId = String(val.from?.id || "").trim();
        const mediaId = String(val.media?.id || val.post_id || "").trim();

        // Skip empty or self comments
        if (!commentId || !commentText) continue;
        if (commenterId && commenterId === targetAccountId) continue;
        if (channelHandle && commenterHandle.toLowerCase() === channelHandle.toLowerCase().replace(/^@/, "")) continue;

        // Deduplication: check if already successfully replied
        const { data: existingReplies } = await admin.database
          .from("social_comments")
          .select("id")
          .eq("platform_comment_id", commentId)
          .eq("status", "replied")
          .limit(1);

        if (existingReplies && existingReplies.length > 0) {
          console.log(`[Meta Webhook] Comment ${commentId} already replied. Skipping.`);
          continue;
        }

        // Match scheduled post for richer analytics
        let matchedPostId: string | null = null;
        if (mediaId) {
          const { data: matchedPosts } = await admin.database
            .from("scheduled_posts")
            .select("id")
            .eq("user_id", userId)
            .ilike("published_url", `%${mediaId}%`)
            .limit(1);
          matchedPostId = matchedPosts?.[0]?.id || null;
        }

        // ─── 3. Generate Autonomous AI Reply ──────────────────────────────────
        let aiResult = {
          sentiment: "NEUTRAL" as "INQUIRY" | "PRAISE" | "COMPLAINT" | "SPAM" | "NEUTRAL",
          reply: `Thank you for connecting with ${brandName}! 🙏`,
          shouldSendDM: false,
          dmMessage: "",
        };

        try {
          const completion = await callResilientCompletion({
            jsonMode: true,
            messages: [
              {
                role: "user",
                content: `You are the autonomous social media AI manager for ${brandName}.
Brand Tone: ${brandTone}
Niche: ${brand?.niche || "Business & Growth"}
Main Offer: ${brand?.main_offer || "Premium solutions"}

Analyze this incoming comment and provide an immediate, engaging reply.
Comment: "${commentText}"
Commenter: @${commenterHandle}

Rules:
1. Public reply must be concise (under 140 characters for Instagram).
2. If the user asks about price, cost, booking, demo, or buying, set shouldSendDM to true and write a helpful private dmMessage.
3. Return ONLY valid JSON:
{
  "sentiment": "INQUIRY" | "PRAISE" | "COMPLAINT" | "SPAM" | "NEUTRAL",
  "reply": "Your public response",
  "shouldSendDM": true,
  "dmMessage": "Private direct message text if purchase intent"
}`,
              },
            ],
          });

          if (completion.data && typeof completion.data === "object") {
            aiResult = {
              sentiment: completion.data.sentiment || "NEUTRAL",
              reply: completion.data.reply || `Thanks for reaching out! 🙏`,
              shouldSendDM: Boolean(completion.data.shouldSendDM),
              dmMessage: completion.data.dmMessage || "",
            };
          }
        } catch (aiErr) {
          console.warn("[Meta Webhook] AI fallback triggered:", aiErr);
          const lower = commentText.toLowerCase();
          if (lower.includes("price") || lower.includes("cost") || lower.includes("buy") || lower.includes("how much")) {
            aiResult = {
              sentiment: "INQUIRY",
              reply: "Sent you a DM with complete pricing details! 📩",
              shouldSendDM: true,
              dmMessage: `Hey @${commenterHandle}! Thanks for your interest in ${brandName}. Here are the details...`,
            };
          } else if (lower.includes("love") || lower.includes("awesome") || lower.includes("great") || lower.includes("fire") || lower.includes("🔥")) {
            aiResult = {
              sentiment: "PRAISE",
              reply: "Thank you so much! Really appreciate the love! ❤️✨",
              shouldSendDM: false,
              dmMessage: "",
            };
          }
        }

        // ─── 4. Post Public Reply via Meta Graph API ──────────────────────────
        let replySuccess = false;
        try {
          const replyRes = await fetch(`https://graph.facebook.com/v22.0/${commentId}/replies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: aiResult.reply,
              access_token: accessToken,
            }),
          });

          const replyJson = await replyRes.json().catch(() => ({}));
          if (replyRes.ok && replyJson?.id) {
            replySuccess = true;
            console.log(`[Meta Webhook] ✓ Auto-reply posted successfully to comment ${commentId}, reply ID: ${replyJson.id}`);
          } else {
            console.error(`[Meta Webhook] Meta Graph API returned error for comment ${commentId}:`, JSON.stringify(replyJson));
          }
        } catch (postErr) {
          console.error(`[Meta Webhook] Failed to dispatch reply to comment ${commentId}:`, postErr);
        }

        // ─── 5. Send Private Direct Message (if purchase intent detected) ───────
        let dmSuccess = false;
        if (replySuccess && aiResult.shouldSendDM && aiResult.dmMessage && commenterId) {
          try {
            const dmRes = await fetch(`https://graph.facebook.com/v22.0/me/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recipient: { id: commenterId },
                message: { text: aiResult.dmMessage },
                access_token: accessToken,
              }),
            });
            const dmJson = await dmRes.json().catch(() => ({}));
            if (dmRes.ok) {
              dmSuccess = true;
              console.log(`[Meta Webhook] ✓ Private DM sent to ${commenterId}`);
            } else {
              console.warn(`[Meta Webhook] Notice sending DM to ${commenterId}:`, JSON.stringify(dmJson));
            }
          } catch (dmErr) {
            console.warn("[Meta Webhook] Notice sending private DM:", dmErr);
          }
        }

        // ─── 6. Record in Database & CRM ─────────────────────────────────────
        if (replySuccess) {
          // Log to social_comments
          await admin.database.from("social_comments").insert({
            user_id: userId,
            post_id: matchedPostId,
            platform: "INSTAGRAM",
            platform_comment_id: commentId,
            commenter_handle: commenterHandle,
            comment_text: commentText,
            sentiment: aiResult.sentiment,
            reply_text: aiResult.reply,
            dm_sent: dmSuccess,
            status: "replied",
          });

          // Lead & CRM conversation capture for potential buyers
          if (aiResult.shouldSendDM || aiResult.sentiment === "INQUIRY") {
            try {
              const cleanHandle = commenterHandle.replace(/^@/, "");
              let leadId: string | null = null;

              const { data: existingLead } = await admin.database
                .from("leads")
                .select("id")
                .eq("user_id", userId)
                .ilike("name", `%${cleanHandle}%`)
                .limit(1);

              if (existingLead && existingLead.length > 0) {
                leadId = existingLead[0].id;
              } else {
                const { data: newLead } = await admin.database
                  .from("leads")
                  .insert({
                    user_id: userId,
                    name: commenterHandle,
                    source: "instagram",
                    stage: "new",
                    score: 8,
                    deal_value: 3000,
                    metadata: {
                      commentId,
                      commentText,
                      sentiment: aiResult.sentiment,
                    },
                  })
                  .select("id")
                  .single();
                leadId = newLead?.id || null;
              }

              const { data: newConv } = await admin.database
                .from("crm_conversations")
                .insert({
                  user_id: userId,
                  lead_id: leadId,
                  channel: "instagram",
                  status: "open",
                  is_ai_active: true,
                  last_message_at: new Date().toISOString(),
                })
                .select("id")
                .single();

              if (newConv?.id) {
                await admin.database.from("crm_messages").insert([
                  { conversation_id: newConv.id, sender_type: "lead", content: commentText },
                  { conversation_id: newConv.id, sender_type: "ai_assistant", content: aiResult.reply },
                ]);
              }
            } catch (crmErr) {
              console.warn("[Meta Webhook] Notice creating CRM lead/conversation:", crmErr);
            }
          }
        }
      }

      // ─── 7. Handle Direct Messages (messaging array) ────────────────────────
      const messaging = entry.messaging || [];
      for (const msgItem of messaging) {
        const senderId = msgItem?.sender?.id;
        const msgText = msgItem?.message?.text;

        if (!senderId || !msgText || senderId === targetAccountId) continue;

        try {
          const aiResponse = await callResilientCompletion({
            messages: [
              {
                role: "user",
                content: `You are the direct messaging concierge for ${brandName}.
Tone: ${brandTone}.
Niche: ${brand?.niche || "Professional Services"}.
Main Offer: ${brand?.main_offer || "Premium solutions"}.

Respond warmly and helpfully under 80 words. If they are asking for pricing or booking, invite them to share their email or contact info.
Customer message: "${msgText}"`,
              },
            ],
          });

          const replyText = aiResponse.content || `Hi there! Thanks for reaching out to ${brandName}. How can we best help you today?`;

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
          console.warn("[Meta Webhook] Error responding to direct DM:", dmErr);
        }
      }
    }

    return NextResponse.json({ status: "processed" }, { status: 200 });
  } catch (err: any) {
    console.error("[Meta Webhook] Ingestion error:", err);
    return NextResponse.json({ error: err?.message || "Webhook error" }, { status: 200 });
  }
}
