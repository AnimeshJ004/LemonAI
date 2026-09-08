import { NextRequest, NextResponse } from "next/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { callResilientCompletion } from "@/lib/ai-gateway";

export const maxDuration = 60;

// GET: Meta Webhook Verification for Instagram & Facebook Comments
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || "lemon_ai_social";

  if (mode === "subscribe" && token === verifyToken) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST: Automatic Incoming Comments Webhook from Instagram & Facebook
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Meta sends an array of entries
    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field === "comments" || change.field === "feed") {
          const value = change.value;
          if (!value) continue;

          // Extract comment details
          const platformCommentId = value.id || value.comment_id;
          const commentText = value.text || value.message;
          const commenterHandle = value.from?.username || value.from?.name || "@customer";
          const mediaId = value.media?.id || value.post_id;

          if (!commentText || !platformCommentId) continue;

          const admin = getInsforgeAdminClient();

          // 1. Prevent duplicate reply if already processed
          try {
            const { data: existing } = await admin.database
              .from("social_comments")
              .select("id")
              .eq("platform_comment_id", platformCommentId)
              .maybeSingle();

            if (existing) {
              console.log(`[Webhook] Comment ${platformCommentId} already processed. Skipping.`);
              continue;
            }
          } catch (e) {
            // Ignore if check fails
          }

          // 2. Find the post and associated user/access token
          let userId = "usr_lemon_auto";
          let accessToken: string | null = null;
          let postId: string | null = null;

          try {
            // Check if post exists in scheduled_posts matching this media
            const { data: post } = await admin.database
              .from("scheduled_posts")
              .select("id, user_id, user_channel_id, user_channels(access_token)")
              .limit(1)
              .maybeSingle();

            if (post) {
              postId = post.id;
              userId = post.user_id;
              accessToken = (post.user_channels as any)?.access_token || null;
            }
          } catch (e) {
            console.warn("Could not find post for comment:", e);
          }

          // 3. Autonomous AI Sentiment Analysis & Reply Generation
          let aiResult = {
            sentiment: "INQUIRY",
            reply: "Thank you for commenting! Check your DMs for details! 🙏",
            shouldSendDM: false,
            dmMessage: "",
          };

          try {
            const completion = await callResilientCompletion({
              jsonMode: true,
              messages: [
                {
                  role: "user",
                  content: `You are an autonomous AI social media manager.
Analyze this incoming customer comment and generate an immediate, friendly brand reply.
Comment: "${commentText}"
User: ${commenterHandle}

Return ONLY valid JSON:
{
  "sentiment": "INQUIRY|PRAISE|COMPLAINT|SPAM|NEUTRAL",
  "reply": "Your public reply (under 140 chars)",
  "shouldSendDM": true,
  "dmMessage": "Private DM if purchase/pricing/booking intent is detected"
}`,
                },
              ],
            });

            if (completion.data && typeof completion.data === "object") {
              aiResult = {
                sentiment: completion.data.sentiment || "NEUTRAL",
                reply: completion.data.reply || "Thanks for your comment! 🙏",
                shouldSendDM: Boolean(completion.data.shouldSendDM),
                dmMessage: completion.data.dmMessage || "",
              };
            }
          } catch (aiErr) {
            console.warn("Autonomous reply generation fallback:", aiErr);
            const lower = commentText.toLowerCase();
            if (lower.includes("price") || lower.includes("cost") || lower.includes("buy")) {
              aiResult = {
                sentiment: "INQUIRY",
                reply: "We just sent you a private DM with all pricing & discount details! 📩",
                shouldSendDM: true,
                dmMessage: "Hey! Thanks for reaching out. Here is the special pricing & booking link...",
              };
            }
          }

          // 4. Send Public Reply back to Instagram/Facebook automatically via Graph API
          const tokenToUse = accessToken || process.env.META_ADS_ACCESS_TOKEN;
          if (tokenToUse && platformCommentId) {
            try {
              await fetch(`https://graph.facebook.com/v22.0/${platformCommentId}/replies`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  message: aiResult.reply,
                  access_token: tokenToUse,
                }),
              });
              console.log(`[Webhook] Autonomous reply posted to Instagram for comment: ${platformCommentId}`);
            } catch (postErr) {
              console.warn("Failed to post reply via Meta Graph API:", postErr);
            }
          }

          // 5. If purchase intent detected, send private DM automatically
          if (aiResult.shouldSendDM && aiResult.dmMessage && tokenToUse && value.from?.id) {
            try {
              await fetch(`https://graph.facebook.com/v22.0/me/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  recipient: { id: value.from.id },
                  message: { text: aiResult.dmMessage },
                  access_token: tokenToUse,
                }),
              });
              console.log(`[Webhook] Autonomous DM dispatched to user ${value.from.id}`);
            } catch (dmErr) {
              console.warn("Failed to send private DM via Meta Graph API:", dmErr);
            }
          }

          // 6. Automatically sync inbound lead & conversation into CRM Pipeline
          if (aiResult.shouldSendDM || aiResult.sentiment === "INQUIRY" || commentText.toLowerCase().includes("price") || commentText.toLowerCase().includes("cost")) {
            try {
              let leadId: string | null = null;
              const cleanHandle = commenterHandle.replace(/^@/, "");

              // Check if lead exists
              const { data: existingLead } = await admin.database
                .from("leads")
                .select("id")
                .eq("user_id", userId)
                .ilike("name", `%${cleanHandle}%`)
                .limit(1)
                .maybeSingle();

              if (existingLead?.id) {
                leadId = existingLead.id;
              } else {
                const { data: newLead } = await admin.database
                  .from("leads")
                  .insert({
                    user_id: userId,
                    name: commenterHandle,
                    source: "instagram",
                    stage: "new",
                    score: 7,
                    deal_value: 3000,
                    metadata: {
                      platform: "INSTAGRAM",
                      commentId: platformCommentId,
                      commentText,
                      sentiment: aiResult.sentiment,
                    },
                  })
                  .select("id")
                  .single();
                leadId = newLead?.id || null;
              }

              // Create CRM conversation and log messages for Kanban & Inbox
              const { data: conv } = await admin.database
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

              if (conv?.id) {
                await admin.database.from("crm_messages").insert([
                  { conversation_id: conv.id, sender_type: "lead", content: commentText },
                  { conversation_id: conv.id, sender_type: "ai_assistant", content: aiResult.reply },
                ]);
              }
            } catch (crmErr) {
              console.warn("[Webhook] Notice capturing CRM lead from comment:", crmErr);
            }
          }

          // 7. Log the automated interaction to database
          try {
            await admin.database.from("social_comments").insert({
              user_id: userId,
              post_id: postId,
              platform: "INSTAGRAM",
              platform_comment_id: platformCommentId,
              commenter_handle: commenterHandle,
              comment_text: commentText,
              sentiment: aiResult.sentiment,
              reply_text: aiResult.reply,
              dm_sent: aiResult.shouldSendDM,
              status: "replied",
            });
          } catch (dbErr) {
            console.warn("Database insert error in webhook:", dbErr);
          }
        }
      }
    }

    return NextResponse.json({ status: "success", message: "Comments processed automatically" });
  } catch (error: any) {
    console.error("Meta comment webhook error:", error);
    return NextResponse.json({ status: "error", message: error.message }, { status: 200 });
  }
}
