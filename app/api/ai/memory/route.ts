import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeServerClient, getInsforgeAdminClient } from "@/lib/insforge-server";
import { recordMemorySignal, getUserMemoryContext, buildMemoryPromptBlock } from "@/lib/ai-memory";
import { getBrandProfileForUser } from "@/lib/brand-helper";

/**
 * POST /api/ai/memory
 * Save a user feedback signal so the AI can learn from it.
 *
 * Body:
 * {
 *   signalType: "positive" | "edited" | "deleted" | "explicit"
 *   originalContent?: string   // What AI generated
 *   finalContent?: string      // What user kept / changed to
 *   feedbackText?: string      // Optional: "too formal", "shorter please"
 *   postId?: string            // Optional: scheduled_posts.id
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { insforge } = await getInsforgeServerClient().catch(() => ({
      insforge: getInsforgeAdminClient(),
    }));

    const body = await req.json().catch(() => ({}));
    const { signalType, originalContent, finalContent, feedbackText, postId } = body;

    if (!signalType || !["positive", "edited", "deleted", "explicit"].includes(signalType)) {
      return NextResponse.json({ error: "Invalid signalType" }, { status: 400 });
    }

    // Fetch brand profile for context
    const brandProfile = await getBrandProfileForUser(userId);

    await recordMemorySignal(
      userId,
      {
        signalType,
        originalContent,
        finalContent,
        feedbackText,
        contextNiche: brandProfile?.niche || undefined,
        contextTone: brandProfile?.brand_tone || undefined,
        postId,
      },
      insforge
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[AI Memory POST] Error:", error);
    return NextResponse.json({ error: "Failed to record memory" }, { status: 500 });
  }
}

/**
 * GET /api/ai/memory
 * Fetch all AI memory records for the current user (for the Memory Dashboard).
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { insforge } = await getInsforgeServerClient().catch(() => ({
      insforge: getInsforgeAdminClient(),
    }));

    const { data, error } = await insforge.database
      .from("ai_memory")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch memories" }, { status: 500 });
    }

    return NextResponse.json({ memories: data || [] });
  } catch (error: any) {
    console.error("[AI Memory GET] Error:", error);
    return NextResponse.json({ error: "Failed to fetch memories" }, { status: 500 });
  }
}

/**
 * DELETE /api/ai/memory
 * Delete a specific memory or reset ALL memories for the user.
 *
 * Body:
 * { id?: string }   — if id provided: delete one. If not: reset all.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { insforge } = await getInsforgeServerClient().catch(() => ({
      insforge: getInsforgeAdminClient(),
    }));

    const body = await req.json().catch(() => ({}));
    const { id } = body;

    if (id) {
      // Delete a single memory
      const { error } = await insforge.database
        .from("ai_memory")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: "Memory deleted" });
    } else {
      // Reset ALL memories for this user
      const { error } = await insforge.database
        .from("ai_memory")
        .delete()
        .eq("user_id", userId);

      if (error) {
        return NextResponse.json({ error: "Failed to reset memories" }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: "All memories reset" });
    }
  } catch (error: any) {
    console.error("[AI Memory DELETE] Error:", error);
    return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
  }
}
