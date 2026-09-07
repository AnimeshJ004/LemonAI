import { inngest } from "../client";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";

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
        cron: "*/15 * * * *",
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
        .select("id, user_id, published_url, user_channel_id, user_channels(access_token, channel_types(type))")
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
        const accessToken = (post.user_channels as any)?.access_token;

        if (!accessToken) continue;

        await step.run(`process-post-${post.id}`, async () => {
          let postReplies = 0;

          // If post has a published URL or media ID, query Graph API for unhandled comments
          const mediaIdMatch = post.published_url?.match(/\/p\/([^\/\?]+)/);
          const shortcode = mediaIdMatch?.[1];

          if (accessToken && shortcode) {
            try {
              // Fetch latest comments on this media
              const res = await fetch(
                `https://graph.facebook.com/v22.0/me?fields=business_discovery.username(${shortcode}){media{comments{id,text,from,timestamp}}}&access_token=${accessToken}`
              );

              if (res.ok) {
                const json = await res.json();
                const comments = json?.business_discovery?.media?.comments?.data || [];

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

                  // Autonomous AI reply generation
                  const { insforge } = await getInsforgeServerClient();
                  const completion = await insforge.ai.chat.completions.create({
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
                  await fetch(`https://graph.facebook.com/v22.0/${commentId}/replies`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: aiResult.reply, access_token: accessToken }),
                  });

                  // Log to database
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
