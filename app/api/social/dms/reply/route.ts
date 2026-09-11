import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { socialDMService } from "@/lib/social-dm-service";

/**
 * POST /api/social/dms/reply — send an AI-generated or manual reply to an Instagram/Facebook DM
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { conversationId, platform, recipientId, message, aiGenerate, context } = body;

    if (!conversationId || !platform || !recipientId) {
      return NextResponse.json({ error: "conversationId, platform, and recipientId are required" }, { status: 400 });
    }

    const result = await socialDMService.replyDM({
      conversationId,
      platform,
      recipientId,
      message,
      aiGenerate,
      context,
      userId: targetUserId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("DM Reply error:", error);
    return NextResponse.json({ error: error.message || "Failed to send DM reply" }, { status: 500 });
  }
}
