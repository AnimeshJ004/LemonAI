import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getActivitiesForUser, recordActivity } from "@/lib/crm-service";

/**
 * GET /api/crm/activities — fetch activity timeline for a user's leads
 * POST /api/crm/activities — log a new activity event
 */

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get("userId");
    const targetUserId = queryUserId || userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null) || "usr_lemon_demo";

    const leadId = searchParams.get("lead_id");
    const limitParam = searchParams.get("limit");
    const limit = Math.min(Number(limitParam) || 50, 200);

    let activities = await getActivitiesForUser(targetUserId);

    if (leadId) {
      activities = activities.filter((a) => a.lead_id === leadId);
    }

    return NextResponse.json({ activities: activities.slice(0, limit) });
  } catch (error: any) {
    console.error("Activities GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch activities" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const body = await request.json().catch(() => ({}));
    const targetUserId = body.userId || userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null) || "usr_lemon_demo";

    const { lead_id, type, title, description, metadata } = body;

    if (!type || !title) {
      return NextResponse.json({ error: "type and title are required" }, { status: 400 });
    }

    const activity = await recordActivity({
      user_id: targetUserId,
      lead_id,
      type,
      title,
      description,
      metadata,
    });

    return NextResponse.json({ activity }, { status: 201 });
  } catch (error: any) {
    console.error("Activities POST error:", error);
    return NextResponse.json({ error: error.message || "Failed to log activity" }, { status: 500 });
  }
}
