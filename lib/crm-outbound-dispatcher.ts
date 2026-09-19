import { getInsforgeAdminClient } from "./insforge-server";
import { decrypt } from "./encryption";
import { getConversationWithMessages, recordActivity } from "./crm-service";
import { sendWhatsAppMessage } from "./whatsapp-client";

export interface OutboundDispatchResult {
  dispatched: boolean;
  channel: string;
  externalMessageId?: string;
  warning?: string;
  error?: string;
}

/**
 * Dispatches an outbound message (sent by human agent or AI assistant) to the
 * external platform (Instagram DM / Private Reply, Facebook, WhatsApp, etc.).
 */
export async function dispatchCRMOutboundMessage({
  conversationId,
  senderType,
  content,
  userId,
}: {
  conversationId: string;
  senderType: "human_agent" | "ai_assistant";
  content: string;
  userId: string;
}): Promise<OutboundDispatchResult> {
  const admin = getInsforgeAdminClient();

  try {
    // 1. Fetch conversation details & associated lead
    const { conversation } = await getConversationWithMessages(conversationId, userId);
    if (!conversation) {
      return {
        dispatched: false,
        channel: "unknown",
        warning: "Conversation not found in CRM database.",
      };
    }

    const channel = String(conversation.channel || "").toLowerCase();
    const lead = conversation.lead;

    // If channel is website chat, it stays entirely within the internal CRM messaging system
    if (channel === "website" || channel === "manual" || channel === "voice") {
      return {
        dispatched: true,
        channel,
      };
    }

    // 2. Fetch connected channels for the owning user / linked accounts only.
    // Scope strictly to the conversation owner and the acting user — never
    // inject other tenants' IDs, which would leak dispatch across accounts.
    const allowedUserIds = Array.from(
      new Set(
        [userId, conversation.user_id, lead?.user_id].filter(Boolean)
      )
    );

    const { data: channels } = await admin.database
      .from("user_channels")
      .select("*, channel_types(*)")
      .in("user_id", allowedUserIds)
      .eq("is_connected", true);

    const connectedChannels = channels || [];

    // ─── INSTAGRAM DISPATCH ───────────────────────────────────────────────────
    if (channel === "instagram" || channel === "instagram_dm") {
      // Find connected Facebook Page and Instagram Channel
      const fbChannel = connectedChannels.find(
        (c: any) => c.channel_types?.type === "FACEBOOK" && c.access_token
      );
      const igChannel = connectedChannels.find(
        (c: any) => c.channel_types?.type === "INSTAGRAM" && c.access_token
      );

      if (!fbChannel?.access_token && !igChannel?.access_token) {
        return {
          dispatched: false,
          channel,
          warning: "No active Instagram or Facebook Page channel token connected in Settings → Channels.",
        };
      }

      const fbToken = fbChannel?.access_token ? decrypt(fbChannel.access_token) : null;
      const igToken = igChannel?.access_token ? decrypt(igChannel.access_token) : null;

      // In Meta Graph API, sending messages and private replies to Instagram requires the Facebook Page ID
      const pageId = fbChannel?.provider_account_id;
      const tokenToUse = fbToken || igToken;

      const commentId = lead?.metadata?.commentId;
      const commenterId = lead?.metadata?.commenterId;

      // Strategy A: Try Private Reply to Instagram Comment if commentId is present
      if (commentId && pageId && tokenToUse) {
        try {
          const prRes = await fetch(`https://graph.facebook.com/v22.0/${pageId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: { comment_id: commentId },
              message: { text: content },
              messaging_type: "RESPONSE",
              access_token: tokenToUse,
            }),
            signal: AbortSignal.timeout(8000),
          });

          const prData = await prRes.json().catch(() => ({}));
          if (prRes.ok && (prData?.message_id || prData?.recipient_id)) {
            console.log(`[CRM Dispatcher] ✓ Instagram Private Reply sent via Page ${pageId}:`, prData.message_id);
            await recordActivity({
              user_id: userId,
              lead_id: lead?.id,
              type: "message_sent",
              title: `Instagram Private Reply sent by ${senderType === "human_agent" ? "Human Agent" : "AI"}`,
              description: content,
              metadata: { message_id: prData.message_id, commentId },
            });
            return {
              dispatched: true,
              channel,
              externalMessageId: prData.message_id,
            };
          }

          // If Meta says this comment already received a private reply, fallback to direct DM or public reply
          console.warn("[CRM Dispatcher] Private reply notice:", prData?.error?.message || prData);
        } catch (prErr: any) {
          console.warn("[CRM Dispatcher] Private reply error:", prErr?.message);
        }
      }

      // Strategy B: Try Direct DM via commenter ID (IGSID)
      if (commenterId && pageId && tokenToUse) {
        try {
          const dmRes = await fetch(`https://graph.facebook.com/v22.0/${pageId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: { id: commenterId },
              message: { text: content },
              messaging_type: "RESPONSE",
              access_token: tokenToUse,
            }),
            signal: AbortSignal.timeout(8000),
          });

          const dmData = await dmRes.json().catch(() => ({}));
          if (dmRes.ok && (dmData?.message_id || dmData?.recipient_id)) {
            console.log(`[CRM Dispatcher] ✓ Instagram Direct DM sent via Page ${pageId}:`, dmData.message_id);
            await recordActivity({
              user_id: userId,
              lead_id: lead?.id,
              type: "message_sent",
              title: `Instagram DM sent by ${senderType === "human_agent" ? "Human Agent" : "AI"}`,
              description: content,
              metadata: { message_id: dmData.message_id, commenterId },
            });
            return {
              dispatched: true,
              channel,
              externalMessageId: dmData.message_id,
            };
          }

          const errMsg = dmData?.error?.message || "";
          if (errMsg.includes("Advanced Access") || dmData?.error?.code === 200) {
            // Strategy C: If direct DM restricted by Meta in dev mode, post as comment reply if comment exists
            if (commentId && (igToken || fbToken)) {
              try {
                const replyRes = await fetch(`https://graph.facebook.com/v22.0/${commentId}/replies`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    message: content,
                    access_token: igToken || fbToken,
                  }),
                  signal: AbortSignal.timeout(8000),
                });
                const replyData = await replyRes.json().catch(() => ({}));
                if (replyRes.ok && replyData?.id) {
                  return {
                    dispatched: true,
                    channel,
                    externalMessageId: replyData.id,
                    warning: "Direct DM restricted by Meta dev mode; posted as public reply to the prospect's comment.",
                  };
                }
              } catch {}
            }

            return {
              dispatched: false,
              channel,
              warning:
                "Meta Dev Mode: Recipient user has not messaged your Instagram account first and is not registered as a Tester on developers.facebook.com.",
            };
          }

          return {
            dispatched: false,
            channel,
            error: errMsg || "Failed to dispatch Instagram message",
          };
        } catch (dmErr: any) {
          return {
            dispatched: false,
            channel,
            error: dmErr?.message || "Network error dispatching Instagram DM",
          };
        }
      }

      return {
        dispatched: false,
        channel,
        warning: "Lead is missing Instagram commentId and recipient ID.",
      };
    }

    // ─── FACEBOOK DISPATCH ────────────────────────────────────────────────────
    if (channel === "facebook" || channel === "facebook_dm") {
      const fbChannel = connectedChannels.find(
        (c: any) => c.channel_types?.type === "FACEBOOK" && c.access_token
      );
      if (!fbChannel?.access_token || !fbChannel?.provider_account_id) {
        return {
          dispatched: false,
          channel,
          warning: "No active Facebook Page channel connected.",
        };
      }

      const fbToken = decrypt(fbChannel.access_token);
      const recipientId = lead?.metadata?.commenterId || lead?.metadata?.senderId;

      if (!recipientId) {
        return {
          dispatched: false,
          channel,
          warning: "No Facebook recipient ID found for this lead.",
        };
      }

      try {
        const res = await fetch(`https://graph.facebook.com/v22.0/${fbChannel.provider_account_id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text: content },
            messaging_type: "RESPONSE",
            access_token: fbToken,
          }),
          signal: AbortSignal.timeout(8000),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.message_id) {
          return {
            dispatched: true,
            channel,
            externalMessageId: data.message_id,
          };
        }
        return {
          dispatched: false,
          channel,
          error: data?.error?.message || "Failed to dispatch Facebook message",
        };
      } catch (err: any) {
        return {
          dispatched: false,
          channel,
          error: err?.message || "Facebook dispatch error",
        };
      }
    }

    // ─── WHATSAPP DISPATCH ────────────────────────────────────────────────────
    if (channel === "whatsapp") {
      if (!lead?.phone) {
        return {
          dispatched: false,
          channel,
          warning: "Lead does not have a phone number for WhatsApp.",
        };
      }

      const waRes = await sendWhatsAppMessage({
        to: lead.phone,
        text: content,
      });

      return {
        dispatched: waRes.success,
        channel,
        externalMessageId: waRes.messageId,
        error: waRes.error,
      };
    }

    // ─── LINKEDIN DISPATCH ───────────────────────────────────────────────────
    if (channel === "linkedin" || channel === "linkedin_dm") {
      const liChannel = connectedChannels.find(
        (c: any) => c.channel_types?.type === "LINKEDIN" && c.access_token
      );
      if (!liChannel?.access_token) {
        return {
          dispatched: false,
          channel,
          warning: "No active LinkedIn account connected in Settings → Channels.",
        };
      }

      const liToken = decrypt(liChannel.access_token);
      const recipientUrn = lead?.metadata?.linkedinUrn || lead?.metadata?.senderId || lead?.metadata?.urn;

      if (!recipientUrn) {
        return {
          dispatched: false,
          channel,
          warning: "No LinkedIn recipient URN found for this lead. Add their profile URN in the lead detail dossier.",
        };
      }

      try {
        const liRes = await fetch("https://api.linkedin.com/v2/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${liToken}`,
            "X-Restli-Protocol-Version": "2.0.0",
          },
          body: JSON.stringify({
            recipients: [recipientUrn.startsWith("urn:li:person:") ? recipientUrn : `urn:li:person:${recipientUrn}`],
            message: {
              body: content,
            },
          }),
          signal: AbortSignal.timeout(8000),
        });

        const liData = await liRes.json().catch(() => ({}));
        if (liRes.ok) {
          const msgId = liData?.id || `li_${Date.now()}`;
          await recordActivity({
            user_id: userId,
            lead_id: lead?.id,
            type: "message_sent",
            title: `LinkedIn message sent by ${senderType === "human_agent" ? "Human Agent" : "AI"}`,
            description: content,
            metadata: { messageId: msgId, recipientUrn },
          });
          return {
            dispatched: true,
            channel,
            externalMessageId: msgId,
          };
        }

        const liError = liData?.message || "LinkedIn API returned an error (Requires LinkedIn MDP Community Management API approval)";
        return {
          dispatched: false,
          channel,
          warning: `LinkedIn dispatch notice: ${liError}`,
        };
      } catch (liErr: any) {
        return {
          dispatched: false,
          channel,
          error: liErr?.message || "Network error dispatching LinkedIn message",
        };
      }
    }

    // ─── TWITTER / X DISPATCH ────────────────────────────────────────────────
    if (channel === "twitter" || channel === "twitter_dm" || channel === "x") {
      const twChannel = connectedChannels.find(
        (c: any) => ["TWITTER", "X"].includes(c.channel_types?.type) && c.access_token
      );
      if (!twChannel?.access_token) {
        return {
          dispatched: false,
          channel,
          warning: "No active Twitter / X channel connected in Settings → Channels.",
        };
      }

      const twToken = decrypt(twChannel.access_token) || twChannel.access_token;
      const recipientId =
        lead?.metadata?.twitterId ||
        lead?.metadata?.senderId ||
        lead?.metadata?.commenterId ||
        lead?.metadata?.dm_conversation_id;

      if (!recipientId) {
        return {
          dispatched: false,
          channel,
          warning: "No Twitter recipient ID or conversation ID found for this lead.",
        };
      }

      try {
        const isConvEndpoint = String(recipientId).includes("-") || String(recipientId).length > 20;
        const twUrl = isConvEndpoint
          ? `https://api.twitter.com/2/dm_conversations/${recipientId}/messages`
          : `https://api.twitter.com/2/dm_conversations/with/${recipientId}/messages`;

        const twRes = await fetch(twUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${twToken}`,
          },
          body: JSON.stringify({
            message: { text: content },
          }),
          signal: AbortSignal.timeout(8000),
        });

        const twData = await twRes.json().catch(() => ({}));
        if (twRes.ok) {
          const msgId = twData?.data?.id || `tw_${Date.now()}`;
          await recordActivity({
            user_id: userId,
            lead_id: lead?.id,
            type: "message_sent",
            title: `Twitter DM sent by ${senderType === "human_agent" ? "Human Agent" : "AI"}`,
            description: content,
            metadata: { messageId: msgId, recipientId },
          });
          return {
            dispatched: true,
            channel,
            externalMessageId: msgId,
          };
        }

        return {
          dispatched: false,
          channel,
          warning: `Twitter DM API notice: ${twData?.detail || JSON.stringify(twData)}`,
        };
      } catch (twErr: any) {
        return {
          dispatched: false,
          channel,
          error: twErr?.message || "Network error dispatching Twitter DM",
        };
      }
    }

    // ─── YOUTUBE COMMENT REPLY DISPATCH ───────────────────────────────────────
    if (channel === "youtube" || channel === "youtube_comment") {
      const ytChannel = connectedChannels.find(
        (c: any) => c.channel_types?.type === "YOUTUBE" && c.access_token
      );
      if (!ytChannel?.access_token) {
        return {
          dispatched: false,
          channel,
          warning: "No active YouTube channel connected in Settings → Channels.",
        };
      }

      const ytToken = decrypt(ytChannel.access_token) || ytChannel.access_token;
      const commentId = lead?.metadata?.commentId || lead?.metadata?.parentId;

      if (!commentId) {
        return {
          dispatched: false,
          channel,
          warning: "No YouTube comment ID found to reply to for this lead.",
        };
      }

      try {
        const ytRes = await fetch("https://www.googleapis.com/youtube/v3/comments?part=snippet", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ytToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            snippet: {
              parentId: commentId,
              textOriginal: content,
            },
          }),
          signal: AbortSignal.timeout(8000),
        });

        const ytData = await ytRes.json().catch(() => ({}));
        if (ytRes.ok && ytData?.id) {
          await recordActivity({
            user_id: userId,
            lead_id: lead?.id,
            type: "message_sent",
            title: `YouTube comment reply posted by ${senderType === "human_agent" ? "Human Agent" : "AI"}`,
            description: content,
            metadata: { commentReplyId: ytData.id, parentCommentId: commentId },
          });
          return {
            dispatched: true,
            channel,
            externalMessageId: ytData.id,
          };
        }

        return {
          dispatched: false,
          channel,
          warning: `YouTube API notice: ${ytData?.error?.message || JSON.stringify(ytData)}`,
        };
      } catch (ytErr: any) {
        return {
          dispatched: false,
          channel,
          error: ytErr?.message || "Network error dispatching YouTube comment reply",
        };
      }
    }

    // ─── EMAIL DISPATCH ──────────────────────────────────────────────────────
    if (channel === "email") {
      if (!lead?.email) {
        return {
          dispatched: false,
          channel,
          warning: "Lead does not have an email address on file.",
        };
      }

      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        return {
          dispatched: false,
          channel,
          warning: "RESEND_API_KEY is not configured in .env.local. Add your Resend API key to enable outbound emails from CRM.",
        };
      }

      try {
        const fromEmail = process.env.EMAIL_FROM || "Lemon AI CRM <onboarding@resend.dev>";
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [lead.email],
            subject: `Follow-up regarding your inquiry${lead.name ? ` — ${lead.name}` : ""}`,
            text: content,
          }),
          signal: AbortSignal.timeout(8000),
        });

        const emailData = await emailRes.json().catch(() => ({}));
        if (emailRes.ok && emailData?.id) {
          await recordActivity({
            user_id: userId,
            lead_id: lead?.id,
            type: "message_sent",
            title: `Email sent by ${senderType === "human_agent" ? "Human Agent" : "AI"}`,
            description: content,
            metadata: { emailId: emailData.id, to: lead.email },
          });
          return {
            dispatched: true,
            channel,
            externalMessageId: emailData.id,
          };
        }

        return {
          dispatched: false,
          channel,
          error: emailData?.message || "Failed to dispatch email via Resend API",
        };
      } catch (mailErr: any) {
        return {
          dispatched: false,
          channel,
          error: mailErr?.message || "Network error dispatching email",
        };
      }
    }

    return {
      dispatched: true,
      channel,
    };
  } catch (err: any) {
    console.error("[CRM Dispatcher] Unhandled error:", err);
    return {
      dispatched: false,
      channel: "error",
      error: err?.message || "Unknown error dispatching message",
    };
  }
}
