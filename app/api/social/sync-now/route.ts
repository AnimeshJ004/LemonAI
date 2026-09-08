import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { callResilientCompletion } from "@/lib/ai-gateway";
import { decrypt } from "@/lib/encryption";

export const maxDuration = 60;

/**
 * POST /api/social/sync-now
 * Directly scans the user's recent Instagram posts for unreplied comments,
 * generates AI responses, and posts them via Meta Graph API in real-time.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = getInsforgeAdminClient();

    // 1. Fetch user's active Instagram channel
    const { data: channels } = await admin.database
      .from("user_channels")
      .select("id, provider_account_id, handle, access_token, channel_types!inner(type)")
      .eq("user_id", userId)
      .eq("channel_types.type", "INSTAGRAM")
      .eq("is_connected", true)
      .order("updated_at", { ascending: false })
      .limit(1);

    const channel = channels?.[0];
    if (!channel || !channel.access_token) {
      return NextResponse.json({
        error: "No active Instagram channel found. Please connect your Instagram account first.",
      }, { status: 400 });
    }

    const accessToken = decrypt(channel.access_token) || channel.access_token;
    const igAccountId = channel.provider_account_id;
    const igHandle = channel.handle?.replace(/^@/, "").toLowerCase() || "";

    if (!igAccountId) {
      return NextResponse.json({
        error: "Instagram Business Account ID missing. Please reconnect Instagram in Settings.",
      }, { status: 400 });
    }

    // 2. Fetch recent media from Instagram
    const mediaRes = await fetch(
      `https://graph.facebook.com/v22.0/${igAccountId}/media?fields=id,caption,comments{id,text,from,timestamp}&limit=10&access_token=${accessToken}`
    );

    if (!mediaRes.ok) {
      const errJson = await mediaRes.json().catch(() => ({}));
      return NextResponse.json({
        error: "Meta API error fetching posts",
        details: errJson,
      }, { status: 400 });
    }

    const mediaData = await mediaRes.json();
    const posts = mediaData?.data || [];
    const repliedComments: any[] = [];

    // Fetch Brand Profile for AI persona
    const { data: brand } = await admin.database
      .from("brand_profiles")
      .select("business_name, niche, brand_tone, main_offer")
      .eq("user_id", userId)
      .maybeSingle();

    const brandName = brand?.business_name || "Our Business";
    const brandTone = brand?.brand_tone || "Friendly and professional";

    for (const post of posts) {
      const comments = post.comments?.data || [];

      for (const item of comments) {
        const commentId = item.id;
        const commentText = item.text;
        const commenterHandle = item.from?.username || "@user";
        const commenterId = item.from?.id;

        // Skip self-comments
        if (commenterId === igAccountId || commenterHandle.toLowerCase() === igHandle) {
          continue;
        }

        // Check if already replied
        const { data: existing } = await admin.database
          .from("social_comments")
          .select("id")
          .eq("platform_comment_id", commentId)
          .eq("status", "replied")
          .limit(1);

        if (existing && existing.length > 0) {
          continue;
        }

        // Generate AI reply
        let replyText = `Thanks for connecting with ${brandName}! 🙏`;
        let sentiment = "NEUTRAL";
        let shouldSendDM = false;
        let dmMessage = "";

        try {
          const completion = await callResilientCompletion({
            jsonMode: true,
            messages: [
              {
                role: "user",
                content: `You are the autonomous social media AI manager for ${brandName}.
Brand Tone: ${brandTone}
Niche: ${brand?.niche || "Business"}
Main Offer: ${brand?.main_offer || "Premium solutions"}

Generate a quick public reply to this comment (under 140 chars).
Comment: "${commentText}"
User: @${commenterHandle}

Return ONLY valid JSON:
{
  "sentiment": "INQUIRY|PRAISE|COMPLAINT|SPAM|NEUTRAL",
  "reply": "Short brand reply",
  "shouldSendDM": true/false,
  "dmMessage": "Private message if buying intent"
}`,
              },
            ],
          });

          if (completion.data && typeof completion.data === "object") {
            sentiment = completion.data.sentiment || "NEUTRAL";
            replyText = completion.data.reply || replyText;
            shouldSendDM = Boolean(completion.data.shouldSendDM);
            dmMessage = completion.data.dmMessage || "";
          }
        } catch (e) {
          console.warn("[Sync Now] AI error, using fallback:", e);
        }

        // Post reply via Graph API
        try {
          const replyRes = await fetch(`https://graph.facebook.com/v22.0/${commentId}/replies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: replyText,
              access_token: accessToken,
            }),
          });

          const replyData = await replyRes.json().catch(() => ({}));
          if (replyRes.ok && replyData?.id) {
            // Save to DB
            await admin.database.from("social_comments").insert({
              user_id: userId,
              post_id: post.id,
              platform: "INSTAGRAM",
              platform_comment_id: commentId,
              commenter_handle: commenterHandle,
              comment_text: commentText,
              sentiment,
              reply_text: replyText,
              dm_sent: shouldSendDM,
              status: "replied",
            });

            repliedComments.push({
              commentId,
              commenterHandle,
              commentText,
              replyText,
              replyId: replyData.id,
            });
          }
        } catch (postErr) {
          console.error(`[Sync Now] Failed to reply to ${commentId}:`, postErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      scannedPostsCount: posts.length,
      repliedCount: repliedComments.length,
      repliedComments,
    });
  } catch (error: any) {
    console.error("[Sync Now] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to sync comments" }, { status: 500 });
  }
}
