import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getLeadById } from "@/lib/crm-service";
import { triggerOutboundQualificationCall } from "@/lib/vapi-client";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { leadId, phone } = body;

    if (!leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    const lead = await getLeadById(leadId, targetUserId);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const targetPhone = phone || lead.phone;
    if (!targetPhone) {
      return NextResponse.json(
        { error: "Lead does not have a phone number on file" },
        { status: 400 }
      );
    }

    const callResult = await triggerOutboundQualificationCall({
      leadId: lead.id,
      leadName: lead.name || "Customer",
      phone: targetPhone,
      company: lead.metadata?.company,
      userId: targetUserId,
      contextNotes: lead.metadata?.notes || "Requested qualification discovery call.",
    });

    return NextResponse.json(callResult);
  } catch (error: any) {
    console.error("Error triggering voice call:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger voice call" },
      { status: 500 }
    );
  }
}
