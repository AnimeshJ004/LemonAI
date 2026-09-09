import { inngest } from "../client";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { decrypt } from "@/lib/encryption";
import { processSingleComment, pollConnectedChannelsComments } from "@/lib/social-comments-service";

/**
 * Autonomous Polling & Auto-Reply Function
 * Runs every 1 minute to ensure comments are answered in near real-time,
 * with strict idempotency to prevent duplicate replies.
 */
export const pollPostComments = inngest.createFunction(
  {
    id: "poll-post-comments",
    name: "Poll & Auto-Reply to Post Comments",
    triggers: [
      {
        cron: "* * * * *", // Polling backup runs every 1 minute for near-instant fallback
      },
    ],
  },
  async ({ step }) => {
    try {
      const admin = getInsforgeAdminClient();

      // Step 1: Poll comments across connected Instagram/Facebook channels directly
      const channelResult = await step.run("poll-connected-channels", async () => {
        return await pollConnectedChannelsComments(10);
      });

      // Step 2: Also check recently published scheduled posts (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: publishedPosts } = await admin.database
        .from("scheduled_posts")
        .select("id, user_id, published_url, user_channel_id, user_channels(access_token, provider_account_id, handle, channel_types(type))")
        .eq("status", "published")
        .gte("published_at", sevenDaysAgo)
        .not("published_url", "is", null)
        .limit(25);

      let postReplies = 0;

      if (publishedPosts && publishedPosts.length > 0) {
        for (const post of publishedPosts) {
          const channelType = (post.user_channels as any)?.channel_types?.type;
          const rawToken = (post.user_channels as any)?.access_token;
          const igAccountId = (post.user_channels as any)?.provider_account_id;
          const channelHandle = (post.user_channels as any)?.handle;
          if (!rawToken) continue;

          let accessToken: string | null = null;
          try {
            accessToken = decrypt(rawToken) || rawToken;
          } catch {
            accessToken = rawToken;
          }

          if (!accessToken) continue;

          const normalizedChannel = String(channelType || "").toUpperCase();
          if (normalizedChannel !== "INSTAGRAM" && normalizedChannel !== "FACEBOOK") {
            continue;
          }

          // Extract Media ID or shortcode from published URL
          const mediaIdMatch = post.published_url?.match(/\/(?:p|posts|status|reel)\/([^\/\?]+)/);
          const rawMediaId = mediaIdMatch?.[1];

          let numericMediaId: string | null = null;
          if (rawMediaId && /^\d+$/.test(rawMediaId)) {
            numericMediaId = rawMediaId;
          } else if (rawMediaId && accessToken) {
            try {
              const lookupUrl = igAccountId
                ? `https://graph.facebook.com/v22.0/${igAccountId}/media?fields=id,shortcode,permalink&limit=25&access_token=${encodeURIComponent(accessToken)}`
                : `https://graph.facebook.com/v22.0/me/media?fields=id,shortcode,permalink&limit=25&access_token=${encodeURIComponent(accessToken)}`;

              const lookupRes = await fetch(lookupUrl);
              if (lookupRes.ok) {
                const lookupData = await lookupRes.json();
                const matched = (lookupData.data || []).find(
                  (m: any) =>
                    m.shortcode === rawMediaId ||
                    (post.published_url && m.permalink && post.published_url.includes(m.shortcode))
                );
                if (matched?.id) {
                  numericMediaId = matched.id;
                }
              }
            } catch (resolveErr) {
              console.warn("[Comment Poller] Shortcode resolution notice:", resolveErr);
            }
          }

          if (accessToken && numericMediaId) {
            try {
              // Fetch comments including existing replies to detect if page already answered
              const res = await fetch(
                `https://graph.facebook.com/v22.0/${numericMediaId}/comments?fields=id,text,from,timestamp,comments{id,from,text}&access_token=${encodeURIComponent(accessToken)}`
              );

              if (res.ok) {
                const json = await res.json();
                const comments = json?.data || [];

                // Fetch Brand Profile for this user
                const { data: brand } = await admin.database
                  .from("brand_profiles")
                  .select("business_name, niche, brand_tone, main_offer")
                  .eq("user_id", post.user_id)
                  .maybeSingle();

                for (const item of comments) {
                  const commentId = item.id;
                  const commentText = item.text;
                  const commenterHandle = item.from?.username || item.from?.name || "@user";
                  const commenterId = item.from?.id;
                  const childReplies = item.comments?.data || [];

                  if (!commentId || !commentText) continue;

                  const processRes = await processSingleComment({
                    userId: post.user_id,
                    commentId,
                    commentText,
                    commenterHandle,
                    commenterId,
                    mediaId: numericMediaId,
                    scheduledPostId: post.id,
                    platform: channelType || "INSTAGRAM",
                    accessToken,
                    igAccountId,
                    channelHandle,
                    brand,
                    childReplies,
                  });

                  if (processRes.success && !processRes.skipped) {
                    postReplies++;
                  }
                }
              }
            } catch (err) {
              console.warn(`[Comment Poller] Error polling post ${post.id}:`, err);
            }
          }
        }
      }

      return {
        success: true,
        channelPolling: channelResult,
        scheduledPostReplies: postReplies,
        totalReplied: (channelResult?.repliedCount || 0) + postReplies,
      };
    } catch (err: any) {
      console.warn("[Comment Poller] Error in pollPostComments function:", err?.message);
      return { processed: 0, error: err?.message };
    }
  }
);
