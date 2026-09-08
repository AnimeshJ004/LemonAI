import { publishPostDirectly } from "@/lib/direct-publisher";
import { inngest } from "@/inngest/client";
import { getInsforgeServerClient } from "@/lib/insforge-server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { insforge, userId } = await getInsforgeServerClient();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: post, error: postError } = await insforge.database
            .from("scheduled_posts")
            .select("id, status")
            .eq("id", id)
            .eq("user_id", userId)
            .single();

        if (postError || !post) {
            return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }
        if (post.status === "published") {
            return NextResponse.json({ error: "Post already published" }, { status: 400 });
        }

        // 1. Directly execute publication across social media
        console.log(`[Publisher] Direct publish requested for post ${id}`);
        const publishResult = await publishPostDirectly(id);

        // 2. Also send inngest event if available as backup
        try {
            await inngest.send({
                name: "post/publish.requested",
                data: { postId: id }
            });
        } catch {}

        if (publishResult.success) {
            return NextResponse.json({
                success: true,
                publishedUrl: publishResult.publishedUrl,
                simulated: publishResult.simulated,
            });
        } else {
            return NextResponse.json({
                success: false,
                error: publishResult.error || "Publishing failed",
            }, { status: 400 });
        }

    } catch (error: any) {
        console.error("Error in publish route:", error);
        return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
    }
}
