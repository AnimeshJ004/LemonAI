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
  provider: "TOGETHER_FLUX" | "DIRECT_FLUX_AI";
  latencyMs: number;
}

/**
 * AI Image Generation Service
 * Priority 1: Together.ai FLUX.1-schnell-Free (high quality, free API)
 * Priority 2: Pollinations.ai FLUX (public, no key needed, fallback)
 */
export async function generateAdCreativeImage(
  options: GenerateImageOptions
): Promise<GeneratedImageResult> {
  const startTime = Date.now();
  const aspectRatio = options.aspectRatio || "1:1";

  // Strip command phrases from prompt
  const cleanPrompt = options.prompt
    .replace(/generate\s+(a\s+)?(post|image|picture|photo|ad|creative|banner|reel|video)\s+(for|about|of|related\s+to)?/gi, "")
    .replace(/attach\s+(this|image|it|photo)\s+(in|to)?\s+(the\s+)?(post)?/gi, "")
    .replace(/with\s+best\s+caption.*/gi, "")
    .replace(/schedule\s+(in|for|at|on)?\s+.*/gi, "")
    .replace(/to(da)?t\s+at\s+.*/gi, "")
    .replace(/tomorrow\s+at\s+.*/gi, "")
    .trim() || options.prompt.trim();

  // Strict photorealism engineering — no anime, no CGI, no doll face
  const polishedPrompt = `Professional commercial editorial photograph of ${cleanPrompt}, realistic authentic human features, natural ambient workplace lighting, 8k resolution, shot on 35mm Hasselblad lens, photorealistic documentary realism, sharp focus, rich authentic color grading, strictly photorealistic, no cartoon, no anime, no CGI, no 3D render, no gaming character, highly detailed`;

  const dimensions: Record<ImageAspectRatio, { width: number; height: number }> = {
    "1:1":  { width: 1024, height: 1024 },
    "9:16": { width: 768,  height: 1344 },
    "16:9": { width: 1344, height: 768  },
    "4:5":  { width: 896,  height: 1120 },
  };
  const { width, height } = dimensions[aspectRatio];

  // ─── Priority 1: Together.ai FLUX.1-schnell-Free ─────────────────────────
  const togetherKey = process.env.TOGETHER_API_KEY;
  if (togetherKey) {
    try {
      const res = await fetch("https://api.together.xyz/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${togetherKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "black-forest-labs/FLUX.1-schnell-Free",
          prompt: polishedPrompt,
          width,
          height,
          steps: 4,
          n: 1,
          response_format: "url",
        }),
      });

      if (res.ok) {
        const data = await res.json() as { data?: { url?: string }[] };
        const imageUrl = data?.data?.[0]?.url ?? null;
        if (imageUrl) {
          return {
            success: true,
            imageUrl,
            storageKey: `creatives/${options.userId || "auto"}/${Date.now()}.webp`,
            aspectRatio,
            prompt: polishedPrompt,
            provider: "TOGETHER_FLUX",
            latencyMs: Date.now() - startTime,
          };
        }
      } else {
        const errText = await res.text();
        console.warn("[Image] Together.ai failed:", res.status, errText);
      }
    } catch (err) {
      console.warn("[Image] Together.ai error:", err);
    }
  }

  // ─── Priority 2: Pollinations.ai with API Key (gen.pollinations.ai FLUX) ───
  const pollinationsKey = process.env.POLLINATIONS_API_KEY;
  if (pollinationsKey) {
    try {
      const pUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(polishedPrompt)}?model=flux&width=${width}&height=${height}&key=${pollinationsKey}&nologo=true`;
      const pRes = await fetch(pUrl, { method: "HEAD" });
      if (pRes.ok) {
        return {
          success: true,
          imageUrl: pUrl,
          storageKey: `creatives/${options.userId || "auto"}/${Date.now()}.webp`,
          aspectRatio,
          prompt: polishedPrompt,
          provider: "DIRECT_FLUX_AI",
          latencyMs: Date.now() - startTime,
        };
      } else {
        console.warn("[Image] Pollinations API key response status:", pRes.status);
      }
    } catch (err) {
      console.warn("[Image] Pollinations API error:", err);
    }
  }

  // ─── Priority 3: Pollinations Public Endpoint (Fallback) ──────────────────
  const encodedPrompt = encodeURIComponent(polishedPrompt);
  const seed = Math.floor(Math.random() * 1_000_000);
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;


  return {
    success: true,
    imageUrl: pollinationsUrl,
    storageKey: `creatives/${options.userId || "auto"}/${Date.now()}-${seed}.webp`,
    aspectRatio,
    prompt: polishedPrompt,
    provider: "DIRECT_FLUX_AI",
    latencyMs: Date.now() - startTime,
  };
}
