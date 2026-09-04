import { getInsforgeServerClient, getInsforgeAdminClient } from "@/lib/insforge-server";
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

            const multiPrompt = `You are an expert Social Media Content Director. Deeply analyze and adhere to the active Brand Profile DNA below:
- Business Name: ${brandProfile?.business_name || "the business"}
- Niche / Industry: ${brandProfile?.niche || "General"}
- Target Audience: ${brandProfile?.target_audience || "Target Customers"}
- Brand Tone: ${brandProfile?.brand_tone || "Professional"}
- Primary Offer: ${brandProfile?.main_offer || "Top Quality Service"}

User Request / Topic: ${prompt}.
Target Channel: ${targetChannel}.
Schedule: ${daysNum} day(s) duration with ${perDayNum} post(s) per day (Total ${totalPostsTarget} distinct posts).

Generate exactly ${totalPostsTarget} distinct, high-converting social media posts distributed over the ${daysNum} day(s).
For each day (Day 1 to Day ${daysNum}), generate ${perDayNum} distinct post(s) tailored to the brand's tone and audience with varied hooks, industry tips, customer solutions, and strong calls-to-action.
Write in clean, professional plain text only. Do NOT use any emojis, icons, or symbols in post content.

Return ONLY a valid JSON object matching this schema without markdown formatting:
{
  "posts": [
    {
      "dayOffset": 1,
      "timeSlot": "10:00 AM",
      "content": "Engaging plain text caption with relevant hashtags",
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

                // Clean plain text without emojis or symbols
                let postContent = item?.content || `Update from ${brandProfile?.business_name || "our team"}: We deliver top quality ${brandProfile?.niche || "solutions"} designed to give you the best results. Contact us today to learn more. #${(brandProfile?.niche || "Business").replace(/\s+/g, "")} #QualityService`;
                postContent = postContent.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, "").trim();

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

                return NextResponse.json({
                    isMultiDay: false,
                    content: parsed.content || cleanJson,
                    schedule: parsed.schedule || null,
                    autoSchedule: hasExplicitSchedule,
                    channels: Array.isArray(parsed.channels) ? parsed.channels : (targetChannel === "all" ? ["all"] : [targetChannel]),
                    image: generatedImageObj,
                });
            } catch {
                const hasScheduleKeywords = prompt.toLowerCase().includes("schedule");
                return NextResponse.json({
                    isMultiDay: false,
                    content: cleanJson,
                    schedule: null,
                    autoSchedule: hasScheduleKeywords,
                    channels: targetChannel === "all" ? ["all"] : [targetChannel],
                    image: null,
                });
            }
        }

        return NextResponse.json({ isMultiDay: false, content: rawText, schedule: null, autoSchedule: false, channels: null, image: null });
    } catch (error: any) {
        console.error("Generate post error:", error);
        return NextResponse.json({ error: error?.message || "Failed to generate post" }, { status: 500 });
    }
}

function buildGenerateSystemPrompt(channelType?: string, characterLimit?: number, brandProfile?: any, targetChannel?: string) {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const todayDay = now.toLocaleDateString("en-US", { weekday: "long" });

    const parts = [
        "You are an expert AI social media assistant and auto-scheduler.",
        `Current reference date: ${todayStr} (${todayDay}).`,
        "",
        "Instructions:",
        "1. Write one high quality, professional social media post in clean plain text. Do NOT use any emojis, icons, or symbols. Plain text only.",
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