import { getInsforgeAdminClient } from "@/lib/insforge-server";

export type ImageAspectRatio = "1:1" | "9:16" | "16:9" | "4:5";

export interface GenerateImageOptions {
  prompt: string;
  aspectRatio?: ImageAspectRatio;
  userId?: string;
  niche?: string;
  brandProfile?: any;
}

export interface GeneratedImageResult {
  success: boolean;
  imageUrl: string | null;
  storageKey?: string;
  aspectRatio: ImageAspectRatio;
  prompt: string;
  provider:
    | "REPLICATE_FLUX_1"
    | "CLOUDFLARE_WORKERS_AI"
    | "TOGETHER_FLUX"
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

function sanitizePhotorealisticPrompt(raw: string): string {
  // 1. Strip any anime, manga, cartoon, drawing, illustration words even if negated (FLUX has no negative prompt so tokens like 'anime' trigger anime aesthetics)
  let cleaned = raw
    .replace(/(no|zero|without|not|avoid|never|stop)\s+(anime|manga|cartoon|illustration|drawing|avatar|chibi|cgi|3d\s+render|comic)/gi, "")
    .replace(/\b(anime|manga|cartoon|illustration|drawing|sketch|avatar|chibi|cgi|3d\s+render|comic|pixar|disney)\b/gi, "")
    .replace(/["'“”]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // 2. Prepend strong photographic anchors
  if (!cleaned.toLowerCase().includes("photograph") && !cleaned.toLowerCase().includes("photo")) {
    cleaned = `Authentic raw color 35mm photograph of ${cleaned}`;
  }

  // 3. Append physical realism anchors
  cleaned += ", 35mm Hasselblad H6D-100c camera, 50mm f/1.8 lens, natural daylight, real skin texture with visible pores, real physical world, authentic editorial lighting, high resolution photography.";

  return cleaned;
}

/**
 * Creates an industry-level commercial art-directed photography prompt
 * strictly grounded in the user's specific Brand Profile details.
 */
async function buildBrandAlignedVisualPrompt(
  rawPrompt: string,
  brandProfile?: any,
  niche?: string
): Promise<string> {
  const brandName = brandProfile?.business_name || "";
  const brandNiche = brandProfile?.niche || niche || "";
  const products = brandProfile?.products_services || "";
  const offer = brandProfile?.main_offer || "";
  const audience = brandProfile?.target_audience || "";
  const tone = brandProfile?.brand_tone || "Modern, luxury, professional";

  const cleanedSubject = rawPrompt
    .replace(/generate\s+(a\s+)?(post|image|picture|photo|ad|creative|banner|reel|video)\s+(for|about|of|related\s+to)?/gi, "")
    .replace(/attach\s+(this|image|it|photo)\s+(in|to)?\s+(the\s+)?(post)?/gi, "")
    .replace(/with\s+best\s+caption.*/gi, "")
    .replace(/schedule\s+(in|for|at|on)?\s+.*/gi, "")
    .replace(/to(da)?t\s+at\s+.*/gi, "")
    .replace(/tomorrow\s+at\s+.*/gi, "")
    .replace(/[#@]/g, "")
    .trim();

  // Enhance using Groq AI when gateway is available
  try {
    const { callResilientCompletion } = await import("@/lib/ai-gateway");
    const aiRes = await callResilientCompletion<string>({
      messages: [
        {
          role: "system",
          content: `You are an award-winning commercial creative director for top-tier global brands and advertising agencies.
Your task is to write a single, ultra-realistic, real-world commercial photography visual prompt for FLUX.1 image generation.

Brand Profile:
- Brand Name: ${brandName || "Premium Brand"}
- Industry / Niche: ${brandNiche || "Modern Business"}
- Products / Services: ${products || offer || "High-end commercial offerings"}
- Target Audience: ${audience || "Discerning clients"}
- Brand Tone & Aesthetic: ${tone}

ART DIRECTION REQUIREMENTS:
1. Ground the visual scene directly in this brand's actual product, craftsmanship, service space, or refined customer lifestyle.
2. If products are featured: real physical commercial product photography, minimalist architectural table flatlay, warm directional studio lighting, crisp textures, soft reflections.
3. If services/spaces are featured: sleek modern architecture, high-end interior design, authentic luxury context.
4. If people are in the frame: real people, candid documentary capture, natural unairbrushed skin textures with visible pores, elegant posture.
5. NO TEXT, NO LOGOS, NO WATERMARKS in the scene.
6. Technical camera specs: "Hasselblad H6D-100c, 50mm f/1.8 lens, natural daylight, rich editorial color grading, 8k commercial photography".
7. CRITICAL: The visual MUST depict a real physical world photograph taken with a camera. Do NOT use terms like 'illustration', 'art', 'concept', or 'drawing'.

Output ONLY the final 2-3 sentence prompt. No markdown, quotes, or preambles.`,
        },
        {
          role: "user",
          content: `Topic / post visual idea: "${cleanedSubject || brandNiche || "Brand showcase"}"`,
        },
      ],
      temperature: 0.5,
      maxTokens: 180,
    });

    if (aiRes?.content && aiRes.content.trim().length > 25) {
      return sanitizePhotorealisticPrompt(aiRes.content);
    }
  } catch (err) {
    console.warn("[Image Engine] AI prompt enhancement notice:", err);
  }

  // Deterministic fallback
  const contextSubject = cleanedSubject || products || offer || brandNiche || "commercial showcase";
  return sanitizePhotorealisticPrompt(`Award-winning commercial editorial photograph of ${contextSubject}, reflecting ${brandName || "modern enterprise"} in ${brandNiche || "business"}. High-end ${tone.toLowerCase()} aesthetic, shot on Hasselblad 50mm f/1.8, soft diffused natural daylight, rich architectural materials, realistic textures, cinematic color grading`);
}

/**
 * Poll Replicate prediction until completion
 */
async function pollReplicatePrediction(predictionUrl: string, apiToken: string, maxWaitMs = 12000): Promise<any> {
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
export const CURATED_COMMERCIAL_PHOTOS: Record<string, string[]> = {
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

export const CURATED_VERTICAL_REELS: string[] = [
  "/videos/reel-1.mp4",
  "/videos/reel-2.mp4",
  "/videos/reel-3.mp4",
  "https://raw.githubusercontent.com/bower-media-samples/big-buck-bunny-1080p-30s/master/video.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://www.w3schools.com/html/mov_bbb.mp4",
];

/**
 * Generate Ultra-Realistic Commercial Ad Creative Image
 * Priority order:
 * 1. Replicate FLUX.1 (if REPLICATE_API_TOKEN is available)
 * 2. Cloudflare Workers AI FLUX.1 (if CLOUDFLARE_ACCOUNT_ID & CLOUDFLARE_API_TOKEN are available - 10,000 free neurons/day)
 * 3. Together.ai FLUX.1 (if TOGETHER_API_KEY is available)
 * 4. Curated Commercial Photography Fallback (Matched to brand industry & aesthetic)
 */
export async function generateAdCreativeImage(
  options: GenerateImageOptions
): Promise<GeneratedImageResult> {
  const startTime = Date.now();
  const aspectRatio = options.aspectRatio || "1:1";

  // Automatically fetch brand profile for user if not already provided
  let brandProfile = options.brandProfile;
  if (!brandProfile && options.userId) {
    try {
      const { getBrandProfileForUser } = await import("@/lib/brand-helper");
      brandProfile = await getBrandProfileForUser(options.userId);
    } catch {
      // continue without DB profile
    }
  }

  // Synthesize industry-level commercial art-directed prompt grounded in brand details
  const photorealisticPrompt = await buildBrandAlignedVisualPrompt(
    options.prompt,
    brandProfile,
    options.niche
  );

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
    // Cost guard — Replicate is 10x more expensive per call than a text
    // completion, so charge it heavier. Fails open on Redis outage.
    const { checkAiSpend } = await import("@/lib/ai-cost-guard");
    const verdict = await checkAiSpend({
      provider: "replicate",
      userId: options.userId ?? null,
      weight: 10,
    });
    if (!verdict.allowed) {
      return {
        success: false,
        imageUrl: null,
        aspectRatio,
        prompt: photorealisticPrompt,
        provider: "REPLICATE_FLUX_1",
        latencyMs: Date.now() - startTime,
      };
    }

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
          Prefer: "wait=10",
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
            prompt: photorealisticPrompt,
            provider: "REPLICATE_FLUX_1",
            latencyMs: Date.now() - startTime,
          };
        }
      }
    } catch (err) {
      console.warn("[Image Engine] Replicate FLUX.1 attempt notice:", err);
    }
  }

  // ─── Priority 2: Cloudflare Workers AI FLUX.1 (10,000 free Neurons/day) ──
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cfApiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY;
  if (cfAccountId && cfApiToken) {
    try {
      const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId.trim()}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
      const cfRes = await fetch(cfUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfApiToken.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: photorealisticPrompt,
          steps: 8,
        }),
      });

      if (cfRes.ok) {
        const json = (await cfRes.json()) as any;
        const b64 = json.result?.image || json.image;
        if (b64) {
          const imageBuffer = Buffer.from(b64, "base64");
          const storageKey = `creatives/${options.userId || "auto"}/${Date.now()}-cf.jpg`;
          let finalImageUrl = `data:image/jpeg;base64,${b64}`;

          // Upload to Insforge storage for persistent CDN URL if available
          try {
            const { getInsforgeUploadClient } = await import("@/lib/insforge-server");
            const insforge = getInsforgeUploadClient();
            const blob = new Blob([new Uint8Array(imageBuffer)], { type: "image/jpeg" });
            const { data, error } = await insforge.storage.from("lemon").upload(storageKey, blob as any);
            if (!error && data?.url) {
              finalImageUrl = data.url;
            }
          } catch (storageErr) {
            console.warn("[Image Engine] Insforge upload notice:", storageErr);
          }

          return {
            success: true,
            imageUrl: finalImageUrl,
            storageKey,
            aspectRatio,
            prompt: photorealisticPrompt,
            provider: "CLOUDFLARE_WORKERS_AI",
            latencyMs: Date.now() - startTime,
          };
        }
      } else {
        const errText = await cfRes.text().catch(() => "");
        console.warn(`[Image Engine] Cloudflare FLUX-1 HTTP ${cfRes.status}:`, errText);
      }
    } catch (cfErr) {
      console.warn("[Image Engine] Cloudflare FLUX-1 attempt notice:", cfErr);
    }
  }

  // ─── Priority 3: Together.ai FLUX.1-schnell-Free ─────────────────────────
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
          steps: 8,
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

  // ─── Priority 4: Curated Commercial Photography Fallback ──────────────────
  const lowerPrompt = (options.prompt + " " + (options.niche || "") + " " + (brandProfile?.niche || "")).toLowerCase();
  let selectedCategory = "default";
  if (lowerPrompt.includes("market") || lowerPrompt.includes("growth") || lowerPrompt.includes("ad") || lowerPrompt.includes("agency")) {
    selectedCategory = "marketing";
  } else if (lowerPrompt.includes("tech") || lowerPrompt.includes("software") || lowerPrompt.includes("code") || lowerPrompt.includes("saas") || lowerPrompt.includes("ai")) {
    selectedCategory = "tech";
  } else if (lowerPrompt.includes("team") || lowerPrompt.includes("office") || lowerPrompt.includes("collaborat")) {
    selectedCategory = "teamwork";
  } else if (lowerPrompt.includes("business") || lowerPrompt.includes("client") || lowerPrompt.includes("finance") || lowerPrompt.includes("consult")) {
    selectedCategory = "business";
  }

  const list = CURATED_COMMERCIAL_PHOTOS[selectedCategory] || CURATED_COMMERCIAL_PHOTOS.default;
  const selectedPhoto = list[Math.floor(Math.random() * list.length)];

  return {
    success: true,
    imageUrl: selectedPhoto,
    storageKey: `fallback-editorial-${Date.now()}`,
    aspectRatio,
    prompt: photorealisticPrompt,
    provider: "CURATED_EDITORIAL_PHOTOGRAPHY",
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Generate 9:16 Vertical Video Reel via Replicate (Wan 2.2 S2V / Wan 2.1)
 * Produces commercial cinematic video reels for Instagram Reels / YouTube Shorts.
 */
export async function generateAdCreativeVideo(options: {
  prompt: string;
  userId?: string;
}): Promise<GeneratedVideoResult> {
  const startTime = Date.now();
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  const photorealisticPrompt = await buildBrandAlignedVisualPrompt(options.prompt);

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

    // Primary: Try Wan 2.1 1.3b via Replicate
    try {
      const wan21Res = await fetch("https://api.replicate.com/v1/models/wan-video/wan-2.1-1.3b/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${replicateToken.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            prompt: `Cinematic 9:16 vertical commercial video reel. ${photorealisticPrompt}. High resolution, smooth natural camera motion, photorealistic cinematography.`,
            aspect_ratio: "9:16",
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
      console.warn("[Replicate Video Engine] Wan 2.1 attempt notice:", err);
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
