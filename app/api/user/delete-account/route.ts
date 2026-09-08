import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { purgeAllUserData } from "@/lib/user-purge";

/**
 * DELETE /api/user/delete-account
 * Allows an authenticated user to initiate account self-deletion,
 * wiping their Clerk user profile and all database records.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[Account Deletion API] Initiating self-deletion for user: ${userId}`);

    // 1. Wipe all records across the database tables
    const purgeResult = await purgeAllUserData(userId);

    // 2. Delete user from Clerk authentication
    try {
      const client = await clerkClient();
      await client.users.deleteUser(userId);
    } catch (clerkErr: any) {
      console.warn("[Account Deletion API] Notice deleting user from Clerk:", clerkErr?.message);
    }

    return NextResponse.json({
      success: true,
      message: "Your account and all associated data have been permanently erased.",
      purgedTables: purgeResult.purgedTables,
    });
  } catch (error: any) {
    console.error("[Account Deletion API] Error deleting account:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete account" },
      { status: 500 }
    );
  }
}
