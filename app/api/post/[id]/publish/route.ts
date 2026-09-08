import { inngest } from "@/inngest/client";
import { getInsforgeServerClient } from "@/lib/insforge-server";
import { executePostPublishDirectly } from "@/inngest/functions/publish-scheduled-posts";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    try {
        const {id} = await params;
        const {insforge, userId} = await getInsforgeServerClient();
        if(!userId) {
            return NextResponse.json({error:"Unauthorized"}, {status:401});
        }

        const {data: post, error: postError} = await insforge.database
            .from("scheduled_posts")
            .select("id, status")
            .eq("id", id)
            .eq("user_id", userId)
            .single();
        
        if(postError || !post) {
            return NextResponse.json({error:"Post not found"}, {status:404});
        }

        // Execute direct publish immediately
        const publishResult = await executePostPublishDirectly(id);

        try {
            await inngest.send({
                name: "post/publish.requested",
                data: {
                    postId: id
                }
            });
        } catch {}

        if (!publishResult.success) {
            return NextResponse.json({
                error: publishResult.error || "Publishing failed",
                provider: publishResult.provider,
            }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            publishedUrl: publishResult.publishedUrl,
            provider: publishResult.provider,
        });
        
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
    }
}
