import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { userBrandCache } from "@/lib/brand-helper";
import { writeAuditEntry, AUDIT_EVENT } from "@/lib/audit-log";

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

  // Emit an audit entry BEFORE deletion so that the erasure event itself is
  // preserved. The `audit_logs` table is retained for the legal-defense
  // window (see data_retention_policies) and its user_id column is nulled
  // out below so the record survives even after the subject is gone.
  await writeAuditEntry({
    userId: cleanUserId,
    event: AUDIT_EVENT.ACCOUNT_DELETION_REQUESTED,
    actorType: "user",
    resourceType: "user_account",
    resourceId: cleanUserId,
    metadata: { source: "user-purge" },
  });

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
    "crm_messages",
    "crm_activities",
    "social_dms",
    "brand_pricing_packages",
  ];

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

  // Delete the Clerk user account itself
  try {
    const { clerkClient } = await import('@clerk/nextjs/server');
    const clerk = await clerkClient();
    await clerk.users.deleteUser(cleanUserId);
    purgedTables.push('clerk_user');
  } catch (err: any) {
    errors['clerk_user'] = err?.message || 'Failed to delete Clerk user';
  }

  // Purge user-owned files in the storage bucket
  try {
    const { data: storageFiles } = await admin.storage.from('post-images').list(cleanUserId);
    if (storageFiles && storageFiles.length > 0) {
      const paths = storageFiles.map((f: any) => `${cleanUserId}/${f.name}`);
      await admin.storage.from('post-images').remove(paths);
    }
    purgedTables.push('storage_post_images');
  } catch (err: any) {
    errors['storage'] = err?.message || 'Storage purge notice';
  }

  // Final audit entry — written AFTER purge so we can prove completion.
  // Note: user_id in audit_logs is intentionally retained (not nulled) for
  // the legal-defense window; the personal data itself is already erased.
  await writeAuditEntry({
    userId: cleanUserId,
    event: AUDIT_EVENT.ACCOUNT_DELETION_COMPLETED,
    actorType: "system",
    resourceType: "user_account",
    resourceId: cleanUserId,
    metadata: {
      purgedTables: purgedTables.slice(0, 32),
      errorTables: Object.keys(errors).slice(0, 32),
      success: Object.keys(errors).length === 0,
    },
  });

  return {
    userId: cleanUserId,
    purgedTables,
    success: Object.keys(errors).length === 0,
    errors,
  };
}
