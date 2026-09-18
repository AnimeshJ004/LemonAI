import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { publishPostDirectly } from "@/lib/direct-publisher";
import { pollConnectedChannelsComments } from "@/lib/social-comments-service";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { timingSafeEqual } from "crypto";

export const maxDuration = 60;

export async function GET(req: Request) {
    return handleProcessDue(req);
}

export async function POST(req: Request) {
    return handleProcessDue(req);
}

async function handleProcessDue(req: Request) {
    // ─── Authorization ────────────────────────────────────────────────────────
    // Accepts one of two valid callers:
    //   1. External cron scheduler — supplies Authorization: Bearer <CRON_SECRET>
    //   2. Dashboard poller — carries a valid Clerk session cookie (authenticated user)
    //
    // Anonymous requests are always rejected.
    const cronSecret = process.env.CRON_SECRET;

    const authHeader = req.headers.get("authorization") || "";
    const providedToken = authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length).trim()
        : "";

    let authorized = false;

    // Path 1: CRON_SECRET bearer token (external schedulers, Vercel Cron, etc.)
    if (cronSecret && cronSecret.trim().length > 0 && providedToken.length > 0) {
        const providedBuf = Buffer.from(providedToken);
        const expectedBuf = Buffer.from(cronSecret.trim());
        if (
            providedBuf.length === expectedBuf.length &&
            timingSafeEqual(providedBuf, expectedBuf)
        ) {
            authorized = true;
        }
    }

    // Path 2: Valid Clerk session (dashboard poller running as an authenticated user)
    if (!authorized) {
        try {
            const { userId } = await auth();
            if (userId) {
                authorized = true;
            }
        } catch {
            // No Clerk context — keep authorized = false
        }
    }

    if (!authorized) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const insforge = getInsforgeAdminClient();

        // 0. Recover posts stuck in 'publishing' for > 3 min that were never
        //    actually published (guards against cold-start crashes). Only resets
        //    posts that started publishing more than 3 min ago AND have no
        //    published_at timestamp — never touches successfully published posts.
        const threeMinutesAgo = new Date(Date.now() - 180_000).toISOString();
        try {
            await insforge.database
                .from("scheduled_posts")
                .update({ status: "queue" })
                .eq("status", "publishing")
                .lte("publishing_started_at", threeMinutesAgo)
                .is("published_at", null);
        } catch {}

        // 1. Fetch all posts in queue whose scheduled time has arrived (with 60s lookahead buffer)
        const lookaheadNow = new Date(Date.now() + 60_000).toISOString();
        const { data: duePosts, error } = await insforge.database
            .from("scheduled_posts")
            .select("id, status, scheduled_at")
            .eq("status", "queue")
            .lte("scheduled_at", lookaheadNow)
            .order("scheduled_at", { ascending: true });

        if (error) {
            console.error("[Publisher] Error fetching due posts:", error.message);
        }

        let publishedCount = 0;
        let dueCount = 0;

        if (duePosts && duePosts.length > 0) {
            dueCount = duePosts.length;

            // publishPostDirectly uses a CAS lock on status so concurrent
            // invocations cannot double-publish the same post.
            const publishResults = await Promise.allSettled(
                duePosts.map((post) => publishPostDirectly(post.id))
            );

            publishedCount = publishResults.filter(
                (r) => r.status === "fulfilled" && (r as any).value?.success
            ).length;
        }

        // 2. Autonomous Comment Engagement — polls connected channels and
        //    auto-replies using DB-backed idempotency (replied_comments table).
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
