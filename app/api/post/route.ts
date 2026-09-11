import { POST_STATUS } from "@/constants/post";
import { inngest } from "@/inngest/client";
import { publishPostDirectly } from "@/lib/direct-publisher";
import { getInsforgeServerClient } from "@/lib/insforge-server";
import { ImageObject } from "@/types/post.type";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { adaptCaptionForPlatform, getPlatformStaggeredDate } from "@/lib/platform-adapt-helper";


type PostType = {
    channelTypeId: string
    content: string
    images?: ImageObject[]
}


export async function GET(request: NextRequest) {
    try {
        const { insforge, userId } = await getInsforgeServerClient()
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const searchParams = request.nextUrl.searchParams
        const status = searchParams.get("status")
        const channelIds = searchParams.getAll("channelIds")
            .flatMap((channel) => channel.split(",")).filter(Boolean)
        const groupByDate = searchParams.get("group_by_date") === "true";

        let postQuery = insforge.database
            .from("scheduled_posts")
            .select(
                "*, user_channels(*, channel_types(id, type, name, color, character_limit))"
            )
            .eq("user_id", userId)
            .order("scheduled_at", { ascending: false })

        if (status) postQuery = postQuery.eq("status", status)
        if (channelIds.length > 0) postQuery = postQuery.in("user_channel_id", channelIds)

        const { data: posts, error } = await postQuery;
        if (error) throw error;

        if (!groupByDate) return NextResponse.json({ posts: posts ?? [] })

        // {date: {label:"", posts:[]}}
        const groupMap = new Map<string, { label: string; posts: typeof posts }>();

        (posts ?? []).forEach((post) => {
            const date = new Date(post.scheduled_at);

            const key = [
                date.getFullYear(),

                String(date.getMonth() + 1).padStart(2, "0"),
                String(date.getDate()).padStart(2, "0")
            ].join("-");

            if (!groupMap.has(key)) {
                groupMap.set(key, { label: formatDayLabel(date), posts: [] });
            }
            groupMap.get(key)!.posts.push(post);
        });

        console.log("groupMap size:", groupMap.size)

        const groupPosts = Array.from(groupMap.entries()).map(([key, value]) => ({
            key,
            ...value
        }));

        return NextResponse.json({ groupPosts })

    } catch (error) {
        console.error("Error getting posts:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}


export async function POST(request: NextRequest) {
    try {
        const { has, userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { insforge } = await getInsforgeServerClient()
        const {
            posts,
            scheduledAt,
            scheduledDates,
            status
        } = await request.json()

        if (status !== undefined && status !== POST_STATUS.DRAFT && status !== POST_STATUS.QUEUE) {
            return NextResponse.json({ error: "Only draft or queue status is allowed" }, { status: 400 })
        }

        if (!Array.isArray(posts) || posts.length === 0) {
            return NextResponse.json({ error: "Posts array is required and cannot be empty" }, { status: 400 })
        }

        const normalizedPosts = posts.filter((post) => !!post).map((post) => ({
            channelTypeId: post.channelTypeId,
            content: post.content,
            images: post.images || [],
            scheduledAt: post.scheduledAt || null,
        }))
        if (normalizedPosts.length === 0) {
            return NextResponse.json({ error: "No valid posts provided" }, { status: 400 })
        }

        const isPaidPlan = has({ plan: "pro" }) || has({ plan: "premium" })
        if (!isPaidPlan) {
            const canCreatePost = await checkCreatePostLimit(insforge, userId)
            if (!canCreatePost) {
                return NextResponse.json({ error: "You have reached your post limit, upgrade" }, { status: 403 })
            }
        }

        const invalidPost = normalizedPosts.find((post) => !post.content);
        if (invalidPost) {
            return NextResponse.json({ error: "Post content is required" }, { status: 400 })
        }

        // Fetch user channels or auto-provision default user channels if not existing
        let { data: userChannels, error: userChannelsError } = await insforge.database
            .from("user_channels")
            .select("id, channel_type_id, is_connected, is_active, channel_types(id, type, name)")
            .eq("user_id", userId);

        if (userChannelsError) {
            return NextResponse.json({ error: "Failed to fetch user channels" }, { status: 500 });
        }

        if (!userChannels || userChannels.length === 0) {
            const { data: channelTypes } = await insforge.database
                .from("channel_types")
                .select("id, type, name")
                .order("created_at", { ascending: true });

            if (channelTypes && channelTypes.length > 0) {
                const toCreate = channelTypes.map((ct) => ({
                    user_id: userId,
                    channel_type_id: ct.id,
                    handle: "@user",
                    is_connected: true,
                    is_active: true,
                }));
                const { data: seeded } = await insforge.database
                    .from("user_channels")
                    .insert(toCreate)
                    .select("id, channel_type_id, is_connected, is_active, channel_types(id, type, name)");
                userChannels = seeded || [];
            }
        }

        if (!userChannels || userChannels.length === 0) {
            return NextResponse.json({ error: "No active channels found" }, { status: 400 });
        }

        // Helper to resolve user_channel for a given channelTypeId
        const resolveUserChannel = (channelTypeId?: string) => {
            if (!userChannels || userChannels.length === 0) return null;
            if (!channelTypeId) return userChannels[0];
            return (
                userChannels.find(
                    (uc: any) =>
                        uc.channel_type_id === channelTypeId ||
                        uc.id === channelTypeId ||
                        String((uc.channel_types as any)?.type).toUpperCase() === String(channelTypeId).toUpperCase()
                ) || userChannels[0]
            );
        };

        const effectiveDates: string[] = Array.isArray(scheduledDates) && scheduledDates.length > 0
            ? scheduledDates.filter((d: any) => typeof d === "string" && Boolean(d.trim()))
            : (scheduledAt ? [scheduledAt] : []);

        if (effectiveDates.length === 0) {
            return NextResponse.json({ error: "Scheduled at or scheduled dates is required" }, { status: 400 });
        }

        // Fetch brand profile for AI persona context (niche, business name, tone)
        const { data: brand } = await insforge.database
            .from("brand_profiles")
            .select("business_name, niche, brand_tone")
            .eq("user_id", userId)
            .maybeSingle();

        const postStatus = status === POST_STATUS.DRAFT ? POST_STATUS.DRAFT : POST_STATUS.QUEUE;

        const payload = effectiveDates.flatMap((dateStr) =>
            normalizedPosts.map((post, postIdx) => {
                const channelRecord = resolveUserChannel(post.channelTypeId);
                const rawType = (channelRecord?.channel_types as any)?.type || "TWITTER";
                const channelType = String(rawType).toUpperCase();

                // Respect the tailored caption from the UI/client
                const tailoredContent = post.content;

                // Support per-channel custom scheduledAt timestamp or default to global scheduledAt dateStr
                const targetScheduledTime = post.scheduledAt || dateStr;
                const scheduledAtDate = new Date(new Date(targetScheduledTime).getTime() + (post.scheduledAt ? 0 : postIdx * 1000));

                return {
                    user_id: userId,
                    user_channel_id: channelRecord?.id,
                    content: tailoredContent,
                    images: post.images,
                    scheduled_at: scheduledAtDate.toISOString(),
                    status: postStatus,
                };
            })
        );

        // console.log(payload,"payload")

        const { data, error } = await insforge.database
            .from("scheduled_posts")
            .insert(payload)
            .select()

        if (error) {
            console.log(error, "error")
            return NextResponse.json({ error: "Failed to create posts" }, { status: 500 })
        }

        // Publish immediately across all selected channels if scheduled for now, or queue
        if (postStatus === POST_STATUS.QUEUE && data && data.length > 0) {
            const dueNowPosts: any[] = [];
            const futurePosts: any[] = [];

            data.forEach((post: any) => {
                const isDueNow = new Date(post.scheduled_at).getTime() <= Date.now() + 120_000;
                if (isDueNow) {
                    dueNowPosts.push(post);
                } else {
                    futurePosts.push(post);
                }
            });

            if (dueNowPosts.length > 0) {
                console.log(`[Publisher] Immediately publishing ${dueNowPosts.length} post(s) simultaneously across channels`);
                await Promise.allSettled(
                    dueNowPosts.map((post: any) => publishPostDirectly(post.id))
                );
            }

            if (futurePosts.length > 0) {
                try {
                    await inngest.send(
                        futurePosts.map((post: any) => ({
                            name: "post/publish.requested",
                            data: { postId: post.id }
                        }))
                    );
                } catch (inngestErr: any) {
                    const isConnRefused =
                        inngestErr?.cause?.code === "ECONNREFUSED" ||
                        inngestErr?.code === "ECONNREFUSED" ||
                        String(inngestErr?.message || "").includes("fetch failed");
                    if (isConnRefused) {
                        console.warn("[Inngest] Local Inngest server not running. Posts are saved to database queue.");
                    } else {
                        console.warn("[Inngest] Background dispatch error:", inngestErr?.message || inngestErr);
                    }
                }
            }
        }

        return NextResponse.json({ posts: data, count: data?.length || 0, scheduledDates: effectiveDates }, { status: 201 })


    } catch (error) {
        console.error("Error creating post:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

async function checkCreatePostLimit(
    insforge: Awaited<ReturnType<typeof getInsforgeServerClient>>["insforge"],
    userId: string,
) {
    const { count, error } = await insforge.database
        .from("scheduled_posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

    if (error) {
        throw error;
    }

    return (count ?? 0) < 100;
}



function formatDayLabel(date: Date) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
        return "Today";
    }
    if (date.toDateString() === tomorrow.toDateString()) {
        return "Tomorrow";
    }
    return date.toLocaleDateString();
}