import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { executeAutonomousFlywheel } from "@/lib/flywheel-orchestrator";
import { getInsforgeAdminClient } from "@/lib/insforge-server";

export const maxDuration = 90;

/**
 * POST: Triggers the Autonomous Flywheel Engine (Research -> Content -> Schedule -> Ad)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      businessName,
      niche,
      targetAudience,
      competitors,
      targetRegion,
      daysToSchedule,
      postsPerDay,
      autoDraftMetaAd,
      selectedChannelIds,
    } = body;

    const result = await executeAutonomousFlywheel({
      userId: targetUserId,
      businessName,
      niche,
      targetAudience,
      competitors: Array.isArray(competitors)
        ? competitors
        : typeof competitors === "string"
          ? competitors.split(/[,\n]/).map((c: string) => c.trim()).filter(Boolean)
          : undefined,
      targetRegion,
      daysToSchedule: Number(daysToSchedule) || 7,
      postsPerDay: Number(postsPerDay) || 1,
      autoDraftMetaAd: autoDraftMetaAd !== false,
      selectedChannelIds: Array.isArray(selectedChannelIds) ? selectedChannelIds : undefined,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Flywheel API] Execution error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute autonomous flywheel" },
      { status: 500 }
    );
  }
}

/**
 * GET: Retrieve recent flywheel executions
 */
export async function GET() {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getInsforgeAdminClient();
    const { data: executions } = await admin.database
      .from("flywheel_executions")
      .select("*")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({ executions: executions || [] });
  } catch (error: any) {
    console.warn("Notice loading flywheel executions:", error?.message);
    return NextResponse.json({ executions: [] });
  }
}
