import { updateLead, getLeadById, VoiceCallLog } from "./crm-service";
import { getBrandProfileForUser } from "./brand-helper";

export interface OutboundCallRequest {
  leadId: string;
  leadName: string;
  phone: string;
  company?: string;
  userId: string;
  contextNotes?: string;
}

export interface OutboundCallResponse {
  success: boolean;
  callId?: string;
  message: string;
  provider: "vapi" | "simulator";
}

/**
 * Triggers an autonomous outbound qualification call via Vapi.ai.
 * If credentials are missing, operates in realistic simulation mode for zero-crash developer testing.
 */
export async function triggerOutboundQualificationCall(
  params: OutboundCallRequest
): Promise<OutboundCallResponse> {
  const { leadId, leadName, phone, company, userId, contextNotes } = params;

  const apiKey = process.env.VAPI_API_KEY;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  const assistantId = process.env.VAPI_ASSISTANT_ID;

  // Retrieve brand profile to ground voice persona
  const brand = await getBrandProfileForUser(userId);
  const brandName = brand?.business_name || "Lemon AI";
  const brandTone = brand?.brand_tone || "Professional";

  const systemPrompt = `You are Alex, an elite inbound/outbound executive qualification assistant representing ${brandName}.
Your tone is ${brandTone}, warm, articulate, and confident.
You are speaking directly with ${leadName}${company ? ` from ${company}` : ""}.
Context from chat: ${contextNotes || "Customer inquired about service offerings and requested a consultation."}

Your goals:
1. Warmly introduce yourself from ${brandName}.
2. Verify their current growth challenges and social media / marketing pipeline goals.
3. Invite them to lock in a dedicated 15-minute Discovery Consultation with the founder/head of strategy.
4. If they agree, confirm their preferred time or state that our instant booking link is being sent to their WhatsApp/Email.`;

  // Realistic Simulation Mode if VAPI keys are not configured yet
  if (!apiKey || !phoneNumberId) {
    console.log(`[Vapi Simulator] Initiating simulated voice call to ${phone} for lead ${leadName} (${leadId})`);
    const simCallId = `sim_call_${Date.now()}`;
    
    // Log call into lead metadata
    const lead = await getLeadById(leadId, userId);
    if (lead) {
      const currentLogs: VoiceCallLog[] = lead.metadata?.callLogs || [];
      const newLog: VoiceCallLog = {
        callId: simCallId,
        timestamp: new Date().toISOString(),
        status: "initiated",
        summary: `Automated outbound qualification call dispatched to ${phone}. AI Persona: Alex (${brandName}).`,
      };
      await updateLead(
        leadId,
        {
          metadata: {
            ...lead.metadata,
            callLogs: [newLog, ...currentLogs],
          },
        },
        userId
      );
    }

    return {
      success: true,
      callId: simCallId,
      message: `Simulated call successfully queued for ${leadName} (${phone}) using voice persona '${brandName} Voice AI'.`,
      provider: "simulator",
    };
  }

  // Real Vapi.ai API call
  try {
    const res = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumberId,
        assistantId: assistantId || undefined,
        customer: {
          number: phone,
          name: leadName,
        },
        assistant: assistantId
          ? undefined
          : {
              firstMessage: `Hi ${leadName}, this is Alex from ${brandName}. I saw you reached out regarding our growth automation platform. Do you have a quick 2 minutes?`,
              model: {
                provider: "openai",
                model: "gpt-4o-mini",
                messages: [
                  {
                    role: "system",
                    content: systemPrompt,
                  },
                ],
              },
              voice: {
                provider: "playht",
                voiceId: "s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json",
              },
            },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Vapi API returned ${res.status}`);
    }

    const callId = data.id || data.callId;

    // Log call
    const lead = await getLeadById(leadId, userId);
    if (lead) {
      const currentLogs: VoiceCallLog[] = lead.metadata?.callLogs || [];
      const newLog: VoiceCallLog = {
        callId,
        timestamp: new Date().toISOString(),
        status: "initiated",
        summary: `Vapi.ai outbound call initiated (Call ID: ${callId}).`,
      };
      await updateLead(
        leadId,
        {
          metadata: {
            ...lead.metadata,
            callLogs: [newLog, ...currentLogs],
          },
        },
        userId
      );
    }

    return {
      success: true,
      callId,
      message: `Vapi call initiated successfully to ${phone}.`,
      provider: "vapi",
    };
  } catch (error: any) {
    console.error("Vapi call error:", error);
    return {
      success: false,
      message: error.message || "Failed to initiate Vapi outbound call",
      provider: "vapi",
    };
  }
}
