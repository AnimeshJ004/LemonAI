import { getInsforgeAdminClient } from "@/lib/insforge-server";

export type ImageAspectRatio = "1:1" | "9:16" | "16:9" | "4:5";

export interface GenerateImageOptions {
  prompt: string;
  aspectRatio?: ImageAspectRatio;
  userId?: string;
  niche?: string;
}

export interface GeneratedImageResult {
  success: boolean;
  imageUrl: string | null;
  storageKey?: string;
  aspectRatio: ImageAspectRatio;
  prompt: string;
  provider: "REPLICATE_FLUX" | "DIRECT_AI_FALLBACK";
  latencyMs: number;
}

/**
 * AI Creative & Banner Generation Service
 * Supports high-CTR advertising visual generation in 1:1, 9:16, and 16:9 formats.
 */
export async function generateAdCreativeImage(options: GenerateImageOptions): Promise<GeneratedImageResult> {
  const startTime = Date.now();
  const aspectRatio = options.aspectRatio || "1:1";
  const replicateToken = process.env.REPLICATE_API_TOKEN?.trim();

  // Clean user intent words and command phrases from image prompt
  const cleanPrompt = options.prompt
    .replace(/generate\s+(a\s+)?(post|image|picture|photo|ad|creative|banner|reel|video)\s+(for|about|of|related\s+to)?/gi, "")
    .replace(/attach\s+(this|image|it|photo)\s+(in|to)?\s+(the\s+)?(post)?/gi, "")
    .replace(/with\s+best\s+caption.*/gi, "")
    .replace(/schedule\s+(in|for|at|on)?\s+.*/gi, "")
    .replace(/todat\s+at\s+.*/gi, "")
    .replace(/today\s+at\s+.*/gi, "")
    .replace(/tomorrow\s+at\s+.*/gi, "")
    .trim() || options.prompt.trim();

  // Strict photorealism prompt engineering: authentic commercial photography, no anime, no gaming CGI
  const polishedPrompt = `Professional commercial editorial photograph of ${cleanPrompt}, realistic authentic human features, natural ambient workplace lighting, 8k resolution, shot on 35mm Hasselblad lens, photorealistic documentary realism, sharp focus, rich authentic color grading, strictly photorealistic, no cartoon, no anime, no CGI, no 3D render, no gaming character, highly detailed`;

  let rawImageUrl: string | null = null;
  let providerUsed: "REPLICATE_FLUX" | "DIRECT_AI_FALLBACK" = "DIRECT_AI_FALLBACK";

  // 1. Try Replicate Flux-Schnell if token is configured
  if (replicateToken && replicateToken.startsWith("r8_")) {
    try {
      const response = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${replicateToken}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          version: "black-forest-labs/flux-schnell",
          input: {
            prompt: polishedPrompt,
            aspect_ratio: aspectRatio,
            output_format: "webp",
            output_quality: 90,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Wait or read output URL
        if (data.output) {
          rawImageUrl = Array.isArray(data.output) ? data.output[0] : data.output;
          providerUsed = "REPLICATE_FLUX";
        }
      } else {
        const errText = await response.text();
        console.warn("[Replicate API] Notice:", errText);
      }
    } catch (repErr) {
      console.warn("[Replicate API] Failed, falling back to direct AI generation:", repErr);
    }
  }

  // 2. High-Quality Direct AI Fallback (Guarantees zero downtime even if client has no Replicate token)
  if (!rawImageUrl) {
    const dimensions = {
      "1:1": { width: 1024, height: 1024 },
      "9:16": { width: 768, height: 1344 },
      "16:9": { width: 1344, height: 768 },
      "4:5": { width: 896, height: 1120 },
    }[aspectRatio] || { width: 1024, height: 1024 };

    const encodedPrompt = encodeURIComponent(polishedPrompt);
    const seed = Math.floor(Math.random() * 1_000_000);
    rawImageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${dimensions.width}&height=${dimensions.height}&seed=${seed}&nologo=true&model=flux`;
    providerUsed = "DIRECT_AI_FALLBACK";
  }

  // 3. Download generated image & save permanently to InsForge Storage
  let finalStorageUrl = rawImageUrl;
  let storageKey: string | undefined = undefined;

  try {
    const imgRes = await fetch(rawImageUrl);
    if (imgRes.ok) {
      const buffer = await imgRes.arrayBuffer();
      const insforge = getInsforgeAdminClient();
      const userIdPrefix = options.userId ? `${options.userId}/` : "ai-creatives/";
      storageKey = `creatives/${userIdPrefix}${Date.now()}-${aspectRatio.replace(":", "-")}.webp`;

      const fileBlob = new Blob([buffer], { type: "image/webp" });
      const { data: uploadData, error: uploadErr } = await insforge.storage
        .from("lemon")
        .upload(storageKey, fileBlob);

      if (!uploadErr && uploadData?.url) {
        finalStorageUrl = uploadData.url;
      }
    }
  } catch (storageErr) {
    console.warn("[Storage Upload Notice] Using direct image URL:", storageErr);
  }

  return {
    success: Boolean(finalStorageUrl),
    imageUrl: finalStorageUrl,
    storageKey,
    aspectRatio,
    prompt: polishedPrompt,
    provider: providerUsed,
    latencyMs: Date.now() - startTime,
  };
}
