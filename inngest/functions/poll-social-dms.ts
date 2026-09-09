import { inngest } from "../client";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { decrypt } from "@/lib/encryption";
import { callResilientCompletion } from "@/lib/ai-gateway";

/**
 * Polls Instagram and Facebook direct messages every 5 minutes.
 * Automatically classifies intent, generates contextual brand-aligned replies,
 * and captures high-intent prospects directly as leads into the CRM.
 */
export const pollSocialDMs = inngest.createFunction(
  {
    id: "poll-social-dms",
    name: "Poll & Auto-Reply to Social DMs",
    triggers: [
      {
        cron: "*/5 * * * *", // Runs every 5 minutes
      },
    ],
  },
  async ({ step }) => {
    try {
      const admin = getInsforgeAdminClient();

      // Find all active connected Instagram / Facebook channels
      const { data: channels } = await admin.database
        .from("user_channels")
        .select("id, user_id, handle, access_token, provider_account_id, channel_types!inner(type)")
        .in("channel_types.type", ["INSTAGRAM", "FACEBOOK"])
        .eq("is_connected", true)
        .limit(30);

      if (!channels || channels.length === 0) {
        return { processed: 0, message: "No active Meta channels found for DM polling." };
      }

      let totalDMsProcessed = 0;
      let totalRepliesSent = 0;

      for (const channel of channels) {
        const rawToken = channel.access_token;
        if (!rawToken) continue;

        let accessToken: string | null = null;
        try {
          accessToken = decrypt(rawToken) || rawToken;
        } catch {
          accessToken = rawToken;
        }
        if (!accessToken) continue;

        const platform = (channel.channel_types as any)?.type;
        const accountId = channel.provider_account_id;
        const userId = channel.user_id;

        await step.run(`poll-channel-${channel.id}`, async () => {
          let channelDMs = 0;
          let channelReplies = 0;

          try {
            // Fetch conversations
            const convUrl = `https://graph.facebook.com/v22.0/${accountId}/conversations?fields=id,participants,messages{message,from,created_time}&access_token=${accessToken}&limit=10`;
            const convRes = await fetch(convUrl, { signal: AbortSignal.timeout(8000) });
            if (!convRes.ok) return;

            const convData = await convRes.json().catch(() => ({}));
            const conversations = convData?.data || [];

            // Fetch Brand profile for personalized replies
            const { data: brand } = await admin.database
              .from("brand_profiles")
              .select("business_name, brand_tone, niche, main_offer")
              .eq("user_id", userId)
              .maybeSingle();

            const brandName = brand?.business_name || "Our Team";
            const brandTone = brand?.brand_tone || "Friendly, professional, and helpful";

            for (const conv of conversations) {
              const messages = conv.messages?.data || [];
              const lastMsg = messages[0];
              if (!lastMsg) continue;

              const participants = conv.participants?.data || [];
              const sender = participants.find((p: any) => p.id !== accountId);
              const senderName = sender?.name || "Customer";
              const senderId = sender?.id || conv.id;

              // Don't reply if last message is from ourselves
              if (lastMsg.from?.id === accountId) continue;

              // Check existing record
              const { data: existing } = await admin.database
                .from("social_dms")
                .select("id, last_replied_at, last_message_at")
                .eq("conversation_id", conv.id)
                .maybeSingle();

              // Upsert the DM conversation record
              await admin.database.from("social_dms").upsert(
                {
                  user_id: userId,
                  platform: platform,
                  conversation_id: conv.id,
                  sender_id: senderId,
                  sender_name: senderName,
                  last_message: lastMsg.message || "[Media]",
                  last_message_at: lastMsg.created_time || new Date().toISOString(),
                  is_read: false,
                  messages_count: messages.length,
                  raw_messages: messages.slice(0, 10),
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "conversation_id" }
              );

              channelDMs++;

              // Auto-reply if new incoming message that hasn't been replied to yet
              const alreadyReplied = existing?.last_replied_at && 
                new Date(existing.last_replied_at).getTime() >= new Date(lastMsg.created_time).getTime();

              if (!alreadyReplied && lastMsg.message) {
                try {
                  const aiCompletion = await callResilientCompletion({
                    messages: [
                      {
                        role: "user",
                        content: `You are the DM concierge for ${brandName}.
Brand Tone: ${brandTone}
Niche: ${brand?.niche || "General"}
Offer: ${brand?.main_offer || "Premium services"}

The customer sent: "${lastMsg.message}".
Write a warm, helpful reply under 80 words. If they ask about price, availability, or booking, invite them to share their preferred contact or book a quick chat.`,
                      },
                    ],
                  });

                  const replyText = aiCompletion.content;
                  if (replyText) {
                    const sendRes = await fetch(`https://graph.facebook.com/v22.0/me/messages`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        recipient: { id: senderId },
                        message: { text: replyText },
                        access_token: accessToken,
                      }),
                    });

                    if (sendRes.ok) {
                      channelReplies++;
                      await admin.database
                        .from("social_dms")
                        .update({
                          last_reply: replyText,
                          last_replied_at: new Date().toISOString(),
                          is_read: true,
                        })
                        .eq("conversation_id", conv.id);

                      // If inquiry sentiment, capture as lead into CRM
                      const lower = (lastMsg.message || "").toLowerCase();
                      if (lower.includes("price") || lower.includes("cost") || lower.includes("book") || lower.includes("buy") || lower.includes("service")) {
                        try {
                          await admin.database.from("leads").insert({
                            user_id: userId,
                            name: senderName,
                            source: platform.toLowerCase() === "instagram" ? "instagram_dm" : "facebook_dm",
                            stage: "new",
                            score: 8,
                            deal_value: 2500,
                            metadata: {
                              dm_conversation_id: conv.id,
                              first_inquiry: lastMsg.message,
                            },
                          });
                        } catch (crmLeadErr) {
                          console.warn("[Poll DMs] Lead capture notice:", crmLeadErr);
                        }
                      }
                    }
                  }
                } catch (replyErr) {
                  console.warn("[Poll DMs] Auto-reply error:", replyErr);
                }
              }
            }
          } catch (pollErr) {
            console.error(`[Poll DMs] Failed for channel ${channel.id}:`, pollErr);
          }

          totalDMsProcessed += channelDMs;
          totalRepliesSent += channelReplies;
        });
      }

      return {
        processed: totalDMsProcessed,
        replied: totalRepliesSent,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      console.error("[Poll DMs] Inngest job failure:", err);
      return { error: err.message };
    }
  }
);
