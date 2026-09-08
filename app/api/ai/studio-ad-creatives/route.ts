import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { getBrandProfileForUser } from "@/lib/brand-helper";
import { generateAdCreativeImage } from "@/lib/ai-image-generator";
import { callResilientCompletion } from "@/lib/ai-gateway";

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

    const completion = await callResilientCompletion({
      jsonMode: true,
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

    let variations = completion.data?.variations;
    if (!variations || !Array.isArray(variations) || variations.length === 0) {
      variations = [
        {
          variationName: "Pain-Point Solution Angle",
          headline: `Tired of Inconsistent ${brand?.niche || "Growth"}?`,
          primaryText: `If you are struggling to get predictable results, you are not alone. ${brand?.business_name || "We"} deliver proven systems tailored for ${targetAudience || "ambitious brands"}. Claim your consultation today before slots fill up.`,
          description: "Exclusive Strategy Consultation • Limited Availability",
          callToAction: "LEARN_MORE",
          visualPrompt: `Authentic commercial 35mm photo of professional consultant in modern studio, soft warm lighting, high end aesthetic, 4:5 aspect ratio`,
          whyItWorks: "Disarms skepticism by addressing acute customer frustration directly.",
        },
        {
          variationName: "Direct Results Angle",
          headline: `Scale Your ${brand?.niche || "Results"} Faster`,
          primaryText: `Stop wasting hours on trial-and-error. Discover our complete turnkey framework for ${offer}. Guaranteed high conversion and dedicated support.`,
          description: "Proven Turnkey Playbook",
          callToAction: "BOOK_NOW",
          visualPrompt: `Minimalist sleek product presentation on modern pedestal, architectural studio lighting, photorealistic`,
          whyItWorks: "Appeals directly to high-intent buyers ready to purchase.",
        },
      ];
    }

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
    } catch (err: any) {
      console.error("[studio-ad-creatives] Error:", err);
      return NextResponse.json({ error: err?.message || "Generation failed" }, { status: 500 });
    }
  }
