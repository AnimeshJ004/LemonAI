import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { decrypt } from "@/lib/encryption";
import { processSingleComment } from "@/lib/social-comments-service";
import { getAppUrl } from "@/lib/app-url";

// Lead synchronization & comment processing
export const maxDuration = 60;

/**
 * POST /api/social/sync-now
 * Scans the user's recent Instagram/Facebook posts for unreplied comments
 * and replies with AI-generated responses.
 *
 * Media fetch strategies (tried in order until one returns posts):
 *  1. IG:       /{igAccountId}/media           (Instagram Business/Creator)
 *  2. IG:       Facebook Page → instagram_business_account → media
 *               (correct fallback for Instagram Graph API tokens)
 *  3. Facebook: /{pageId}/published_posts
 *  4. Threads:  /{userId}/threads + /{threadId}/replies
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let baseUrl: string = "https://lemon-ai-snowy.vercel.app";
    try {
      const detected = getAppUrl(req);
      if (detected && !detected.includes("localhost") && !detected.includes("127.0.0.1")) {
        baseUrl = detected;
      }
    } catch {}

    const admin = getInsforgeAdminClient();

    // 1. Fetch user's connected Instagram & Facebook channels
    const { data: channels } = await admin.database
      .from("user_channels")
      .select("id, provider_account_id, page_id, handle, access_token, page_access_token, channel_types!inner(type)")
      .eq("user_id", userId)
      .in("channel_types.type", ["INSTAGRAM", "FACEBOOK", "THREADS"])
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
      const rawPageToken = channel.page_access_token;
      const pageToken = rawPageToken ? (decrypt(rawPageToken) || rawPageToken) : null;
      const rawUserToken = channel.access_token;
      const userToken = rawUserToken ? (decrypt(rawUserToken) || rawUserToken) : null;

      const accessToken = pageToken || userToken;
      const accountId = channel.provider_account_id;
      const channelType = (channel.channel_types as any)?.type || "INSTAGRAM";
      const channelHandle = channel.handle?.replace(/^@/, "") || "";

      if (!accessToken) continue;

      // ── Try multiple strategies to fetch posts ──────────────────────────
      let posts: any[] = [];

      // Strategy 1: /{accountId}/media  (Instagram Business/Creator standard endpoint)
      if (accountId && channelType === "INSTAGRAM") {
        try {
          // NOTE: Instagram Graph API exposes only { id, username } on a comment's `from`
          // node. Asking for `name` triggers #100 "nonexisting field (name)".
          const res = await fetch(
            `https://graph.facebook.com/v22.0/${accountId}/media?fields=id,caption,comments{id,text,from{id,username},timestamp,comments{id,from{id,username},text}}&limit=5&access_token=${encodeURIComponent(accessToken)}`
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

      // Strategy 2: Resolve Page → instagram_business_account and query media via
      // the Page access token. This is the correct fallback for Instagram Graph
      // API tokens (the older /me/media edge only exists on Instagram Basic
      // Display tokens and returns #100 "nonexisting field (media)" here).
      if (posts.length === 0 && channelType === "INSTAGRAM") {
        try {
          const pagesRes = await fetch(
            `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token,instagram_business_account{id}&access_token=${encodeURIComponent(accessToken)}`
          );
          if (pagesRes.ok) {
            const pagesData = await pagesRes.json();
            const pages = pagesData?.data || [];
            const targetIgId = channel.provider_account_id;
            const matchedPage = targetIgId ? pages.find((p: any) => p.instagram_business_account?.id === targetIgId) : null;
            const pageWithIg = matchedPage || pages.find((p: any) => p.instagram_business_account?.id);
            if (pageWithIg?.instagram_business_account?.id) {
              const igId = targetIgId || pageWithIg.instagram_business_account.id;
              const igToken = pageWithIg.access_token || accessToken;
              const mediaRes = await fetch(
                `https://graph.facebook.com/v22.0/${igId}/media?fields=id,caption,comments{id,text,from{id,username},timestamp,comments{id,from{id,username},text}}&limit=5&access_token=${encodeURIComponent(igToken)}`
              );
              if (mediaRes.ok) {
                const mediaData = await mediaRes.json();
                posts = mediaData?.data || [];
              } else {
                const errData = await mediaRes.json().catch(() => ({}));
                console.warn("[Sync Now] Strategy 2 IG-via-Page failed:", errData?.error?.message || mediaRes.status);
              }
            }
          } else {
            const errData = await pagesRes.json().catch(() => ({}));
            console.warn("[Sync Now] Strategy 2 /me/accounts failed:", errData?.error?.message || pagesRes.status);
          }
        } catch (e: any) {
          console.warn("[Sync Now] Strategy 2 network error:", e?.message);
        }
      }

      // Strategy 3: Facebook Page posts (for Facebook Pages connected as FACEBOOK channel type)
      // Note: Use /{pageId}/published_posts instead of /{pageId}/posts.
      // /{pageId}/posts requires 'pages_read_user_content' permission, whereas
      // /{pageId}/published_posts accesses the page's own posts with standard page permissions.
      if (posts.length === 0 && channelType === "FACEBOOK" && accountId) {
        try {
          const res = await fetch(
            `https://graph.facebook.com/v22.0/${accountId}/published_posts?fields=id,message,comments{id,message,from,created_time}&limit=5&access_token=${encodeURIComponent(accessToken)}`
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
            console.warn("[Sync Now] Strategy 3 FB published_posts failed:", errData?.error?.message || res.status);
          }
        } catch (e: any) {
          console.warn("[Sync Now] Strategy 3 network error:", e?.message);
        }
      }

      // Strategy 4: Threads posts + replies (graph.threads.net)
      if (posts.length === 0 && channelType === "THREADS" && accountId) {
        try {
          const threadsRes = await fetch(
            `https://graph.threads.net/v1.0/${accountId}/threads?fields=id,text,timestamp&limit=5&access_token=${encodeURIComponent(accessToken)}`
          );
          if (threadsRes.ok) {
            const threadsData = await threadsRes.json();
            for (const post of threadsData?.data || []) {
              const repliesRes = await fetch(
                `https://graph.threads.net/v1.0/${post.id}/replies?fields=id,text,username,timestamp&access_token=${encodeURIComponent(accessToken)}`
              );
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
          } else {
            const errData = await threadsRes.json().catch(() => ({}));
            console.warn("[Sync Now] Strategy 4 Threads failed:", errData?.error?.message || threadsRes.status);
            errors.push(`Threads: ${errData?.error?.message || `HTTP ${threadsRes.status}`}`);
          }
        } catch (e: any) {
          console.warn("[Sync Now] Strategy 4 Threads network error:", e?.message);
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
          // Instagram Graph API may omit from.id due to privacy. We still capture it if present.
          // The DM uses recipient.comment_id (not user id) so this doesn't block DM delivery.
          const commenterId = String(item.from?.id || "").trim();
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
            baseUrl,
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
