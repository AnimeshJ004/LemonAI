import { NextRequest, NextResponse, after } from "next/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { callResilientCompletion } from "@/lib/ai-gateway";
import { validateInputLengths } from "@/lib/validate-inputs";
import { decrypt } from "@/lib/encryption";
import { processSingleComment } from "@/lib/social-comments-service";
import { getAppUrl } from "@/lib/app-url";
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
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  // Fail closed: if no verify token is configured, refuse verification in ALL
  // environments (production, dev, and test). Never fall back to a hardcoded
  // default, which would allow anyone to complete Meta webhook verification.
  if (!verifyToken || verifyToken.trim().length === 0) {
    console.error(
      "[Meta Webhook] No verify token configured (META_WEBHOOK_VERIFY_TOKEN / WHATSAPP_WEBHOOK_VERIFY_TOKEN). Rejecting verification."
    );
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    const appSecret = (process.env.META_APP_SECRET || process.env.META_CLIENT_SECRET || "").trim();
    const signature = (req.headers.get("x-hub-signature-256") || "").trim();
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction) {
      // Signature verification is MANDATORY in production. Fail closed on any
      // missing configuration or missing/invalid signature.
      if (!appSecret) {
        console.error(
          "[Meta Webhook] META_APP_SECRET is not configured in production. Rejecting webhook."
        );
        return NextResponse.json({ error: "Webhook signature verification not configured" }, { status: 401 });
      }
      if (!signature) {
        console.warn("[Meta Webhook] Missing X-Hub-Signature-256 header in production. Rejecting.");
        return NextResponse.json({ error: "Missing webhook signature" }, { status: 401 });
      }
      const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        console.warn("[Meta Webhook] Signature verification failed.");
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
      }
    } else if (appSecret && signature) {
      // Non-production: verify when we have both the secret and a signature.
      const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        console.warn("[Meta Webhook] Signature verification failed.");
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
      }
    }
    // Non-production with appSecret unset: skip the check to ease local testing.

    const body = JSON.parse(rawBody || "{}");
    const entries = body?.entry || [];

    if (entries.length === 0) {
      return NextResponse.json({ status: "acknowledged_empty" }, { status: 200 });
    }

    let baseUrl: string = "https://lemon-ai-snowy.vercel.app";
    try {
      const detected = getAppUrl(req);
      if (detected && !detected.includes("localhost") && !detected.includes("127.0.0.1")) {
        baseUrl = detected;
      }
    } catch { }

    // Use Next.js after() to return HTTP 200 to Meta in < 20ms, preventing Meta
    // webhook retry storms, while Next.js & Vercel keep the serverless container alive
    // up to maxDuration (60s) so AI generation, comment replies, and DMs run to completion.
    after(async () => {
      try {
        await processWebhookEntriesAsync(entries, baseUrl);
      } catch (procErr) {
        console.error("[Meta Webhook] Background ingestion error:", procErr);
      }
    });

    return NextResponse.json({ status: "acknowledged" }, { status: 200 });
  } catch (err: any) {
    console.error("[Meta Webhook] Synchronous ingestion error:", err);
    return NextResponse.json({ error: err?.message || "Webhook error" }, { status: 200 });
  }
}

/**
 * Asynchronous background worker for processing Meta webhook entries
 */
async function processWebhookEntriesAsync(entries: any[], baseUrl?: string) {
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
        // Meta webhooks can send entry.id as either the Instagram Business Account ID
        // OR the associated Facebook Page ID. Query both columns to guarantee a match.
        const { data: matched } = await admin.database
          .from("user_channels")
          .select("id, user_id, handle, access_token, page_access_token, provider_account_id, page_id, channel_types!inner(type)")
          .or(`provider_account_id.eq.${targetAccountId},page_id.eq.${targetAccountId}`)
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

      // Prioritize permanent Facebook Page Access Token for Instagram/Facebook comment replies & DMs
      const rawPageToken = channelRecord.page_access_token;
      const pageToken = rawPageToken ? (decrypt(rawPageToken) || rawPageToken) : null;
      const rawUserToken = channelRecord.access_token;
      const userToken = rawUserToken ? (decrypt(rawUserToken) || rawUserToken) : null;

      accessToken = pageToken || userToken;

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
        } catch { }
      }

      const igAccountId = channelRecord.provider_account_id || targetAccountId;

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
        igAccountId,
        channelHandle,
        brand,
        baseUrl,
      });
    }

    // ─── 3. Handle Direct Messages (messaging array) ────────────────────────
    const messaging = entry.messaging || [];
    for (const msgItem of messaging) {
      const senderId = msgItem?.sender?.id;
      const msgText = msgItem?.message?.text;
      const msgTimestamp = msgItem?.timestamp
        ? new Date(Number(msgItem.timestamp) * (String(msgItem.timestamp).length <= 10 ? 1000 : 1)).toISOString()
        : new Date().toISOString();

      if (!senderId || !msgText || senderId === targetAccountId) continue;

      // Dedup: resolve the Page ID we'll use for messaging — this is stable and
      // consistent between webhook events and the DM poller.
      const messagingPageId = channelRecord.page_id || targetAccountId;
      const messagingToken = (channelRecord.page_access_token ? decrypt(channelRecord.page_access_token) || channelRecord.page_access_token : null) || accessToken;
      // Use a stable conversation ID: sender + page pair (same as DM poller).
      const stableConvId = `${messagingPageId}_${senderId}`;

      // Check if we already replied to this exact message time to prevent duplicate replies
      // when Meta sends multiple webhook events for the same message.
      try {
        const { data: existingDM } = await admin.database
          .from("social_dms")
          .select("id, last_replied_at, last_message_at")
          .eq("conversation_id", stableConvId)
          .maybeSingle();

        const alreadyReplied =
          existingDM?.last_replied_at &&
          existingDM?.last_message_at &&
          new Date(existingDM.last_replied_at).getTime() >= new Date(existingDM.last_message_at).getTime();

        if (alreadyReplied) {
          // Update last_message_at only if the incoming message is newer
          const incomingTs = new Date(msgTimestamp).getTime();
          const storedTs = existingDM.last_message_at ? new Date(existingDM.last_message_at).getTime() : 0;
          if (incomingTs <= storedTs) {
            // Duplicate event — same message we already replied to, skip.
            console.log(`[Meta Webhook] Skipping duplicate DM event for conv ${stableConvId}`);
            continue;
          }
          // Genuinely new message — fall through to reply.
        }

        // Record/update the incoming DM immediately so concurrent events dedup correctly.
        await admin.database.from("social_dms").upsert(
          {
            user_id: userId,
            platform: (channelRecord?.channel_types as any)?.type || "FACEBOOK",
            conversation_id: stableConvId,
            sender_id: senderId,
            sender_name: `Customer (${senderId.slice(-4)})`,
            last_message: msgText,
            last_message_at: msgTimestamp,
            is_read: false,
            messages_count: 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "conversation_id" }
        );
      } catch (dedupErr) {
        console.warn("[Meta Webhook] DM dedup check notice:", dedupErr);
      }

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

        const sendRes = await fetch(`https://graph.facebook.com/v22.0/${messagingPageId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: replyText },
            // REQUIRED: messaging_type RESPONSE is mandatory for Instagram/Facebook DMs
            // to ensure delivery within the 24-hour messaging window. Without this,
            // Meta may silently drop messages or return error code 10.
            messaging_type: "RESPONSE",
            access_token: messagingToken,
          }),
        });

        if (!sendRes.ok) {
          const errBody = await sendRes.json().catch(() => ({}));
          console.warn(
            `[Meta Webhook] DM reply to ${senderId} failed (sender: ${messagingPageId}):`,
            JSON.stringify(errBody)
          );
        } else {
          console.log(`[Meta Webhook] ✓ DM auto-reply sent to ${senderId} via account ${messagingPageId}`);
          // Mark as replied so the DM poller doesn't duplicate this reply.
          await admin.database
            .from("social_dms")
            .update({
              last_reply: replyText,
              last_replied_at: new Date().toISOString(),
              is_read: true,
            })
            .eq("conversation_id", stableConvId);
        }

        // CRM: capture lead + open conversation for this DM (best-effort, never blocks reply)
        try {
          const lower = msgText.toLowerCase();
          const isHighIntent =
            lower.includes("price") ||
            lower.includes("cost") ||
            lower.includes("buy") ||
            lower.includes("quote") ||
            lower.includes("hire") ||
            lower.includes("book") ||
            lower.includes("demo") ||
            lower.includes("interested");

          // Guard: only create a CRM lead if one doesn't already exist for this sender
          // to prevent duplicate leads accumulating on every webhook event.
          const { data: existingLead } = await admin.database
            .from("leads")
            .select("id")
            .eq("user_id", userId)
            .eq("source", "meta_dm")
            .filter("metadata->>sender_id", "eq", senderId)
            .maybeSingle();

          if (!existingLead) {
            const lead = await createLead({
              user_id: userId,
              name: `DM Prospect (@${senderId.slice(-4)})`,
              source: "meta_dm",
              stage: isHighIntent ? "qualified" : "new",
              score: isHighIntent ? 8 : 5,
              deal_value: isHighIntent ? 2000 : 500,
              notes: `Inbound DM: "${msgText}"`,
              metadata: { sender_id: senderId, inquiry: msgText },
            });

            const conv = await createConversation({
              user_id: userId,
              lead_id: lead.id,
              channel: "instagram",
              is_ai_active: true,
            });

            if (conv?.id) {
              await addMessage({ conversation_id: conv.id, sender_type: "lead", content: msgText });
              if (sendRes.ok && replyText) {
                await addMessage({ conversation_id: conv.id, sender_type: "ai_assistant", content: replyText });
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
          }
        } catch (storageErr) {
          console.warn("[Meta Webhook] DM CRM capture notice:", storageErr);
        }
      } catch (dmErr) {
        console.warn("[Meta Webhook] Error responding to direct DM:", dmErr);
      }
    }
  }
}
