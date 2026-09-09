import { NextRequest, NextResponse } from "next/server";
import { updateLead, VoiceCallLog } from "@/lib/crm-service";
import { getInsforgeAdminClient } from "@/lib/insforge-server";

/**
 * Vapi.ai / Bland.ai Call Events & Webhook Ingestion
 */
export async function POST(request: NextRequest) {
  try {
    // 0. Secret verification if configured
    const voiceSecret = process.env.VOICE_WEBHOOK_SECRET || process.env.VAPI_WEBHOOK_SECRET;
    if (voiceSecret) {
      const headerSecret =
        request.headers.get("x-vapi-secret") ||
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (headerSecret !== voiceSecret) {
        console.warn("[Voice Webhook] Invalid voice webhook authorization header.");
        return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const message = body.message || body;
    const type = message.type || body.type || "status-update";
    const call = message.call || body.call || body;

    const callId = call.id || message.callId || `call_${Date.now()}`;
    const customerPhone = call.customer?.number || call.phoneNumber;
    const transcript = message.transcript || call.transcript || message.artifact?.transcript;
    const recordingUrl = message.recordingUrl || call.recordingUrl || message.artifact?.recordingUrl;
    const summary = message.summary || call.summary || message.analysis?.summary;

    const admin = getInsforgeAdminClient();
    let matchedLead: any = null;
    const cleanPhone = customerPhone ? customerPhone.replace(/\D/g, "") : null;

    // 1. Dynamic Tenant Resolution: Query leads by callId first (most specific)
    if (callId) {
      try {
        const { data: callMatches } = await admin.database
          .from("leads")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(50);
        matchedLead = callMatches?.find((l: any) =>
          l.metadata?.callLogs?.some((c: VoiceCallLog) => c.callId === callId)
        );
      } catch {}
    }

    // 2. Fallback: Query by phone if not matched by callId
    if (!matchedLead && cleanPhone) {
      const { searchParams } = new URL(request.url);
      const queryUserId = searchParams.get("userId") || searchParams.get("tenantId");

      let leadQuery = admin.database.from("leads").select("*");
      if (queryUserId) {
        leadQuery = leadQuery.eq("user_id", queryUserId);
      }

      const { data: leadsByPhone } = await leadQuery
        .order("updated_at", { ascending: false })
        .limit(20);

      matchedLead = leadsByPhone?.find(
        (l: any) => l.phone && l.phone.replace(/\D/g, "") === cleanPhone
      );
    }


    if (matchedLead) {
      const currentLogs: VoiceCallLog[] = matchedLead.metadata?.callLogs || [];
      const existingIdx = currentLogs.findIndex((c) => c.callId === callId);

      const status =
        type === "end-of-call-report" || type === "call.ended"
          ? "completed"
          : type === "call.started"
          ? "initiated"
          : "completed";

      const updatedLog: VoiceCallLog = {
        callId,
        timestamp: new Date().toISOString(),
        status,
        summary: summary || (status === "completed" ? "Voice qualification call completed successfully." : undefined),
        transcript: transcript || undefined,
        recordingUrl: recordingUrl || undefined,
      };

      if (existingIdx !== -1) {
        currentLogs[existingIdx] = { ...currentLogs[existingIdx], ...updatedLog };
      } else {
        currentLogs.unshift(updatedLog);
      }

      await updateLead(
        matchedLead.id,
        {
          metadata: {
            ...matchedLead.metadata,
            callLogs: currentLogs,
          },
        },
        matchedLead.user_id
      );

      return NextResponse.json({
        status: "logged",
        leadId: matchedLead.id,
        callId,
      });
    }

    return NextResponse.json({ status: "acknowledged", callId });
  } catch (err: any) {
    console.error("Voice webhook error:", err);
    return NextResponse.json({ error: err?.message || "Webhook processing failed" }, { status: 500 });
  }
}
