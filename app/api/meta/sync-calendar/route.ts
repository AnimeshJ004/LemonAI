import { getInsforgeServerClient } from "@/lib/insforge-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { insforge, userId } = await getInsforgeServerClient();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { content, imageUrl, scheduledAt, channelTypeId } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "Post content is required" }, { status: 400 });
    }
    if (!scheduledAt) {
      return NextResponse.json({ error: "Schedule time is required" }, { status: 400 });
    }

    // Find user's channel by channel type
    let userChannelId: string | null = null;
    if (channelTypeId) {
      const { data: channelData } = await insforge.database
        .from("user_channels")
        .select("id")
        .eq("user_id", userId)
        .eq("channel_type_id", channelTypeId)
        .eq("is_connected", true)
        .limit(1)
        .maybeSingle();
      userChannelId = channelData?.id ?? null;
    }

    if (!userChannelId) {
      // Fallback: get any connected channel
      const { data: anyChannel } = await insforge.database
        .from("user_channels")
        .select("id")
        .eq("user_id", userId)
        .eq("is_connected", true)
        .limit(1)
        .maybeSingle();
      userChannelId = anyChannel?.id ?? null;
    }

    if (!userChannelId) {
      return NextResponse.json(
        { error: "No connected social channel found. Please connect a channel in Settings first." },
        { status: 422 }
      );
    }

    const postPayload = {
      user_id: userId,
      user_channel_id: userChannelId,
      content: content.trim(),
      images: imageUrl ? [{ url: imageUrl, type: "image" }] : [],
      scheduled_at: scheduledAt,
      status: "SCHEDULED",
    };

    const { data, error } = await insforge.database
      .from("scheduled_posts")
      .insert(postPayload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      post: data,
      message: "Post synced to your organic calendar!",
    });
  } catch (error) {
    console.error("Error syncing to calendar:", error);
    return NextResponse.json({ error: "Failed to sync post to calendar" }, { status: 500 });
  }
}
