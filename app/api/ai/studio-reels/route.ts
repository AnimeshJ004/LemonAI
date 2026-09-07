import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";
import { getBrandProfileForUser } from "@/lib/brand-helper";

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
    const { insforge } = await getInsforgeServerClient();

    const completion = await insforge.ai.chat.completions.create({
      model: "google/gemini-3.8-flash",
      messages: [
        {
          role: "system",
          content: `You are a viral Reels Script Director. Generate a structured 60-second Reel script.
Return ONLY valid JSON with this exact structure (no markdown, no extra text):
{
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

    const raw = completion.choices[0]?.message?.content || "";
    const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();

    try {
      const script = JSON.parse(clean);

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
    } catch {
      return NextResponse.json(
        { error: "AI response could not be parsed. Please try again.", raw },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("[studio-reels] Error:", err);
    return NextResponse.json({ error: err?.message || "Generation failed" }, { status: 500 });
  }
}
