import { POST_STATUS } from "@/constants/post";
import { getInsforgeServerClient, getInsforgeAdminClient } from "@/lib/insforge-server";
import { recordMemorySignal } from "@/lib/ai-memory";
import { getBrandProfileForUser } from "@/lib/brand-helper";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { insforge, userId } = await getInsforgeServerClient();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { content, images, scheduledAt, status } = await request.json();

    // Fetch original post content BEFORE updating (for memory diff)
    let originalContent: string | null = null;
    try {
      const { data: originalPost } = await insforge.database
        .from("scheduled_posts")
        .select("content")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      originalContent = originalPost?.content || null;
    } catch {}

    const updateData: any = {};
    if (content) updateData.content = content;
    if (Array.isArray(images)) updateData.images = images;
    if (scheduledAt) updateData.scheduled_at = scheduledAt;
    const postStatus = status === POST_STATUS.DRAFT ? POST_STATUS.DRAFT : POST_STATUS.QUEUE;
    updateData.status = postStatus;

    const { data, error } = await insforge.database
      .from("scheduled_posts")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating post:", error);
      return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
    }

    // Auto-record memory signal if content was meaningfully changed
    if (
      content &&
      originalContent &&
      content.trim() !== originalContent.trim()
    ) {
      try {
        const brandProfile = await getBrandProfileForUser(userId);
        const { insforge: adminInsforge } = await getInsforgeServerClient().catch(() => ({
          insforge: getInsforgeAdminClient(),
        }));
        await recordMemorySignal(
          userId,
          {
            signalType: "edited",
            originalContent,
            finalContent: content,
            contextNiche: brandProfile?.niche || undefined,
            contextTone: brandProfile?.brand_tone || undefined,
            postId: id,
          },
          adminInsforge
        );
      } catch (memErr: any) {
        // Non-fatal — memory recording failure should not break post update
        console.warn("[AI Memory] Auto-record on edit failed:", memErr?.message);
      }
    }

    return NextResponse.json({ post: data });
  } catch (error) {
    console.error("Error updating post:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { insforge, userId } = await getInsforgeServerClient();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch original post content BEFORE deleting (for negative memory signal)
    let originalContent: string | null = null;
    try {
      const { data: originalPost } = await insforge.database
        .from("scheduled_posts")
        .select("content")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      originalContent = originalPost?.content || null;
    } catch {}

    const { error } = await insforge.database
      .from("scheduled_posts")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting post:", error);
      return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
    }

    // Record negative memory signal (delete = AI should avoid this style)
    if (originalContent) {
      try {
        const brandProfile = await getBrandProfileForUser(userId);
        const { insforge: adminInsforge } = await getInsforgeServerClient().catch(() => ({
          insforge: getInsforgeAdminClient(),
        }));
        await recordMemorySignal(
          userId,
          {
            signalType: "deleted",
            originalContent,
            contextNiche: brandProfile?.niche || undefined,
            contextTone: brandProfile?.brand_tone || undefined,
            postId: id,
          },
          adminInsforge
        );
      } catch (memErr: any) {
        console.warn("[AI Memory] Auto-record on delete failed:", memErr?.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting post:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
