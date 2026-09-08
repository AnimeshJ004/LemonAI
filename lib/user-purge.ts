import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { userBrandCache } from "@/lib/brand-helper";

export interface PurgeResult {
  userId: string;
  purgedTables: string[];
  success: boolean;
  errors: Record<string, string>;
}

/**
 * Permanently purges all user data across the entire database.
 * Enforces GDPR/DPDP "Right to Erasure" when an account is deleted.
 */
export async function purgeAllUserData(userId: string): Promise<PurgeResult> {
  if (!userId || !userId.trim()) {
    return { userId, purgedTables: [], success: false, errors: { init: "Invalid userId" } };
  }

  const cleanUserId = userId.trim();
  const admin = getInsforgeAdminClient();
  const purgedTables: string[] = [];
  const errors: Record<string, string> = {};

  // List of all tables storing user data by user_id column
  const tablesToPurge = [
    "scheduled_posts",
    "user_channels",
    "brand_profiles",
    "leads",
    "crm_conversations",
    "meta_campaigns",
    "competitor_researches",
    "flywheel_executions",
    "ai_memory",
    "ideas",
    "social_comments",
  ];

  console.log(`[User Purge] Starting complete data wipe for user: ${cleanUserId}`);

  for (const table of tablesToPurge) {
    try {
      const { error } = await admin.database
        .from(table)
        .delete()
        .eq("user_id", cleanUserId);

      if (error) {
        // Log notice if table does not exist or column mismatch
        errors[table] = error.message;
        console.warn(`[User Purge] Notice wiping ${table}:`, error.message);
      } else {
        purgedTables.push(table);
      }
    } catch (err: any) {
      errors[table] = err?.message || "Unknown error";
    }
  }

  // Clear in-memory server cache
  userBrandCache.delete(cleanUserId);

  console.log(`[User Purge] Finished data wipe for user ${cleanUserId}. Purged ${purgedTables.length} tables.`);

  return {
    userId: cleanUserId,
    purgedTables,
    success: Object.keys(errors).length === 0,
    errors,
  };
}
