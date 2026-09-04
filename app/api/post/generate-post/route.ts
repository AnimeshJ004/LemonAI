import { getInsforgeServerClient, getInsforgeAdminClient } from "@/lib/insforge-server";
import { getBrandProfileForUser, formatBrandHashtags, cleanTag } from "@/lib/brand-helper";
import { generateAdCreativeImage } from "@/lib/ai-image-generator";
import { POST_STATUS } from "@/constants/post";
import { auth } from "@clerk/nextjs/server";
import { inngest } from "@/inngest/client";
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
            generateImage = true,
            aspectRatio = "1:1",
            daysCount = 1,
            postsPerDay = 1,
            targetChannel = "all",
            goal = "default",
        } = await request.json();

        if (!ACTIONS.includes(action as ActionType)) {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
        if (action === "generate" && !prompt.trim()) {
            return NextResponse.json({ error: "Prompt is required for generate action" }, { status: 400 });
        }

        let channelType: string | undefined;
        let characterLimit: number | undefined;

        const { insforge } = await getInsforgeServerClient().catch(() => ({
            insforge: getInsforgeAdminClient(),
        }));

        if (channelId) {
            const { data: channelData } = await insforge.database
                .from("channel_types")
                .select("type, character_limit")
                .eq("id", channelId)
                .maybeSingle();

            if (channelData) {
                channelType = channelData.type;
                characterLimit = channelData.character_limit;
            }
        }

        // Fetch client brand profile for personalized content generation
        const brandProfile = await getBrandProfileForUser(userId);

        // Fetch connected channels for this user
        const { data: userChannels } = await insforge.database
            .from("user_channels")
            .select("id, channel_type_id, channel_types(type, name)")
            .eq("user_id", userId);

        const defaultChannelId = userChannels?.[0]?.id || null;

        const isGenerateAction = action === "generate";
        const daysNum = Math.min(Math.max(Number(daysCount) || 1, 1), 30);
        const perDayNum = Math.min(Math.max(Number(postsPerDay) || 1, 1), 5);
        const totalPostsTarget = daysNum * perDayNum;
        const isMultiPost = isGenerateAction && totalPostsTarget > 1;

        if (isMultiPost) {
            const now = new Date();
            const todayStr = now.toISOString().split("T")[0];

            const TIME_SLOT_MAP: Record<number, string[]> = {
                1: ["10:00 AM"],
                2: ["10:00 AM", "6:30 PM"],
                3: ["9:00 AM", "2:00 PM", "8:00 PM"],
                4: ["9:00 AM", "1:00 PM", "5:00 PM", "8:30 PM"],
                5: ["8:30 AM", "11:30 AM", "2:30 PM", "5:30 PM", "8:30 PM"],
            };
            const defaultSlots = TIME_SLOT_MAP[perDayNum] || ["10:00 AM"];

            const cleanBrandTag = cleanTag(brandProfile?.business_name, "Brand");
            const cleanNicheTag = cleanTag(brandProfile?.niche, "Business");

            const brandSummary = brandProfile?.business_name
                ? `CRITICAL BRAND PROFILE DNA (You MUST deeply integrate this specific brand into every post, do NOT write generic or unrelated text):
- Business Name: ${brandProfile.business_name}
- Industry / Niche: ${brandProfile.niche}
- Target Audience: ${brandProfile.target_audience}
- Brand Tone & Voice: ${brandProfile.brand_tone || "Professional"}
- Primary Core Offer: ${brandProfile.main_offer || "Top Quality Services"}
- Competitors / Context: ${brandProfile.competitors || "Leading industry providers"}`
                : `Business Context: High quality professional content tailored for the brand.`;

            const multiPrompt = `You are the Lead Social Media Strategist and Copywriter.
${brandSummary}

User Request / Topic: ${prompt}.
Target Channel: ${targetChannel}.
Schedule: ${daysNum} day(s) duration with ${perDayNum} post(s) per day (Total ${totalPostsTarget} distinct posts).

Strict Generation Rules:
1. Every single post MUST specifically feature ${brandProfile?.business_name || "our brand"}, its niche (${brandProfile?.niche || "industry"}), and core offer. Do NOT write generic motivational quotes or unrelated filler.
2. Every post MUST end with 4 to 6 relevant hashtags including #${cleanBrandTag} and #${cleanNicheTag} (e.g. #${cleanBrandTag} #${cleanNicheTag} #${cleanNicheTag}Tips #BusinessGrowth).
3. Plain text only: zero emojis, zero icons, zero symbols. Do not use markdown headings (# Header) or bold asterisks (**bold**).

Return ONLY a valid JSON object matching this schema without markdown formatting:
{
  "posts": [
    {
      "dayOffset": 1,
      "timeSlot": "10:00 AM",
      "content": "Specific brand caption talking about ${brandProfile?.business_name || 'our services'} and value.\\n\\n#${cleanBrandTag} #${cleanNicheTag} #${cleanNicheTag}Tips #QualityService",
      "imagePrompt": "Authentic professional commercial photo of..."
    }
  ]
}`;

            const completion = await insforge.ai.chat.completions.create({
                model: "google/gemini-3.8-flash",
                messages: [{ role: "user", content: multiPrompt }],
            }).catch(() => {
                return insforge.ai.chat.completions.create({
                    model: "google/gemini-3.7-flash",
                    messages: [{ role: "user", content: multiPrompt }],
                });
            });

            const rawText = completion.choices[0]?.message?.content ?? "";
            const cleanJson = rawText.replace(/```(?:json)?\s*|\s*```/g, "").trim();
            let parsedData: any = {};
            try {
                parsedData = JSON.parse(cleanJson);
            } catch {
                parsedData = { posts: [] };
            }

            const rawItems: any[] = Array.isArray(parsedData.posts) ? parsedData.posts : [];

            // Ensure exact totalPostsTarget posts are constructed
            const payloadPromises = Array.from({ length: totalPostsTarget }).map(async (_, i) => {
                const item = rawItems[i];
                const dayIndex = Math.floor(i / perDayNum);
                const slotIndex = i % perDayNum;
                const fallbackSlot = defaultSlots[slotIndex] || "10:00 AM";

                const timeSlotStr = item?.timeSlot || fallbackSlot;
                const dayOffset = (item?.dayOffset && item.dayOffset >= 1) ? item.dayOffset : (dayIndex + 1);

                const scheduledDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
                const timeParts = timeSlotStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
                if (timeParts) {
                    let hour = parseInt(timeParts[1], 10);
                    const min = parseInt(timeParts[2], 10) || 0;
                    const meridiem = timeParts[3]?.toUpperCase() || "AM";
                    if (meridiem === "PM" && hour < 12) hour += 12;
                    if (meridiem === "AM" && hour === 12) hour = 0;
                    scheduledDate.setHours(hour, min, 0, 0);
                }

                // Clean plain text without emojis or symbols and guarantee 4-6 hashtags
                let rawContent = item?.content || `Update from ${brandProfile?.business_name || "our team"}: We deliver top quality ${brandProfile?.niche || "solutions"} designed to give you the best results. Contact us today to learn more.`;
                rawContent = rawContent.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, "").trim();
                const postContent = cleanAndEnsureHashtags(rawContent, brandProfile);

                let imageObj: { url: string; key: string } | null = null;
                const imgPrompt = item?.imagePrompt || `${brandProfile?.business_name || "Professional"} ${brandProfile?.niche || "commercial"} showcase photo`;

                if (generateImage) {
                    const imgRes = await generateAdCreativeImage({
                        prompt: imgPrompt,
                        aspectRatio: aspectRatio || "1:1",
                        userId,
                        niche: brandProfile?.niche,
                    });
                    if (imgRes.success && imgRes.imageUrl) {
                        imageObj = { url: imgRes.imageUrl, key: imgRes.storageKey || `ai-${Date.now()}-${i}` };
                    }
                }

                return {
                    user_id: userId,
                    user_channel_id: defaultChannelId,
                    content: postContent,
                    images: imageObj ? [imageObj] : [],
                    scheduled_at: scheduledDate.toISOString(),
                    status: POST_STATUS.QUEUE,
                };
            });

            const payloads = await Promise.all(payloadPromises);

            let createdBatch: any[] = [];
            if (payloads.length > 0) {
                try {
                    const { data: batchRes, error: batchErr } = await insforge.database
                        .from("scheduled_posts")
                        .insert(payloads)
                        .select();
                    if (batchRes) createdBatch = batchRes;
                    if (batchErr) console.warn("Batch insert notice:", batchErr);
                } catch (bErr) {
                    console.warn("Batch insert catch notice:", bErr);
                }
            }

            return NextResponse.json({
                isMultiDay: true,
                scheduledCount: createdBatch.length > 0 ? createdBatch.length : payloads.length,
                content: payloads[0]?.content || "Multi-post schedule plan generated successfully",
                schedule: null,
                autoSchedule: true,
                channels: targetChannel === "all" ? ["all"] : [targetChannel],
                image: payloads[0]?.images?.[0] || null,
                posts: createdBatch.length > 0 ? createdBatch : payloads,
            });
        }

        // Single Post Generation
        const systemPrompt = isGenerateAction
            ? buildGenerateSystemPrompt(channelType, characterLimit, brandProfile, targetChannel)
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

                let generatedImageObj: { url: string; key: string } | null = null;

                if (generateImage || parsed.generateImage === true) {
                    const imgPrompt = parsed.imagePrompt || prompt;
                    try {
                        const imgRes = await generateAdCreativeImage({
                            prompt: imgPrompt,
                            aspectRatio: aspectRatio || "1:1",
                            userId,
                            niche: brandProfile?.niche,
                        });
                        if (imgRes.success && imgRes.imageUrl) {
                            generatedImageObj = {
                                url: imgRes.imageUrl,
                                key: imgRes.storageKey || `ai-creative-${Date.now()}`,
                            };
                        }
                    } catch (imgErr) {
                        console.warn("Auto-image generation notice:", imgErr);
                    }
                }

                const finalContent = cleanAndEnsureHashtags(
                    (parsed.content || cleanJson)
                        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, "")
                        .trim(),
                    brandProfile
                );

                return NextResponse.json({
                    isMultiDay: false,
                    content: finalContent,
                    schedule: parsed.schedule || null,
                    autoSchedule: hasExplicitSchedule,
                    channels: Array.isArray(parsed.channels) ? parsed.channels : (targetChannel === "all" ? ["all"] : [targetChannel]),
                    image: generatedImageObj,
                });
            } catch {
                const hasScheduleKeywords = prompt.toLowerCase().includes("schedule");
                const fallbackContent = cleanAndEnsureHashtags(
                    cleanJson.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, "").trim(),
                    brandProfile
                );
                return NextResponse.json({
                    isMultiDay: false,
                    content: fallbackContent,
                    schedule: null,
                    autoSchedule: hasScheduleKeywords,
                    channels: targetChannel === "all" ? ["all"] : [targetChannel],
                    image: null,
                });
            }
        }

        const fallbackRefined = cleanAndEnsureHashtags(
            rawText.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, "").trim(),
            brandProfile
        );
        return NextResponse.json({ isMultiDay: false, content: fallbackRefined, schedule: null, autoSchedule: false, channels: null, image: null });
    } catch (error: any) {
        console.error("Generate post error:", error);
        return NextResponse.json({ error: error?.message || "Failed to generate post" }, { status: 500 });
    }
}

function cleanAndEnsureHashtags(content: string, brandProfile?: any): string {
    if (!content) return content;

    // 1. Clean markdown headings e.g. "# Headline" -> "Headline" and bold/italic asterisks
    let cleaned = content
        .replace(/^#+\s+/gm, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .trim();

    // 2. Extract existing hashtags
    const foundTags = cleaned.match(/#[a-zA-Z0-9_]+/g) || [];
    
    // Remove hashtags from main text body so we can format them cleanly at the end
    cleaned = cleaned.replace(/#[a-zA-Z0-9_]+/g, "").trim();

    // 3. Build brand-specific hashtags
    const brandTags = formatBrandHashtags(brandProfile);
    
    // Combine unique tags
    const combinedSet = new Set<string>();
    for (const t of brandTags) {
        if (t) combinedSet.add(t);
    }
    for (const t of foundTags) {
        if (t && t.length > 1) combinedSet.add(t);
    }

    // Pick top 4 to 6 hashtags
    const finalTags = Array.from(combinedSet).slice(0, 5).join(" ");

    return `${cleaned}\n\n${finalTags}`;
}

function buildGenerateSystemPrompt(channelType?: string, characterLimit?: number, brandProfile?: any, targetChannel?: string) {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const todayDay = now.toLocaleDateString("en-US", { weekday: "long" });

    const cleanBrandTag = cleanTag(brandProfile?.business_name, "Brand");
    const cleanNicheTag = cleanTag(brandProfile?.niche, "Business");

    const brandSummary = brandProfile?.business_name
        ? `CRITICAL BRAND IDENTITY & MANDATORY DNA:
- Business Name: ${brandProfile.business_name}
- Industry / Niche: ${brandProfile.niche}
- Target Audience: ${brandProfile.target_audience}
- Brand Voice & Tone: ${brandProfile.brand_tone || "Professional"}
- Primary Core Offer / Services: ${brandProfile.main_offer || "High Quality Services"}
- Competitive Edge / Context: ${brandProfile.competitors || "Industry Leader"}

MANDATORY BRAND REQUIREMENT:
You are the dedicated social media manager and copywriter specifically for "${brandProfile.business_name}". Every single post you write MUST be directly about ${brandProfile.business_name}, its services/products, and its target audience (${brandProfile.target_audience}).
DO NOT write generic motivational quotes, generic life advice, or vague platitudes. Speak directly as ${brandProfile.business_name} addressing potential clients.`
        : `Business Context: You are writing high-converting, tailored social media posts for a professional brand.`;

    const parts = [
        "You are an expert AI social media strategist, copywriter, and auto-scheduler.",
        brandSummary,
        "",
        `Current reference date: ${todayStr} (${todayDay}).`,
        "",
        "Generation Rules:",
        "1. Focus entirely on the brand's niche, services, and value proposition.",
        "2. Clean plain text only: ZERO emojis, ZERO icons, ZERO symbols, and ZERO markdown headings (# Heading) or bold asterisks (**text**).",
        `3. Every post MUST include 4 to 6 relevant social hashtags at the very bottom, always including #${cleanBrandTag} and #${cleanNicheTag} (e.g. #${cleanBrandTag} #${cleanNicheTag} #${cleanNicheTag}Tips #BusinessGrowth).`,
        "4. Scheduling & Date Detection:",
        `   - If user mentions dates or times (e.g. 'tomorrow at 5pm', 'next Monday 10:00 AM', 'September 5th at 3 PM', 'today at 6 PM', 'schedule kardo'):`,
        `     * Calculate the exact target date formatted as 'YYYY-MM-DD' (relative to ${todayStr}).`,
        "     * Format the time in 'h:mm A' 12-hour format (e.g. '5:00 PM', '10:30 AM').",
        "     * Set schedule: { 'date': 'YYYY-MM-DD', 'time': '5:00 PM' }.",
        "     * Set autoSchedule: true.",
        "   - If no scheduling is mentioned, set schedule: null and autoSchedule: false.",
        "5. Channel Detection:",
        "   - If user mentions target social platforms (e.g. 'Twitter', 'X', 'LinkedIn', 'Instagram', 'Facebook', 'Bluesky', 'all channels'):",
        "     * Set channels array: ['twitter', 'linkedin'] or ['all'].",
        "   - Else set channels: null.",
        "6. Visual Photo Prompt:",
        "   - Formulate a clear, highly realistic commercial photo prompt in 'imagePrompt' that reflects the brand's services (e.g. 'Authentic commercial photograph of...').",
        "   - Set generateImage: true.",
        "",
        "Return ONLY a valid JSON object matching this schema without any markdown wrapping:",
        "{",
        `  "content": "Specific caption about ${brandProfile?.business_name || 'our services'} and value proposition.\\n\\n#${cleanBrandTag} #${cleanNicheTag} #${cleanNicheTag}Tips #BusinessGrowth",`,
        '  "schedule": { "date": "YYYY-MM-DD", "time": "5:00 PM" } | null,',
        '  "autoSchedule": true,',
        '  "channels": ["instagram"] | null,',
        '  "generateImage": true,',
        '  "imagePrompt": "Authentic commercial photograph of..."',
        "}"
    ];

    // Adapt generation style based on Channel Type (Organic Social vs Meta Ads)
    const channelLower = (channelType || "").toLowerCase();
    const isMetaAdChannel = channelLower.includes("ad") || channelLower.includes("meta_ad");

    if (isMetaAdChannel) {
        parts.push(
            "",
            "Performance Advertising Strategy (Meta Ads Mode):",
            "- Goal: High CTR, lead generation, and direct conversion.",
            "- Copy Structure: Scroll-stopping 5-7 word headline hook, clear problem/solution agitation, strong offer positioning, and decisive Call-to-Action (e.g. 'Claim 20% Off', 'Book Your Consultation Today').",
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

    if (channelType) {
        parts.push(`Match the specific platform tone for ${channelType}.`);
    }
    if (characterLimit) {
        parts.push(`Must be less than the maximum character limit: ${characterLimit}.`);
    }
    return parts.join("\n");
}

function buildRefineSystemPrompt(channelType?: string, characterLimit?: number, brandProfile?: any) {
    const cleanBrandTag = cleanTag(brandProfile?.business_name, "Brand");
    const cleanNicheTag = cleanTag(brandProfile?.niche, "Business");

    const system_prompt = [
        "You are a social media writing assistant.",
        "Return only the final post text.",
        "Do not add quotes, labels, bullet points, or explanations.",
        "Do not use markdown formatting like **, *, #, or backticks.",
        "Return plain text only.",
    ];
    if (brandProfile?.business_name) {
        system_prompt.push(
            `Writing for brand: ${brandProfile.business_name} (${brandProfile.niche}), Tone: ${brandProfile.brand_tone || 'Professional'}, Offer: ${brandProfile.main_offer || 'Services'}.`,
            `Ensure the post is tailored to ${brandProfile.business_name} and ends with hashtags #${cleanBrandTag} #${cleanNicheTag}.`
        );
    }
    if (channelType) {
        system_prompt.push(`Write for ${channelType}. Match the platform's tone, style, and expected length and relevant hashtags.`);
    }
    if (characterLimit) {
        system_prompt.push(`Must be less than the maximum character limit: ${characterLimit}.`);
    }
    return system_prompt.join("\n");
}

function buildPrompt(action: ActionType, content: string, prompt: string) {
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