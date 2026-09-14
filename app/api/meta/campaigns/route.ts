import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getInsforgeAdminClient();
    const { data: campaigns, error } = await admin.database
      .from("meta_campaigns")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error && error.code !== "42P01") {
      console.warn("Notice querying meta_campaigns:", error.message);
    }

    // Detect sandbox mode: META_AD_ACCOUNT_ID must be set for live campaign creation
    const isSandbox = !process.env.META_AD_ACCOUNT_ID || process.env.META_AD_ACCOUNT_ID.trim() === "";

    return NextResponse.json({
      campaigns: campaigns || [],
      success: true,
      isSandbox,
      sandboxReason: isSandbox
        ? "META_AD_ACCOUNT_ID is not set. Campaign creates are saved to DB but not pushed to Meta. Set it in .env.local to go live."
        : null,
    });
  } catch (error: any) {
    console.warn("Error fetching campaigns:", error?.message);
    return NextResponse.json({ campaigns: [], success: false, isSandbox: true });
  }
}
