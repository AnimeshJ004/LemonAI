import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { callResilientCompletion } from "@/lib/ai-gateway";
import { validateInputLengths } from "@/lib/validate-inputs";
import { decrypt } from "@/lib/encryption";
import { sendPrivateDM } from "@/lib/meta-messaging";
import {
  createLead,
  updateLead,
  createConversation,
  addMessage,
  recordActivity,
} from "@/lib/crm-service";
import { getAppUrl } from "@/lib/app-url";

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
  baseUrl?: string;
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
  const upper = String(platform || "").toUpperCase();
  const normalizedPlatform =
    upper === "FACEBOOK" ? "facebook" :
    upper === "THREADS" ? "threads" :
    upper === "YOUTUBE" ? "youtube" :
    upper === "LINKEDIN" ? "linkedin" :
    upper === "TWITTER" || upper === "X" ? "twitter" :
    "instagram";

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

  const admin = getInsforgeAdminClient();

  // ─── 3. Check if Instagram/Facebook ALREADY has a reply from our page ──────
  if (childReplies.length > 0) {
    const alreadyRepliedOnInstagram = childReplies.some((reply) => {
      const fromId = String(reply?.from?.id || "");
      const fromUsername = String(reply?.from?.username || "").toLowerCase().replace(/^@/, "").trim();
      return (
        (igAccountId && fromId === String(igAccountId)) ||
        (cleanChannel && fromUsername === cleanChannel)
      );
    });

    if (alreadyRepliedOnInstagram) {
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
      return { success: true, skipped: true, reason: "already_in_db" };
    }
  } catch (checkErr) {
    console.warn("[Social Comment Service] DB pre-check notice:", checkErr);
  }

  // ─── 5. Durable DB-backed Idempotency Claim ─────────────────────────────────
  // Replaces the previous in-memory dedup with a durable claim in `replied_comments`.
  // Works correctly across serverless multi-instance deployments: if another
  // instance already claimed this comment, the unique PK on comment_id causes a
  // conflict (Postgres error code 23505) and we skip sending the reply.
  try {
    const { error: idempotencyError } = await admin.database
      .from("replied_comments")
      .insert({
        comment_id: commentId,
        user_id: userId,
        replied_at: new Date().toISOString(),
      });

    if (idempotencyError) {
      // 23505 = unique_violation → another instance already owns this comment.
      if (
        idempotencyError.code === "23505" ||
        idempotencyError.message?.toLowerCase().includes("duplicate") ||
        idempotencyError.message?.toLowerCase().includes("unique")
      ) {
        return { success: true, skipped: true, reason: "already_replied_idempotency" };
      }
      console.warn("[Social Comment Service] Idempotency record insert warning:", idempotencyError.message);
    }
  } catch (idempotencyErr: any) {
    if (
      idempotencyErr?.code === "23505" ||
      idempotencyErr?.message?.toLowerCase().includes("duplicate") ||
      idempotencyErr?.message?.toLowerCase().includes("unique")
    ) {
      return { success: true, skipped: true, reason: "already_replied_idempotency" };
    }
    console.warn("[Social Comment Service] Non-fatal idempotency claim notice:", idempotencyErr?.message || idempotencyErr);
  }

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
      if (
        claimError.code === "23505" ||
        claimError.message?.toLowerCase().includes("duplicate") ||
        claimError.message?.toLowerCase().includes("unique")
      ) {
        // If UNIQUE constraint violated, another thread or worker already claimed this comment
        return { success: true, skipped: true, reason: "concurrency_preclaim_conflict" };
      }
      console.warn("[Social Comment Service] Pre-claim insert notice:", claimError.message);
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

    // ─── Deterministic intent detection (source of truth, not the LLM) ────────
    // The LLM's role is to write nice copy; the DECISION to send a DM is made
    // here from the raw comment text so the auto-DM cannot be silently dropped
    // by a model that parrots default JSON values back to us.
    const lowerComment = commentText.toLowerCase();
    const bookingKeywords = [
      "interested", "intrested", "intrest",
      "book", "booking", "appointment", "appt",
      "meet", "meeting", "call", "consult", "consultation",
      "schedule", "demo", "walkthrough", "connect",
    ];
    const pricingKeywords = [
      "price", "pricing", "cost", "costing", "how much",
      "rate", "rates", "quote", "quotation",
      "package", "packages", "plan", "plans",
      "fees", "fee", "charges", "charge",
      // Hinglish
      "kya price", "kitna", "kitne",
    ];
    const isBookingIntent = bookingKeywords.some((k) => lowerComment.includes(k));
    const isPricingIntent = pricingKeywords.some((k) => lowerComment.includes(k));
    const detectedIntent: "booking" | "pricing" | "general" =
      isBookingIntent ? "booking" : isPricingIntent ? "pricing" : "general";
    // Only fire an auto-DM on unambiguous buyer intent (booking / pricing /
    // "interested"). Broad inquiry keywords like "info" or "details" alone are
    // captured as CRM leads (below) but do NOT trigger an unsolicited DM.
    const hasBuyerIntent = isBookingIntent || isPricingIntent;

    try {
      const completion = await callResilientCompletion({
        jsonMode: true,
        messages: [
          {
            role: "system",
            content: `You are the autonomous social media AI manager for ${brandName}.
Brand Tone: ${brandTone}
Niche: ${brandNiche}
Main Offer: ${mainOffer}

Your job: for each incoming public comment, write (a) a short public reply and (b) a warm private DM message. You DO NOT decide whether the DM is sent — that decision is made deterministically by our system based on the comment text. You just always author both pieces of copy.

Copy rules:
- Public reply: under 140 characters, engaging, in the brand tone. NEVER write "check your DM", "sent you a DM", or similar — our system appends that automatically when a DM is delivered.
- DM message: 2–4 friendly sentences, warm and helpful, addressed to @${commenterHandle}. If the intent is "booking", invite them to book a consultation. If "pricing", acknowledge their interest and offer to share details. If "general", thank them and offer to help further. Do NOT include a URL — our system appends the correct lead-capture link automatically.

Output format: ONLY a JSON object with these keys. Do not wrap in markdown.
- sentiment: one of "INQUIRY" | "PRAISE" | "COMPLAINT" | "SPAM" | "NEUTRAL"
- reply: string (the public reply text)
- dmMessage: string (the private DM body — ALWAYS write one, even for praise, so the system can use it if needed)
- intentType: one of "booking" | "pricing" | "general"

Examples:
Comment "Interested, DM me pricing please" → {"sentiment":"INQUIRY","reply":"Amazing! We'd love to help you out 💛","dmMessage":"Hi @user! Thanks so much for reaching out about ${brandName}. We'd love to share our pricing options that match your needs — a couple of quick questions will let us tailor the right plan for you.","intentType":"pricing"}
Comment "Can I book an appointment?" → {"sentiment":"INQUIRY","reply":"Absolutely — we'd love to have you! 📅","dmMessage":"Hi @user! Thrilled you want to connect with ${brandName}. Let's get a quick consultation on the calendar so we can understand your goals and how we can help.","intentType":"booking"}
Comment "Love this content 🔥" → {"sentiment":"PRAISE","reply":"Thank you so much! 💛 So glad it landed!","dmMessage":"Hey @user! Thanks a ton for the love — means the world. If there's ever anything we can help you with, just say the word.","intentType":"general"}

Now analyze this comment.
Comment: "${commentText}"
Commenter: @${commenterHandle}
Detected intent (hint, may be general): "${detectedIntent}"

Return ONLY the JSON object.`,
          },
        ],
      });

      if (completion.data && typeof completion.data === "object") {
        const rawIntent = String(completion.data.intentType || detectedIntent).toLowerCase();
        const parsedIntent: "booking" | "pricing" | "general" =
          rawIntent === "booking" ? "booking" : rawIntent === "pricing" ? "pricing" : "general";
        aiResult = {
          sentiment: normalizeSentiment(completion.data.sentiment),
          reply: completion.data.reply || `Thanks for reaching out! 🙏`,
          // NOTE: we deliberately IGNORE the AI's shouldSendDM — that decision
          // is made deterministically below from the actual comment text.
          shouldSendDM: false,
          dmMessage: String(completion.data.dmMessage || "").trim(),
          intentType: parsedIntent,
        };
      } else {
        console.warn("[Social Comment Service] AI returned no parseable data — falling back to templated copy.");
        aiResult.sentiment = normalizeSentiment(aiResult.sentiment);
      }
    } catch (aiErr) {
      console.warn("[Social Comment Service] AI generation threw, using templated copy:", aiErr);
    }

    // ─── 6a. Deterministic DM decision + default copy safety net ──────────────
    // Regardless of what the AI returned, decide whether to send the DM based
    // on the actual comment text. This is the single fix that makes auto-DM
    // reliable for "book appointment / pricing / interested" comments.
    if (hasBuyerIntent) {
      aiResult.shouldSendDM = true;
      aiResult.intentType = detectedIntent === "general" ? aiResult.intentType : detectedIntent;
      if (aiResult.sentiment === "NEUTRAL") aiResult.sentiment = "INQUIRY";

      // If the AI didn't produce a usable DM body, synthesize a warm default
      // so we never drop a lead just because the model returned an empty string.
      if (!aiResult.dmMessage || aiResult.dmMessage.length < 10) {
        if (aiResult.intentType === "booking") {
          aiResult.dmMessage = `Hi @${commenterHandle}! Thanks so much for reaching out to ${brandName} 🙌 We'd love to hop on a quick call to understand your goals and see how ${mainOffer} can help. A few quick details from you and we'll get you booked in.`;
        } else if (aiResult.intentType === "pricing") {
          aiResult.dmMessage = `Hi @${commenterHandle}! Thanks for your interest in ${brandName} 💛 We tailor pricing to what you actually need — a couple of quick questions and we'll send over the right package + a custom quote.`;
        } else {
          aiResult.dmMessage = `Hi @${commenterHandle}! Thanks for reaching out to ${brandName} 🙏 Happy to answer any questions — just share a few details and we'll take it from there.`;
        }
      }

      // If the AI produced a reply that didn't hint at follow-up, keep it — the
      // "📩 Check your DMs!" suffix is appended later once the DM is confirmed.
      if (!aiResult.reply || aiResult.reply.length < 4) {
        aiResult.reply =
          aiResult.intentType === "booking"
            ? `We'd love to connect! 💛`
            : aiResult.intentType === "pricing"
            ? `Great question — sending details your way! 💛`
            : `Thanks for reaching out! 🙏`;
      }
    } else if (
      lowerComment.includes("love") ||
      lowerComment.includes("awesome") ||
      lowerComment.includes("great") ||
      lowerComment.includes("fire") ||
      lowerComment.includes("🔥")
    ) {
      // Praise path — no DM, keep whatever AI reply came back or use a warm default.
      if (aiResult.sentiment === "NEUTRAL") aiResult.sentiment = "PRAISE";
    }

    console.log(
      `[Social Comment Service] intent=${aiResult.intentType} sentiment=${aiResult.sentiment} shouldSendDM=${aiResult.shouldSendDM} dmMessageLen=${aiResult.dmMessage.length} commenter=@${commenterHandle}`
    );

    // ─── 6b. Append intent-aware form link to DM message ────────────────────────
    // If AI wants to send a DM, embed the right lead capture form URL based on what the commenter said.
    try {
      if (aiResult.shouldSendDM && aiResult.dmMessage && userId) {
        let baseUrl = params.baseUrl;
        // Never send localhost links to external commenters in Instagram/Facebook DMs
        const isLocal = (url?: string | null) =>
          !url ||
          url.includes("localhost") ||
          url.includes("127.0.0.1") ||
          url.includes("0.0.0.0") ||
          url.includes("[::1]");

        if (isLocal(baseUrl)) {
          try {
            baseUrl = getAppUrl();
          } catch {}
        }

        const PRODUCTION_VERCEL_URL = "https://lemon-ai-snowy.vercel.app";
        if (isLocal(baseUrl)) {
          baseUrl = PRODUCTION_VERCEL_URL;
        }

        baseUrl = (baseUrl || PRODUCTION_VERCEL_URL).replace(/\/$/, "");
        const formType = aiResult.intentType === "booking" ? "booking" : aiResult.intentType === "pricing" ? "pricing" : null;
        if (formType && baseUrl) {
          const formUrl = `${baseUrl}/lead-form?type=${formType}&user=${encodeURIComponent(userId)}&source=${encodeURIComponent(platform.toLowerCase())}&name=${encodeURIComponent(commenterHandle)}`;
          const formCta = formType === "booking"
            ? `\n\n📅 Book your free consultation here:\n${formUrl}`
            : `\n\n📋 Share your requirements & get a custom quote:\n${formUrl}`;
          aiResult.dmMessage = aiResult.dmMessage.trim() + formCta;
        }
      }
    } catch (linkErr) {
      console.warn("[Social Comment Service] Form link attachment non-fatal notice:", linkErr);
    }

    // ─── 7. Post Public Reply via Platform API ────────────────────────────────
    const normPlatform = String(platform || "").toUpperCase();
    const isThreads = normPlatform === "THREADS";
    const isFacebook = normPlatform === "FACEBOOK";
    const isYouTube = normPlatform === "YOUTUBE";
    const isLinkedIn = normPlatform === "LINKEDIN";
    const isTwitter = normPlatform === "TWITTER" || normPlatform === "X";

    let replySuccess = false;
    let replyId: string | undefined = undefined;

    if (isYouTube) {
      try {
        const ytRes = await fetch("https://www.googleapis.com/youtube/v3/comments?part=snippet", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            snippet: {
              parentId: commentId,
              textOriginal: aiResult.reply,
            },
          }),
          signal: AbortSignal.timeout(8000),
        });

        const ytJson = await ytRes.json().catch(() => ({}));
        if (ytRes.ok && ytJson?.id) {
          replySuccess = true;
          replyId = ytJson.id;
          console.log(`[Social Comment Service] ✓ Auto-reply posted to YouTube comment ${commentId}, ID: ${ytJson.id}`);
        } else {
          console.warn("[Social Comment Service] YouTube comment reply notice:", ytJson?.error?.message || ytJson);
        }
      } catch (ytErr) {
        console.warn("[Social Comment Service] Network error dispatching YouTube reply:", ytErr);
      }
    } else if (isLinkedIn) {
      try {
        const authorUrn = igAccountId
          ? igAccountId.startsWith("urn:li:")
            ? igAccountId
            : `urn:li:person:${igAccountId}`
          : "urn:li:person:me";
        const shareUrn = mediaId || commentId;
        const liRes = await fetch(`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(shareUrn)}/comments`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
            "Linkedin-Version": "202604",
          },
          body: JSON.stringify({
            actor: authorUrn,
            message: { text: aiResult.reply },
            parentComment: commentId,
          }),
          signal: AbortSignal.timeout(8000),
        });

        const liJson = await liRes.json().catch(() => ({}));
        if (liRes.ok || liRes.status === 201) {
          replySuccess = true;
          replyId = liJson?.id || `li_${Date.now()}`;
          console.log(`[Social Comment Service] ✓ Auto-reply posted to LinkedIn comment ${commentId}`);
        } else {
          console.warn("[Social Comment Service] LinkedIn comment reply notice:", liJson?.message || liJson);
        }
      } catch (liErr) {
        console.warn("[Social Comment Service] Network error dispatching LinkedIn reply:", liErr);
      }
    } else if (isTwitter) {
      try {
        const twRes = await fetch("https://api.twitter.com/2/tweets", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: aiResult.reply,
            reply: { in_reply_to_tweet_id: commentId },
          }),
          signal: AbortSignal.timeout(8000),
        });

        const twJson = await twRes.json().catch(() => ({}));
        if (twRes.ok && (twJson?.data?.id || twJson?.id)) {
          replySuccess = true;
          replyId = twJson?.data?.id || twJson?.id;
          console.log(`[Social Comment Service] ✓ Auto-reply posted to Twitter/X tweet ${commentId}, ID: ${replyId}`);
        } else {
          console.warn("[Social Comment Service] Twitter comment reply notice:", twJson?.detail || twJson?.errors || twJson);
        }
      } catch (twErr) {
        console.warn("[Social Comment Service] Network error dispatching Twitter reply:", twErr);
      }
    } else {
      // Each Meta/Threads platform uses a different Graph API host + endpoint:
      let replyEndpoint: string;
      if (isThreads) {
        replyEndpoint = `https://graph.threads.net/v1.0/${commentId}/replies`;
      } else if (isFacebook) {
        replyEndpoint = `https://graph.facebook.com/v22.0/${commentId}/comments`;
      } else {
        replyEndpoint = `https://graph.facebook.com/v22.0/${commentId}/replies`;
      }

      try {
        const replyBody = isThreads
          ? { text: aiResult.reply, access_token: accessToken }
          : { message: aiResult.reply, access_token: accessToken };

        let replyRes = await fetch(replyEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(replyBody),
          signal: AbortSignal.timeout(8000),
        });

        let replyJson = await replyRes.json().catch(() => ({}));

        // Token fallback: if code 190 (token expired/invalid), attempt retry with channel page token if available
        if (!replyRes.ok && replyJson?.error?.code === 190 && userId) {
          try {
            const { data: channels } = await admin.database
              .from("user_channels")
              .select("access_token, page_access_token")
              .eq("user_id", userId)
              .in("channel_types.type", ["INSTAGRAM", "FACEBOOK"])
              .eq("is_connected", true);

            const altRaw = channels?.[0]?.page_access_token || channels?.[0]?.access_token;
            if (altRaw) {
              const altToken = decrypt(altRaw) || altRaw;
              if (altToken && altToken !== accessToken) {
                console.log(`[Social Comment Service] Retrying comment reply with alternative channel token...`);
                const retryBody = isThreads
                  ? { text: aiResult.reply, access_token: altToken }
                  : { message: aiResult.reply, access_token: altToken };
                replyRes = await fetch(replyEndpoint, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(retryBody),
                  signal: AbortSignal.timeout(8000),
                });
                replyJson = await replyRes.json().catch(() => ({}));
              }
            }
          } catch (retryErr) {
            console.warn("[Social Comment Service] Token retry lookup error:", retryErr);
          }
        }

        if (replyRes.ok && replyJson?.id) {
          replySuccess = true;
          replyId = replyJson.id;
          const platformLabel = isThreads ? "Threads" : isFacebook ? "Facebook" : "Instagram";
          console.log(`[Social Comment Service] ✓ Auto-reply posted to comment ${commentId} (${platformLabel}), reply ID: ${replyJson.id}`);
        } else {
          const errMsg = replyJson?.error?.message || JSON.stringify(replyJson);
          console.error(`[Social Comment Service] Meta Graph API returned error for comment ${commentId}:`, errMsg);

          if (errMsg.includes("already") || errMsg.includes("duplicate") || replyJson?.error?.code === 100) {
            replySuccess = false;
          }
        }
      } catch (postErr) {
        console.error(`[Social Comment Service] Network error dispatching reply to comment ${commentId}:`, postErr);
      }
    }

    // ─── 8. Send Private Direct Message (if purchase intent detected) ───────────
    // Delegates to the unified `sendPrivateDM()` orchestrator, which:
    //   - Resolves the correct Facebook Page ID + Page token (required by Meta —
    //     using the IG Business Account ID or "me" silently drops messages).
    //   - For Instagram: tries Private Reply by comment_id FIRST (works even when
    //     the commenter's IGSID is omitted from the webhook), then falls back
    //     to a direct DM by IGSID.
    //   - For Facebook: sends a direct DM by PSID.
    //   - Always includes `messaging_type: "RESPONSE"` (without it Meta returns
    //     error code 10 for messages outside the 24h window).
    //   - Returns a structured result with the Meta error code so we can
    //     distinguish permission failures (code 200 — Dev Mode / non-tester)
    //     from bugs.

    let dmSuccess = false;
    let dmResult: Awaited<ReturnType<typeof sendPrivateDM>> | null = null;

    if (aiResult.shouldSendDM && aiResult.dmMessage) {
      try {
        dmResult = await sendPrivateDM({
          userId,
          platform,
          commentId,
          commenterId,
          igAccountId,
          accessToken,
          dmMessage: aiResult.dmMessage,
        });

        dmSuccess = dmResult.ok;

        if (!dmSuccess) {
          console.warn(
            `[Social Comment Service] ✗ DM dispatch failed (strategy=${dmResult.strategy}, code=${dmResult.errorCode}, subcode=${dmResult.errorSubcode}): ${dmResult.errorMessage}`
          );
          // Code 190 == access token invalid/expired (e.g. subcode 460 = session
          // invalidated after a password change or Meta security reset). This is
          // NOT a code bug — the stored Page token is dead and must be refreshed
          // by reconnecting the channel. Surface it loudly so operators act.
          if (dmResult.errorCode === 190) {
            console.error(
              `[Social Comment Service] 🔑 ACTION REQUIRED: The Meta access token for this ${platform} account is invalid/expired (code=190, subcode=${dmResult.errorSubcode}). ` +
                "No DM can be sent until the channel is reconnected. Go to Settings → Channels, disconnect the account, and reconnect it to store a fresh Page access token."
            );
          }
          // Code 200 == Meta Dev Mode restriction / user not a tester. Not a code bug.
          if (dmResult.errorCode === 200) {
            console.warn(
              "[Social Comment Service] Hint: Meta Dev Mode limit. Add the commenter as a Tester on developers.facebook.com, or submit the app for Advanced Access with `instagram_manage_messages` + `pages_messaging`."
            );
          }
        }
      } catch (dmErr) {
        console.warn("[Social Comment Service] Unexpected error during DM dispatch:", dmErr);
      }
    } else if (aiResult.shouldSendDM) {
      console.warn("[Social Comment Service] DM skipped despite shouldSendDM=true:", {
        missingDmMessage: !aiResult.dmMessage,
      });
    }

    // ─── 8b. Patch public reply text to reflect actual DM outcome ────────────
    // Only relevant for Instagram/Facebook — Threads has no DM API.
    // Only promise a DM in the public comment if the DM was actually delivered.
    // If DM failed, strip any DM-promise language so we don't mislead the commenter.
    if (!isThreads && aiResult.shouldSendDM) {
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
  } catch (outerErr: any) {
    console.error("[Social Comment Service] Unexpected error in processSingleComment:", outerErr?.message || outerErr);
    return { success: false, skipped: false, reason: "unexpected_error" };
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
    // 1. Fetch connected Instagram, Facebook, Threads, YouTube, and LinkedIn channels
    const { data: channels, error: chanErr } = await admin.database
      .from("user_channels")
      .select("id, user_id, provider_account_id, handle, access_token, channel_types!inner(type)")
      .in("channel_types.type", ["INSTAGRAM", "FACEBOOK", "THREADS", "YOUTUBE", "LINKEDIN"])
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
      if (!accessToken) continue;

      // Fetch Brand Profile for this user
      const { data: brand } = await admin.database
        .from("brand_profiles")
        .select("business_name, niche, brand_tone, main_offer")
        .eq("user_id", channel.user_id)
        .maybeSingle();

      // Query recent media/posts (latest 5 posts for rapid scanning)
      try {
        let posts: any[] = [];

        if (channelType === "YOUTUBE") {
          // YouTube Data API v3: fetch recent channel comment threads
          try {
            const ytUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&allThreadsRelatedToChannelId=${accountId}&maxResults=10`;
            const ytRes = await fetch(ytUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
              signal: AbortSignal.timeout(6000),
            });
            if (ytRes.ok) {
              const ytData = await ytRes.json();
              const items = ytData?.items || [];
              posts.push({
                id: accountId || "yt_channel",
                caption: "YouTube Channel Videos",
                comments: {
                  data: items.map((t: any) => {
                    const top = t.snippet?.topLevelComment;
                    const replies = t.replies?.comments || [];
                    return {
                      id: top?.id || t.id,
                      text: top?.snippet?.textOriginal || top?.snippet?.textDisplay,
                      from: {
                        username: top?.snippet?.authorDisplayName || "@viewer",
                        id: top?.snippet?.authorChannelId?.value,
                      },
                      timestamp: top?.snippet?.publishedAt,
                      comments: {
                        data: replies.map((r: any) => ({
                          id: r.id,
                          text: r.snippet?.textOriginal,
                          from: { username: r.snippet?.authorDisplayName, id: r.snippet?.authorChannelId?.value },
                        })),
                      },
                    };
                  }),
                },
              });
            }
          } catch (ytPollErr) {
            console.warn("[Comment Poller] YouTube polling notice:", ytPollErr);
          }
        } else if (channelType === "LINKEDIN") {
          // LinkedIn: Query published posts for this channel and fetch comments
          try {
            const { data: liPosts } = await admin.database
              .from("scheduled_posts")
              .select("id, published_url")
              .eq("user_id", channel.user_id)
              .not("published_url", "is", null)
              .order("created_at", { ascending: false })
              .limit(5);

            for (const lp of liPosts || []) {
              const match = lp.published_url?.match(/urn:li:(?:share|ugcPost|activity):([0-9a-zA-Z_-]+)/);
              const urn = match ? match[0] : null;
              if (!urn) continue;

              const liCommentsUrl = `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(urn)}/comments`;
              const liRes = await fetch(liCommentsUrl, {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "X-Restli-Protocol-Version": "2.0.0",
                  "Linkedin-Version": "202604",
                },
                signal: AbortSignal.timeout(6000),
              });
              if (liRes.ok) {
                const liData = await liRes.json();
                const elements = liData?.elements || [];
                posts.push({
                  id: urn,
                  caption: "LinkedIn Post",
                  comments: {
                    data: elements.map((el: any) => ({
                      id: el.id || el.$URN,
                      text: el.message?.text,
                      from: { username: el.actor || "@linkedin_user", id: el.actor },
                      timestamp: el.created?.time ? new Date(el.created.time).toISOString() : new Date().toISOString(),
                      comments: { data: [] },
                    })),
                  },
                });
              }
            }
          } catch (liPollErr) {
            console.warn("[Comment Poller] LinkedIn polling notice:", liPollErr);
          }
        } else if (channelType === "THREADS") {
          // Threads Graph API: fetch recent posts then their replies
          const threadsUrl = `https://graph.threads.net/v1.0/${accountId}/threads?fields=id,text,timestamp&limit=5&access_token=${encodeURIComponent(accessToken)}`;
          const threadsRes = await fetch(threadsUrl);
          if (threadsRes.ok) {
            const threadsData = await threadsRes.json();
            for (const post of threadsData?.data || []) {
              const repliesUrl = `https://graph.threads.net/v1.0/${post.id}/replies?fields=id,text,username,timestamp&access_token=${encodeURIComponent(accessToken)}`;
              const repliesRes = await fetch(repliesUrl);
              if (repliesRes.ok) {
                const repliesData = await repliesRes.json();
                posts.push({
                  id: post.id,
                  caption: post.text,
                  comments: {
                    data: (repliesData?.data || []).map((r: any) => ({
                      id: r.id,
                      text: r.text,
                      from: { username: r.username, id: r.id },
                      timestamp: r.timestamp,
                      comments: { data: [] },
                    })),
                  },
                });
              }
            }
          }
        } else if (channelType === "FACEBOOK") {
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
