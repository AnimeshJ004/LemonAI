import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { callResilientCompletion } from "@/lib/ai-gateway";
import { decrypt } from "@/lib/encryption";

// ---------------------------------------------------------------------------
// In-Memory Idempotency & Concurrency Locks
// ---------------------------------------------------------------------------
// Prevents any simultaneous concurrent executions from double-replying
const inFlightCommentIds = new Set<string>();

// Caches recently replied comment IDs for 1 hour to prevent any instant re-entry
const recentRepliedCommentIds = new Map<string, number>();

// Tracks IDs of replies posted by our bot so webhooks don't treat them as incoming comments
const ourPostedReplyIds = new Set<string>();

// Periodically clean up cache entries older than 1 hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, timestamp] of recentRepliedCommentIds.entries()) {
    if (timestamp < oneHourAgo) {
      recentRepliedCommentIds.delete(id);
    }
  }
  // Cap ourPostedReplyIds size
  if (ourPostedReplyIds.size > 10000) {
    ourPostedReplyIds.clear();
  }
}, 10 * 60 * 1000);

export type AllowedSentiment = "INQUIRY" | "PRAISE" | "COMPLAINT" | "SPAM" | "NEUTRAL";
const VALID_SENTIMENTS: AllowedSentiment[] = ["INQUIRY", "PRAISE", "COMPLAINT", "SPAM", "NEUTRAL"];

/**
 * Validates whether a string is a valid UUID to prevent Postgres type errors
 */
export function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Normalizes sentiment strictly to Postgres check constraint values
 */
export function normalizeSentiment(raw?: any): AllowedSentiment {
  if (!raw) return "NEUTRAL";
  const upper = String(raw).toUpperCase().trim();
  for (const s of VALID_SENTIMENTS) {
    if (upper.includes(s)) return s;
  }
  return "NEUTRAL";
}

export interface ProcessCommentParams {
  userId: string;
  commentId: string;
  commentText: string;
  commenterHandle: string;
  commenterId?: string | null;
  mediaId?: string | null;
  scheduledPostId?: string | null;
  platform?: string;
  accessToken: string;
  igAccountId?: string | null;
  channelHandle?: string | null;
  brand?: {
    business_name?: string;
    brand_tone?: string;
    niche?: string;
    main_offer?: string;
  } | null;
  childReplies?: Array<{
    id?: string;
    text?: string;
    from?: { id?: string; username?: string };
  }>;
}

export interface ProcessCommentResult {
  success: boolean;
  skipped: boolean;
  reason?: string;
  replyId?: string;
  replyText?: string;
  dmSent?: boolean;
}

/**
 * Bulletproof single-comment processor.
 * Guarantees EXACTLY ONE reply per comment:
 * 1. Self-comment filter
 * 2. In-memory in-flight lock
 * 3. Instagram native child replies inspection
 * 4. DB pre-check
 * 5. Atomic DB pre-claim (status: 'processing' with UNIQUE constraint)
 * 6. Resilient AI generation with sentiment sanitization
 * 7. Meta Graph API post
 * 8. DB update (status: 'replied')
 * 9. Private DM & CRM capture if purchase intent
 */
export async function processSingleComment(params: ProcessCommentParams): Promise<ProcessCommentResult> {
  const {
    userId,
    commentId,
    commentText,
    commenterHandle,
    commenterId,
    mediaId,
    scheduledPostId,
    platform = "INSTAGRAM",
    accessToken,
    igAccountId,
    channelHandle,
    brand,
    childReplies = [],
  } = params;

  if (!commentId || !commentText.trim()) {
    return { success: false, skipped: true, reason: "empty_comment" };
  }

  // ─── 1. Filter Self-Comments (Posted by our own page) ────────────────────────
  const cleanCommenter = commenterHandle.toLowerCase().replace(/^@/, "").trim();
  const cleanChannel = (channelHandle || "").toLowerCase().replace(/^@/, "").trim();

  if (commenterId && igAccountId && String(commenterId) === String(igAccountId)) {
    return { success: true, skipped: true, reason: "self_comment_account_id" };
  }
  if (cleanChannel && cleanCommenter === cleanChannel) {
    return { success: true, skipped: true, reason: "self_comment_handle" };
  }
  if (ourPostedReplyIds.has(commentId)) {
    return { success: true, skipped: true, reason: "is_own_bot_reply" };
  }

  // ─── 2. In-Memory Idempotency Lock ──────────────────────────────────────────
  if (inFlightCommentIds.has(commentId)) {
    console.log(`[Social Comment Service] Comment ${commentId} is already in-flight. Skipping duplicate.`);
    return { success: true, skipped: true, reason: "already_in_flight" };
  }

  if (recentRepliedCommentIds.has(commentId)) {
    console.log(`[Social Comment Service] Comment ${commentId} was recently replied (memory cache). Skipping duplicate.`);
    return { success: true, skipped: true, reason: "recently_replied_cache" };
  }

  const admin = getInsforgeAdminClient();

  // ─── 3. Check if Instagram ALREADY has a reply from our page ─────────────────
  if (childReplies.length > 0) {
    const alreadyRepliedOnInstagram = childReplies.some((reply) => {
      const fromId = String(reply?.from?.id || "");
      const fromUsername = String(reply?.from?.username || "").toLowerCase().replace(/^@/, "").trim();
      return (
        (igAccountId && fromId === String(igAccountId)) ||
        (cleanChannel && fromUsername === cleanChannel) ||
        (reply.id && ourPostedReplyIds.has(reply.id))
      );
    });

    if (alreadyRepliedOnInstagram) {
      console.log(`[Social Comment Service] Comment ${commentId} already answered on Instagram. Recording to DB.`);
      recentRepliedCommentIds.set(commentId, Date.now());

      // Sync into DB so future checks find it immediately
      try {
        const safePostId = isValidUuid(scheduledPostId) ? scheduledPostId : null;
        await admin.database.from("social_comments").upsert(
          {
            user_id: userId,
            post_id: safePostId,
            platform,
            platform_comment_id: commentId,
            commenter_handle: commenterHandle,
            comment_text: commentText,
            sentiment: "NEUTRAL",
            reply_text: childReplies[0]?.text || "Replied",
            status: "replied",
          },
          { onConflict: "platform_comment_id" }
        );
      } catch (upsertErr) {
        console.warn("[Social Comment Service] Sync existing reply notice:", upsertErr);
      }

      return { success: true, skipped: true, reason: "already_replied_on_instagram" };
    }
  }

  // ─── 4. Database Pre-Check ──────────────────────────────────────────────────
  try {
    const { data: existing } = await admin.database
      .from("social_comments")
      .select("id, status")
      .eq("platform_comment_id", commentId)
      .limit(1);

    if (existing && existing.length > 0) {
      recentRepliedCommentIds.set(commentId, Date.now());
      console.log(`[Social Comment Service] Comment ${commentId} already in DB with status '${existing[0].status}'. Skipping.`);
      return { success: true, skipped: true, reason: "already_in_db" };
    }
  } catch (checkErr) {
    console.warn("[Social Comment Service] DB pre-check notice:", checkErr);
  }

  // ─── 5. Atomic Database Pre-Claim (status: 'processing') ─────────────────────
  // Acquire in-memory lock
  inFlightCommentIds.add(commentId);

  let safePostId: string | null = null;
  if (isValidUuid(scheduledPostId)) {
    safePostId = scheduledPostId ?? null;
  } else if (mediaId) {
    // Try to find matching scheduled post by media ID in published_url
    try {
      const { data: matchedPosts } = await admin.database
        .from("scheduled_posts")
        .select("id")
        .eq("user_id", userId)
        .ilike("published_url", `%${mediaId}%`)
        .limit(1);
      if (matchedPosts && matchedPosts[0]?.id && isValidUuid(matchedPosts[0].id)) {
        safePostId = matchedPosts[0].id;
      }
    } catch {}
  }

  try {
    // Attempt pre-claim insert. If another process won the race, UNIQUE constraint fails.
    const { error: claimError } = await admin.database.from("social_comments").insert({
      user_id: userId,
      post_id: safePostId,
      platform,
      platform_comment_id: commentId,
      commenter_handle: commenterHandle,
      comment_text: commentText,
      sentiment: "NEUTRAL",
      reply_text: null,
      status: "processing",
    });

    if (claimError) {
      // If UNIQUE constraint violated, another thread or worker already claimed this comment
      console.log(`[Social Comment Service] Comment ${commentId} pre-claim conflict (already claimed):`, claimError.message);
      inFlightCommentIds.delete(commentId);
      recentRepliedCommentIds.set(commentId, Date.now());
      return { success: true, skipped: true, reason: "concurrency_preclaim_conflict" };
    }

    // ─── 6. Generate Autonomous AI Reply ──────────────────────────────────────
    const brandName = brand?.business_name || "Our Team";
    const brandTone = brand?.brand_tone || "Friendly, professional, and helpful";
    const brandNiche = brand?.niche || "Business & Growth";
    const mainOffer = brand?.main_offer || "Premium solutions";

    let aiResult = {
      sentiment: "NEUTRAL" as AllowedSentiment,
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
Niche: ${brandNiche}
Main Offer: ${mainOffer}

Analyze this incoming comment and provide an immediate, engaging reply.
Comment: "${commentText}"
Commenter: @${commenterHandle}

Rules:
1. Public reply MUST be concise, under 140 characters.
2. If the user asks about price, cost, booking, demo, or buying, set shouldSendDM to true and write a helpful private dmMessage.
3. Return ONLY valid JSON:
{
  "sentiment": "INQUIRY|PRAISE|COMPLAINT|SPAM|NEUTRAL",
  "reply": "Your public response",
  "shouldSendDM": true,
  "dmMessage": "Private direct message text if purchase intent"
}`,
          },
        ],
      });

      if (completion.data && typeof completion.data === "object") {
        aiResult = {
          sentiment: normalizeSentiment(completion.data.sentiment),
          reply: completion.data.reply || `Thanks for reaching out! 🙏`,
          shouldSendDM: Boolean(completion.data.shouldSendDM),
          dmMessage: completion.data.dmMessage || "",
        };
      } else {
        aiResult.sentiment = normalizeSentiment(aiResult.sentiment);
      }
    } catch (aiErr) {
      console.warn("[Social Comment Service] AI fallback triggered:", aiErr);
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

    // ─── 7. Post Public Reply via Meta Graph API ──────────────────────────────
    let replySuccess = false;
    let replyId: string | undefined = undefined;

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
        replyId = replyJson.id;
        ourPostedReplyIds.add(replyJson.id);
        recentRepliedCommentIds.set(commentId, Date.now());
        console.log(`[Social Comment Service] ✓ Auto-reply posted to comment ${commentId}, reply ID: ${replyJson.id}`);
      } else {
        const errMsg = replyJson?.error?.message || JSON.stringify(replyJson);
        console.error(`[Social Comment Service] Meta Graph API returned error for comment ${commentId}:`, errMsg);

        // Check if Meta says the comment already has replies or was deleted
        if (errMsg.includes("already") || errMsg.includes("duplicate") || replyJson?.error?.code === 100) {
          replySuccess = false;
        }
      }
    } catch (postErr) {
      console.error(`[Social Comment Service] Network error dispatching reply to comment ${commentId}:`, postErr);
    }

    // ─── 8. Send Private Direct Message (if purchase intent detected) ───────────
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
          console.log(`[Social Comment Service] ✓ Private DM sent to commenter ${commenterId}`);
        } else {
          console.warn(`[Social Comment Service] Notice sending DM to ${commenterId}:`, JSON.stringify(dmJson));
        }
      } catch (dmErr) {
        console.warn("[Social Comment Service] Network notice sending private DM:", dmErr);
      }
    }

    // ─── 9. Finalize Database Record ──────────────────────────────────────────
    if (replySuccess) {
      try {
        const { error: updateErr } = await admin.database
          .from("social_comments")
          .update({
            sentiment: aiResult.sentiment,
            reply_text: aiResult.reply,
            dm_sent: dmSuccess,
            status: "replied",
          })
          .eq("platform_comment_id", commentId);

        if (updateErr) {
          console.error("[Social Comment Service] Failed to update social_comments status:", updateErr.message);
        }
      } catch (dbUpdateErr) {
        console.error("[Social Comment Service] DB update exception:", dbUpdateErr);
      }

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
          console.warn("[Social Comment Service] Notice creating CRM lead/conversation:", crmErr);
        }
      }

      return {
        success: true,
        skipped: false,
        replyId,
        replyText: aiResult.reply,
        dmSent: dmSuccess,
      };
    } else {
      // Mark as failed so future runs know what happened, or remove so it can retry later
      try {
        await admin.database
          .from("social_comments")
          .update({ status: "failed" })
          .eq("platform_comment_id", commentId);
      } catch {}

      return {
        success: false,
        skipped: false,
        reason: "meta_api_reply_failed",
      };
    }
  } finally {
    inFlightCommentIds.delete(commentId);
  }
}

/**
 * Autonomous Polling Engine:
 * Scans connected Instagram & Facebook accounts for newly published media comments,
 * and replies autonomously with 0 human effort.
 */
export async function pollConnectedChannelsComments(maxChannels = 10): Promise<{
  scannedChannels: number;
  scannedPosts: number;
  repliedCount: number;
}> {
  const admin = getInsforgeAdminClient();
  let totalReplied = 0;
  let totalPosts = 0;

  try {
    // 1. Fetch connected Instagram and Facebook channels
    const { data: channels, error: chanErr } = await admin.database
      .from("user_channels")
      .select("id, user_id, provider_account_id, handle, access_token, channel_types!inner(type)")
      .in("channel_types.type", ["INSTAGRAM", "FACEBOOK"])
      .eq("is_connected", true)
      .not("access_token", "is", null)
      .limit(maxChannels);

    if (chanErr || !channels || channels.length === 0) {
      return { scannedChannels: 0, scannedPosts: 0, repliedCount: 0 };
    }

    for (const channel of channels) {
      const rawToken = channel.access_token;
      if (!rawToken) continue;

      let accessToken: string | null = null;
      try {
        accessToken = decrypt(rawToken) || rawToken;
      } catch {
        accessToken = rawToken;
      }

      const igAccountId = channel.provider_account_id;
      if (!accessToken || !igAccountId) continue;

      // Fetch Brand Profile for this user
      const { data: brand } = await admin.database
        .from("brand_profiles")
        .select("business_name, niche, brand_tone, main_offer")
        .eq("user_id", channel.user_id)
        .maybeSingle();

      // Query recent media from Instagram (latest 5 posts for rapid scanning)
      try {
        const mediaUrl = `https://graph.facebook.com/v22.0/${igAccountId}/media?fields=id,caption,comments{id,text,from,timestamp,comments{id,from,text}}&limit=5&access_token=${encodeURIComponent(accessToken)}`;
        const mediaRes = await fetch(mediaUrl);

        if (!mediaRes.ok) continue;

        const mediaData = await mediaRes.json();
        const posts = mediaData?.data || [];
        totalPosts += posts.length;

        for (const post of posts) {
          const comments = post.comments?.data || [];

          for (const item of comments) {
            const commentId = item.id;
            const commentText = item.text;
            const commenterHandle = item.from?.username || item.from?.name || "@user";
            const commenterId = item.from?.id;
            const childReplies = item.comments?.data || [];

            const res = await processSingleComment({
              userId: channel.user_id,
              commentId,
              commentText,
              commenterHandle,
              commenterId,
              mediaId: post.id,
              platform: (channel.channel_types as any)?.type || "INSTAGRAM",
              accessToken,
              igAccountId,
              channelHandle: channel.handle,
              brand,
              childReplies,
            });

            if (res.success && !res.skipped) {
              totalReplied++;
            }
          }
        }
      } catch (mediaErr) {
        console.warn(`[Social Comment Service] Polling error for account ${igAccountId}:`, mediaErr);
      }
    }

    return {
      scannedChannels: channels.length,
      scannedPosts: totalPosts,
      repliedCount: totalReplied,
    };
  } catch (err: any) {
    console.error("[Social Comment Service] Poller error:", err);
    return { scannedChannels: 0, scannedPosts: totalPosts, repliedCount: totalReplied };
  }
}
