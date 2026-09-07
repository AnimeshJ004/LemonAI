import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchTrendingMetaAds } from "@/lib/meta-ads-library";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { niche, country } = body;

  if (!niche) return NextResponse.json({ error: "niche is required" }, { status: 400 });

  const ads = await fetchTrendingMetaAds({
    niche,
    country: country || "IN",
    userId,
  });

  return NextResponse.json({ success: true, ads });
}
