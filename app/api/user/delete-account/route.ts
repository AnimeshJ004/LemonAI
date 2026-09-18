import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { purgeAllUserData } from "@/lib/user-purge";
import { reportError, logInfo } from "@/lib/observability";
import { writeAuditEntry, AUDIT_EVENT } from "@/lib/audit-log";

/**
 * DELETE /api/user/delete-account
 *
 * GDPR Art. 17 (Right to erasure) + DPDP Sec. 12 (Right to erasure).
 * Fully wipes:
 *   • Every user_id-keyed row across the DB (see lib/user-purge.ts)
 *   • The Clerk user profile
 *   • The user's private folder in the storage bucket
 *
 * An audit_logs entry is recorded BEFORE and AFTER the purge (user-purge.ts
 * emits both). A dsr_requests row is also created here for regulator evidence.
 */
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  logInfo("Account deletion initiated", { scope: "delete-account", userId });

  try {
    // Record the DSR request first so the compliance timeline survives even if
    // a later step (Clerk deletion, storage purge) fails part-way.
    try {
      const { getInsforgeAdminClient } = await import("@/lib/insforge-server");
      const admin = getInsforgeAdminClient();
      await admin.database.from("dsr_requests").insert({
        user_id: userId,
        request_type: "deletion",
        status: "processing",
        metadata: { source: "self-service" },
      });
    } catch {
      /* best-effort — do not block deletion on DSR record failure */
    }

    void writeAuditEntry({
      userId,
      event: AUDIT_EVENT.ACCOUNT_DELETION_REQUESTED,
      resourceType: "user_account",
      resourceId: userId,
      metadata: { entry: "api/user/delete-account" },
      ip,
      userAgent,
    });

    // 1. Purge all DB rows (user-purge writes its own audit entries).
    const purgeResult = await purgeAllUserData(userId);

    // 2. Belt-and-suspenders: also try to delete the Clerk user here in case
    //    the internal purge helper skipped it. Non-fatal if already gone.
    try {
      const client = await clerkClient();
      await client.users.deleteUser(userId);
    } catch (clerkErr) {
      await reportError(clerkErr, { scope: "delete-account.clerk", userId }, "warning");
    }

    // 3. Close out the DSR request as completed.
    try {
      const { getInsforgeAdminClient } = await import("@/lib/insforge-server");
      const admin = getInsforgeAdminClient();
      await admin.database
        .from("dsr_requests")
        .update({ status: "completed", fulfilled_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("request_type", "deletion")
        .eq("status", "processing");
    } catch {
      /* best-effort */
    }

    return NextResponse.json({
      success: true,
      message: "Your account and all associated data have been permanently erased.",
      purgedTables: purgeResult.purgedTables,
    });
  } catch (error) {
    await reportError(error, { scope: "delete-account", userId }, "error");
    return NextResponse.json(
      { error: "Failed to delete account. Please contact support." },
      { status: 500 }
    );
  }
}
