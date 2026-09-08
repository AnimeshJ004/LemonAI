import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { publishPostDirectly } from "@/lib/direct-publisher";
import { inngest } from "@/inngest/client";
import { NextResponse } from "next/server";

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

        // Fetch all posts in queue whose scheduled time has arrived
        const { data: duePosts, error } = await insforge.database
            .from("scheduled_posts")
            .select("id, status, scheduled_at")
            .eq("status", "queue")
            .lte("scheduled_at", now)
            .order("scheduled_at", { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!duePosts || duePosts.length === 0) {
            return NextResponse.json({ message: "No due posts found", count: 0 });
        }

        console.log(`[Publisher] Processing ${duePosts.length} due post(s) simultaneously across channels`);

        // 1. Directly execute publication across all channels concurrently
        const publishResults = await Promise.allSettled(
            duePosts.map((post) => publishPostDirectly(post.id))
        );

        // 2. Also trigger Inngest as secondary fallback
        try {
            await inngest.send(
                duePosts.map((post) => ({
                    name: "post/publish.requested",
                    data: { postId: post.id }
                }))
            );
        } catch {}

        const successful = publishResults.filter(
            (r) => r.status === "fulfilled" && (r as any).value?.success
        ).length;

        return NextResponse.json({
            success: true,
            processedCount: duePosts.length,
            successfulCount: successful,
            postIds: duePosts.map((p) => p.id),
        });
    } catch (error: any) {
        console.error("Error processing due posts:", error);
        return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
    }
}

