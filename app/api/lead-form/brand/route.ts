import { NextRequest, NextResponse } from "next/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get("user");
  if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 400 });

  try {
    const admin = getInsforgeAdminClient();
    const { data } = await admin.database
      .from("brand_profiles")
      .select("business_name, niche, main_offer, brand_tone")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return NextResponse.json({});
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({});
  }
}
