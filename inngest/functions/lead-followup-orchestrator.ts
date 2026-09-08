import { inngest } from "../client";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { sendWhatsAppMessage } from "@/lib/whatsapp-client";
import { triggerOutboundQualificationCall } from "@/lib/vapi-client";
import { getBrandProfileForUser } from "@/lib/brand-helper";
import { updateLead, Lead } from "@/lib/crm-service";

/**
 * Autonomous Lead Follow-Up Drip Engine
 * Runs periodically to ensure zero leads are dropped:
 * 1. Checks for unbooked leads created > 20 mins ago without follow-up
 * 2. Sends personalized WhatsApp message with the brand's verified booking URL
 * 3. Dispatches AI Voice Qualification Call if intent score >= 7 and auto-call is active
 */
export const leadFollowupOrchestrator = inngest.createFunction(
  {
    id: "lead-followup-orchestrator",
    name: "Autonomous Lead Follow-Up & Voice Drip",
    triggers: [
      {
        cron: "*/15 * * * *", // Runs every 15 minutes
      },
    ],
  },
  async ({ step, logger }) => {
    const admin = getInsforgeAdminClient();

    // 1. Identify unbooked leads needing follow-up
    const eligibleLeads = await step.run("load-unbooked-leads", async () => {
      const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

      const { data: leads, error } = await admin.database
        .from("leads")
        .select("*")
        .in("stage", ["new", "contacted"])
        .lte("created_at", twentyMinsAgo)
        .gte("created_at", threeDaysAgo)
        .limit(25);

      if (error) {
        logger.error("Failed to load leads for follow-up", { error });
        return [];
      }

      // Filter leads that have already received maximum follow-ups (max 2)
      return (leads || []).filter((lead: any) => {
        const followups = lead.metadata?.followup_count || 0;
        const lastFollowup = lead.metadata?.last_followup_at;
        if (followups >= 2) return false;
        if (lastFollowup) {
          const hoursSinceLast = (Date.now() - new Date(lastFollowup).getTime()) / (1000 * 60 * 60);
          return hoursSinceLast >= 20; // At least 20 hours between follow-ups
        }
        return true;
      });
    });

    if (eligibleLeads.length === 0) {
      return { processed: 0, message: "No unbooked leads pending follow-up" };
    }

    logger.info(`[Follow-Up Engine] Processing ${eligibleLeads.length} leads for autonomous follow-up`);

    let followedUpCount = 0;
    let callsDispatched = 0;

    for (const lead of eligibleLeads) {
      await step.run(`followup-lead-${lead.id}`, async () => {
        const brand = await getBrandProfileForUser(lead.user_id);
        const brandName = brand?.business_name || "Our Team";
        const bookingUrl = brand?.booking_url || "";
        const leadName = lead.name || "there";

        // Step A: Send WhatsApp Follow-up if phone exists
        if (lead.phone) {
          const followUpMessage = bookingUrl
            ? `Hi ${leadName}! 👋 This is the concierge at ${brandName}. We noticed you were interested in our services. You can select a dedicated 15-min consultation time here: ${bookingUrl}\n\nLet us know if you have any questions!`
            : `Hi ${leadName}! 👋 Following up from ${brandName}. How can our team best assist you with your goals this week? Feel free to reply here anytime!`;

          await sendWhatsAppMessage({
            to: lead.phone,
            text: followUpMessage,
          }).catch((err) => logger.warn("WhatsApp follow-up notice:", { err }));
        }

        // Step B: Dispatch AI Voice Call if score >= 7 and auto-calling is enabled
        const autoCallThreshold = brand?.auto_call_min_score ?? 7;
        const shouldCall =
          Boolean(brand?.auto_call_enabled) &&
          (lead.score || 0) >= autoCallThreshold &&
          Boolean(lead.phone) &&
          !lead.metadata?.callLogs?.length;

        if (shouldCall && lead.phone) {
          try {
            await triggerOutboundQualificationCall({
              leadId: lead.id,
              leadName,
              phone: lead.phone,
              userId: lead.user_id,
              contextNotes: `Autonomous follow-up trigger: Lead expressed interest but has not booked a consultation yet.`,
            });
            callsDispatched++;
          } catch (callErr) {
            logger.warn("Voice call dispatch notice:", { callErr });
          }
        }

        // Step C: Update Lead Metadata
        const currentCount = lead.metadata?.followup_count || 0;
        await updateLead(
          lead.id,
          {
            stage: "contacted",
            metadata: {
              ...lead.metadata,
              followup_count: currentCount + 1,
              last_followup_at: new Date().toISOString(),
              auto_followup_dispatched: true,
            },
          },
          lead.user_id
        );

        followedUpCount++;
      });
    }

    return {
      processed: eligibleLeads.length,
      followedUpCount,
      callsDispatched,
      message: `Completed autonomous follow-ups for ${followedUpCount} leads`,
    };
  }
);
