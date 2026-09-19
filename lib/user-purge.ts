import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { userBrandCache } from "@/lib/brand-helper";
import { writeAuditEntry, AUDIT_EVENT } from "@/lib/audit-log";

/**
 * User Data Purge Service
 *
 * Cascades a permanent deletion across every user-keyed table plus the
 * user's storage bucket folder plus the Clerk user record. Called on:
 *   • `DELETE /api/user/delete-account` (user-initiated erasure)
 *   • Clerk `user.deleted` webhook (external deletion, e.g. via dashboard)
 *
 * GDPR Art. 17 / DPDP Sec. 12 (Right to erasure).
 *
 * Design guarantees:
 *   • Emits an ACCOUNT_DELETION_REQUESTED audit entry BEFORE any deletion, so
 *     the erasure event survives even after the subject data is gone.
 *   • Emits an ACCOUNT_DELETION_COMPLETED audit entry AFTER, retained for
 *     the 6-year legal-defense window (see data_retention_policies).
 *   • Never throws — every failure is captured in `errors[table]` and the
 *     caller decides how to surface it.
 */

export interface PurgeResult {
  userId: string;
  purgedTables: string[];
  success: boolean;
  errors: Record<string, string>;
}

interface StorageFileEntry {
  name: string;
}

// Every user-keyed table the purge must cascade. Order is not significant
// because Supabase deletes are independent per-table.
const TABLES_TO_PURGE = [
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
] as const;

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
  // window (see data_retention_policies).
  await writeAuditEntry({
    userId: cleanUserId,
    event: AUDIT_EVENT.ACCOUNT_DELETION_REQUESTED,
    actorType: "user",
    resourceType: "user_account",
    resourceId: cleanUserId,
    metadata: { source: "user-purge" },
  });

  for (const table of TABLES_TO_PURGE) {
    try {
      const { error } = await admin.database
        .from(table)
        .delete()
        .eq("user_id", cleanUserId);

      if (error) {
        errors[table] = error.message;
        console.warn(`[User Purge] Notice wiping ${table}:`, error.message);
      } else {
        purgedTables.push(table);
      }
    } catch (err: unknown) {
      errors[table] = err instanceof Error ? err.message : "Unknown error";
    }
  }

  // Clear in-memory server cache
  userBrandCache.delete(cleanUserId);

  // Delete the Clerk user account itself
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const clerk = await clerkClient();
    await clerk.users.deleteUser(cleanUserId);
    purgedTables.push("clerk_user");
  } catch (err: unknown) {
    errors["clerk_user"] =
      err instanceof Error ? err.message : "Failed to delete Clerk user";
  }

  // Purge user-owned files in the storage bucket
  try {
    const { data: storageFiles } = await admin.storage
      .from("post-images")
      .list(cleanUserId);
    const files = (storageFiles ?? []) as StorageFileEntry[];
    if (files.length > 0) {
      const paths = files.map((f) => `${cleanUserId}/${f.name}`);
      await admin.storage.from("post-images").remove(paths);
    }
    purgedTables.push("storage_post_images");
  } catch (err: unknown) {
    errors["storage"] =
      err instanceof Error ? err.message : "Storage purge notice";
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
