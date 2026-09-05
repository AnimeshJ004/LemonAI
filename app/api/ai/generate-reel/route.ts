import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateVideoReel } from "@/lib/video-generator";
import type { GenerateReelOptions } from "@/lib/video-generator";

export const maxDuration = 120; // 2-minute timeout for video generation

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (!body.businessName || !body.niche) {
      return NextResponse.json(
        { error: "businessName and niche are required" },
        { status: 400 }
      );
    }

    const options: GenerateReelOptions = {
      businessName: String(body.businessName),
      niche: String(body.niche),
      offer: body.offer ? String(body.offer) : `Premium ${body.niche} services`,
      targetAudience: body.targetAudience ? String(body.targetAudience) : "adults 20-45",
      style: body.style || "product_promo",
      aspectRatio: body.aspectRatio || "9:16",
      durationSeconds: Number(body.durationSeconds) || 30,
      userId,
    };

    const result = await generateVideoReel(options);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to generate reel";
    console.error("[generate-reel] Error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
