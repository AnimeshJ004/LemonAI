import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { publishPostDirectly } from "@/lib/direct-publisher";
import { inngest } from "@/inngest/client";
import { pollConnectedChannelsComments } from "@/lib/social-comments-service";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function GET() {
    return handleProcessDue();
}

export async function POST() {
    return handleProcessDue();
}

async function handleProcessDue() {
    try {
        const insforge = getInsforgeAdminClient();
        const now = new Date().toISOString();

        // 1. Fetch all posts in queue whose scheduled time has arrived
        const { data: duePosts, error } = await insforge.database
            .from("scheduled_posts")
            .select("id, status, scheduled_at")
            .eq("status", "queue")
            .lte("scheduled_at", now)
            .order("scheduled_at", { ascending: true });

        if (error) {
            console.error("[Publisher] Error fetching due posts:", error.message);
        }

        let publishedCount = 0;
        let dueCount = 0;

        if (duePosts && duePosts.length > 0) {
            dueCount = duePosts.length;
            console.log(`[Publisher] Processing ${duePosts.length} due post(s) simultaneously across channels`);

            // Directly execute publication across all channels concurrently
            const publishResults = await Promise.allSettled(
                duePosts.map((post) => publishPostDirectly(post.id))
            );

            // Also trigger Inngest as secondary fallback
            try {
                await inngest.send(
                    duePosts.map((post) => ({
                        name: "post/publish.requested",
                        data: { postId: post.id }
                    }))
                );
            } catch {}

            publishedCount = publishResults.filter(
                (r) => r.status === "fulfilled" && (r as any).value?.success
            ).length;
        }

        // 2. Autonomous Comment Engagement Backup
        // Guarantees comments are polled and answered every 60 seconds even if webhooks or Inngest are idle
        let commentSyncStats = { scannedChannels: 0, scannedPosts: 0, repliedCount: 0 };
        try {
            commentSyncStats = await pollConnectedChannelsComments(5);
        } catch (commentErr: any) {
            console.warn("[Process Due] Background comment polling notice:", commentErr?.message);
        }

        return NextResponse.json({
            success: true,
            posts: {
                processedCount: dueCount,
                successfulCount: publishedCount,
                postIds: duePosts?.map((p) => p.id) || [],
            },
            comments: commentSyncStats,
        });
    } catch (error: any) {
        console.error("Error processing due posts & comments:", error);
        return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
    }
}
