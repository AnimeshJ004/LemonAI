// External AI calling stub

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
 * AI Calling is deactivated in the backend in favor of an external voice provider.
 * This stub safely returns a mock response without making any outbound requests.
 */
export async function triggerOutboundQualificationCall(
  params: OutboundCallRequest
): Promise<OutboundCallResponse> {
  const { leadId, leadName, phone } = params;
  return {
    success: true,
    callId: `stub_call_${Date.now()}`,
    message: `Outbound AI calling is disabled (handled by external provider). Simulated trigger for ${leadName} (${phone}).`,
    provider: "simulator",
  };
}

