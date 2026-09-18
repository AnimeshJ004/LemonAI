import { getInsforgeAdminClient } from "./insforge-server";
import { decrypt } from "./encryption";
import { getBrandBrainSummary, getBrandProfileForUser } from "./brand-helper";
import { callResilientCompletion } from "./ai-gateway";
import { createLead } from "./crm-service";
import { sendPrivateDM } from "./meta-messaging";

export interface DMMessage {
  id?: string;
  message: string;
  from?: { id: string; name?: string };
  created_time: string;
}

export interface DMConversation {
  id: string;
  user_id: string;
  platform: "INSTAGRAM" | "FACEBOOK" | "WHATSAPP";
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  last_message: string;
  last_message_at: string;
  last_reply?: string;
  last_replied_at?: string;
  is_read: boolean;
  messages_count: number;
  raw_messages: DMMessage[];
  created_at: string;
  updated_at: string;
}

/**
 * Social DM service.
 *
 * All conversations are persisted in the `social_dms` database table and are
 * strictly scoped to the owning `user_id`. There is no local filesystem cache
 * (unsafe on ephemeral serverless runtimes) and no demo/seed data — only real
 * conversations synced from the Meta Graph API are stored.
 */
export const socialDMService = {
  /**
   * Get all DM conversations for a user.
   */
  async getDMs(userId: string, platform?: string | null, limit: number = 50): Promise<DMConversation[]> {
    if (!userId) return [];
    const admin = getInsforgeAdminClient();

    try {
      let query = admin.database
        .from("social_dms")
        .select("*")
        .eq("user_id", userId)
        .order("last_message_at", { ascending: false })
        .limit(limit);

      if (platform) {
        query = query.eq("platform", platform.toUpperCase());
      }

      const { data, error } = await query;
      if (error) {
        console.warn("[DM Service] Error reading DMs from DB:", error.message);
        return [];
      }
      return (data as DMConversation[]) || [];
    } catch (dbErr: any) {
      console.warn("[DM Service] Error reading DMs from DB:", dbErr?.message);
      return [];
    }
  },

  /**
   * Upsert a DM conversation into the database.
   */
  async upsertDM(dm: Partial<DMConversation> & { conversation_id: string; user_id: string }): Promise<DMConversation> {
    const admin = getInsforgeAdminClient();
    const now = new Date().toISOString();

    // Load any existing row so we can merge fields without clobbering history.
    let existing: DMConversation | null = null;
    try {
      const { data } = await admin.database
        .from("social_dms")
        .select("*")
        .eq("conversation_id", dm.conversation_id)
        .eq("user_id", dm.user_id)
        .maybeSingle();
      existing = (data as DMConversation) || null;
    } catch {
      existing = null;
    }

    const record: DMConversation = {
      id: existing?.id || dm.id || `dm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      user_id: dm.user_id,
      platform: (dm.platform || existing?.platform || "INSTAGRAM") as any,
      conversation_id: dm.conversation_id,
      sender_id: dm.sender_id || existing?.sender_id || dm.conversation_id,
      sender_name: dm.sender_name || existing?.sender_name || "Customer",
      last_message: dm.last_message || existing?.last_message || "",
      last_message_at: dm.last_message_at || existing?.last_message_at || now,
      last_reply: dm.last_reply ?? existing?.last_reply,
      last_replied_at: dm.last_replied_at ?? existing?.last_replied_at,
      is_read: dm.is_read ?? existing?.is_read ?? false,
      messages_count: dm.messages_count ?? existing?.messages_count ?? 1,
      raw_messages: dm.raw_messages || existing?.raw_messages || [
        {
          message: dm.last_message || "",
          from: { id: dm.sender_id || "" },
          created_time: dm.last_message_at || now,
        },
      ],
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    try {
      await admin.database.from("social_dms").upsert(record, { onConflict: "conversation_id" });
    } catch (err: any) {
      console.warn("[DM Service] Error upserting DM to DB:", err?.message);
    }

    return record;
  },

  /**
   * Perform DM synchronization:
   * 1. Detect connected Meta channels for the user
   * 2. Fetch live conversations from the Meta Graph API using stored tokens
   *
   * No simulated/seed data is ever produced — if the live API returns nothing
   * (or lacks permissions), we report zero synced conversations honestly.
   */
  async syncDMs(userId: string): Promise<{ synced: number; message: string; source: "live" | "none" }> {
    if (!userId) {
      return { synced: 0, message: "Missing user context.", source: "none" };
    }
    const admin = getInsforgeAdminClient();

    // Find connected Meta channels for this user only
    const { data: channels } = await admin.database
      .from("user_channels")
      .select("*, channel_types(*)")
      .eq("user_id", userId);

    const metaChannels = (channels || []).filter((c: any) =>
      ["INSTAGRAM", "FACEBOOK"].includes(c.channel_types?.type) &&
      (c.is_connected || c.access_token)
    );

    if (metaChannels.length === 0) {
      return {
        synced: 0,
        message: "No Instagram or Facebook channels connected. Go to Settings → Channels to connect your account.",
        source: "none",
      };
    }

    let liveSyncedCount = 0;
    let hadPermissionIssue = false;

    for (const ch of metaChannels) {
      if (!ch.access_token || !ch.provider_account_id) continue;
      const token = decrypt(ch.access_token);
      if (!token) continue;

      const platform = ch.channel_types?.type;
      const accountId = ch.provider_account_id;

      try {
        const res = await fetch(
          `https://graph.facebook.com/v22.0/${accountId}/conversations?fields=id,participants,messages{message,from,created_time}&access_token=${token}&limit=20`,
          { signal: AbortSignal.timeout(6000) }
        );

        if (res.ok) {
          const convData = await res.json();
          const conversations = convData?.data || [];

          for (const conv of conversations) {
            const messages = conv.messages?.data || [];
            const lastMsg = messages[0];
            if (!lastMsg) continue;

            const participants = conv.participants?.data || [];
            const sender = participants.find((p: any) => p.id !== accountId);

            await this.upsertDM({
              user_id: userId,
              platform: platform as any,
              conversation_id: conv.id,
              sender_id: sender?.id || conv.id,
              sender_name: sender?.name || `Customer (${conv.id.slice(-4)})`,
              last_message: lastMsg.message || "[Media message]",
              last_message_at: lastMsg.created_time || new Date().toISOString(),
              messages_count: messages.length,
              raw_messages: messages,
              is_read: false,
            });
            liveSyncedCount++;
          }
        } else {
          hadPermissionIssue = true;
        }
      } catch {
        hadPermissionIssue = true;
      }
    }

    if (liveSyncedCount > 0) {
      return {
        synced: liveSyncedCount,
        message: `Successfully synced ${liveSyncedCount} live DM conversation(s) from your Meta accounts!`,
        source: "live",
      };
    }

    return {
      synced: 0,
      message: hadPermissionIssue
        ? "No new conversations synced. Your Meta account may not have granted messaging permissions yet, or there are no recent DMs."
        : "No new conversations found on your connected Meta accounts.",
      source: "none",
    };
  },

  /**
   * Reply to a DM conversation (AI or manual).
   */
  async replyDM({
    conversationId,
    platform,
    recipientId,
    message,
    aiGenerate,
    context,
    userId,
  }: {
    conversationId: string;
    platform: string;
    recipientId: string;
    message?: string;
    aiGenerate?: boolean;
    context?: string;
    userId: string;
  }) {
    let replyText = message;

    // AI Generation
    if (aiGenerate || !replyText) {
      try {
        const brand = await getBrandProfileForUser(userId);
        const brandContext = getBrandBrainSummary(brand);

        const completion = await callResilientCompletion({
          jsonMode: false,
          messages: [
            {
              role: "system",
              content: `You are a helpful, warm, professional customer care AI for this brand:\n\n${brandContext}\n\nRespond to customer DMs concisely (under 80 words). Friendly tone. If they ask about pricing or booking, invite them warmly.`,
            },
            {
              role: "user",
              content: `Customer DM: "${context || "Hello"}"\n\nWrite a friendly reply:`,
            },
          ],
        });

        replyText =
          (completion as any)?.text ||
          (completion as any)?.data ||
          "Thank you for reaching out! We'd love to help you. Feel free to ask any questions or book a quick walkthrough!";
      } catch {
        replyText =
          "Thanks for reaching out! Our team has received your message and will be happy to assist you.";
      }
    }

    // Send to Meta API via the unified sender (resolves the correct Page ID +
    // Page token; works for separate and shared IG/FB account setups).
    let sentLive = false;

    try {
      const dmResult = await sendPrivateDM({
        userId,
        platform,
        commenterId: recipientId,
        accessToken: null,
        dmMessage: replyText!,
      });
      sentLive = dmResult.ok;
      if (!dmResult.ok) {
        console.warn(
          `[DM Service] replyDM send failed (strategy=${dmResult.strategy}, code=${dmResult.errorCode}): ${dmResult.errorMessage}`
        );
      }
    } catch (dmErr) {
      console.warn("[DM Service] replyDM send exception:", dmErr);
    }

    const now = new Date().toISOString();

    // Load existing conversation to append the outgoing message
    const admin = getInsforgeAdminClient();
    let existing: DMConversation | null = null;
    try {
      const { data } = await admin.database
        .from("social_dms")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();
      existing = (data as DMConversation) || null;
    } catch {
      existing = null;
    }

    const updatedMessages = [...(existing?.raw_messages || [])];
    updatedMessages.push({
      id: `reply_${Date.now()}`,
      message: replyText!,
      from: { id: "brand_me", name: "You" },
      created_time: now,
    });

    await this.upsertDM({
      conversation_id: conversationId,
      user_id: userId,
      platform: platform as any,
      last_reply: replyText,
      last_replied_at: now,
      is_read: true,
      raw_messages: updatedMessages,
    });

    // Check for CRM Lead creation if inquiry has high purchase intent
    const textToCheck = (context || existing?.last_message || "").toLowerCase();
    if (
      textToCheck.includes("price") ||
      textToCheck.includes("cost") ||
      textToCheck.includes("buy") ||
      textToCheck.includes("quote") ||
      textToCheck.includes("demo") ||
      textToCheck.includes("hire")
    ) {
      try {
        await createLead({
          user_id: userId,
          name: existing?.sender_name || `DM Prospect (${recipientId.slice(-4)})`,
          source: (platform.toLowerCase() + "_dm") as any,
          stage: "new",
          deal_value: 1500,
          metadata: {
            inquiry: existing?.last_message,
            platform,
            conversationId,
            autoCapturedFromDM: true,
          },
        });
      } catch (crmErr) {
        console.warn("[DM Service] Auto CRM lead capture notice:", crmErr);
      }
    }

    return {
      success: true,
      replyText,
      sentLive,
      conversationId,
    };
  },
};
