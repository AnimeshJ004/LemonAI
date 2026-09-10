import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  getLeadsForUser,
  createLead,
  updateLead,
  recordActivity,
  getAppointmentsForUser,
  LeadStage,
} from "@/lib/crm-service";
import { scoreAndUpdateLead } from "@/lib/lead-scoring";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : "usr_lemon_demo");
    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const stage = searchParams.get("stage") as LeadStage | null;
    const search = searchParams.get("search")?.toLowerCase() || "";
    const type = searchParams.get("type");

    if (type === "appointments") {
      const appointments = await getAppointmentsForUser(targetUserId);
      return NextResponse.json({ appointments });
    }

    let leads = await getLeadsForUser(targetUserId);

    if (stage) {
      leads = leads.filter((l) => l.stage === stage);
    }
    if (search) {
      leads = leads.filter(
        (l) =>
          (l.name && l.name.toLowerCase().includes(search)) ||
          (l.email && l.email.toLowerCase().includes(search)) ||
          (l.phone && l.phone.includes(search)) ||
          (l.metadata?.company && l.metadata.company.toLowerCase().includes(search))
      );
    }

    // Compute pipeline summary stats
    const totalLeads = leads.length;
    const totalPipelineValue = leads.reduce((sum, l) => sum + (Number(l.deal_value) || 0), 0);
    const qualifiedCount = leads.filter((l) => ["qualified", "booked", "closed_won"].includes(l.stage)).length;
    const wonCount = leads.filter((l) => l.stage === "closed_won").length;
    const bookedCount = leads.filter((l) => l.stage === "booked" || l.metadata?.bookingInfo?.scheduledAt).length;
    const conversionRate = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0;
    const appointments = await getAppointmentsForUser(targetUserId);

    return NextResponse.json({
      leads,
      appointments,
      stats: {
        totalLeads,
        totalPipelineValue,
        qualifiedCount,
        wonCount,
        bookedCount,
        conversionRate,
      },
    });
  } catch (error: any) {
    console.error("Error fetching leads:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch leads" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : "usr_lemon_demo");
    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { name, email, phone, source, stage, score, deal_value, company, notes } = body;

    if (!name && !email && !phone) {
      return NextResponse.json(
        { error: "At least one contact identifier (name, email, or phone) is required" },
        { status: 400 }
      );
    }

    const newLead = await createLead({
      user_id: targetUserId,
      name: name || "New Prospect",
      email: email || null,
      phone: phone || null,
      source: source || "organic",
      stage: stage || "new",
      score: Number(score) || 5,
      deal_value: Number(deal_value) || 0,
      metadata: {
        company: company || "",
        notes: notes || "",
      },
    });

    // Auto-score lead with BANT intelligence
    let finalizedLead = newLead;
    try {
      const scoreContext = notes || `New prospect ${name || ""} from ${source || "inbound"}. Company: ${company || "Unspecified"}. Deal: $${deal_value || 0}`;
      const scored = await scoreAndUpdateLead(newLead, scoreContext);
      finalizedLead = scored.lead;
    } catch (scoreErr) {
      console.warn("[CRM Leads] Auto-scoring notice:", scoreErr);
    }

    // Log lead created activity
    try {
      await recordActivity({
        user_id: targetUserId,
        lead_id: finalizedLead.id,
        type: "lead_created",
        title: `New lead created: ${finalizedLead.name || "Prospect"}`,
        description: `Source: ${finalizedLead.source} | Initial BANT Score: ${finalizedLead.score}/10`,
        metadata: { source: finalizedLead.source, score: finalizedLead.score },
      });
    } catch (actErr) {
      console.warn("[CRM Leads] Activity log notice:", actErr);
    }

    return NextResponse.json({ lead: finalizedLead }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating lead:", error);
    return NextResponse.json({ error: error.message || "Failed to create lead" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : "usr_lemon_demo");
    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { id, stage, score, deal_value, name, email, phone, metadata, triggerScoring, transcript } = body;

    if (!id) {
      return NextResponse.json({ error: "Lead ID is required" }, { status: 400 });
    }

    const updates: any = {};
    if (stage !== undefined) updates.stage = stage;
    if (score !== undefined) updates.score = Number(score);
    if (deal_value !== undefined) updates.deal_value = Number(deal_value);
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (metadata !== undefined) updates.metadata = metadata;

    let updated = await updateLead(id, updates, targetUserId);
    if (!updated) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // On-demand BANT re-scoring (via button or transcript)
    if (triggerScoring) {
      const scoringContext =
        transcript ||
        updated.metadata?.notes ||
        `Prospect ${updated.name} via ${updated.source}. Deal value: $${updated.deal_value}. Company: ${updated.metadata?.company || "Direct"}`;
      const result = await scoreAndUpdateLead(updated, scoringContext);
      updated = result.lead;

      // Log score activity
      try {
        const admin = (await import("@/lib/insforge-server")).getInsforgeAdminClient();
        await admin.database.from("crm_activities").insert({
          user_id: targetUserId,
          lead_id: updated.id,
          type: "score_updated",
          title: `BANT AI score evaluated: ${updated.score}/10`,
          description: result.evaluation.reasoning || "Lead re-scored via AI auditor.",
          metadata: { score: updated.score, bant: updated.metadata?.bant },
        });
      } catch {}
    }

    return NextResponse.json({ lead: updated });
  } catch (error: any) {
    console.error("Error updating lead:", error);
    return NextResponse.json({ error: error.message || "Failed to update lead" }, { status: 500 });
  }
}
