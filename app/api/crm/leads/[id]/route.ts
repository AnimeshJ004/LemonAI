import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { getLeadById, updateLead, deleteLead } from "@/lib/crm-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  const targetUserId = userId || "user_lemon_default";

  const { id } = await params;
  const lead = await getLeadById(id, targetUserId);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  return NextResponse.json({ lead });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  const targetUserId = userId || "user_lemon_default";

  const { id } = await params;
  const body = await req.json();

  const updated = await updateLead(id, body, targetUserId);
  if (!updated) return NextResponse.json({ error: "Failed to update lead" }, { status: 404 });

  return NextResponse.json({ success: true, lead: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  const targetUserId = userId || "user_lemon_default";

  const { id } = await params;
  const success = await deleteLead(id, targetUserId);
  if (!success) return NextResponse.json({ error: "Failed to delete lead" }, { status: 404 });

  return NextResponse.json({ success: true });
}
