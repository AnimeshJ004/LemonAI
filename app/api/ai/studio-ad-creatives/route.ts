import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";
import { getBrandProfileForUser } from "@/lib/brand-helper";
import { generateAdCreativeImage } from "@/lib/ai-image-generator";

export const maxDuration = 90;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { objective, targetAudience, offer, platform, generateImage } = body;

    if (!offer) {
      return NextResponse.json({ error: "offer is required" }, { status: 400 });
    }

    const brand = await getBrandProfileForUser(userId);
    const { insforge } = await getInsforgeServerClient();

    const completion = await insforge.ai.chat.completions.create({
      model: "google/gemini-3.8-flash",
      messages: [
        {
          role: "system",
          content: `You are a world-class Meta Ads copywriter. Generate 3 high-converting ad creative variations.
Return ONLY valid JSON with this exact structure (no markdown, no extra text):
{
  "variations": [
    {
      "variationName": "Hook-Lead (Curiosity)",
      "primaryText": "Full ad body copy 3-4 sentences that creates desire and urgency",
      "headline": "Punchy headline max 7 words",
      "description": "Supporting description line under headline",
      "callToAction": "LEARN_MORE",
      "visualPrompt": "Detailed AI image generation prompt describing the scene/visual for this ad",
      "whyItWorks": "Brief explanation of the conversion psychology used"
    }
  ]
}
Make 3 variations with different angles: 1) Curiosity/Hook, 2) Pain-Point/Solution, 3) Social Proof/Results.
callToAction must be one of: LEARN_MORE, SHOP_NOW, SIGN_UP, GET_QUOTE, BOOK_NOW, CONTACT_US`,
        },
        {
          role: "user",
          content: `Business: ${brand?.business_name || "My Business"}
Niche: ${brand?.niche || "business"}
Campaign Objective: ${objective || "LEAD_GENERATION"}
Your Offer: ${offer}
Target Audience: ${targetAudience || brand?.target_audience || "general audience"}
Ad Platform: ${platform || "Meta Ads (Instagram + Facebook)"}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "";
    const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();

    try {
      const result = JSON.parse(clean);
      const variations = result.variations || [];

      // Optionally generate AI image for the first variation
      if (generateImage && variations.length > 0 && variations[0].visualPrompt) {
        try {
          const imgRes = await generateAdCreativeImage({
            prompt: variations[0].visualPrompt,
            aspectRatio: "4:5",
            userId,
            niche: brand?.niche || "",
          });
          if (imgRes.success && imgRes.imageUrl) {
            variations[0].imageUrl = imgRes.imageUrl;
          }
        } catch (imgErr) {
          console.warn("[studio-ad-creatives] Image generation failed:", imgErr);
        }
      }

      // Save draft to DB (non-fatal)
      try {
        const admin = getInsforgeAdminClient();
        await admin.database.from("studio_drafts").insert({
          user_id: userId,
          type: "AD_CREATIVE",
          title: offer,
          content_data: { objective, platform, variations },
        });
      } catch {}

      return NextResponse.json({ success: true, variations });
    } catch {
      return NextResponse.json(
        { error: "AI response could not be parsed. Please try again.", raw },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("[studio-ad-creatives] Error:", err);
    return NextResponse.json({ error: err?.message || "Generation failed" }, { status: 500 });
  }
}
