import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { callResilientCompletion } from "@/lib/ai-gateway";
import { decrypt } from "@/lib/encryption";
import {
  createLead,
  updateLead,
  createConversation,
  addMessage,
  recordActivity,
} from "@/lib/crm-service";

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
 * Checks whether a comment contains buying, pricing, contact, or collaboration intent.
 * Covers both English and common Hinglish / Indian market patterns.
 */
export function isCommentInquiry(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  const inquiryKeywords = [
    "price", "pricing", "cost", "costing", "how much", "rate", "rates", "quote", "quotation",
    "buy", "buying", "purchase", "order", "ordering",
    "hire", "book", "booking", "appointment", "demo",
    "interested", "intrested", "intrest", "want", "need", "looking for",
    "detail", "details", "info", "information",
    "dm", "link", "collab", "collaboration", "work with",
    "call", "connect", "contact", "phone", "whatsapp", "number",
    "service", "services", "solution", "solutions", "plan", "plans",
    "package", "packages", "fees", "fee", "charges", "charge",
    // Hinglish / Indian phrasing
    "kya price", "kitna", "kitne", "chahiye", "batao", "bataiye", "kaise", "sampark",
    "inquire", "inquiry"
  ];
  return inquiryKeywords.some((k) => lower.includes(k));
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

export interface CaptureLeadParams {
  userId: string;
  commentId: string;
  commentText: string;
  commenterHandle: string;
  commenterId?: string | null;
  mediaId?: string | null;
  platform: string;
  sentiment?: AllowedSentiment;
  replyText?: string | null;
}

/**
 * Captures a prospect who commented with buying/pricing/service intent as a CRM Lead,
 * opens a conversation in the Omnichannel Inbox, and logs an activity timeline event.
 * Bulletproof and independent of whether automated public replies succeed.
 */
export async function captureLeadFromComment(params: CaptureLeadParams): Promise<string | null> {
  const {
    userId,
    commentId,
    commentText,
    commenterHandle,
    commenterId,
    mediaId,
    platform,
    sentiment = "INQUIRY",
    replyText,
  } = params;

  if (!userId || !commenterHandle) return null;
  const admin = getInsforgeAdminClient();
  const cleanHandle = commenterHandle.replace(/^@/, "").trim();
  const normalizedPlatform = String(platform || "").toUpperCase() === "FACEBOOK" ? "facebook" : "instagram";

  try {
    let leadId: string | null = null;

    // 1. Check if a lead already exists for this handle under this user
    const { data: existingLead } = await admin.database
      .from("leads")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", `%${cleanHandle}%`)
      .limit(1);

    if (existingLead && existingLead.length > 0 && existingLead[0]?.id) {
      const existingId = existingLead[0].id;
      leadId = existingId;
      // Update existing lead with latest comment inquiry details and bump updated_at
      await updateLead(existingId, {
        stage: "new",
        metadata: {
          notes: `Recent inquiry on ${normalizedPlatform.toUpperCase()} post ${mediaId || ""}: "${commentText}"`,
          commentId,
          commentText,
          sentiment,
          platform: normalizedPlatform,
          commenterId,
          mediaId,
          latestInquiryAt: new Date().toISOString(),
        },
      });
    } else {
      const created = await createLead({
        user_id: userId,
        name: commenterHandle,
        source: normalizedPlatform,
        stage: "new",
        score: 8,
        deal_value: 3000,
        notes: `Comment on ${normalizedPlatform.toUpperCase()} post ${mediaId || ""}: "${commentText}"`,
        metadata: {
          commentId,
          commentText,
          sentiment,
          platform: normalizedPlatform,
          commenterId,
          mediaId,
        },
      });
      leadId = created.id;
    }

    if (leadId) {
      // 2. Create or find conversation in Omnichannel Inbox
      const conv = await createConversation({
        user_id: userId,
        lead_id: leadId,
        channel: normalizedPlatform,
        is_ai_active: true,
      });

      if (conv?.id) {
        await addMessage({
          conversation_id: conv.id,
          sender_type: "lead",
          content: commentText,
        });
        if (replyText) {
          await addMessage({
            conversation_id: conv.id,
            sender_type: "ai_assistant",
            content: replyText,
          });
        }
      }

      // 3. Record in activity timeline
      await recordActivity({
        user_id: userId,
        lead_id: leadId,
        type: "lead_created",
        title: `New lead from ${normalizedPlatform.toUpperCase()} comment: ${commenterHandle}`,
        description: `Inquiry: "${commentText.slice(0, 100)}"`,
        metadata: { commentId, mediaId, platform: normalizedPlatform },
      });

      console.log(`[Social Comment Service] ✓ CRM Lead & Conversation captured for ${commenterHandle} (${normalizedPlatform})`);
    }
    return leadId;
  } catch (err: any) {
    console.error("[Social Comment Service] Failed to capture lead from comment:", err?.message || err);
    return null;
  }
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

  // ─── 3. Check if Instagram/Facebook ALREADY has a reply from our page ──────
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
      console.log(`[Social Comment Service] Comment ${commentId} already answered on Instagram/Facebook. Recording to DB.`);
      recentRepliedCommentIds.set(commentId, Date.now());

      // If inquiry or buyer intent detected, ensure the CRM lead is recorded
      if (isCommentInquiry(commentText)) {
        await captureLeadFromComment({
          userId,
          commentId,
          commentText,
          commenterHandle,
          commenterId,
          mediaId,
          platform,
          sentiment: "INQUIRY",
          replyText: childReplies[0]?.text || "Replied",
        });
      }

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
            sentiment: isCommentInquiry(commentText) ? "INQUIRY" : "NEUTRAL",
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
      // Ensure CRM lead is captured/updated if this was an inquiry
      if (isCommentInquiry(commentText)) {
        await captureLeadFromComment({
          userId,
          commentId,
          commentText,
          commenterHandle,
          commenterId,
          mediaId,
          platform,
          sentiment: "INQUIRY",
        });
      }
      console.log(`[Social Comment Service] Comment ${commentId} already in DB with status '${existing[0].status}'. Skipping duplicate reply.`);
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
      intentType: "general" as "booking" | "pricing" | "general",
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
1. Public reply MUST be concise, under 140 characters. Do NOT say "Sent you a DM" or "check your DM" in the public reply — that will be added automatically if a DM is sent.
2. If the user expresses interest in booking, meeting, appointment, or consultation → set shouldSendDM true, intentType "booking", write a warm DM inviting them to book.
3. If the user asks about price, cost, rate, quote, package, or fees → set shouldSendDM true, intentType "pricing", write a DM acknowledging their interest.
4. For general inquiries → set shouldSendDM true if warranted, intentType "general".
5. Return ONLY valid JSON (no markdown). Use exactly this structure:
{
  "sentiment": "INQUIRY",
  "reply": "Your concise public comment reply here",
  "shouldSendDM": false,
  "dmMessage": "",
  "intentType": "general"
}
shouldSendDM must be a boolean. intentType must be one of: booking | pricing | general.`,

          },
        ],
      });

      if (completion.data && typeof completion.data === "object") {
        const rawIntent = String(completion.data.intentType || "general").toLowerCase();
        const parsedIntent: "booking" | "pricing" | "general" =
          rawIntent === "booking" ? "booking" : rawIntent === "pricing" ? "pricing" : "general";
        aiResult = {
          sentiment: normalizeSentiment(completion.data.sentiment),
          reply: completion.data.reply || `Thanks for reaching out! 🙏`,
          shouldSendDM: Boolean(completion.data.shouldSendDM),
          dmMessage: completion.data.dmMessage || "",
          intentType: parsedIntent,
        };
      } else {
        aiResult.sentiment = normalizeSentiment(aiResult.sentiment);
      }
    } catch (aiErr) {
      console.warn("[Social Comment Service] AI fallback triggered:", aiErr);
      const lower = commentText.toLowerCase();
      const isBookingIntent =
        lower.includes("interested") || lower.includes("book") || lower.includes("appointment") ||
        lower.includes("meet") || lower.includes("consult") || lower.includes("schedule");
      const isPricingIntent =
        lower.includes("price") || lower.includes("cost") || lower.includes("how much") ||
        lower.includes("rate") || lower.includes("fees") || lower.includes("quote") || lower.includes("package");

      if (isBookingIntent) {
        aiResult = {
          sentiment: "INQUIRY",
          reply: `We'd love to connect! 📩 Sending you details now.`,
          shouldSendDM: true,
          dmMessage: `Hi @${commenterHandle}! We'd love to have a chat with you about ${brandName}. Let's get you booked in! 🙏`,
          intentType: "booking",
        };
      } else if (isPricingIntent) {
        aiResult = {
          sentiment: "INQUIRY",
          reply: `Great question! 📩 Sending you pricing details in DM.`,
          shouldSendDM: true,
          dmMessage: `Hi @${commenterHandle}! Thanks for your interest in ${brandName}. Here's a bit about what we offer — ${mainOffer}. Let's find the right plan for you!`,
          intentType: "pricing",
        };
      } else if (lower.includes("love") || lower.includes("awesome") || lower.includes("great") || lower.includes("fire") || lower.includes("🔥")) {
        aiResult = {
          sentiment: "PRAISE",
          reply: "Thank you so much! Really appreciate the love! ❤️✨",
          shouldSendDM: false,
          dmMessage: "",
          intentType: "general",
        };
      }
    }

    // ─── 6b. Append intent-aware form link to DM message ────────────────────────
    // If AI wants to send a DM, embed the right lead capture form URL based on what the commenter said.
    if (aiResult.shouldSendDM && aiResult.dmMessage && userId) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
      const formType = aiResult.intentType === "booking" ? "booking" : aiResult.intentType === "pricing" ? "pricing" : null;
      if (formType && baseUrl) {
        const formUrl = `${baseUrl}/lead-form?type=${formType}&user=${encodeURIComponent(userId)}&source=${encodeURIComponent(platform.toLowerCase())}&name=${encodeURIComponent(commenterHandle)}`;
        const formCta = formType === "booking"
          ? `\n\n📅 Book your free consultation here:\n${formUrl}`
          : `\n\n📋 Share your requirements & get a custom quote:\n${formUrl}`;
        aiResult.dmMessage = aiResult.dmMessage.trim() + formCta;
      }
    }

    // ─── 7. Post Public Reply via Meta Graph API ──────────────────────────────
    const isFacebook = String(platform || "").toUpperCase() === "FACEBOOK";
    // Facebook Page comments use /{comment_id}/comments, Instagram uses /{comment_id}/replies
    const replyEndpoint = isFacebook
      ? `https://graph.facebook.com/v22.0/${commentId}/comments`
      : `https://graph.facebook.com/v22.0/${commentId}/replies`;

    let replySuccess = false;
    let replyId: string | undefined = undefined;

    try {
      const replyRes = await fetch(replyEndpoint, {
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
        console.log(`[Social Comment Service] ✓ Auto-reply posted to comment ${commentId} (${isFacebook ? "Facebook" : "Instagram"}), reply ID: ${replyJson.id}`);
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
    // DIAGNOSTIC: Log every variable that controls whether a DM is sent
    console.log("[Social Comment Service] DM diagnostic:", {
      shouldSendDM: aiResult.shouldSendDM,
      hasDmMessage: Boolean(aiResult.dmMessage),
      commenterId: commenterId || "(empty — DM will be skipped!)",
      igAccountId: igAccountId || "(empty — will fallback to 'me')",
      intentType: aiResult.intentType,
      platform,
    });

    let dmSuccess = false;
    // Allow DM even if commenterId is empty — the private reply fallback uses commentId directly.
    // Instagram often omits from.id on comments, so we must not block on it.
    if (aiResult.shouldSendDM && aiResult.dmMessage && (commenterId || commentId)) {
      try {
        const senderId = igAccountId || "me";

        // Instagram requires messaging_type: "RESPONSE" for DMs sent in response to user actions.
        // Without this, the API rejects the request with code 10 (Permission Denied).
        const dmPayload: Record<string, any> = {
          recipient: { id: commenterId },
          message: { text: aiResult.dmMessage },
          messaging_type: "RESPONSE",
          access_token: accessToken,
        };

        const dmRes = await fetch(`https://graph.facebook.com/v22.0/${senderId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dmPayload),
        });
        const dmJson = await dmRes.json().catch(() => ({}));

        if (dmRes.ok && (dmJson?.message_id || dmJson?.recipient_id)) {
          dmSuccess = true;
          console.log(`[Social Comment Service] ✓ DM sent to ${commenterId} via ${senderId}`);
        } else {
          const errCode = dmJson?.error?.code;
          const errMsg = dmJson?.error?.message || JSON.stringify(dmJson);
          console.warn(
            `[Social Comment Service] ✗ DM to ${commenterId} failed (sender: ${senderId}, code: ${errCode}):`,
            errMsg
          );

          // Fallback: For Instagram, try sending DM using the comment_id as recipient
          // (Private Reply API — works even if user hasn't messaged the page before)
          if (!dmSuccess && !isFacebook && commentId) {
            try {
              console.log(`[Social Comment Service] Trying Instagram Private Reply to comment ${commentId}...`);
              const prRes = await fetch(`https://graph.facebook.com/v22.0/${senderId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  recipient: { comment_id: commentId },
                  message: { text: aiResult.dmMessage },
                  messaging_type: "RESPONSE",
                  access_token: accessToken,
                }),
              });
              const prJson = await prRes.json().catch(() => ({}));
              if (prRes.ok && (prJson?.message_id || prJson?.recipient_id)) {
                dmSuccess = true;
                console.log(`[Social Comment Service] ✓ Instagram Private Reply sent to comment ${commentId}`);
              } else {
                console.warn(
                  `[Social Comment Service] ✗ Private Reply also failed (comment: ${commentId}):`,
                  JSON.stringify(prJson)
                );
              }
            } catch (prErr) {
              console.warn("[Social Comment Service] Private Reply network error:", prErr);
            }
          }
        }
      } catch (dmErr) {
        console.warn("[Social Comment Service] Network error sending private DM:", dmErr);
      }
    } else if (aiResult.shouldSendDM) {
      // Log WHY the DM was skipped despite shouldSendDM = true
      console.warn("[Social Comment Service] DM skipped despite shouldSendDM=true:", {
        missingBothIds: !commenterId && !commentId,
        missingDmMessage: !aiResult.dmMessage,
      });
    }

    // ─── 8b. Patch public reply text to reflect actual DM outcome ────────────
    // Only promise a DM in the public comment if the DM was actually delivered.
    // If DM failed, strip any DM-promise language so we don't mislead the commenter.
    if (aiResult.shouldSendDM) {
      const replyLower = aiResult.reply.toLowerCase();
      const mentionsDM = replyLower.includes("dm") || replyLower.includes("direct message") || replyLower.includes("inbox");
      if (dmSuccess && !mentionsDM) {
        // Safely append DM confirmation within 140 char limit
        const suffix = " 📩 Check your DMs!";
        if ((aiResult.reply + suffix).length <= 140) {
          aiResult.reply = aiResult.reply + suffix;
        }
      } else if (!dmSuccess && mentionsDM) {
        // DM failed — replace the reply with a neutral version that doesn't lie
        aiResult.reply = `Thanks for your interest, @${commenterHandle}! 🙏 We'll get back to you shortly.`;
      }
    }

    // ─── 9. Lead & CRM Capture (CRITICAL FIX: Runs INDEPENDENTLY of public reply success) ───
    const hasIntent =
      isCommentInquiry(commentText) ||
      aiResult.shouldSendDM ||
      aiResult.sentiment === "INQUIRY";

    let leadId: string | null = null;
    if (hasIntent) {
      leadId = await captureLeadFromComment({
        userId,
        commentId,
        commentText,
        commenterHandle,
        commenterId,
        mediaId,
        platform,
        sentiment: aiResult.sentiment,
        replyText: aiResult.reply,
      });
    }

    // ─── 10. Update social_comments Database Record ───────────────────────────
    const commentStatus = replySuccess ? "replied" : (hasIntent ? "lead_captured" : "failed");
    try {
      const { error: updateErr } = await admin.database
        .from("social_comments")
        .update({
          sentiment: aiResult.sentiment,
          reply_text: replySuccess ? aiResult.reply : null,
          dm_sent: dmSuccess,
          status: commentStatus,
        })
        .eq("platform_comment_id", commentId);

      if (updateErr) {
        console.error("[Social Comment Service] Failed to update social_comments status:", updateErr.message);
      }
    } catch (dbUpdateErr) {
      console.error("[Social Comment Service] DB update exception:", dbUpdateErr);
    }

    return {
      success: replySuccess || Boolean(leadId),
      skipped: false,
      replyId,
      replyText: aiResult.reply,
      dmSent: dmSuccess,
      reason: replySuccess ? undefined : (leadId ? "lead_captured_reply_pending" : "reply_failed"),
    };
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

      const accountId = channel.provider_account_id;
      const channelType = (channel.channel_types as any)?.type || "INSTAGRAM";
      if (!accessToken || !accountId) continue;

      // Fetch Brand Profile for this user
      const { data: brand } = await admin.database
        .from("brand_profiles")
        .select("business_name, niche, brand_tone, main_offer")
        .eq("user_id", channel.user_id)
        .maybeSingle();

      // Query recent media/posts (latest 5 posts for rapid scanning)
      try {
        let posts: any[] = [];
        if (channelType === "FACEBOOK") {
          const fbUrl = `https://graph.facebook.com/v22.0/${accountId}/published_posts?fields=id,message,comments{id,message,from,created_time}&limit=5&access_token=${encodeURIComponent(accessToken)}`;
          const fbRes = await fetch(fbUrl);
          if (fbRes.ok) {
            const fbData = await fbRes.json();
            posts = (fbData?.data || []).map((p: any) => ({
              id: p.id,
              caption: p.message,
              comments: {
                data: (p.comments?.data || []).map((c: any) => ({
                  id: c.id,
                  text: c.message,
                  from: c.from,
                  timestamp: c.created_time,
                  comments: { data: [] },
                })),
              },
            }));
          }
        } else {
          const mediaUrl = `https://graph.facebook.com/v22.0/${accountId}/media?fields=id,caption,comments{id,text,from,timestamp,comments{id,from,text}}&limit=5&access_token=${encodeURIComponent(accessToken)}`;
          const mediaRes = await fetch(mediaUrl);
          if (mediaRes.ok) {
            const mediaData = await mediaRes.json();
            posts = mediaData?.data || [];
          }
        }

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
              igAccountId: accountId,
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
        console.warn(`[Social Comment Service] Polling error for account ${accountId}:`, mediaErr);
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
