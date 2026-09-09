import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getInsforgeServerClient, getInsforgeAdminClient } from "@/lib/insforge-server";
import { getBrandProfileForUser, formatBrandHashtags, cleanTag } from "@/lib/brand-helper";
import { getUserMemoryContext, buildMemoryPromptBlock } from "@/lib/ai-memory";
import { callResilientCompletion, extractJsonFromText } from "@/lib/ai-gateway";

interface ChannelInput {
  id: string;
  type: string; // e.g. "twitter", "x", "linkedin", "instagram", "facebook", "youtube", "threads", "bluesky", "pinterest"
  name?: string;
  character_limit?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content, channels } = (await request.json()) as {
      content: string;
      channels: ChannelInput[];
    };

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Content is required to adapt" }, { status: 400 });
    }

    if (!Array.isArray(channels) || channels.length === 0) {
      return NextResponse.json({ error: "At least one channel is required" }, { status: 400 });
    }

    const { insforge } = await getInsforgeServerClient().catch(() => ({
      insforge: getInsforgeAdminClient(),
    }));

    // Fetch user brand profile and AI memory for personalized brand voice
    const brandProfile = await getBrandProfileForUser(targetUserId).catch(() => null);
    const userMemories = await getUserMemoryContext(targetUserId, insforge).catch(() => []);
    const memoryBlock = buildMemoryPromptBlock(userMemories);

    const cleanBrandTag = cleanTag(brandProfile?.business_name, "Brand");
    const cleanNicheTag = cleanTag(brandProfile?.niche, "Business");
    const brandHashtags = formatBrandHashtags(brandProfile).slice(0, 4);

    const channelDescriptions = channels.map((ch) => {
      const type = (ch.type || "social").toLowerCase();
      const limit = ch.character_limit || (type === "twitter" || type === "x" ? 280 : 3000);
      return `- Channel ID: "${ch.id}", Platform: "${ch.name || ch.type}" (Type: "${type}"), Max Character Limit: ${limit}`;
    }).join("\n");

    const systemPrompt = `You are a world-class Social Media Strategist and Platform Copywriter.
Your job is to adapt a single master message so that it publishes differently and natively on each distinct social media platform according to their unique format, audience psychology, algorithm, and constraints.

${brandProfile?.business_name ? `Brand Context:
- Business: ${brandProfile.business_name}
- Niche: ${brandProfile.niche || "Professional"}
- Tone: ${brandProfile.brand_tone || "Professional and Engaging"}
- Core Offer: ${brandProfile.main_offer || "High Quality Services"}
- Brand Hashtags: #${cleanBrandTag} #${cleanNicheTag}` : "Brand Context: Professional and authentic communication."}

${memoryBlock || ""}

Platform-Specific Tailoring Rules:
1. **X / Twitter**:
   - Extreme conciseness. Total characters MUST be under 280 (including hashtags).
   - High-impact hook in the very first line.
   - Snappy, conversational, debate or discussion provoking.
   - Include 1-3 targeted hashtags max (e.g. #${cleanBrandTag} #${cleanNicheTag}).

2. **LinkedIn**:
   - Professional, thought-leadership, or career/business development framing.
   - Generous line breaks between sentences for easy mobile scanning.
   - Actionable business insight, key takeaways, or lesson learned.
   - Strong conversational closing question to encourage comments (e.g. "Agree? What's your experience with this?").
   - 3-5 professional industry hashtags at the bottom.

3. **Instagram**:
   - Visual-first storytelling hook.
   - Clean paragraph spacing with natural emoji accents (e.g. ✨, 📌, 💡, 🚀).
   - Explicit Call to Action (e.g. "Save this for later 📌", "Drop your thoughts below 👇", "Link in bio 🔗").
   - Clustered block of 8 to 12 targeted hashtags at the very bottom.

4. **Facebook**:
   - Warm, friendly, community-oriented and conversational.
   - Asks a question to spark discussion in groups and comments.
   - Light emojis, easy to read, 1-3 hashtags max.

5. **Threads / Bluesky**:
   - Snappy, casual, relatable, genuine internet-native voice.
   - Under 500 characters. Minimal or no hashtags.

6. **YouTube / Other**:
   - Descriptive, clear value proposition, organized with bullet points if helpful.

Format Requirements:
- Return ONLY a valid JSON object matching this schema without any markdown wrapping:
{
  "adaptations": {
    "<channelId>": {
      "text": "The full platform-tailored post caption...",
      "summary": "Brief 1-sentence note of how it was adapted (e.g., 'Punchy hook under 280 chars with 2 hashtags')",
      "badge": "Optimized for Twitter (240 chars)"
    }
  }
}`;

    const userPrompt = `Base Message to Adapt:
"""
${content}
"""

Target Channels to Tailor for:
${channelDescriptions}

Generate the tailored version for each channel ID listed above.`;

    const aiRes = await callResilientCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      jsonMode: true,
    });

    let adaptations = extractJsonFromText<{
      adaptations: Record<string, { text: string; summary?: string; badge?: string }>;
    }>(aiRes.content)?.adaptations;

    // Fallback if AI response couldn't be parsed
    if (!adaptations || typeof adaptations !== "object") {
      adaptations = {};
      channels.forEach((ch) => {
        const type = (ch.type || "").toLowerCase();
        const limit = ch.character_limit || (type === "twitter" || type === "x" ? 280 : 3000);
        let tailored = content;
        if (tailored.length > limit) {
          tailored = tailored.slice(0, limit - 3) + "...";
        }
        adaptations![ch.id] = {
          text: tailored,
          summary: `Adapted for ${ch.name || ch.type}`,
          badge: `Adapted for ${ch.name || ch.type}`,
        };
      });
    }

    return NextResponse.json({
      success: true,
      adaptations,
    });
  } catch (error: any) {
    console.error("Adapt post error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to adapt post for channels" },
      { status: 500 }
    );
  }
}
