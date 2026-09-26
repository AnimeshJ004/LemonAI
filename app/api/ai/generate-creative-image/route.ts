import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { generateAdCreativeImage, ImageAspectRatio } from "@/lib/ai-image-generator";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Image generation is expensive — cap per-user throughput.
    const limited = await enforceRateLimit(request, {
      limit: 15,
      windowMs: 60_000,
      namespace: "ai-image",
    });
    if (limited) return limited;

    const body = await request.json();
    const prompt = body.prompt?.trim();
    const aspectRatio: ImageAspectRatio = body.aspectRatio || "1:1";

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required to generate creative visual." },
        { status: 400 }
      );
    }

    const imageResult = await generateAdCreativeImage({
      prompt,
      aspectRatio,
      userId,
      niche: body.niche,
      brandProfile: body.brandProfile,
      numOutputs: body.numOutputs || 4, // Generate 4 images by default
    });

    if (!imageResult.success || !imageResult.imageUrls || imageResult.imageUrls.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate AI visual. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      images: imageResult.imageUrls.map((url, i) => ({
        url,
        key: `${imageResult.storageKey}-${i}`,
        aspectRatio: imageResult.aspectRatio,
        provider: imageResult.provider,
        latencyMs: imageResult.latencyMs,
      })),
    });
  } catch (error: any) {
    console.error("[Generate Creative Image API Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
