import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateAdCreativeImage, ImageAspectRatio } from "@/lib/ai-image-generator";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    });

    if (!imageResult.success || !imageResult.imageUrl) {
      return NextResponse.json(
        { error: "Failed to generate AI visual. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      image: {
        url: imageResult.imageUrl,
        key: imageResult.storageKey,
        aspectRatio: imageResult.aspectRatio,
        provider: imageResult.provider,
        latencyMs: imageResult.latencyMs,
      },
    });
  } catch (error: any) {
    console.error("[Generate Creative Image API Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
