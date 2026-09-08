import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { getBrandProfileForUser } from "@/lib/brand-helper";
import { callResilientCompletion } from "@/lib/ai-gateway";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { topic, tone, targetAudience } = body;

    if (!topic) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }

    const brand = await getBrandProfileForUser(userId);

    const completion = await callResilientCompletion({
      jsonMode: true,
      messages: [
        {
          role: "system",
          content: `You are a viral Reels Script Director. Generate a structured 60-second Reel script.
Return ONLY valid JSON with this exact structure (no markdown, no extra text):
{
  "title": "Short punchy title",
  "hook": { "text": "0-3s scroll-stopping opening line", "visualCue": "what to show on screen" },
  "body": [
    { "second": "4-15", "script": "value point 1", "visualCue": "B-roll idea", "onScreenText": "caption overlay" },
    { "second": "16-30", "script": "value point 2", "visualCue": "B-roll idea", "onScreenText": "caption overlay" },
    { "second": "31-45", "script": "value point 3", "visualCue": "B-roll idea", "onScreenText": "caption overlay" }
  ],
  "cta": { "text": "46-60s closing CTA line", "action": "Comment/Follow/Link in bio" },
  "caption": "Full Instagram caption with 5-10 relevant hashtags",
  "voiceoverTone": "Energetic/Calm/Authoritative",
  "musicMood": "Upbeat/Cinematic/Lo-fi"
}`,
        },
        {
          role: "user",
          content: `Business: ${brand?.business_name || "My Business"}
Niche: ${brand?.niche || "business"}
Topic: ${topic}
Voice Tone: ${tone || brand?.brand_tone || "Professional"}
Target Audience: ${targetAudience || brand?.target_audience || "general audience"}`,
        },
      ],
    });

    let script = completion.data;
    if (!script) {
      script = {
        title: topic.slice(0, 40),
        hook: {
          text: `Stop scrolling if you are still making this huge mistake with ${topic}!`,
          visualCue: "Creator looking directly at lens with subtle forward zoom and text banner",
        },
        body: [
          {
            second: "4-15",
            script: `Most people focus on the wrong variable. When tackling ${topic}, the real breakthrough comes from diagnosing your core bottleneck first.`,
            visualCue: "B-roll of focused working environment with subtle split screen",
            onScreenText: "Rule #1: Fix the foundation first",
          },
          {
            second: "16-30",
            script: `Instead of doing everything manually, build a repeatable 3-step checklist that eliminates guesswork.`,
            visualCue: "Close-up screen demonstration showing automated dashboard",
            onScreenText: "Rule #2: Automate repeat steps",
          },
          {
            second: "31-45",
            script: `Track your top 20% actions weekly. That is where 80% of your real growth actually comes from.`,
            visualCue: "Upbeat montage showing analytics climbing",
            onScreenText: "Rule #3: Double down on what converts",
          },
        ],
        cta: {
          text: `Want our complete execution template? Comment 'REEL' below and we will send it straight to your DMs!`,
          action: "Comment 'REEL' for free guide",
        },
        caption: `🚀 The secret to mastering ${topic} without burning out.\n\nSave this reel for your next planning session!\n\n#BusinessGrowth #ViralReels #SaaS #MarketingTips #Automation`,
        voiceoverTone: tone || "Energetic",
        musicMood: "Upbeat Lo-Fi",
      };
    }

    // Save draft to DB (non-fatal)
    try {
      const admin = getInsforgeAdminClient();
      await admin.database.from("studio_drafts").insert({
        user_id: userId,
        type: "REEL",
        title: topic,
        content_data: script,
      });
    } catch {}

    return NextResponse.json({ success: true, script });
  } catch (err: any) {
    console.error("[studio-reels] Error:", err);
    return NextResponse.json({ error: err?.message || "Generation failed" }, { status: 500 });
  }
}
