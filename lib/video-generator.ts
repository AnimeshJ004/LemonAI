/**
 * Lemon AI – Video Reel Generation Pipeline
 *
 * Full pipeline:
 *   1. AI generates viral scene scripts (Groq AI — ~₹0.05)
 *   2. Scene images fetched from Hugging Face FLUX (hf-inference) / Together / Cloudflare
 *   3. Edge TTS voiceover via Microsoft Edge Speech (free)
 *   4. FFmpeg (WASM or static binary) stitches images + audio → MP4
 *   5. MP4 uploaded to Supabase Storage
 */

import path from "path";
import fs from "fs";
import os from "os";
// NOTE: getSupabaseAdminClient / getInsforgeAdminClient imported dynamically in functions to avoid Next.js edge runtime issues
import type { InsForgeClient } from "@/lib/supabase-server";
import { callResilientCompletion } from "@/lib/ai-gateway";
import { validateInputLengths } from "@/lib/validate-inputs";

export type ReelStyle = "product_promo" | "awareness" | "testimonial" | "story";
export type ReelAspect = "9:16" | "1:1" | "16:9";

export interface GenerateReelOptions {
  businessName: string;
  niche: string;
  offer: string;
  targetAudience?: string;
  style?: ReelStyle;
  aspectRatio?: ReelAspect;
  durationSeconds?: number; // 15, 30, or 60
  userId?: string;
}

export interface SceneScript {
  sceneNumber: number;
  narration: string;      // spoken voiceover text
  imagePrompt: string;    // visual description for image generation
  subtitle: string;       // short on-screen text (3–8 words)
  durationSeconds: number;
}

export interface GeneratedReelResult {
  success: boolean;
  videoUrl: string | null;
  storageKey?: string;
  scenes: SceneScript[];
  totalDurationSeconds: number;
  costINR: number;
  provider: "FFMPEG_SERVER" | "BROWSER_FALLBACK";
  latencyMs: number;
}

// ─── Step 1: Generate Scene Script via InsForge AI ───────────────────────────

export async function generateReelScript(
  options: GenerateReelOptions,
  insforgeClient: InsForgeClient
): Promise<SceneScript[]> {
  const duration = options.durationSeconds || 30;
  const numScenes = duration <= 15 ? 3 : duration <= 30 ? 4 : 6;

  const systemPrompt = `You are a world-class viral social media video scriptwriter.
Create EXACTLY ${numScenes} visual scenes for a ${duration}-second ${options.style || "product_promo"} reel.

Return ONLY a valid JSON array. Each object must have:
- sceneNumber (1-${numScenes})
- narration (spoken voiceover text, 10-25 words max)
- imagePrompt (detailed realistic photography description, mention: lighting, angle, real people, setting)
- subtitle (short punchy on-screen text, 3-8 words max)
- durationSeconds (seconds this scene shows, total must equal ${duration})

No markdown, no explanation — only the JSON array.`;

  const userPrompt = `Business: ${options.businessName}
Niche: ${options.niche}
Offer: ${options.offer}
Target Audience: ${options.targetAudience || "general public"}
Style: ${options.style || "product promo"}
Duration: ${duration} seconds
Number of scenes: ${numScenes}

Write a high-converting viral reel script.`;

  let rawText = "";
  try {
    const completion = await callResilientCompletion({
      temperature: 0.8,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    rawText = completion.content || "";
  } catch {
    rawText = "";
  }

  // Clean markdown fences and parse JSON
  let clean = rawText.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }

  try {
    const scenes = JSON.parse(clean) as SceneScript[];
    if (Array.isArray(scenes) && scenes.length > 0) return scenes;
  } catch {
    // Fallback scenes
  }

  return Array.from({ length: numScenes }, (_, i) => ({
    sceneNumber: i + 1,
    narration: `${options.businessName} offers ${options.offer}. Discover the difference today!`,
    imagePrompt: `Authentic candid photo of real ${options.niche} professional at work, natural indoor lighting, sharp focus, documentary photography`,
    subtitle: i === 0 ? options.businessName : i === numScenes - 1 ? "Get Started Now" : options.offer,
    durationSeconds: Math.round(duration / numScenes),
  }));
}

// ─── Step 2: Fetch Scene Images (Hugging Face Native Inference / Together) ───

export async function fetchSceneImages(
  scenes: SceneScript[],
  aspectRatio: ReelAspect = "9:16"
): Promise<{ sceneNumber: number; imageBuffer: Buffer }[]> {
  const dims: Record<ReelAspect, { w: number; h: number }> = {
    "9:16": { w: 720, h: 1280 },
    "1:1": { w: 1080, h: 1080 },
    "16:9": { w: 1280, h: 720 },
  };
  const { w, h } = dims[aspectRatio];
  const negPrompt = encodeURIComponent(
    "anime, doll, cartoon, cgi, 3d render, illustration, plastic face, airbrushed, manga, distorted, deformed"
  );
  const togetherKey = process.env.TOGETHER_API_KEY;

  const results = await Promise.all(
    scenes.map(async (scene) => {
      const fullPrompt = `Authentic documentary photo of ${scene.imagePrompt}, real human, natural skin texture with pores, candid shot, natural lighting, no anime, no CGI, strictly photorealistic`;

      // ── Priority 0: Hugging Face Inference (via Hugging Face API Token) ──
      const hfKey = process.env.HUGGINGFACE_API_KEY;
      if (hfKey) {
        try {
          const { InferenceClient } = await import("@huggingface/inference");
          const hfClient = new InferenceClient(hfKey.trim());
          let imageBlob: any;
          try {
            imageBlob = await hfClient.textToImage({
              model: "black-forest-labs/FLUX.1-schnell",
              inputs: fullPrompt,
            });
          } catch (hfErr1: any) {
            console.warn("[Video Engine] HF FLUX.1-schnell error, trying FLUX.1-dev:", hfErr1?.message || hfErr1);
            try {
              imageBlob = await hfClient.textToImage({
                model: "black-forest-labs/FLUX.1-dev",
                inputs: fullPrompt,
              });
            } catch (hfErr2: any) {
              console.warn("[Video Engine] HF FLUX.1-dev error, trying SD 3.5:", hfErr2?.message || hfErr2);
              imageBlob = await hfClient.textToImage({
                model: "stabilityai/stable-diffusion-3.5-large",
                inputs: fullPrompt,
              });
            }
          }

          if (typeof imageBlob === "string") {
            if (imageBlob.startsWith("data:")) {
              const base64Data = imageBlob.split(",")[1];
              return { sceneNumber: scene.sceneNumber, imageBuffer: Buffer.from(base64Data, "base64") };
            } else if (imageBlob.startsWith("http")) {
              const imgRes = await fetch(imageBlob);
              const ab = await imgRes.arrayBuffer();
              return { sceneNumber: scene.sceneNumber, imageBuffer: Buffer.from(ab) };
            }
          }

          const ab = await (imageBlob as unknown as Blob).arrayBuffer();
          return { sceneNumber: scene.sceneNumber, imageBuffer: Buffer.from(ab) };
        } catch (hfErr: any) {
          console.warn("[Video Engine] HF error:", hfErr?.message || hfErr);
        }
      }
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
              prompt: fullPrompt,
              width: w,
              height: h,
              steps: 4,
              n: 1,
              response_format: "url",
            }),
          });
          if (res.ok) {
            const data = await res.json() as { data?: { url?: string }[] };
            const imageUrl = data?.data?.[0]?.url;
            if (imageUrl) {
              const imgRes = await fetch(imageUrl);
              const ab = await imgRes.arrayBuffer();
              return { sceneNumber: scene.sceneNumber, imageBuffer: Buffer.from(ab) };
            }
          }
        } catch {
          // fall through
        }
      }

      // ── Priority 2: Cloudflare Workers AI FLUX.1 ──
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
              prompt: fullPrompt,
              steps: 4,
            }),
          });
          if (cfRes.ok) {
            const json = (await cfRes.json()) as any;
            const b64 = json.result?.image || json.image;
            if (b64) {
              return { sceneNumber: scene.sceneNumber, imageBuffer: Buffer.from(b64, "base64") };
            }
          }
        } catch {
          // fall through to empty buffer
        }
      }

      // ── Priority 3: Fallback ──
      return { sceneNumber: scene.sceneNumber, imageBuffer: Buffer.alloc(0) };
    })
  );
  return results;
}


// ─── Step 3: Generate Edge TTS Voiceover (Completely Free) ───────────────────

export async function generateEdgeVoiceover(
  narrationText: string,
  voice: "en-IN-NeerjaNeural" | "en-IN-PrabhatNeural" | "hi-IN-SwaraNeural" = "en-IN-NeerjaNeural"
): Promise<Buffer | null> {
  try {
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-IN">
      <voice name="${voice}">
        <prosody rate="1.05" pitch="+2Hz">${narrationText.replace(/[<>&"]/g, " ")}</prosody>
      </voice>
    </speak>`;

    const res = await fetch(
      "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?trustedclienttoken=6A5AA1D4EAFF4e31CC2B3A1498A40DC2",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Origin: "https://edge.microsoft.com",
          Referer: "https://edge.microsoft.com/",
        },
        body: ssml,
      }
    );

    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    return buf.length > 1000 ? buf : null;
  } catch {
    return null;
  }
}

// ─── Step 4: Stitch Reel with FFmpeg (Server-side) ───────────────────────────

export async function stitchReelWithFFmpeg(params: {
  scenes: SceneScript[];
  imageBuffers: { sceneNumber: number; imageBuffer: Buffer }[];
  audioBuffer: Buffer | null;
  aspectRatio: ReelAspect;
}): Promise<Buffer | null> {
  const tmpDir = path.join(os.tmpdir(), `lemon-reel-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // Dynamically resolve to avoid bundler static resolution errors for optional packages
    let ffmpegPath: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ffmpeg: any = null;

    try {
      const dynamicRequire = eval("require");
      ffmpegPath = dynamicRequire("ffmpeg-static");
      ffmpeg = dynamicRequire("fluent-ffmpeg");
    } catch {
      console.warn("[Reel] ffmpeg-static or fluent-ffmpeg not installed — cannot stitch MP4");
      return null;
    }

    if (!ffmpegPath || !ffmpeg) {
      return null;
    }

    // Save each scene image as jpg
    const imagePaths: string[] = [];
    for (const scene of params.scenes) {
      const imgBuf = params.imageBuffers.find((b) => b.sceneNumber === scene.sceneNumber);
      if (!imgBuf || imgBuf.imageBuffer.length === 0) continue;
      const imgPath = path.join(tmpDir, `scene-${scene.sceneNumber}.jpg`);
      fs.writeFileSync(imgPath, imgBuf.imageBuffer);
      imagePaths.push(imgPath);
    }

    if (imagePaths.length === 0) return null;

    // Write audio if exists
    let audioPath: string | null = null;
    if (params.audioBuffer && params.audioBuffer.length > 1000) {
      audioPath = path.join(tmpDir, "voiceover.mp3");
      fs.writeFileSync(audioPath, params.audioBuffer);
    }

    // FFmpeg concat input list (each image shown for its scene duration)
    const validScenes = params.scenes.filter((_, idx) => imagePaths[idx]);
    const concatContent = validScenes
      .map((scene, idx) => `file '${imagePaths[idx].replace(/\\/g, "/")}'\nduration ${scene.durationSeconds}`)
      .join("\n");

    const concatPath = path.join(tmpDir, "concat.txt");
    fs.writeFileSync(concatPath, concatContent);

    const outputPath = path.join(tmpDir, "reel.mp4");
    const dims: Record<ReelAspect, string> = {
      "9:16": "720:1280",
      "1:1": "1080:1080",
      "16:9": "1280:720",
    };
    const scaleFilter = dims[params.aspectRatio] || "720:1280";

    await new Promise<void>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let cmd: any = ffmpeg()
        .setFfmpegPath(ffmpegPath)
        .input(concatPath)
        .inputOptions(["-f concat", "-safe 0"])
        .videoCodec("libx264")
        .outputOptions([
          `-vf scale=${scaleFilter}:force_original_aspect_ratio=decrease,pad=${scaleFilter}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24`,
          "-preset fast",
          "-crf 23",
          "-pix_fmt yuv420p",
          "-movflags +faststart",
        ]);

      if (audioPath) {
        cmd = cmd.input(audioPath).audioCodec("aac").audioBitrate("128k");
      }

      cmd.output(outputPath).on("end", resolve).on("error", reject).run();
    });

    return fs.readFileSync(outputPath);
  } catch (err) {
    console.warn("[Reel FFmpeg] Stitch failed:", err);
    return null;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch { }
  }
}

// ─── Main: Full Reel Generation Orchestrator ─────────────────────────────────

export async function generateVideoReel(options: GenerateReelOptions): Promise<GeneratedReelResult> {
  const startTime = Date.now();
  // Dynamic import to stay compatible with Next.js server runtime
  const { getInsforgeAdminClient } = await import("@/lib/insforge-server");
  const insforge = getInsforgeAdminClient();

  const aspectRatio = options.aspectRatio || "9:16";
  let scenes: SceneScript[] = [];
  let videoUrl: string | null = null;
  let storageKey: string | undefined = undefined;
  let provider: "FFMPEG_SERVER" | "BROWSER_FALLBACK" = "BROWSER_FALLBACK";

  // Step 1: Generate scene script
  try {
    scenes = await generateReelScript(options, insforge);
  } catch (err) {
    console.error("[Reel] Script generation failed:", err);
  }

  // Step 2: Fetch scene images
  const imageBuffers = scenes.length > 0
    ? await fetchSceneImages(scenes, aspectRatio)
    : [];

  // Step 3: Generate voiceover
  const fullNarration = scenes.map((s) => s.narration).join(" ");
  const audioBuffer = fullNarration ? await generateEdgeVoiceover(fullNarration) : null;

  // Step 4: Stitch with FFmpeg
  const videoBuf = scenes.length > 0
    ? await stitchReelWithFFmpeg({ scenes, imageBuffers, audioBuffer, aspectRatio })
    : null;

  if (videoBuf && videoBuf.length > 10_000) {
    provider = "FFMPEG_SERVER";

    // Step 5: Upload to InsForge Storage
    try {
      const userPrefix = options.userId ? `${options.userId}/` : "public/";
      storageKey = `reels/${userPrefix}${Date.now()}-${aspectRatio.replace(":", "-")}.mp4`;
      // Copy into a fresh ArrayBuffer to avoid SharedArrayBuffer incompatibility with BlobPart
      const freshBuf = videoBuf.buffer.slice(videoBuf.byteOffset, videoBuf.byteOffset + videoBuf.byteLength) as ArrayBuffer;
      const blob = new Blob([freshBuf], { type: "video/mp4" });
      const { data: uploadData, error: uploadErr } = await insforge.storage
        .from("lemon")
        .upload(storageKey, blob);
      if (!uploadErr && uploadData?.url) {
        videoUrl = uploadData.url;
      } else {
        videoUrl = `data:video/mp4;base64,${videoBuf.toString("base64")}`;
      }
    } catch {
      videoUrl = `data:video/mp4;base64,${videoBuf.toString("base64")}`;
    }
  }

  const totalDuration = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
  const costINR = parseFloat((0.05).toFixed(3)); // ~₹0.05 for script; images & voiceover are free

  return {
    success: Boolean(videoUrl || scenes.length > 0),
    videoUrl,
    storageKey,
    scenes,
    totalDurationSeconds: totalDuration || options.durationSeconds || 30,
    costINR,
    provider,
    latencyMs: Date.now() - startTime,
  };
}
