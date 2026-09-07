import { NextRequest, NextResponse } from "next/server";
import { getLeadsForUser, updateLead, VoiceCallLog } from "@/lib/crm-service";

/**
 * Vapi.ai / Bland.ai Call Events & Webhook Ingestion
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const message = body.message || body;
    const type = message.type || body.type || "status-update";
    const call = message.call || body.call || body;

    const callId = call.id || message.callId || `call_${Date.now()}`;
    const customerPhone = call.customer?.number || call.phoneNumber;
    const transcript = message.transcript || call.transcript || message.artifact?.transcript;
    const recordingUrl = message.recordingUrl || call.recordingUrl || message.artifact?.recordingUrl;
    const summary = message.summary || call.summary || message.analysis?.summary;

    const targetUserId = "user_lemon_default";
    const allLeads = await getLeadsForUser(targetUserId);

    // Match lead by phone or by metadata callId
    const matchedLead = allLeads.find(
      (l) =>
        (customerPhone && l.phone && l.phone.replace(/\D/g, "") === customerPhone.replace(/\D/g, "")) ||
        (l.metadata?.callLogs && l.metadata.callLogs.some((c: VoiceCallLog) => c.callId === callId))
    );

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
