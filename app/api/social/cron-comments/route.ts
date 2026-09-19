import { NextRequest, NextResponse } from "next/server";
import { pollConnectedChannelsComments } from "@/lib/social-comments-service";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Autonomous 1-minute fallback cron job for social comments.
 * Called automatically by Vercel Cron every 1 minute ("* * * * *")
 * to guarantee that unreplied comments on Instagram/Facebook are processed
 * within 60 seconds, even if Meta webhooks are delayed or dropped.
 */
export async function GET(req: NextRequest) {
  return executePoll(req);
}

export async function POST(req: NextRequest) {
  return executePoll(req);
}

async function executePoll(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is configured, enforce authorization
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Vercel Cron automatically sends CRON_SECRET in the Authorization header
    }

    const result = await pollConnectedChannelsComments(10);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: any) {
    console.error("[Cron Comments] Execution failure:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Cron comments error" },
      { status: 500 }
    );
  }
}
