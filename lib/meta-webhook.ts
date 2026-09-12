import { NextRequest, NextResponse, after } from "next/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { callResilientCompletion } from "@/lib/ai-gateway";
import { decrypt } from "@/lib/encryption";
import { processSingleComment } from "@/lib/social-comments-service";
import { socialDMService } from "@/lib/social-dm-service";
import {
  createLead,
  createConversation,
  addMessage,
  recordActivity,
} from "@/lib/crm-service";
import crypto from "crypto";

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
 * 
 * CRITICAL FIX:
 * Responds with HTTP 200 immediately (< 50ms) to prevent Meta from timing out
 * and triggering exponential retry storms (which caused 1-hour delays and duplicate replies).
 * All AI generation, Graph API calls, and DB operations run asynchronously via Next.js `after()`.
 */
export async function handleMetaWebhookPost(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // ─── 0. Cryptographic Signature Verification (X-Hub-Signature-256) ───
    const appSecret = process.env.META_APP_SECRET || process.env.META_CLIENT_SECRET;
    const signature = req.headers.get("x-hub-signature-256");

    if (appSecret && signature) {
      const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        console.warn("[Meta Webhook] Signature verification failed.");
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === "production" && !appSecret) {
      console.warn("[Meta Webhook Warning] META_APP_SECRET is not configured for signature verification.");
    }

    const body = JSON.parse(rawBody || "{}");
    const entries = body?.entry || [];

    if (entries.length === 0) {
      return NextResponse.json({ status: "acknowledged_empty" }, { status: 200 });
    }

    // Schedule background asynchronous processing via Next.js `after`
    // This allows returning HTTP 200 immediately to Meta so it never triggers retries
    after(async () => {
      try {
        await processWebhookEntriesAsync(entries);
      } catch (bgErr) {
        console.error("[Meta Webhook Background] Processing error:", bgErr);
      }
    });

    // Immediate 200 OK to Meta in < 30ms
    return NextResponse.json({ status: "acknowledged" }, { status: 200 });
  } catch (err: any) {
    console.error("[Meta Webhook] Synchronous ingestion error:", err);
    return NextResponse.json({ error: err?.message || "Webhook error" }, { status: 200 });
  }
}

/**
 * Asynchronous background worker for processing Meta webhook entries
 */
async function processWebhookEntriesAsync(entries: any[]) {
  const admin = getInsforgeAdminClient();

  for (const entry of entries) {
    const targetAccountId = String(entry.id || "").trim();

    // ─── 1. Robust Multi-Tenant Channel Resolution ─────────────────────────
    let userId: string | null = null;
    let accessToken: string | null = null;
    let channelHandle: string | null = null;
    let channelRecord: any = null;

    try {

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

      if (!channelRecord) {
        console.log(`[Meta Webhook] Ignored event for unregistered/unconnected account: ${targetAccountId}`);
        continue;
      }

      userId = channelRecord.user_id;
      channelHandle = channelRecord.handle;
      const rawToken = channelRecord.access_token;
      accessToken = decrypt(rawToken) || rawToken;

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

      // Facebook feed changes can be 'post', 'comment', etc. Check if it's a comment or has message
      if (change.field === "feed" && val.item && val.item !== "comment") {
        continue;
      }

      const commentId = String(val.id || val.comment_id || "").trim();
      const commentText = String(val.text || val.message || "").trim();
      const commenterHandle = val.from?.username || val.from?.name || "@user";
      const commenterId = String(val.from?.id || "").trim();
      const mediaId = String(val.media?.id || val.post_id || "").trim();

      if (!commentId || !commentText) continue;

      const detectedPlatform =
        change.field === "feed" || (channelRecord?.channel_types as any)?.type === "FACEBOOK"
          ? "FACEBOOK"
          : "INSTAGRAM";

      // If mediaId is known, try to match to the specific user's scheduled post author
      let postAuthorUserId = userId;
      if (mediaId) {
        try {
          const { data: matchedPost } = await admin.database
            .from("scheduled_posts")
            .select("user_id")
            .ilike("published_url", `%${mediaId}%`)
            .limit(1);
          if (matchedPost && matchedPost.length > 0 && matchedPost[0]?.user_id) {
            postAuthorUserId = matchedPost[0].user_id;
          }
        } catch {}
      }

      // Process comment with unified, bulletproof deduplication & CRM capture engine
      await processSingleComment({
        userId: postAuthorUserId,
        commentId,
        commentText,
        commenterHandle,
        commenterId,
        mediaId,
        platform: detectedPlatform,
        accessToken,
        igAccountId: targetAccountId,
        channelHandle,
        brand,
      });
    }

    // ─── 3. Handle Direct Messages (messaging array) ────────────────────────
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

        const sendRes = await fetch(`https://graph.facebook.com/v22.0/me/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: replyText },
            access_token: accessToken,
          }),
        });

        // Persist DM thread in social_dms table and local fallback
        try {
          await socialDMService.upsertDM({
            user_id: userId,
            platform: "FACEBOOK",
            conversation_id: `dm_${senderId}`,
            sender_id: senderId,
            sender_name: `Customer (${senderId.slice(-4)})`,
            last_message: msgText,
            last_message_at: new Date().toISOString(),
            last_reply: sendRes.ok ? replyText : undefined,
            last_replied_at: sendRes.ok ? new Date().toISOString() : undefined,
            is_read: true,
            messages_count: 2,
          });

          // Record lead in CRM and open conversation in Inbox for all inbound DMs
          const lower = msgText.toLowerCase();
          const isHighIntent =
            lower.includes("price") ||
            lower.includes("cost") ||
            lower.includes("buy") ||
            lower.includes("quote") ||
            lower.includes("hire") ||
            lower.includes("book") ||
            lower.includes("demo") ||
            lower.includes("interested") ||
            lower.includes("detail") ||
            lower.includes("info") ||
            lower.includes("how");

          const lead = await createLead({
            user_id: userId,
            name: `DM Prospect (@${senderId.slice(-4)})`,
            source: "meta_dm",
            stage: isHighIntent ? "qualified" : "new",
            score: isHighIntent ? 8 : 5,
            deal_value: isHighIntent ? 2000 : 500,
            notes: `Inbound DM: "${msgText}"`,
            metadata: {
              sender_id: senderId,
              inquiry: msgText,
            },
          });

          const conv = await createConversation({
            user_id: userId,
            lead_id: lead.id,
            channel: "instagram",
            is_ai_active: true,
          });

          if (conv?.id) {
            await addMessage({
              conversation_id: conv.id,
              sender_type: "lead",
              content: msgText,
            });
            if (sendRes.ok && replyText) {
              await addMessage({
                conversation_id: conv.id,
                sender_type: "ai_assistant",
                content: replyText,
              });
            }
          }

          await recordActivity({
            user_id: userId,
            lead_id: lead.id,
            type: "direct_message",
            title: `Direct message received from ${senderId.slice(-4)}`,
            description: `Inquiry: "${msgText.slice(0, 100)}"`,
            metadata: { sender_id: senderId },
          });
        } catch (storageErr) {
          console.warn("[Meta Webhook] DM persistence notice:", storageErr);
        }
      } catch (dmErr) {
        console.warn("[Meta Webhook] Error responding to direct DM:", dmErr);
      }
    }
  }
}
