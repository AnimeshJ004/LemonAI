import { getInsforgeServerClient, getInsforgeAdminClient } from "@/lib/insforge-server";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      objective,
      daily_budget,
      ad_headline,
      ad_primary_text,
      status,
      start_date,
      end_date,
    } = body;

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updatePayload.name = name;
    if (objective !== undefined) updatePayload.objective = objective;
    if (daily_budget !== undefined) updatePayload.daily_budget = Number(daily_budget);
    if (ad_headline !== undefined) updatePayload.ad_headline = ad_headline;
    if (ad_primary_text !== undefined) updatePayload.ad_primary_text = ad_primary_text;
    if (status !== undefined) updatePayload.status = status;
    if (start_date !== undefined) updatePayload.start_date = start_date;
    if (end_date !== undefined) updatePayload.end_date = end_date;

    const admin = getInsforgeAdminClient();
    const { data: updated, error } = await admin.database
      .from("meta_campaigns")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating meta campaign:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaign: updated });
  } catch (error: any) {
    console.error("Error in PATCH /api/meta/campaigns/[id]:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getInsforgeAdminClient();
    const { error } = await admin.database
      .from("meta_campaigns")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting meta campaign:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Campaign deleted" });
  } catch (error: any) {
    console.error("Error in DELETE /api/meta/campaigns/[id]:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
