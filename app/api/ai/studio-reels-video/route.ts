import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateAdCreativeVideo } from "@/lib/ai-image-generator";

export const maxDuration = 180; // Video rendering can take up to 2-3 minutes

/**
 * POST /api/ai/studio-reels-video
 * Generates an ultra-realistic 9:16 vertical commercial video reel using Wan 2.2 / Wan 2.1 via Replicate
 * with curated HD commercial video reel fallback.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { prompt, topic } = body;

    const videoPrompt = prompt || topic;
    if (!videoPrompt || !videoPrompt.trim()) {
      return NextResponse.json({ error: "Prompt or topic is required to generate video" }, { status: 400 });
    }

    console.log(`[Reels Video Studio] Triggering video generation for: "${videoPrompt.slice(0, 60)}..."`);
    const result = await generateAdCreativeVideo({
      prompt: videoPrompt,
      userId: targetUserId,
    });

    return NextResponse.json({
      success: result.success,
      video: result,
    });
  } catch (error: any) {
    console.error("[Reels Video Studio] Generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate video reel" },
      { status: 500 }
    );
  }
}
