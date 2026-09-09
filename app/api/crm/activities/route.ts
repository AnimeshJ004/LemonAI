import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { randomUUID } from "node:crypto";

interface CRMActivityRecord {
  id: string;
  user_id: string;
  lead_id: string;
  type: string;
  title: string;
  description: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

// In-memory fallback if crm_activities table is not yet migrated in database
const memoryActivities = new Map<string, CRMActivityRecord[]>();

/**
 * GET /api/crm/activities — fetch activity timeline for a user's leads
 * POST /api/crm/activities — log a new activity event
 */

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get("lead_id");
    const limitParam = searchParams.get("limit");
    const limit = Math.min(Number(limitParam) || 50, 200);

    try {
      const admin = getInsforgeAdminClient();

      let query = admin.database
        .from("crm_activities")
        .select("*")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (leadId) {
        query = query.eq("lead_id", leadId);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        return NextResponse.json({ activities: data });
      }
    } catch (dbErr) {
      console.warn("[CRM Activities] DB table notice, using memory fallback:", dbErr);
    }

    // Memory fallback
    const userActs = memoryActivities.get(targetUserId) || memoryActivities.get("user_lemon_default") || [];
    let filtered = userActs;
    if (leadId) {
      filtered = filtered.filter((a) => a.lead_id === leadId);
    }
    const result = filtered.slice(0, limit);
    return NextResponse.json({ activities: result });
  } catch (error: any) {
    console.error("Activities GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch activities" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { lead_id, type, title, description, metadata } = body;

    if (!lead_id || !type || !title) {
      return NextResponse.json({ error: "lead_id, type, and title are required" }, { status: 400 });
    }

    const newActivity: CRMActivityRecord = {
      id: randomUUID(),
      user_id: targetUserId,
      lead_id,
      type,
      title,
      description: description || null,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    };

    try {
      const admin = getInsforgeAdminClient();
      const { data, error } = await admin.database
        .from("crm_activities")
        .insert({
          id: newActivity.id,
          user_id: targetUserId,
          lead_id,
          type,
          title,
          description: description || null,
          metadata: metadata || {},
          created_at: newActivity.created_at,
        })
        .select()
        .single();

      if (!error && data) {
        return NextResponse.json({ activity: data }, { status: 201 });
      }
    } catch (dbErr) {
      console.warn("[CRM Activities] DB insert notice, using memory fallback:", dbErr);
    }

    // Memory store fallback
    const current = memoryActivities.get(targetUserId) || [];
    memoryActivities.set(targetUserId, [newActivity, ...current]);

    return NextResponse.json({ activity: newActivity }, { status: 201 });
  } catch (error: any) {
    console.error("Activities POST error:", error);
    return NextResponse.json({ error: error.message || "Failed to log activity" }, { status: 500 });
  }
}
