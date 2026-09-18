import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { decrypt } from "@/lib/encryption";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cookie = request.cookies.get("lemon_meta_pending_selection")?.value;
    if (!cookie) {
      return NextResponse.json({ accounts: [] });
    }

    const decrypted = decrypt(cookie);
    if (!decrypted) {
      return NextResponse.json({ accounts: [] });
    }

    const parsed = JSON.parse(decrypted);
    if (parsed.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const safeAccounts = (parsed.accounts || []).map((acc: any) => ({
      providerAccountId: acc.providerAccountId,
      handle: acc.handle,
      profileImage: acc.profileImage || null,
      pageName: acc.pageName || "Facebook Page",
      pageId: acc.pageId || null,
    }));

    return NextResponse.json({
      accounts: safeAccounts,
      channelTypeId: parsed.channelTypeId,
    });
  } catch (error: any) {
    console.error("[Pending Accounts] Error:", error);
    return NextResponse.json({ error: "Failed to read pending accounts" }, { status: 500 });
  }
}
