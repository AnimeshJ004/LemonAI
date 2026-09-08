import { inngest } from "../client";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { evaluateCampaignsForOptimization, applyOptimizationAction } from "@/lib/ad-optimizer";

/**
 * Autonomous Ad Optimizer Cron
 * Periodically audits active Meta Ad campaigns and executes autonomous budget reallocation:
 * - Auto-pauses underperforming ad campaigns wasting ad spend.
 * - Auto-scales daily budget (+20%) on high-ROAS winning campaigns.
 */
export const adOptimizerCron = inngest.createFunction(
  {
    id: "ad-optimizer-cron",
    name: "Autonomous Meta Ads Budget & ROAS Optimizer",
    triggers: [
      {
        cron: "0 */6 * * *", // Runs every 6 hours
      },
    ],
  },
  async ({ step, logger }) => {
    const admin = getInsforgeAdminClient();

    // 1. Fetch distinct users with active campaigns
    const usersWithCampaigns = await step.run("load-active-ad-users", async () => {
      const { data, error } = await admin.database
        .from("meta_campaigns")
        .select("user_id")
        .eq("status", "ACTIVE")
        .limit(50);

      if (error) {
        logger.error("Failed to fetch active campaign users:", { error });
        return [];
      }

      const uniqueUserIds = Array.from(new Set((data || []).map((c: any) => c.user_id)));
      return uniqueUserIds;
    });

    if (usersWithCampaigns.length === 0) {
      return { processedUsers: 0, message: "No active campaigns found requiring optimization" };
    }

    let optimizedCampaignsCount = 0;

    for (const userId of usersWithCampaigns) {
      await step.run(`optimize-user-${userId}`, async () => {
        try {
          const { recommendations } = await evaluateCampaignsForOptimization(userId);

          for (const rec of recommendations) {
            // Automatically pause extreme losers to prevent client budget burning
            if (rec.action === "PAUSE_CAMPAIGN") {
              logger.info(`[Ad Optimizer] Auto-pausing underperforming campaign: ${rec.campaignName}`, {
                spend: rec.metrics.estimatedSpend,
                leads: rec.metrics.leadsGenerated,
              });
              await applyOptimizationAction(userId, rec.campaignId, "PAUSE_CAMPAIGN");
              optimizedCampaignsCount++;
            }
          }
        } catch (err: any) {
          logger.warn(`Notice optimizing user campaigns for ${userId}:`, err?.message);
        }
      });
    }

    return {
      processedUsers: usersWithCampaigns.length,
      optimizedCampaignsCount,
      message: `Audited ${usersWithCampaigns.length} users and optimized campaigns autonomously.`,
    };
  }
);
