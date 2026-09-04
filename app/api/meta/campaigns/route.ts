import { getInsforgeServerClient, getInsforgeAdminClient } from "@/lib/insforge-server";
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

    return NextResponse.json({
      campaigns: campaigns || [],
      success: true,
    });
  } catch (error: any) {
    console.warn("Error fetching campaigns:", error?.message);
    return NextResponse.json({ campaigns: [], success: false });
  }
}
