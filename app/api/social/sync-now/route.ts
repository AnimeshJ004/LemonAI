import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { decrypt } from "@/lib/encryption";
import { processSingleComment } from "@/lib/social-comments-service";

export const maxDuration = 60;

/**
 * POST /api/social/sync-now
 * Scans the user's recent Instagram/Facebook posts for unreplied comments
 * and replies with AI-generated responses.
 *
 * Robust multi-strategy media fetching:
 *  1. Try /{igAccountId}/media (Instagram Business / Creator)
 *  2. Try /me/media fallback
 *  3. Try fetching from Facebook Page posts (/{pageId}/posts)
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = getInsforgeAdminClient();

    // 1. Fetch user's connected Instagram & Facebook channels
    const { data: channels } = await admin.database
      .from("user_channels")
      .select("id, provider_account_id, handle, access_token, channel_types!inner(type)")
      .eq("user_id", userId)
      .in("channel_types.type", ["INSTAGRAM", "FACEBOOK"])
      .eq("is_connected", true)
      .order("updated_at", { ascending: false })
      .limit(3);

    if (!channels || channels.length === 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: "No active Instagram or Facebook channel found. Please connect your account in Settings.",
        scannedPostsCount: 0,
        repliedCount: 0,
      }, { status: 200 });
    }

    // Fetch Brand Profile for AI persona
    const { data: brand } = await admin.database
      .from("brand_profiles")
      .select("business_name, niche, brand_tone, main_offer")
      .eq("user_id", userId)
      .maybeSingle();

    const repliedComments: any[] = [];
    let totalScannedPosts = 0;
    const errors: string[] = [];

    for (const channel of channels) {
      if (!channel.access_token) continue;

      const accessToken = decrypt(channel.access_token) || channel.access_token;
      const accountId = channel.provider_account_id;
      const channelType = (channel.channel_types as any)?.type || "INSTAGRAM";
      const channelHandle = channel.handle?.replace(/^@/, "") || "";

      if (!accessToken) continue;

      // ── Try multiple strategies to fetch posts ──────────────────────────
      let posts: any[] = [];

      // Strategy 1: /{accountId}/media  (Instagram Business/Creator standard endpoint)
      if (accountId) {
        try {
          const res = await fetch(
            `https://graph.facebook.com/v22.0/${accountId}/media?fields=id,caption,comments{id,text,from,timestamp,comments{id,from,text}}&limit=5&access_token=${encodeURIComponent(accessToken)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.data?.length > 0) {
              posts = data.data;
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            console.warn(`[Sync Now] Strategy 1 failed for ${accountId}:`, errData?.error?.message || res.status);
            errors.push(`IG Media: ${errData?.error?.message || `HTTP ${res.status}`}`);
          }
        } catch (e: any) {
          console.warn("[Sync Now] Strategy 1 network error:", e?.message);
        }
      }

      // Strategy 2: /me/media (fallback for some token types)
      if (posts.length === 0) {
        try {
          const res = await fetch(
            `https://graph.facebook.com/v22.0/me/media?fields=id,caption,comments{id,text,from,timestamp,comments{id,from,text}}&limit=5&access_token=${encodeURIComponent(accessToken)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.data?.length > 0) {
              posts = data.data;
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            console.warn("[Sync Now] Strategy 2 /me/media failed:", errData?.error?.message || res.status);
          }
        } catch (e: any) {
          console.warn("[Sync Now] Strategy 2 network error:", e?.message);
        }
      }

      // Strategy 3: Facebook Page posts (for Facebook Pages connected as FACEBOOK channel type)
      if (posts.length === 0 && channelType === "FACEBOOK" && accountId) {
        try {
          const res = await fetch(
            `https://graph.facebook.com/v22.0/${accountId}/posts?fields=id,message,comments{id,message,from,created_time}&limit=5&access_token=${encodeURIComponent(accessToken)}`
          );
          if (res.ok) {
            const data = await res.json();
            // Normalize Facebook posts to same shape as Instagram media
            posts = (data?.data || []).map((p: any) => ({
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
          } else {
            const errData = await res.json().catch(() => ({}));
            console.warn("[Sync Now] Strategy 3 FB posts failed:", errData?.error?.message || res.status);
          }
        } catch (e: any) {
          console.warn("[Sync Now] Strategy 3 network error:", e?.message);
        }
      }

      // Strategy 4: Lookup media via Facebook Page -> instagram_business_account
      if (posts.length === 0 && channelType === "INSTAGRAM") {
        try {
          const pagesRes = await fetch(
            `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,instagram_business_account{id}&access_token=${encodeURIComponent(accessToken)}`
          );
          if (pagesRes.ok) {
            const pagesData = await pagesRes.json();
            const pageWithIg = (pagesData?.data || []).find((p: any) => p.instagram_business_account?.id);
            if (pageWithIg?.instagram_business_account?.id) {
              const igId = pageWithIg.instagram_business_account.id;
              const mediaRes = await fetch(
                `https://graph.facebook.com/v22.0/${igId}/media?fields=id,caption,comments{id,text,from,timestamp,comments{id,from,text}}&limit=5&access_token=${encodeURIComponent(accessToken)}`
              );
              if (mediaRes.ok) {
                const mediaData = await mediaRes.json();
                posts = mediaData?.data || [];
              }
            }
          }
        } catch (e: any) {
          console.warn("[Sync Now] Strategy 4 network error:", e?.message);
        }
      }

      totalScannedPosts += posts.length;

      // ── Process comments on each post ──────────────────────────────────
      for (const post of posts) {
        const comments = post.comments?.data || [];

        for (const item of comments) {
          const commentId = item.id;
          const commentText = item.text || item.message;
          const commenterHandle = item.from?.username || item.from?.name || "@user";
          const commenterId = item.from?.id;
          const childReplies = item.comments?.data || [];

          if (!commentId || !commentText) continue;

          const res = await processSingleComment({
            userId,
            commentId,
            commentText,
            commenterHandle,
            commenterId,
            mediaId: post.id,
            platform: channelType,
            accessToken,
            igAccountId: accountId,
            channelHandle,
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
    }

    // If we got zero posts across all strategies, give a clear actionable message
    if (totalScannedPosts === 0 && errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: "Could not fetch posts from Meta. Your access token may have expired or lack required permissions (instagram_manage_comments, pages_read_engagement). Please reconnect your Instagram account in Settings.",
        metaErrors: errors,
        scannedPostsCount: 0,
        repliedCount: 0,
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      scannedPostsCount: totalScannedPosts,
      repliedCount: repliedComments.length,
      repliedComments,
    });
  } catch (error: any) {
    console.error("[Sync Now] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to sync comments" }, { status: 500 });
  }
}
