import { inngest } from "../client";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { decrypt } from "@/lib/encryption";

/**
 * Polls published posts for new comments every 15 minutes
 * and auto-replies completely automatically using Gemini AI
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

      // Get published posts from last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: publishedPosts } = await admin.database
        .from("scheduled_posts")
        .select("id, user_id, published_url, user_channel_id, user_channels(access_token, provider_account_id, channel_types(type))")
        .eq("status", "published")
        .gte("published_at", sevenDaysAgo)
        .not("published_url", "is", null)
        .limit(50);

      if (!publishedPosts || publishedPosts.length === 0) {
        return { processed: 0, replied: 0, message: "No recent published posts found" };
      }

      let repliedCount = 0;

      for (const post of publishedPosts) {
        const channelType = (post.user_channels as any)?.channel_types?.type;
        const rawToken = (post.user_channels as any)?.access_token;
        if (!rawToken) continue;

        let accessToken: string | null = null;
        try {
          accessToken = decrypt(rawToken);
        } catch {
          accessToken = rawToken;
        }

        if (!accessToken) continue;


        await step.run(`process-post-${post.id}`, async () => {
          let postReplies = 0;

          // Only poll platforms with active Graph API comments support
          const normalizedChannel = String(channelType || "").toUpperCase();
          if (normalizedChannel !== "INSTAGRAM" && normalizedChannel !== "FACEBOOK") {
            // Other platforms (Twitter/LinkedIn/YouTube) require specialized comment webhooks
            return { skipped: true, channel: channelType };
          }

          // Extract Media ID or shortcode from published URL (e.g. https://instagram.com/p/{shortcode} or facebook.com/{post_id})
          const mediaIdMatch = post.published_url?.match(/\/(?:p|posts|status|reel)\/([^\/\?]+)/);
          const rawMediaId = mediaIdMatch?.[1];

          let numericMediaId: string | null = null;
          if (rawMediaId && /^\d+$/.test(rawMediaId)) {
            numericMediaId = rawMediaId;
          } else if (rawMediaId && accessToken) {
            // If shortcode (e.g. Cxyz123), resolve authentic numeric Media ID via Graph API
            try {
              const igAccountId = (post.user_channels as any)?.provider_account_id;
              const lookupUrl = igAccountId
                ? `https://graph.facebook.com/v22.0/${igAccountId}/media?fields=id,shortcode,permalink&limit=25&access_token=${encodeURIComponent(accessToken)}`
                : `https://graph.facebook.com/v22.0/me/media?fields=id,shortcode,permalink&limit=25&access_token=${encodeURIComponent(accessToken)}`;
              
              const lookupRes = await fetch(lookupUrl);
              if (lookupRes.ok) {
                const lookupData = await lookupRes.json();
                const matched = (lookupData.data || []).find(
                  (m: any) => m.shortcode === rawMediaId || (post.published_url && m.permalink && post.published_url.includes(m.shortcode))
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
              // Query Meta Graph API directly for media comments using authentic numeric ID
              const res = await fetch(
                `https://graph.facebook.com/v22.0/${numericMediaId}/comments?fields=id,text,from,timestamp&access_token=${encodeURIComponent(accessToken)}`
              );

              if (res.ok) {
                const json = await res.json();
                const comments = json?.data || [];


                for (const item of comments) {
                  const commentId = item.id;
                  const commentText = item.text;
                  const commenterHandle = item.from?.username || "@user";

                  if (!commentId || !commentText) continue;

                  // Check if already replied
                  const { data: existing } = await admin.database
                    .from("social_comments")
                    .select("id")
                    .eq("platform_comment_id", commentId)
                    .maybeSingle();

                  if (existing) continue;

                  // Autonomous AI reply generation using admin client (no auth context needed in cron)
                  const adminClient = getInsforgeAdminClient();
                  const completion = await adminClient.ai.chat.completions.create({
                    model: "google/gemini-3.8-flash",
                    messages: [
                      {
                        role: "user",
                        content: `Analyze this social comment and provide a concise, friendly, brand-voice reply.
Comment: "${commentText}"
User: ${commenterHandle}

Return ONLY valid JSON:
{
  "sentiment": "INQUIRY|PRAISE|COMPLAINT|SPAM|NEUTRAL",
  "reply": "Your public response under 140 chars",
  "shouldSendDM": true/false,
  "dmMessage": "Direct message copy if purchase intent"
}`,
                      },
                    ],
                  });

                  const raw = completion.choices[0]?.message?.content || "{}";
                  const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();
                  let aiResult = { sentiment: "NEUTRAL", reply: "Thanks for your comment! 🙏", shouldSendDM: false };
                  try {
                    aiResult = JSON.parse(clean);
                  } catch {}

                  // Post public reply to Instagram
                  let replyOk = false;
                  try {
                    const replyRes = await fetch(`https://graph.facebook.com/v22.0/${commentId}/replies`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ message: aiResult.reply, access_token: accessToken }),
                    });
                    const replyJson = await replyRes.json().catch(() => ({}));
                    if (replyRes.ok && replyJson?.id) {
                      replyOk = true;
                      console.log(`[Comment Poller] Successfully posted reply to comment ${commentId}: ${replyJson.id}`);
                    } else {
                      console.error(`[Comment Poller] Error replying to comment ${commentId}:`, replyJson);
                    }
                  } catch (err) {
                    console.error(`[Comment Poller] Network error replying to comment ${commentId}:`, err);
                  }

                  // Log to database only if successfully posted
                  if (replyOk) {
                    await admin.database.from("social_comments").insert({
                      user_id: post.user_id,
                      post_id: post.id,
                      platform: channelType || "INSTAGRAM",
                      platform_comment_id: commentId,
                      commenter_handle: commenterHandle,
                      comment_text: commentText,
                      sentiment: aiResult.sentiment,
                      reply_text: aiResult.reply,
                      dm_sent: aiResult.shouldSendDM,
                      status: "replied",
                    });

                    postReplies++;
                  }
                }
              }
            } catch (err) {
              console.warn(`[Comment Poller] Error polling post ${post.id}:`, err);
            }
          }

          return { postId: post.id, replied: postReplies };
        });

        repliedCount++;
      }

      return {
        processed: publishedPosts.length,
        replied: repliedCount,
        message: `Polled ${publishedPosts.length} posts and handled new comments autonomously`,
      };
    } catch (err: any) {
      console.warn("[Comment Poller] Error polling comments:", err?.message);
      return { processed: 0, error: err?.message };
    }
  }
);
