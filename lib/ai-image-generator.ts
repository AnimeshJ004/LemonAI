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
  provider:
    | "REPLICATE_FLUX_1"
    | "TOGETHER_FLUX"
    | "DIRECT_FLUX_AI"
    | "GOOGLE_IMAGEN_3"
    | "CURATED_EDITORIAL_PHOTOGRAPHY";
  latencyMs: number;
}

export interface GeneratedVideoResult {
  success: boolean;
  videoUrl: string | null;
  storageKey?: string;
  prompt: string;
  provider: "REPLICATE_WAN_2_2" | "REPLICATE_WAN_2_1" | "CURATED_VIDEO_REEL";
  latencyMs: number;
}

/**
 * Clean user command terms and condition prompt for ultra-realistic commercial photography
 */
function buildPhotorealisticPrompt(rawPrompt: string, niche?: string): string {
  const cleaned = rawPrompt
    .replace(/generate\s+(a\s+)?(post|image|picture|photo|ad|creative|banner|reel|video)\s+(for|about|of|related\s+to)?/gi, "")
    .replace(/attach\s+(this|image|it|photo)\s+(in|to)?\s+(the\s+)?(post)?/gi, "")
    .replace(/with\s+best\s+caption.*/gi, "")
    .replace(/schedule\s+(in|for|at|on)?\s+.*/gi, "")
    .replace(/to(da)?t\s+at\s+.*/gi, "")
    .replace(/tomorrow\s+at\s+.*/gi, "")
    .replace(/[#@]/g, "")
    .trim();

  const subject = cleaned || (niche ? `professional ${niche} business context` : "modern professional business environment");

  // Strict commercial DSLR documentary conditioning - eliminates cartoon/anime/CGI
  return `Authentic commercial documentary photograph of ${subject}. Shot on 35mm lens, f/2.8, natural daylight, sharp focus, hyperrealistic human skin textures, cinematic lighting, corporate professional editorial aesthetic. Award-winning commercial photography, zero 3D render, zero CGI, zero cartoon, zero anime.`;
}

/**
 * Poll Replicate prediction until completion
 */
async function pollReplicatePrediction(predictionUrl: string, apiToken: string, maxWaitMs = 120000): Promise<any> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const res = await fetch(predictionUrl, {
      headers: {
        Authorization: `Bearer ${apiToken.trim()}`,
      },
    });
    if (!res.ok) {
      throw new Error(`Replicate poll failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    if (data.status === "succeeded") {
      return data;
    }
    if (data.status === "failed" || data.status === "canceled") {
      throw new Error(`Replicate prediction ${data.status}: ${data.error || "Unknown error"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("Replicate prediction timed out");
}

/**
 * Curated High-Definition Commercial Photography Database (Emergency Safe Fallback)
 */
const CURATED_COMMERCIAL_PHOTOS: Record<string, string[]> = {
  business: [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80",
  ],
  marketing: [
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=80",
  ],
  tech: [
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80",
  ],
  teamwork: [
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
  ],
  default: [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80",
  ],
};

const CURATED_VERTICAL_REELS: string[] = [
  "https://assets.mixkit.co/videos/preview/mixkit-young-woman-working-with-a-laptop-in-an-office-42790-large.mp4",
  "https://assets.mixkit.co/videos/preview/mixkit-group-of-diverse-people-having-a-business-meeting-42777-large.mp4",
  "https://assets.mixkit.co/videos/preview/mixkit-man-working-on-a-laptop-in-a-coffee-shop-42784-large.mp4",
];

/**
 * Generate Ultra-Realistic Commercial Ad Creative Image
 * Priority order:
 * 1. Replicate FLUX.1 (if REPLICATE_API_TOKEN is available)
 * 2. Together.ai FLUX.1 (if TOGETHER_API_KEY is available)
 * 3. Pollinations.ai FLUX with API Key (if POLLINATIONS_API_KEY is available)
 * 4. Pollinations.ai Public FLUX endpoint
 * 5. Curated Commercial Photography Fallback
 */
export async function generateAdCreativeImage(
  options: GenerateImageOptions
): Promise<GeneratedImageResult> {
  const startTime = Date.now();
  const aspectRatio = options.aspectRatio || "1:1";
  const photorealisticPrompt = buildPhotorealisticPrompt(options.prompt, options.niche);

  const dimensions: Record<ImageAspectRatio, { width: number; height: number }> = {
    "1:1":  { width: 1024, height: 1024 },
    "9:16": { width: 768,  height: 1344 },
    "16:9": { width: 1344, height: 768  },
    "4:5":  { width: 896,  height: 1120 },
  };
  const { width, height } = dimensions[aspectRatio] || { width: 1024, height: 1024 };

  // ─── Priority 1: Replicate FLUX.1 ────────────────────────────────────────
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (replicateToken && replicateToken.trim()) {
    try {
      const fluxAspectRatio =
        aspectRatio === "9:16" ? "9:16" :
        aspectRatio === "16:9" ? "16:9" :
        aspectRatio === "4:5" ? "4:5" : "1:1";

      const createRes = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${replicateToken.trim()}`,
          "Content-Type": "application/json",
          Prefer: "wait=60",
        },
        body: JSON.stringify({
          input: {
            prompt: photorealisticPrompt,
            aspect_ratio: fluxAspectRatio,
            output_format: "webp",
            output_quality: 90,
            num_outputs: 1,
            disable_safety_checker: false,
          },
        }),
      });

      if (createRes.ok) {
        let prediction = await createRes.json();
        if (prediction.status !== "succeeded" && prediction.urls?.get) {
          prediction = await pollReplicatePrediction(prediction.urls.get, replicateToken);
        }

        const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        if (outputUrl) {
          return {
            success: true,
            imageUrl: outputUrl,
            storageKey: `flux-${prediction.id || Date.now()}`,
            aspectRatio,
            prompt: options.prompt,
            provider: "REPLICATE_FLUX_1",
            latencyMs: Date.now() - startTime,
          };
        }
      }
    } catch (err) {
      console.warn("[Image Engine] Replicate FLUX.1 attempt notice:", err);
    }
  }

  // ─── Priority 2: Together.ai FLUX.1-schnell-Free ─────────────────────────
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
          prompt: photorealisticPrompt,
          width,
          height,
          steps: 4,
          n: 1,
          response_format: "url",
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { data?: { url?: string }[] };
        const imageUrl = data?.data?.[0]?.url ?? null;
        if (imageUrl) {
          return {
            success: true,
            imageUrl,
            storageKey: `creatives/${options.userId || "auto"}/${Date.now()}.webp`,
            aspectRatio,
            prompt: photorealisticPrompt,
            provider: "TOGETHER_FLUX",
            latencyMs: Date.now() - startTime,
          };
        }
      }
    } catch (err) {
      console.warn("[Image Engine] Together.ai attempt notice:", err);
    }
  }

  // ─── Priority 3: Pollinations.ai with API Key (gen.pollinations.ai FLUX) ───
  const pollinationsKey = process.env.POLLINATIONS_API_KEY;
  if (pollinationsKey) {
    try {
      const pUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(photorealisticPrompt)}?model=flux&width=${width}&height=${height}&key=${pollinationsKey}&nologo=true`;
      const pRes = await fetch(pUrl, { method: "HEAD" });
      if (pRes.ok) {
        return {
          success: true,
          imageUrl: pUrl,
          storageKey: `creatives/${options.userId || "auto"}/${Date.now()}.webp`,
          aspectRatio,
          prompt: photorealisticPrompt,
          provider: "DIRECT_FLUX_AI",
          latencyMs: Date.now() - startTime,
        };
      }
    } catch (err) {
      console.warn("[Image Engine] Pollinations API attempt notice:", err);
    }
  }

  // ─── Priority 4: Pollinations Public Endpoint ─────────────────────────────
  try {
    const encodedPrompt = encodeURIComponent(photorealisticPrompt);
    const seed = Math.floor(Math.random() * 1_000_000);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

    return {
      success: true,
      imageUrl: pollinationsUrl,
      storageKey: `creatives/${options.userId || "auto"}/${Date.now()}-${seed}.webp`,
      aspectRatio,
      prompt: options.prompt,
      provider: "DIRECT_FLUX_AI",
      latencyMs: Date.now() - startTime,
    };
  } catch (pubErr) {
    console.warn("[Image Engine] Pollinations public attempt notice:", pubErr);
  }

  // ─── Priority 5: Safe Fallback (Curated Commercial Photography) ────────────
  const lowerPrompt = options.prompt.toLowerCase();
  let selectedCategory = "default";
  if (lowerPrompt.includes("market") || lowerPrompt.includes("growth") || lowerPrompt.includes("ad")) {
    selectedCategory = "marketing";
  } else if (lowerPrompt.includes("tech") || lowerPrompt.includes("software") || lowerPrompt.includes("code")) {
    selectedCategory = "tech";
  } else if (lowerPrompt.includes("team") || lowerPrompt.includes("office") || lowerPrompt.includes("collaborat")) {
    selectedCategory = "teamwork";
  } else if (lowerPrompt.includes("business") || lowerPrompt.includes("client")) {
    selectedCategory = "business";
  }

  const list = CURATED_COMMERCIAL_PHOTOS[selectedCategory] || CURATED_COMMERCIAL_PHOTOS.default;
  const selectedPhoto = list[Math.floor(Math.random() * list.length)];

  return {
    success: true,
    imageUrl: selectedPhoto,
    storageKey: `fallback-editorial-${Date.now()}`,
    aspectRatio,
    prompt: options.prompt,
    provider: "CURATED_EDITORIAL_PHOTOGRAPHY",
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Generate 9:16 Vertical Video Reel via Replicate (Wan 2.2 S2V / Wan 2.1)
 * Produces commercial cinematic video reels for Instagram Reels / Shorts / TikTok.
 */
export async function generateAdCreativeVideo(options: {
  prompt: string;
  userId?: string;
}): Promise<GeneratedVideoResult> {
  const startTime = Date.now();
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  const photorealisticPrompt = buildPhotorealisticPrompt(options.prompt);

  if (replicateToken && replicateToken.trim()) {
    // 1. Primary: Try Wan 2.2 S2V ($0.02/sec, 1080p Full HD)
    try {
      const wan22Res = await fetch("https://api.replicate.com/v1/models/alibaba-pai/wan-2.2-s2v/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${replicateToken.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            prompt: `Cinematic 9:16 vertical commercial video reel. ${photorealisticPrompt}. 1080p full HD, natural human physics, photorealistic cinematography.`,
            aspect_ratio: "9:16",
            duration: 5,
            resolution: "1080p",
          },
        }),
      });

      if (wan22Res.ok) {
        const initialPrediction = await wan22Res.json();
        if (initialPrediction.urls?.get) {
          const finished = await pollReplicatePrediction(initialPrediction.urls.get, replicateToken, 180000);
          const videoUrl = Array.isArray(finished.output) ? finished.output[0] : finished.output;
          if (videoUrl) {
            return {
              success: true,
              videoUrl,
              storageKey: `wan22-${finished.id || Date.now()}`,
              prompt: options.prompt,
              provider: "REPLICATE_WAN_2_2",
              latencyMs: Date.now() - startTime,
            };
          }
        }
      }
    } catch (err) {
      console.warn("[Replicate Video Engine] Wan 2.2 attempt notice:", err);
    }

    // 2. Secondary / Backup: Wan 2.1 1.3b
    try {
      const wan21Res = await fetch("https://api.replicate.com/v1/models/alibaba-pai/wan2.1-t2v-1.3b/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${replicateToken.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            prompt: `Cinematic 9:16 vertical commercial video reel. ${photorealisticPrompt}. High resolution, smooth natural camera motion, photorealistic cinematography.`,
            aspect_ratio: "9:16",
            duration: 5,
            resolution: "720p",
          },
        }),
      });

      if (wan21Res.ok) {
        const initialPrediction = await wan21Res.json();
        if (initialPrediction.urls?.get) {
          const finished = await pollReplicatePrediction(initialPrediction.urls.get, replicateToken, 180000);
          const videoUrl = Array.isArray(finished.output) ? finished.output[0] : finished.output;
          if (videoUrl) {
            return {
              success: true,
              videoUrl,
              storageKey: `wan21-${finished.id || Date.now()}`,
              prompt: options.prompt,
              provider: "REPLICATE_WAN_2_1",
              latencyMs: Date.now() - startTime,
            };
          }
        }
      }
    } catch (err) {
      console.warn("[Replicate Video Engine] Wan 2.1 fallback notice:", err);
    }
  }

  // Fallback vertical reel
  const randomReel = CURATED_VERTICAL_REELS[Math.floor(Math.random() * CURATED_VERTICAL_REELS.length)];

  return {
    success: true,
    videoUrl: randomReel,
    storageKey: `fallback-reel-${Date.now()}`,
    prompt: options.prompt,
    provider: "CURATED_VIDEO_REEL",
    latencyMs: Date.now() - startTime,
  };
}
