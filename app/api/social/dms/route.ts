import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { socialDMService } from "@/lib/social-dm-service";

/**
 * GET /api/social/dms — fetch all stored DM conversations
 * POST /api/social/dms — sync new DMs from Instagram/Facebook Graph API
 */

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform");
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

    const dms = await socialDMService.getDMs(targetUserId, platform, limit);
    return NextResponse.json({ dms });
  } catch (error: any) {
    console.error("DM GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch DMs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await socialDMService.syncDMs(targetUserId);

    return NextResponse.json({
      synced: result.synced,
      message: result.message,
      source: result.source,
    });
  } catch (error: any) {
    console.error("DM POST sync error:", error);
    return NextResponse.json({ error: error.message || "Failed to sync DMs" }, { status: 500 });
  }
}
