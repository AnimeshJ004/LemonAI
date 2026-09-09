import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { decrypt } from "@/lib/encryption";
import { processSingleComment } from "@/lib/social-comments-service";

export const maxDuration = 60;

/**
 * POST /api/social/sync-now
 * Directly scans the user's recent Instagram posts for unreplied comments,
 * generates AI responses, and posts them via Meta Graph API with strict deduplication.
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
    const igHandle = channel.handle?.replace(/^@/, "") || "";

    if (!igAccountId) {
      return NextResponse.json({
        error: "Instagram Business Account ID missing. Please reconnect Instagram in Settings.",
      }, { status: 400 });
    }

    // 2. Fetch recent media from Instagram (latest 5 posts for rapid scanning)
    const mediaRes = await fetch(
      `https://graph.facebook.com/v22.0/${igAccountId}/media?fields=id,caption,comments{id,text,from,timestamp,comments{id,from,text}}&limit=5&access_token=${encodeURIComponent(accessToken)}`
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

    for (const post of posts) {
      const comments = post.comments?.data || [];

      for (const item of comments) {
        const commentId = item.id;
        const commentText = item.text;
        const commenterHandle = item.from?.username || item.from?.name || "@user";
        const commenterId = item.from?.id;
        const childReplies = item.comments?.data || [];

        if (!commentId || !commentText) continue;

        // Process with unified deduplicating comment service
        const res = await processSingleComment({
          userId,
          commentId,
          commentText,
          commenterHandle,
          commenterId,
          mediaId: post.id,
          platform: "INSTAGRAM",
          accessToken,
          igAccountId,
          channelHandle: igHandle,
          brand,
          childReplies,
        });

        if (res.success && !res.skipped) {
          repliedComments.push({
            commentId,
            commenterHandle,
            commentText,
            replyText: res.replyText,
            replyId: res.replyId,
            dmSent: res.dmSent,
          });
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
