import { getInsforgeServerClient } from "@/lib/insforge-server";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";


const ACTIONS = ["generate", "rephrase", "shorten", "expand"] as const;
type ActionType = (typeof ACTIONS)[number];

export async function POST(request:NextRequest){
    try {
        const { has, userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Allowed for all authenticated users
        const canUseAI = true;
        
        const {
            action,
            content="",
            prompt="",
            channelId
        } =await request.json()

        if(!ACTIONS.includes(action as ActionType)){
            return NextResponse.json({ error: "Invalid action" }, { status: 400 })
        }
        if(action === "generate" && !prompt.trim()){
            return NextResponse.json({ error: "Prompt is required for generate action" }, { status: 400 })
        }

        let channelType:string | undefined;
        let characterLimit:number | undefined;

        const {insforge} = await getInsforgeServerClient();

        if(channelId){
            const {data: channelData, error: channelError} = await insforge.database
                .from("channel_types")
                .select("type, character_limit")
                .eq("id", channelId)
                .single();
            
            if(channelError){
                return NextResponse.json({ error: "Invalid channel ID" }, { status: 400 });
            }
            if(!channelData){
                return NextResponse.json({ error: "Channel not found" }, { status: 404 });
            }
            channelType = channelData.type;
            characterLimit = channelData.character_limit;
        }

        const isGenerateAction = action === "generate";
        const systemPrompt = isGenerateAction 
            ? buildGenerateSystemPrompt(channelType, characterLimit)
            : buildRefineSystemPrompt(channelType, characterLimit);

        const userPrompt = buildPrompt(action, content, prompt);

        const result = await insforge.ai.chat.completions.create({
          model: "google/gemini-2.5-flash-lite",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },{
                    role: "user",
                    content: userPrompt,
                }
            ]
        });

        const rawText = result.choices[0]?.message?.content ?? "";

        if (isGenerateAction) {
            const cleanJson = rawText.replace(/```(?:json)?\s*|\s*```/g, "").trim();
            try {
                const parsed = JSON.parse(cleanJson);
                const hasScheduleKeywords =
                    prompt.toLowerCase().includes("schedule") ||
                    prompt.toLowerCase().includes("bhejo") ||
                    prompt.toLowerCase().includes("post on") ||
                    prompt.toLowerCase().includes("tomorrow") ||
                    prompt.toLowerCase().includes("today at");

                const hasExplicitSchedule = Boolean(
                    parsed.autoSchedule === true ||
                    (parsed.schedule?.date && parsed.schedule?.time) ||
                    (parsed.schedule && hasScheduleKeywords)
                );

                return NextResponse.json({
                    content: parsed.content || cleanJson,
                    schedule: parsed.schedule || null,
                    autoSchedule: hasExplicitSchedule,
                    channels: Array.isArray(parsed.channels) ? parsed.channels : null,
                });
            } catch {
                const hasScheduleKeywords = prompt.toLowerCase().includes("schedule");
                return NextResponse.json({
                    content: cleanJson,
                    schedule: null,
                    autoSchedule: hasScheduleKeywords,
                    channels: null,
                });
            }
        }

        return NextResponse.json({ content: rawText, schedule: null, autoSchedule: false, channels: null });
    } catch (error: any) {
        console.error("Generate post error:", error);
        return NextResponse.json({ error: error?.message || "Failed to generate post" }, { status: 500 });
    }
}

function buildGenerateSystemPrompt(channelType?: string, characterLimit?: number) {
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
        "",
        "Return ONLY a valid JSON object matching this schema without any markdown formatting:",
        "{",
        '  "content": "The generated post text here",',
        '  "schedule": { "date": "YYYY-MM-DD", "time": "5:00 PM" } | null,',
        '  "autoSchedule": true,',
        '  "channels": ["twitter", "linkedin"] | null',
        "}"
    ];

    if(channelType){
        parts.push(`Match the specific platform tone for ${channelType}.`);
    }
    if(characterLimit){
        parts.push(`Must be less than the maximum character limit: ${characterLimit}.`);
    }
    return parts.join("\n");
}

function buildRefineSystemPrompt(channelType?: string, characterLimit?: number){
    const system_prompt = [
        "You are a social media writing assistant.",
        "Return only the final post text.",
        "Do not add quotes, labels, bullet points, or explanations.",
        "Do not use markdown formatting like **, *, #, or backticks.",
        "Return plain text only.",
    ];
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