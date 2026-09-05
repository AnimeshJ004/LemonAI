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
  provider: "REPLICATE_FLUX_1" | "GOOGLE_IMAGEN_3" | "CURATED_EDITORIAL_PHOTOGRAPHY";
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
    .replace(/todat\s+at\s+.*/gi, "")
    .replace(/today\s+at\s+.*/gi, "")
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
    // Wait 1.5 seconds between polling checks
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("Replicate prediction timed out");
}

/**
 * Curated High-Definition Commercial Photography Database (Emergency Safe Fallback)
 * 100% Real Camera Photography (Zero anime, zero 3D) in case Replicate token runs out of credits
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
 * Generate Ultra-Realistic Commercial Ad Creative Image via Replicate (Flux.1)
 * Eliminates anime, cartoon, and 3D CGI styles.
 */
export async function generateAdCreativeImage(options: GenerateImageOptions): Promise<GeneratedImageResult> {
  const startTime = Date.now();
  const aspectRatio = options.aspectRatio || "1:1";
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  const photorealisticPrompt = buildPhotorealisticPrompt(options.prompt, options.niche);

  console.log("[Replicate Media Engine] Generating realistic photo with Flux.1:", {
    hasToken: Boolean(replicateToken),
    aspectRatio,
  });

  // 1. Generate via Replicate (Flux.1)
  if (replicateToken && replicateToken.trim()) {
    try {
      // Map aspect ratio for Flux (1:1, 16:9, 9:16, 4:5)
      const fluxAspectRatio =
        aspectRatio === "9:16" ? "9:16" :
        aspectRatio === "16:9" ? "16:9" :
        aspectRatio === "4:5" ? "4:5" : "1:1";

      const createRes = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${replicateToken.trim()}`,
          "Content-Type": "application/json",
          Prefer: "wait=60", // Ask Replicate to wait up to 60s for direct return
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

        // If not completed immediately, poll until done
        if (prediction.status !== "succeeded" && prediction.urls?.get) {
          prediction = await pollReplicatePrediction(prediction.urls.get, replicateToken);
        }

        const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        if (outputUrl) {
          console.log("[Replicate Media Engine] Successfully generated Flux.1 photo in", Date.now() - startTime, "ms");
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
      } else {
        const errText = await createRes.text();
        console.warn("[Replicate Media Engine] Flux request error:", createRes.status, errText);
      }
    } catch (err) {
      console.error("[Replicate Media Engine] Flux generation failed:", err);
    }
  }

  // 2. Safe Fallback: High-Definition Curated Commercial Photography
  // Ensures UI never breaks or displays broken image icons if API token is not yet provided
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
export async function generateAdCreativeVideo(options: { prompt: string; userId?: string }): Promise<GeneratedVideoResult> {
  const startTime = Date.now();
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  const photorealisticPrompt = buildPhotorealisticPrompt(options.prompt);

  console.log("[Replicate Video Engine] Generating 9:16 Video Reel with Wan 2.2 S2V...");

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
            console.log("[Replicate Video Engine] Successfully generated Wan 2.2 video reel!");
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
      } else {
        console.warn("[Replicate Video Engine] Wan 2.2 endpoint notice, attempting Wan 2.1 fallback...");
      }
    } catch (err) {
      console.warn("[Replicate Video Engine] Wan 2.2 attempt notice, attempting Wan 2.1 fallback:", err);
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
            console.log("[Replicate Video Engine] Successfully generated Wan 2.1 fallback video reel!");
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
      console.error("[Replicate Video Engine] Wan 2.1 fallback failed:", err);
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
