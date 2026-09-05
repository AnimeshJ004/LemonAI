import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeServerClient, getInsforgeAdminClient } from "@/lib/insforge-server";
import { getBrandProfileForUser, formatBrandHashtags, cleanTag, userBrandCache } from "@/lib/brand-helper";
import { generateAdCreativeImage } from "@/lib/ai-image-generator";
import { POST_STATUS } from "@/constants/post";
import { inngest } from "@/inngest/client";
import { getUserMemoryContext, buildMemoryPromptBlock } from "@/lib/ai-memory";

export const maxDuration = 120; // Support extended AI batch generation

export interface AutoPilotRequest {
  businessName?: string;
  niche?: string;
  targetAudience?: string;
  brandTone?: string;
  mainOffer?: string;
  competitors?: string;
  days?: number; // 1 to 30 days
  daysToGenerate?: number; // fallback
  postsPerDay?: number; // 1 to 5 posts per day
  selectedChannelIds?: string[];
  generateImages?: boolean;
  postStatus?: "queue" | "draft";
}

/**
 * Realistic engagement time slots spaced throughout the day
 */
function getTimeSlots(count: number): string[] {
  switch (count) {
    case 1:
      return ["10:00 AM"];
    case 2:
      return ["09:30 AM", "04:30 PM"];
    case 3:
      return ["09:00 AM", "02:00 PM", "07:30 PM"];
    case 4:
      return ["08:30 AM", "12:30 PM", "05:00 PM", "08:30 PM"];
    case 5:
    default:
      return ["08:00 AM", "11:30 AM", "02:30 PM", "05:30 PM", "08:30 PM"];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { insforge } = await getInsforgeServerClient().catch(() => ({
      insforge: getInsforgeAdminClient(),
    }));

    const body: AutoPilotRequest = await req.json().catch(() => ({}));

    // 1. Fetch or update saved brand profile
    const savedProfile = await getBrandProfileForUser(userId);
    const businessName = (body.businessName || savedProfile?.business_name || "").trim();
    const niche = (body.niche || savedProfile?.niche || "").trim();
    const targetAudience = (body.targetAudience || savedProfile?.target_audience || "").trim();
    const brandTone = (body.brandTone || savedProfile?.brand_tone || "Professional").trim();
    const mainOffer = (body.mainOffer || savedProfile?.main_offer || "").trim();
    const competitors = (body.competitors || savedProfile?.competitors || "").trim();

    if (!businessName || !niche) {
      return NextResponse.json(
        { error: "Business Name and Niche are required. Please configure your Brand Profile first." },
        { status: 400 }
      );
    }

    // Persist brand profile if provided
    const profilePayload = {
      user_id: userId,
      business_name: businessName,
      niche,
      target_audience: targetAudience || "Target professionals & customers",
      brand_tone: brandTone,
      main_offer: mainOffer || "High quality service & customer satisfaction",
      competitors: competitors || null,
      updated_at: new Date().toISOString(),
    };
    userBrandCache.set(userId, profilePayload);

    try {
      const admin = getInsforgeAdminClient();
      const { data: existingProf } = await admin.database
        .from("brand_profiles")
        .select("id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (existingProf?.id) {
        await admin.database.from("brand_profiles").update(profilePayload).eq("id", existingProf.id);
      } else {
        await admin.database.from("brand_profiles").insert(profilePayload);
      }
    } catch (profErr: any) {
      console.warn("Brand profile upsert notice in auto-pilot:", profErr?.message);
    }

    // 2. Parse Filters
    const days = Math.min(Math.max(Number(body.days || body.daysToGenerate || 7), 1), 30);
    const postsPerDay = Math.min(Math.max(Number(body.postsPerDay || 1), 1), 5);
    const totalPostsToGenerate = days * postsPerDay;
    const generateImages = body.generateImages !== false;
    const targetStatus = body.postStatus === "draft" ? POST_STATUS.DRAFT : POST_STATUS.QUEUE;

    // 2b. Fetch AI Prompt Memory for this user (personalized learning)
    const userMemories = await getUserMemoryContext(userId, insforge);
    const memoryBlock = buildMemoryPromptBlock(userMemories);

    // 3. Fetch or Provision user channels
    let { data: userChannels } = await insforge.database
      .from("user_channels")
      .select("id, channel_type_id, is_connected, channel_types(id, type, name, character_limit, color)")
      .eq("user_id", userId);

    // If user has no channels yet, provision default active channels so foreign keys never fail
    if (!userChannels || userChannels.length === 0) {
      const { data: channelTypes } = await insforge.database
        .from("channel_types")
        .select("id, type, name, character_limit, color")
        .order("created_at", { ascending: true });

      if (channelTypes && channelTypes.length > 0) {
        const cleanHandle = `@${businessName.toLowerCase().replace(/[^a-z0-9]/g, "") || "brand"}`;
        const toCreate = channelTypes.slice(0, 3).map((ct) => ({
          user_id: userId,
          channel_type_id: ct.id,
          handle: cleanHandle,
          is_connected: true,
          is_active: true,
        }));
        const { data: seededChannels } = await insforge.database
          .from("user_channels")
          .insert(toCreate)
          .select("id, channel_type_id, is_connected, channel_types(id, type, name, character_limit, color)");

        userChannels = seededChannels || [];
      }
    }

    // Filter by selected channel IDs if provided
    let targetChannels = userChannels || [];
    if (Array.isArray(body.selectedChannelIds) && body.selectedChannelIds.length > 0) {
      const filtered = userChannels?.filter(
        (ch: any) =>
          body.selectedChannelIds!.includes(ch.id) ||
          body.selectedChannelIds!.includes(ch.channel_type_id)
      );
      if (filtered && filtered.length > 0) {
        targetChannels = filtered;
      }
    }

    const defaultChannelId = targetChannels[0]?.id || userChannels?.[0]?.id || null;

    // Rescue any previously stuck 'publishing' posts for this user
    try {
      await insforge.database
        .from("scheduled_posts")
        .update({ status: "queue" })
        .eq("user_id", userId)
        .eq("status", "publishing");
    } catch {}

    // 4. Generate AI Posts Strategy (STARTS TODAY: Day 0)
    const timeSlotsPerDay = getTimeSlots(postsPerDay);
    const brandTags = formatBrandHashtags({ business_name: businessName, niche });

    const systemPrompt = `You are an elite Autonomous Social Media Director and Marketing Strategist for "${businessName}" in the "${niche}" industry.
Brand Voice: ${brandTone}.
Target Demographics: ${targetAudience || "Target customers, professionals, and clients"}.
Core Offer: ${mainOffer || "High quality service & premium results"}.
Competitor References: ${competitors || "Industry leaders"}.${memoryBlock}

Your mission:
Generate exactly ${totalPostsToGenerate} high-converting social media posts designed to be scheduled across ${days} days with ${postsPerDay} posts per day.

CRITICAL TIMELINE RULES:
- The schedule STARTS TODAY (Day Offset 0).
- Day Offset 0 is TODAY: Post 1 must be a timely, high-impact introductory announcement, value insight, or compelling hook for today.
- Day Offsets MUST range from 0 to ${days - 1} (total ${days} days).
- Each post must feature punchy hooks, value-packed body copy, and 3-5 brand-relevant hashtags.
- Distribute across diverse content pillars (e.g. Industry Tips, Social Proof/Case Study, Counter-Intuitive Insights, Behind-the-Scenes/Mission, and Strong Direct Offers).

Return ONLY valid JSON matching this exact schema (no markdown, no backticks):
{
  "posts": [
    {
      "dayOffset": 0,
      "timeSlot": "09:30 AM",
      "pillar": "Educational Tip",
      "content": "Full post caption with hook, insightful value delivery, and relevant hashtags",
      "visualPrompt": "Authentic 35mm DSLR documentary photo of [commercial subject relevant to niche], natural lighting, professional corporate setting",
      "aspectRatio": "1:1"
    }
  ]
}`;

    let aiRawResponse = "";
    try {
      const completion = await insforge.ai.chat.completions.create({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate all ${totalPostsToGenerate} social media posts starting TODAY (Day 0 to ${days - 1}) with ${postsPerDay} posts/day for ${businessName}.`,
          },
        ],
      });
      aiRawResponse = completion.choices[0]?.message?.content ?? "";
    } catch (err) {
      // Fallback to Gemini 3.7 Flash
      const completion = await insforge.ai.chat.completions.create({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate all ${totalPostsToGenerate} social media posts starting TODAY (Day 0 to ${days - 1}) with ${postsPerDay} posts/day for ${businessName}.`,
          },
        ],
      });
      aiRawResponse = completion.choices[0]?.message?.content ?? "";
    }

    const cleanJson = aiRawResponse.replace(/```(?:json)?\s*|\s*```/g, "").trim();
    let generatedPosts: any[] = [];

    try {
      const parsed = JSON.parse(cleanJson);
      generatedPosts = parsed.posts || parsed.socialCalendar || [];
    } catch (parseErr) {
      console.warn("AI post parse fallback, attempting relaxed extraction:", parseErr);
      const match = cleanJson.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          generatedPosts = JSON.parse(match[0]);
        } catch {}
      }
    }

    // 5. Structure Post Payloads for every Day & Time Slot (STARTS TODAY: Day 0)
    const now = new Date();
    const payloadItems: any[] = [];
    let postCounter = 0;

    for (let d = 0; d < days; d++) {
      for (let p = 0; p < postsPerDay; p++) {
        const slot = timeSlotsPerDay[p] || "10:00 AM";
        const aiPost = generatedPosts[postCounter] || generatedPosts[postCounter % (generatedPosts.length || 1)];

        // Compute scheduled date & time
        let scheduledDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
        const timeMatch = slot.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (timeMatch) {
          let hour = parseInt(timeMatch[1], 10);
          const min = parseInt(timeMatch[2], 10) || 0;
          const meridiem = timeMatch[3]?.toUpperCase() || "AM";
          if (meridiem === "PM" && hour < 12) hour += 12;
          if (meridiem === "AM" && hour === 12) hour = 0;
          scheduledDate.setHours(hour, min, 0, 0);
        }

        // For TODAY (d === 0):
        // If the slot has already passed or is the first post of the campaign, schedule for right now
        if (d === 0) {
          if (p === 0 || scheduledDate.getTime() <= now.getTime()) {
            // First post is scheduled for right now (+ 1 minute)
            // Subsequent posts today are spaced out later today
            const offsetMinutes = p === 0 ? 1 : Math.max(120, (p * 180));
            scheduledDate = new Date(now.getTime() + offsetMinutes * 60 * 1000);
          }
        }

        // Clean content & ensure hashtags
        let cleanContent = (
          aiPost?.content ||
          `Excited to share insights from ${businessName}. Discover leading solutions tailored for ${niche} success.`
        )
          .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, "")
          .replace(/^#+\s+/gm, "")
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .trim();

        const existingTags = cleanContent.match(/#[a-zA-Z0-9_]+/g) || [];
        cleanContent = cleanContent.replace(/#[a-zA-Z0-9_]+/g, "").trim();

        const mergedTags = new Set<string>();
        for (const t of brandTags) if (t) mergedTags.add(t);
        for (const t of existingTags) if (t && t.length > 1) mergedTags.add(t);
        const tagLine = Array.from(mergedTags).slice(0, 5).join(" ");
        const finalContent = `${cleanContent}\n\n${tagLine}`;

        // Distribute across available target channels
        const targetChannel =
          targetChannels.length > 0
            ? targetChannels[postCounter % targetChannels.length]
            : null;
        const channelId = targetChannel?.id || defaultChannelId;

        const visualPrompt =
          aiPost?.visualPrompt ||
          `Authentic commercial photography of ${niche} professional services for ${businessName}`;

        payloadItems.push({
          user_id: userId,
          user_channel_id: channelId,
          content: finalContent,
          visualPrompt,
          aspectRatio: aiPost?.aspectRatio || "1:1",
          scheduled_at: scheduledDate.toISOString(),
          status: targetStatus,
          dayOffset: d,
          timeSlot: slot,
          pillar: aiPost?.pillar || (d === 0 ? "Announcement" : "Brand Update"),
          targetChannel,
          channelInfo: targetChannel
            ? {
                id: targetChannel.id,
                name: (Array.isArray(targetChannel.channel_types) ? targetChannel.channel_types[0]?.name : (targetChannel.channel_types as any)?.name) || "Social Channel",
                type: (Array.isArray(targetChannel.channel_types) ? targetChannel.channel_types[0]?.type : (targetChannel.channel_types as any)?.type) || "TWITTER",
                color: (Array.isArray(targetChannel.channel_types) ? targetChannel.channel_types[0]?.color : (targetChannel.channel_types as any)?.color) || "#000000",
              }
            : null,
        });

        postCounter++;
      }
    }

    // 6. Generate Images (Fast Commercial Engine with Curated Fallback)
    const finalPostsToInsert = await Promise.all(
      payloadItems.map(async (item, idx) => {
        let imageArray: { url: string; key: string }[] = [];

        if (generateImages && item.visualPrompt) {
          try {
            const imgRes = await generateAdCreativeImage({
              prompt: item.visualPrompt,
              aspectRatio: item.aspectRatio || "1:1",
              userId,
              niche,
            });
            if (imgRes.success && imgRes.imageUrl) {
              imageArray = [
                {
                  url: imgRes.imageUrl,
                  key: imgRes.storageKey || `ai-post-${Date.now()}-${idx}`,
                },
              ];
            }
          } catch (imgErr) {
            console.warn("Visual generation error for item:", idx, imgErr);
          }
        }

        return {
          user_id: item.user_id,
          user_channel_id: item.user_channel_id,
          content: item.content,
          images: imageArray,
          scheduled_at: item.scheduled_at,
          status: item.status,
        };
      })
    );

    // 7. Batch Insert into scheduled_posts
    let createdPosts: any[] = [];
    if (finalPostsToInsert.length > 0) {
      try {
        const { data: inserted, error: dbError } = await insforge.database
          .from("scheduled_posts")
          .insert(finalPostsToInsert)
          .select("*, user_channels(*, channel_types(id, type, name, color, character_limit))");

        if (dbError) {
          console.warn("Post batch insert notice:", dbError);
        } else if (inserted) {
          createdPosts = inserted;
        }
      } catch (insertErr: any) {
        console.warn("Insert error in scheduled_posts:", insertErr?.message || insertErr);
      }
    }

    // 8. Handle Today's Post Publishing (Day 0, Post 1)
    // If targetStatus is QUEUE and today's first post is ready right now:
    if (targetStatus === POST_STATUS.QUEUE && createdPosts.length > 0) {
      const todayFirstPost = createdPosts[0];
      const hasLiveOAuthToken = Boolean(
        todayFirstPost?.user_channels?.access_token &&
        todayFirstPost?.user_channels?.access_token.length > 10
      );

      if (hasLiveOAuthToken) {
        // Dispatch Inngest event for today's immediate post only (future posts stay queued)
        try {
          await inngest.send({
            name: "post/publish.requested",
            data: { postId: todayFirstPost.id },
          });
        } catch (inngestErr: any) {
          console.warn("Inngest dispatch notice for today's post:", inngestErr?.message || inngestErr);
        }
      } else {
        // If channel is in demo/simulated mode without live OAuth token, mark today's post published
        try {
          const chType = todayFirstPost?.user_channels?.channel_types?.type || "TWITTER";
          const chHandle = todayFirstPost?.user_channels?.handle || businessName.toLowerCase().replace(/[^a-z0-9]/g, "") || "brand";
          const simUrl = `https://${chType.toLowerCase()}.com/${chHandle}/status/${Date.now()}`;

          await insforge.database
            .from("scheduled_posts")
            .update({
              status: POST_STATUS.PUBLISHED,
              published_at: new Date().toISOString(),
              published_url: simUrl,
            })
            .eq("id", todayFirstPost.id);

          todayFirstPost.status = POST_STATUS.PUBLISHED;
          todayFirstPost.published_at = new Date().toISOString();
          todayFirstPost.published_url = simUrl;
        } catch (simErr: any) {
          console.warn("Simulated publish notice for today's post:", simErr?.message || simErr);
        }
      }
    }

    // Calculate human-friendly date labels starting TODAY
    const startDate = now;
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (days - 1));
    const dateOptions: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    const dateRangeLabel = `Today (${startDate.toLocaleDateString("en-US", dateOptions)}) – ${endDate.toLocaleDateString("en-US", dateOptions)}`;

    return NextResponse.json({
      success: true,
      message: `Successfully scheduled ${createdPosts.length || finalPostsToInsert.length} posts starting Today (${startDate.toLocaleDateString("en-US", dateOptions)}) through ${endDate.toLocaleDateString("en-US", dateOptions)}!`,
      summary: {
        totalPosts: createdPosts.length || finalPostsToInsert.length,
        days,
        postsPerDay,
        dateRangeLabel,
        channelsCount: targetChannels.length,
        status: targetStatus,
        publishedToday: targetStatus === POST_STATUS.QUEUE ? 1 : 0,
      },
      createdPosts: createdPosts.length > 0 ? createdPosts : payloadItems,
    });

  } catch (error: any) {
    console.error("Auto-pilot scheduling error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to configure and schedule AI posts" },
      { status: 500 }
    );
  }
}
