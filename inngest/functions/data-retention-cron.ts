import { inngest } from "../client";
import { enforceRetentionPolicies } from "@/lib/data-retention";

/**
 * Data Retention Cron
 *
 * Enforces every active row in `data_retention_policies` once per day at
 * 03:00 UTC. The engine itself is env-gated (DATA_RETENTION_ENABLED=true),
 * so simply deploying this file is safe — retention only fires when opted in.
 *
 * Rationale for the 03:00 UTC slot:
 *   • Off-peak in most tenant timezones (India, EU, US).
 *   • Well after typical scheduled-post windows finish.
 *   • Coincides with lowest AI-router traffic.
 */
export const dataRetentionCron = inngest.createFunction(
  {
    id: "data-retention-cron",
    name: "Data Retention Enforcement (GDPR / DPDP)",
    triggers: [
      {
        cron: "0 3 * * *",
      },
    ],
  },
  async ({ step, logger }) => {
    const result = await step.run("enforce-retention-policies", async () => {
      return enforceRetentionPolicies({ dryRun: false });
    });

    if (!result.enabled) {
      logger.info(
        "[Retention Cron] DATA_RETENTION_ENABLED is not 'true' — skipping. Set the env variable to activate."
      );
      return { skipped: true, reason: "disabled" };
    }

    logger.info("[Retention Cron] Run complete", {
      totalDeleted: result.totalDeleted,
      tableCount: result.results.length,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
    });

    return {
      skipped: false,
      totalDeleted: result.totalDeleted,
      results: result.results.map((r) => ({
        table: r.tableName,
        deleted: r.deletedCount,
        skipped: r.skipped,
        skipReason: r.skipReason,
      })),
    };
  }
);
