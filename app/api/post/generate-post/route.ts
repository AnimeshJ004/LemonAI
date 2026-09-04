import { getInsforgeServerClient } from "@/lib/insforge-server";
import { generateAdCreativeImage } from "@/lib/ai-image-generator";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const ACTIONS = ["generate", "rephrase", "shorten", "expand"] as const;
type ActionType = (typeof ACTIONS)[number];

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const {
            action,
            content = "",
            prompt = "",
            channelId,
            generateImage = false,
            aspectRatio = "1:1",
        } = await request.json();

        if (!ACTIONS.includes(action as ActionType)) {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
        if (action === "generate" && !prompt.trim()) {
            return NextResponse.json({ error: "Prompt is required for generate action" }, { status: 400 });
        }

        let channelType: string | undefined;
        let characterLimit: number | undefined;

        const { insforge } = await getInsforgeServerClient();

        if (channelId) {
            const { data: channelData, error: channelError } = await insforge.database
                .from("channel_types")
                .select("type, character_limit")
                .eq("id", channelId)
                .single();

            if (channelError) {
                return NextResponse.json({ error: "Invalid channel ID" }, { status: 400 });
            }
            if (!channelData) {
                return NextResponse.json({ error: "Channel not found" }, { status: 404 });
            }
            channelType = channelData.type;
            characterLimit = channelData.character_limit;
        }

        // Fetch client brand profile for personalized content generation
        let brandProfile: any = null;
        try {
            const { data: profile } = await insforge.database
                .from("brand_profiles")
                .select("business_name, niche, target_audience, brand_tone, main_offer, competitors")
                .eq("user_id", userId)
                .limit(1)
                .maybeSingle();
            brandProfile = profile;
        } catch {}

        const isGenerateAction = action === "generate";
        const systemPrompt = isGenerateAction
            ? buildGenerateSystemPrompt(channelType, characterLimit, brandProfile)
            : buildRefineSystemPrompt(channelType, characterLimit, brandProfile);

        const userPrompt = buildPrompt(action, content, prompt);

        const result = await insforge.ai.chat.completions.create({
            model: "google/gemini-3.8-flash",
            messages: [
                {
                    role: "system",
                    content: systemPrompt,
                },
                {
                    role: "user",
                    content: userPrompt,
                },
            ],
        }).catch(() => {
            return insforge.ai.chat.completions.create({
                model: "google/gemini-3.7-flash",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
            });
        });

        const rawText = result.choices[0]?.message?.content ?? "";

        if (isGenerateAction) {
            const cleanJson = rawText.replace(/```(?:json)?\s*|\s*```/g, "").trim();
            try {
                const parsed = JSON.parse(cleanJson);
                const promptLower = prompt.toLowerCase();
                const hasScheduleKeywords =
                    promptLower.includes("schedule") ||
                    promptLower.includes("bhejo") ||
                    promptLower.includes("post on") ||
                    promptLower.includes("tomorrow") ||
                    promptLower.includes("today at") ||
                    promptLower.includes("todat at");

                const hasExplicitSchedule = Boolean(
                    parsed.autoSchedule === true ||
                    (parsed.schedule?.date && parsed.schedule?.time) ||
                    (parsed.schedule && hasScheduleKeywords)
                );

                // Check if user requested an image/visual/creative
                const wantsImage =
                    generateImage ||
                    parsed.generateImage === true ||
                    Boolean(parsed.imagePrompt) ||
                    promptLower.includes("image") ||
                    promptLower.includes("photo") ||
                    promptLower.includes("picture") ||
                    promptLower.includes("visual") ||
                    promptLower.includes("banner") ||
                    promptLower.includes("attach") ||
                    promptLower.includes("reel");

                let generatedImageObj: { url: string; key: string } | null = null;

                if (wantsImage) {
                    const imgPrompt = parsed.imagePrompt || prompt;
                    try {
                        const imgRes = await generateAdCreativeImage({
                            prompt: imgPrompt,
                            aspectRatio: aspectRatio || "1:1",
                            userId,
                        });
                        if (imgRes.success && imgRes.imageUrl) {
                            generatedImageObj = {
                                url: imgRes.imageUrl,
                                key: imgRes.storageKey || `ai-creative-${Date.now()}`,
                            };
                        }
                    } catch (imgErr) {
                        console.warn("Auto-image generation error in generate-post:", imgErr);
                    }
                }

                return NextResponse.json({
                    content: parsed.content || cleanJson,
                    schedule: parsed.schedule || null,
                    autoSchedule: hasExplicitSchedule,
                    channels: Array.isArray(parsed.channels) ? parsed.channels : null,
                    image: generatedImageObj,
                });
            } catch {
                const hasScheduleKeywords = prompt.toLowerCase().includes("schedule");
                return NextResponse.json({
                    content: cleanJson,
                    schedule: null,
                    autoSchedule: hasScheduleKeywords,
                    channels: null,
                    image: null,
                });
            }
        }

        return NextResponse.json({ content: rawText, schedule: null, autoSchedule: false, channels: null, image: null });
    } catch (error: any) {
        console.error("Generate post error:", error);
        return NextResponse.json({ error: error?.message || "Failed to generate post" }, { status: 500 });
    }
}

function buildGenerateSystemPrompt(channelType?: string, characterLimit?: number, brandProfile?: any) {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const todayDay = now.toLocaleDateString("en-US", { weekday: "long" });

    const parts = [
        "You are an expert AI social media assistant and auto-scheduler.",
        `Current reference date: ${todayStr} (${todayDay}).`,
        "",
        "Instructions:",
        "1. Write one high quality, engaging social media post based on the user's request. Include suitable emojis and relevant hashtags. Do NOT include scheduling commands/dates inside the post text itself.",
        "2. Plain text only in post content. Do not use markdown tags like **, *, #, or quotes.",
        `3. If user mentions scheduling, dates, or times (e.g. 'tomorrow at 5pm', 'next Monday 10:00 AM', 'September 5th at 3 PM', 'in 2 hours', 'today at 6 PM', 'schedule kardo'):`,
        `   - Calculate the exact target date formatted as 'YYYY-MM-DD' (relative to ${todayStr}).`,
        "   - Format the time slot in 'h:mm A' 12-hour format (e.g. '5:00 PM', '10:30 AM', '3:00 PM', '9:15 AM').",
        "   - Set schedule object: { 'date': 'YYYY-MM-DD', 'time': '5:00 PM' }.",
        "   - Set autoSchedule: true.",
        "   - If no scheduling is mentioned, set schedule: null and autoSchedule: false.",
        "4. If user mentions target social media platforms (e.g. 'Twitter', 'X', 'LinkedIn', 'Instagram', 'Facebook', 'Bluesky', 'Threads', 'YouTube', 'TikTok', 'all channels'):",
        "   - Set channels array: ['twitter', 'linkedin'] or ['all'].",
        "   - If no platforms are mentioned, set channels: null.",
        "5. If user asks for an image, photo, banner, visual, creative, reel, or asks to attach a visual (e.g. 'generate photo', 'attach this in post', 'with doctor photo'):",
        "   - Set 'generateImage': true.",
        "   - Formulate a clear, highly realistic commercial visual prompt in 'imagePrompt' (e.g. 'Authentic photo of a confident medical doctor in a modern clinic with stethoscope').",
        "   - If no image requested, set 'generateImage': false and 'imagePrompt': null.",
        "",
        "Return ONLY a valid JSON object matching this schema without any markdown formatting:",
        "{",
        '  "content": "The generated post text here",',
        '  "schedule": { "date": "YYYY-MM-DD", "time": "5:00 PM" } | null,',
        '  "autoSchedule": true,',
        '  "channels": ["bluesky"] | null,',
        '  "generateImage": true,',
        '  "imagePrompt": "Authentic professional commercial photo of doctor in modern clinic" | null',
        "}"
    ];

    if (brandProfile?.business_name) {
        parts.push(
            "",
            "Client Active Business DNA (Brand Profile):",
            `- Business Name: ${brandProfile.business_name}`,
            `- Niche / Industry: ${brandProfile.niche || "General"}`,
            `- Target Audience: ${brandProfile.target_audience || "Target Customers"}`,
            `- Brand Tone: ${brandProfile.brand_tone || "Professional"}`,
            `- Primary Offer: ${brandProfile.main_offer || ""}`,
            "Always align the copy, tone, vocabulary, and image prompts with this specific brand identity."
        );
    }

    // Adapt generation style based on Channel Type (Organic Social vs Meta Ads)
    const channelLower = (channelType || "").toLowerCase();
    const isMetaAdChannel = channelLower.includes("ad") || channelLower.includes("meta_ad");

    if (isMetaAdChannel) {
        parts.push(
            "",
            "Performance Advertising Strategy (Meta Ads Mode):",
            "- Goal: High CTR, lead generation, and direct conversion.",
            "- Copy Structure: Scroll-stopping 5-7 word headline hook, clear problem/solution agitation, strong offer positioning, and decisive Call-to-Action (e.g. 'Claim 20% Off', 'Book Your 3D Scan Today').",
            "- Visual: High-impact commercial product/service hero photography with clean focus."
        );
    } else {
        parts.push(
            "",
            "Organic Community Strategy (Organic Social Mode):",
            "- Goal: Organic reach, high saves, shares, and comment engagement.",
            "- Copy Structure: Conversational hook, relatable storytelling, educational tip or insight, question to spark comments (e.g. 'What do you think? Drop a comment below!'), and 4-6 targeted niche hashtags.",
            "- If user requests a Reel/Video: include timestamps (0-3s Hook, 3-20s Value, 20-30s CTA) with 9:16 vertical visual cues.",
            "- Visual: Authentic, lifestyle and workplace documentary photography."
        );
    }

    if(channelType){
        parts.push(`Match the specific platform tone for ${channelType}.`);
    }
    if(characterLimit){
        parts.push(`Must be less than the maximum character limit: ${characterLimit}.`);
    }
    return parts.join("\n");
}

function buildRefineSystemPrompt(channelType?: string, characterLimit?: number, brandProfile?: any){
    const system_prompt = [
        "You are a social media writing assistant.",
        "Return only the final post text.",
        "Do not add quotes, labels, bullet points, or explanations.",
        "Do not use markdown formatting like **, *, #, or backticks.",
        "Return plain text only.",
    ];
    if (brandProfile?.business_name) {
        system_prompt.push(`Writing for brand: ${brandProfile.business_name} (${brandProfile.niche}), Tone: ${brandProfile.brand_tone || 'Professional'}.`);
    }
    if(channelType){
        system_prompt.push(`Write for ${channelType}. Match the platform's tone, style, and expected length and relevant hashtags.`);
    }
    if(characterLimit){
        system_prompt.push(`Must be less than the maximum character limit: ${characterLimit}.`);
    }
    return system_prompt.join("\n");
}

function buildPrompt(action:ActionType,content:string, prompt:string){
    if (action === "generate") {
        return prompt;
    }
    if (!content.trim()) {
        throw new Error("Content is required for this action");
    }
    if (action === "rephrase") {
        return `Rephrase this social media post while keeping the meaning:\n${content}`;
    }
    if (action === "shorten") {
        return `Shorten this social media post while keeping the key message:\n${content}`;
    }
    return `Expand this social media post with more helpful detail while keeping the same tone:\n${content}`;
}