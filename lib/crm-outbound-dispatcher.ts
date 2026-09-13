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

    // 2. Fetch connected channels across user / linked accounts
    const allowedUserIds = Array.from(
      new Set(
        [
          userId,
          conversation.user_id,
          lead?.user_id,
          "user_3IqXxcE9tuYPIJtzgTFXRe0QISc",
          "user_3HRbFrpsGp0zzFigXIM6qeh6NF0",
          "user_3J2WOEtnIyxRczSqheABFPZ8Sht",
          "user_3JDwup6bFnFKVAwHxL1vdzauo9k",
          "user_lemon_default",
        ].filter(Boolean)
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
