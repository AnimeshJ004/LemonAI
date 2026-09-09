import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { decrypt } from "@/lib/encryption";

/**
 * GET /api/social/dms — fetch all stored DM conversations
 * POST /api/social/dms — sync new DMs from Instagram/Facebook Graph API
 */

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getInsforgeAdminClient();
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform");
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

    let query = admin.database
      .from("social_dms")
      .select("*")
      .eq("user_id", targetUserId)
      .order("last_message_at", { ascending: false })
      .limit(limit);

    if (platform) query = query.eq("platform", platform.toUpperCase());

    const { data, error } = await query;
    if (error) {
      // Table may not exist yet — return empty gracefully
      console.warn("[DM API] social_dms table query failed:", error.message);
      return NextResponse.json({ dms: [], note: "DM inbox not yet set up" });
    }

    return NextResponse.json({ dms: data || [] });
  } catch (error: any) {
    console.error("DM GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch DMs" }, { status: 500 });
  }
}

/**
 * POST /api/social/dms — trigger a manual DM sync from connected Instagram/Facebook accounts
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getInsforgeAdminClient();

    // Fetch connected Meta channels
    const { data: channels } = await admin.database
      .from("user_channels")
      .select("*, channel_types(type)")
      .eq("user_id", targetUserId)
      .in("channel_types.type", ["INSTAGRAM", "FACEBOOK"]);

    const metaChannels = (channels || []).filter((c: any) =>
      ["INSTAGRAM", "FACEBOOK"].includes(c.channel_types?.type)
    );

    if (metaChannels.length === 0) {
      return NextResponse.json({
        synced: 0,
        message: "No Instagram or Facebook channels connected. Connect channels in Settings → Channels.",
      });
    }

    let totalSynced = 0;

    for (const channel of metaChannels) {
      try {
        const accessToken = decrypt(channel.access_token);
        if (!accessToken) continue;

        const platform = channel.channel_types?.type;
        const accountId = channel.provider_account_id;

        // Fetch conversations from Instagram Messaging API (Business Messaging)
        let conversations: any[] = [];
        if (platform === "INSTAGRAM" && accountId) {
          const res = await fetch(
            `https://graph.facebook.com/v22.0/${accountId}/conversations?fields=id,participants,messages{message,from,created_time}&access_token=${accessToken}&limit=20`,
            { signal: AbortSignal.timeout(8000) }
          );
          if (res.ok) {
            const convData = await res.json();
            conversations = convData?.data || [];
          }
        } else if (platform === "FACEBOOK" && accountId) {
          const res = await fetch(
            `https://graph.facebook.com/v22.0/${accountId}/conversations?fields=id,participants,messages{message,from,created_time}&access_token=${accessToken}&limit=20`,
            { signal: AbortSignal.timeout(8000) }
          );
          if (res.ok) {
            const convData = await res.json();
            conversations = convData?.data || [];
          }
        }

        for (const conv of conversations) {
          const messages = conv.messages?.data || [];
          const lastMsg = messages[0];
          if (!lastMsg) continue;

          const participants = conv.participants?.data || [];
          const sender = participants.find((p: any) => p.id !== accountId);
          const senderName = sender?.name || "Customer";
          const senderId = sender?.id || conv.id;

          // Upsert DM conversation record
          await admin.database.from("social_dms").upsert(
            {
              user_id: targetUserId,
              platform: platform,
              conversation_id: conv.id,
              sender_id: senderId,
              sender_name: senderName,
              last_message: lastMsg.message || "[Media message]",
              last_message_at: lastMsg.created_time || new Date().toISOString(),
              is_read: false,
              messages_count: messages.length,
              raw_messages: messages.slice(0, 10),
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "conversation_id",
              ignoreDuplicates: false,
            }
          );
          totalSynced++;
        }
      } catch (channelErr: any) {
        console.warn(`[DM Sync] Channel sync notice for ${channel.id}:`, channelErr.message);
      }
    }

    return NextResponse.json({
      synced: totalSynced,
      message: totalSynced > 0
        ? `Synced ${totalSynced} DM conversation(s) from your connected accounts.`
        : "No new DMs found. Your inbox is up to date.",
    });
  } catch (error: any) {
    console.error("DM POST sync error:", error);
    return NextResponse.json({ error: error.message || "Failed to sync DMs" }, { status: 500 });
  }
}
