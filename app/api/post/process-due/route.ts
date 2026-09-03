import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { inngest } from "@/inngest/client";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const insforge = getInsforgeAdminClient();
        const now = new Date().toISOString();

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

        const eventPromises = duePosts.map((post) =>
            inngest.send({
                name: "post/publish.requested",
                data: {
                    postId: post.id,
                },
            }).catch((err) => {
                console.warn(`[Inngest] Send event notice for post ${post.id}:`, err?.message || err);
            })
        );

        await Promise.allSettled(eventPromises);

        return NextResponse.json({
            success: true,
            processedCount: duePosts.length,
            postIds: duePosts.map((p) => p.id),
        });
    } catch (error: any) {
        console.error("Error processing due posts:", error);
        return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
    }
}
