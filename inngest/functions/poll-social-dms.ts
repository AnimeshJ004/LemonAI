import { inngest } from "../client";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { decrypt } from "@/lib/encryption";
import { callResilientCompletion } from "@/lib/ai-gateway";
import { validateInputLengths } from "@/lib/validate-inputs";
import { sendPrivateDM } from "@/lib/meta-messaging";

/**
 * Polls Instagram and Facebook direct messages every 5 minutes.
 * Automatically classifies intent, generates contextual brand-aligned replies,
 * and captures high-intent prospects directly as leads into the CRM.
 */
export const pollSocialDMs = inngest.createFunction(
  {
    id: "poll-social-dms",
    name: "Poll & Auto-Reply to Social DMs",
    // Back-pressure: only one DM poll runs at a time. Meta rate-limits per app
    // token, so overlapping runs would just burn quota. Slow runs cause the
    // next cron tick to wait rather than compound.
    concurrency: {
      limit: 1,
    },
    triggers: [
      {
        cron: "*/5 * * * *", // Runs every 5 minutes
      },
    ],
  },
  async ({ step }) => {
    try {
      const admin = getInsforgeAdminClient();

      // Find all active connected Instagram, Facebook, Twitter, and LinkedIn channels
      const { data: channels } = await admin.database
        .from("user_channels")
        .select("id, user_id, handle, access_token, page_access_token, page_id, provider_account_id, channel_types!inner(type)")
        .in("channel_types.type", ["INSTAGRAM", "FACEBOOK", "TWITTER", "LINKEDIN"])
        .eq("is_connected", true);

      if (!channels || channels.length === 0) {
        return { processed: 0, message: "No active social channels found for DM polling." };
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
        // pageId is the Facebook Page ID — this is what the bot sends DMs AS.
        // For IG channels: page_id is the linked Facebook Page.
        // For FB channels: page_id may be the same as provider_account_id.
        // Prefer page_id for conversations API; fall back to accountId.
        const pageId = channel.page_id || accountId;
        const userId = channel.user_id;

        // Also decrypt the page_access_token if available — it has messaging permissions
        let pageAccessToken: string | null = null;
        const rawPageToken = channel.page_access_token;
        if (rawPageToken) {
          try { pageAccessToken = decrypt(rawPageToken) || rawPageToken; } catch { pageAccessToken = rawPageToken; }
        }

        await step.run(`poll-channel-${channel.id}`, async () => {
          let channelDMs = 0;
          let channelReplies = 0;

          try {
            // Fetch Brand profile for personalized replies
            const { data: brand } = await admin.database
              .from("brand_profiles")
              .select("business_name, brand_tone, niche, main_offer")
              .eq("user_id", userId)
              .maybeSingle();

            const brandName = brand?.business_name || "Our Team";
            const brandTone = brand?.brand_tone || "Friendly, professional, and helpful";

            // ─── A. Twitter / X DM Polling ────────────────────────────────────
            if (platform === "TWITTER") {
              const twRes = await fetch(
                "https://api.twitter.com/2/dm_events?dm_event.fields=id,text,sender_id,created_at,dm_conversation_id&max_results=20",
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                  },
                  signal: AbortSignal.timeout(8000),
                }
              );

              if (twRes.ok) {
                const twData = await twRes.json().catch(() => ({}));
                const events = twData?.data || [];

                for (const ev of events) {
                  const senderId = ev.sender_id;
                  if (!senderId || senderId === accountId) continue;
                  const convId = ev.dm_conversation_id || `tw_${senderId}`;
                  const msgText = ev.text || "";

                  const { data: existing } = await admin.database
                    .from("social_dms")
                    .select("id, last_replied_at, last_message_at")
                    .eq("conversation_id", convId)
                    .maybeSingle();

                  await admin.database.from("social_dms").upsert(
                    {
                      user_id: userId,
                      platform: "TWITTER",
                      conversation_id: convId,
                      sender_id: senderId,
                      sender_name: `Twitter User (@${senderId})`,
                      last_message: msgText || "[Media]",
                      last_message_at: ev.created_at || new Date().toISOString(),
                      is_read: false,
                      messages_count: 1,
                      raw_messages: [{ id: ev.id, message: msgText, from: { id: senderId }, created_time: ev.created_at }],
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "conversation_id" }
                  );

                  channelDMs++;

                  const alreadyReplied =
                    existing?.last_replied_at &&
                    new Date(existing.last_replied_at).getTime() >= new Date(ev.created_at || Date.now()).getTime();

                  if (!alreadyReplied && msgText) {
                    try {
                      const aiCompletion = await callResilientCompletion({
                        messages: [
                          {
                            role: "user",
                            content: `You are the DM concierge for ${brandName}.
Brand Tone: ${brandTone}
Niche: ${brand?.niche || "General"}
Offer: ${brand?.main_offer || "Premium services"}

The customer sent on Twitter/X DM: "${msgText}".
Write a warm, helpful reply under 240 characters. If they ask about price or booking, invite them to share contact or book a quick chat.`,
                          },
                        ],
                      });

                      const replyText = aiCompletion.content;
                      if (replyText) {
                        const sendRes = await fetch(`https://api.twitter.com/2/dm_conversations/with/${senderId}/messages`, {
                          method: "POST",
                          headers: {
                            Authorization: `Bearer ${accessToken}`,
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({ message: { text: replyText } }),
                          signal: AbortSignal.timeout(8000),
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
                            .eq("conversation_id", convId);

                          // Capture lead into CRM if buying/pricing intent
                          const lower = msgText.toLowerCase();
                          if (
                            lower.includes("price") ||
                            lower.includes("cost") ||
                            lower.includes("book") ||
                            lower.includes("buy") ||
                            lower.includes("service") ||
                            lower.includes("quote")
                          ) {
                            try {
                              await admin.database.from("leads").insert({
                                user_id: userId,
                                name: `Twitter (@${senderId})`,
                                source: "twitter_dm",
                                stage: "new",
                                score: 8,
                                deal_value: 2500,
                                metadata: {
                                  dm_conversation_id: convId,
                                  sender_id: senderId,
                                  first_inquiry: msgText,
                                },
                              });
                            } catch (crmLeadErr) {
                              console.warn("[Poll DMs] Twitter lead capture notice:", crmLeadErr);
                            }
                          }
                        } else {
                          console.warn(`[Poll DMs] Twitter DM send failed for sender ${senderId}`);
                        }
                      }
                    } catch (twReplyErr) {
                      console.warn("[Poll DMs] Twitter auto-reply error:", twReplyErr);
                    }
                  }
                }
              }
            // ─── B. LinkedIn Direct Messages ──────────────────────────────────
            } else if (platform === "LINKEDIN") {
              const liRes = await fetch("https://api.linkedin.com/v2/messages", {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "X-Restli-Protocol-Version": "2.0.0",
                },
                signal: AbortSignal.timeout(8000),
              });

              if (liRes.ok) {
                const liData = await liRes.json().catch(() => ({}));
                const elements = liData?.elements || [];

                for (const el of elements) {
                  const senderUrn = el.sender || el.actor || "";
                  if (!senderUrn || senderUrn === accountId || (accountId && senderUrn.includes(accountId))) continue;
                  const convId = el.conversation || `li_${senderUrn.replace(/[^a-zA-Z0-9]/g, "_")}`;
                  const msgText = el.message?.body || el.text || "";

                  const { data: existing } = await admin.database
                    .from("social_dms")
                    .select("id, last_replied_at, last_message_at")
                    .eq("conversation_id", convId)
                    .maybeSingle();

                  await admin.database.from("social_dms").upsert(
                    {
                      user_id: userId,
                      platform: "LINKEDIN",
                      conversation_id: convId,
                      sender_id: senderUrn,
                      sender_name: "LinkedIn Connection",
                      last_message: msgText || "[Media]",
                      last_message_at: el.created ? new Date(el.created).toISOString() : new Date().toISOString(),
                      is_read: false,
                      messages_count: 1,
                      raw_messages: [{ id: el.id, message: msgText, from: { id: senderUrn }, created_time: el.created }],
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "conversation_id" }
                  );

                  channelDMs++;

                  const alreadyReplied =
                    existing?.last_replied_at &&
                    new Date(existing.last_replied_at).getTime() >= new Date(el.created || Date.now()).getTime();

                  if (!alreadyReplied && msgText) {
                    try {
                      const aiCompletion = await callResilientCompletion({
                        messages: [
                          {
                            role: "user",
                            content: `You are the LinkedIn concierge for ${brandName}.
Brand Tone: ${brandTone}
Niche: ${brand?.niche || "General"}
Offer: ${brand?.main_offer || "Premium services"}

The customer sent on LinkedIn: "${msgText}".
Write a warm, professional reply under 80 words. If they ask about services or booking, invite them to share their work email or schedule a conversation.`,
                          },
                        ],
                      });

                      const replyText = aiCompletion.content;
                      if (replyText) {
                        const targetRecipient = senderUrn.startsWith("urn:li:person:") ? senderUrn : `urn:li:person:${senderUrn}`;
                        const sendRes = await fetch("https://api.linkedin.com/v2/messages", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${accessToken}`,
                            "X-Restli-Protocol-Version": "2.0.0",
                          },
                          body: JSON.stringify({
                            recipients: [targetRecipient],
                            message: { body: replyText },
                          }),
                          signal: AbortSignal.timeout(8000),
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
                            .eq("conversation_id", convId);

                          // Capture lead into CRM if buying/pricing intent
                          const lower = msgText.toLowerCase();
                          if (
                            lower.includes("price") ||
                            lower.includes("cost") ||
                            lower.includes("book") ||
                            lower.includes("buy") ||
                            lower.includes("service") ||
                            lower.includes("quote")
                          ) {
                            try {
                              await admin.database.from("leads").insert({
                                user_id: userId,
                                name: "LinkedIn Connection",
                                source: "linkedin_dm",
                                stage: "new",
                                score: 9,
                                deal_value: 3500,
                                metadata: {
                                  dm_conversation_id: convId,
                                  sender_urn: senderUrn,
                                  first_inquiry: msgText,
                                },
                              });
                            } catch (crmLeadErr) {
                              console.warn("[Poll DMs] LinkedIn lead capture notice:", crmLeadErr);
                            }
                          }
                        } else {
                          console.warn(`[Poll DMs] LinkedIn DM send failed for sender ${senderUrn}`);
                        }
                      }
                    } catch (liReplyErr) {
                      console.warn("[Poll DMs] LinkedIn auto-reply error:", liReplyErr);
                    }
                  }
                }
              }
            // ─── C. Meta (Instagram & Facebook) DMs ───────────────────────────
            } else if (accountId) {
              // Prefer the Facebook Page ID for the conversations endpoint — this is the
              // same identity the bot sends DMs AS (via page_access_token). Using the IG
              // Business Account ID works for reading but the from.id on our own replies
              // will be the Page ID, not the IG account ID, breaking the self-msg filter.
              const convAccountId = pageId || accountId;
              // Use pageAccessToken if available (it has messaging_type RESPONSE rights),
              // fall back to the user access_token.
              const convToken = pageAccessToken || accessToken;
              const isInstagram = platform === "INSTAGRAM";
              const platformParam = isInstagram ? "&platform=instagram" : "";
              const convUrl = `https://graph.facebook.com/v22.0/${convAccountId}/conversations?fields=id,participants,messages{message,from,created_time}${platformParam}&access_token=${convToken}&limit=10`;
              let convRes = await fetch(convUrl, { signal: AbortSignal.timeout(8000) });

              // If fetching via Page ID fails, fallback to accountId if different
              if (!convRes.ok && convAccountId !== accountId && accountId) {
                const fallbackUrl = `https://graph.facebook.com/v22.0/${accountId}/conversations?fields=id,participants,messages{message,from,created_time}${platformParam}&access_token=${convToken}&limit=10`;
                const fallbackRes = await fetch(fallbackUrl, { signal: AbortSignal.timeout(8000) });
                if (fallbackRes.ok) {
                  convRes = fallbackRes;
                }
              }

              if (!convRes.ok) {
                const errBody = await convRes.json().catch(() => ({}));
                console.warn(`[Poll DMs] Conversations fetch failed for channel ${channel.id} (${platform}):`, JSON.stringify(errBody));
                return;
              }

              const convData = await convRes.json().catch(() => ({}));
              const conversations = convData?.data || [];

              for (const conv of conversations) {
                const messages = conv.messages?.data || [];
                const lastMsg = messages[0];
                if (!lastMsg) continue;

                const participants = conv.participants?.data || [];
                // Filter out the bot's own participant identity:
                // for Instagram, our bot appears as the Page ID (page_id), not the IG account ID.
                // Check both to be safe.
                const sender = participants.find((p: any) => p.id !== accountId && p.id !== pageId);
                const senderName = sender?.name || "Customer";
                const senderId = sender?.id || conv.id;

                // Don't reply if last message is from ourselves (check BOTH IG account ID and Page ID)
                if (lastMsg.from?.id === accountId || lastMsg.from?.id === pageId) continue;

                // Use stable conversation ID: pageId_senderId (same format as webhook handler)
                // This ensures webhook replies and poller replies share the same dedup record.
                const stableConvId = (pageId && senderId && senderId !== conv.id)
                  ? `${pageId}_${senderId}`
                  : conv.id;

                // Check existing record
                const { data: existing } = await admin.database
                  .from("social_dms")
                  .select("id, last_replied_at, last_message_at")
                  .eq("conversation_id", stableConvId)
                  .maybeSingle();

                // Upsert the DM conversation record (use stable conv ID)
                await admin.database.from("social_dms").upsert(
                  {
                    user_id: userId,
                    platform: platform,
                    conversation_id: stableConvId,
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

                // Auto-reply if the last message is newer than our last reply.
                // Using strict > (not >=) so clock-equal timestamps (edge case)
                // don't cause a re-reply.
                const alreadyReplied =
                  existing?.last_replied_at &&
                  new Date(existing.last_replied_at).getTime() > new Date(lastMsg.created_time).getTime();

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
                      const dmResult = await sendPrivateDM({
                        userId,
                        platform,
                        commenterId: senderId,
                        igAccountId: accountId,
                        accessToken: convToken,
                        dmMessage: replyText,
                      });

                      if (dmResult.ok) {
                        channelReplies++;
                        await admin.database
                          .from("social_dms")
                          .update({
                            last_reply: replyText,
                            last_replied_at: new Date().toISOString(),
                            is_read: true,
                          })
                          .eq("conversation_id", stableConvId);

                        // If inquiry sentiment, capture as lead into CRM
                        const lower = (lastMsg.message || "").toLowerCase();
                        if (
                          lower.includes("price") ||
                          lower.includes("cost") ||
                          lower.includes("book") ||
                          lower.includes("buy") ||
                          lower.includes("service")
                        ) {
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
                      } else {
                        console.warn(
                          `[Poll DMs] DM send failed for conv ${conv.id} (strategy=${dmResult.strategy}, code=${dmResult.errorCode}): ${dmResult.errorMessage}`
                        );
                      }
                    }
                  } catch (replyErr) {
                    console.warn("[Poll DMs] Auto-reply error:", replyErr);
                  }
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
