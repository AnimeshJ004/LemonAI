import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { CURATED_COMMERCIAL_PHOTOS, CURATED_VERTICAL_REELS } from "@/lib/ai-image-generator";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { posts, status = "queue", selectedChannelIds } = body;

    if (!Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ error: "No posts provided for scheduling" }, { status: 400 });
    }

    const admin = getInsforgeAdminClient();

    // 1. Get user channels or auto-provision if none exist
    let { data: userChannels } = await admin.database
      .from("user_channels")
      .select("id, channel_type_id, is_connected, is_active, channel_types(id, type, name)")
      .eq("user_id", targetUserId);

    if (!userChannels || userChannels.length === 0) {
      const { data: channelTypes } = await admin.database
        .from("channel_types")
        .select("id, type, name")
        .order("created_at", { ascending: true });

      if (channelTypes && channelTypes.length > 0) {
        const toCreate = channelTypes.map((ct) => ({
          user_id: targetUserId,
          channel_type_id: ct.id,
          handle: null,
          is_connected: false,
          is_active: false,
        }));

        const { data: created } = await admin.database
          .from("user_channels")
          .insert(toCreate)
          .select("id, channel_type_id, is_connected, is_active, channel_types(id, type, name)");

        userChannels = created || [];
      }
    }

    // Filter by selected channels if specified
    if (selectedChannelIds && selectedChannelIds.length > 0) {
      const selectedSet = new Set(selectedChannelIds);
      const filtered = (userChannels || []).filter(
        (c) => selectedSet.has(c.id) || selectedSet.has(c.channel_type_id)
      );
      if (filtered.length > 0) {
        userChannels = filtered;
      }
    }

    // Prioritize genuinely connected channels
    const connectedChannels = (userChannels || []).filter(
      (c: any) => c.is_connected && c.access_token
    );
    const targetChannels =
      connectedChannels.length > 0
        ? connectedChannels
        : userChannels && userChannels.length > 0
        ? userChannels
        : [];

    let scheduledCount = 0;
    const insertedIds: string[] = [];

    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      const format = p.format || "FEED_POST";
      const isReel = format === "REEL";
      const isCarousel = format === "CAROUSEL";

      // Prepare media items
      const mediaItems: any[] = [];
      if (isReel) {
        const videoUrl = CURATED_VERTICAL_REELS[i % CURATED_VERTICAL_REELS.length];
        const thumbUrl = CURATED_COMMERCIAL_PHOTOS.business[i % CURATED_COMMERCIAL_PHOTOS.business.length];
        mediaItems.push({
          url: videoUrl,
          key: `reel-video-${i}`,
          media_type: "video",
          thumbnail_url: thumbUrl,
        });
      } else if (isCarousel) {
        const carouselImg = CURATED_COMMERCIAL_PHOTOS.marketing[i % CURATED_COMMERCIAL_PHOTOS.marketing.length];
        mediaItems.push({
          url: carouselImg,
          key: `carousel-cover-${i}`,
          media_type: "image",
        });
      } else {
        const postImg = CURATED_COMMERCIAL_PHOTOS.default[i % CURATED_COMMERCIAL_PHOTOS.default.length];
        mediaItems.push({
          url: postImg,
          key: `post-image-${i}`,
          media_type: "image",
        });
      }

      // If user has channels, associate with first active channel or loop
      const channelToUse = targetChannels[i % (targetChannels.length || 1)] || null;

      const scheduleDate = p.scheduledAt ? new Date(p.scheduledAt) : new Date();

      const { data: inserted, error: insertErr } = await admin.database
        .from("scheduled_posts")
        .insert({
          user_id: targetUserId,
          user_channel_id: channelToUse?.id || null,
          content: p.caption || p.content || p.title,
          images: mediaItems,
          scheduled_at: scheduleDate.toISOString(),
          status: status === "draft" ? "draft" : "queue",
        })
        .select("id")
        .maybeSingle();

      if (!insertErr && inserted?.id) {
        scheduledCount++;
        insertedIds.push(inserted.id);
      }
    }

    return NextResponse.json({
      success: true,
      scheduledCount,
      insertedIds,
      message: `Successfully scheduled ${scheduledCount} posts to your calendar!`,
    });
  } catch (error: any) {
    console.error("[Batch Schedule API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to schedule approved posts" },
      { status: 500 }
    );
  }
}
