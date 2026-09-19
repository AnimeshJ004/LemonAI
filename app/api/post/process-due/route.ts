import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { timingSafeEqual } from "crypto";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { inngest } from "@/inngest/client";
import { reportError, logInfo } from "@/lib/observability";

/**
 * /api/post/process-due — THIN FAN-OUT
 *
 * Historical note: this route used to publish posts and poll comments
 * synchronously inside its 60-second HTTP window, which timed out on busy
 * tenants and burned Vercel function budget. It is now a pure dispatcher:
 *
 *   1. Recover posts stuck in 'publishing' > 3 min (fast SQL update).
 *   2. Fetch due posts (fast SQL select).
 *   3. Fan out one `post/publish.requested` Inngest event per due post.
 *   4. Return immediately.
 *
 * All heavy work (publishing to social APIs, comment polling, DM polling)
 * happens in Inngest background functions with their own retries,
 * concurrency limits, and throttling — see `inngest/functions/*`.
 *
 * Typical response time: < 500ms even with hundreds of due posts.
 *
 * Authorization: identical to the previous version — accepts either a
 * `Bearer <CRON_SECRET>` header (Vercel Cron, external scheduler) or a
 * valid Clerk session (dashboard poller).
 */

// This handler is intentionally cheap. Keep the maxDuration modest so the
// function slot returns to the pool quickly.
export const maxDuration = 15;

export async function GET(req: Request) {
  return handleProcessDue(req);
}

export async function POST(req: Request) {
  return handleProcessDue(req);
}

async function handleProcessDue(req: Request) {
  const startedAt = Date.now();

  // ─── Authorization ────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  const providedToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  let authorized = false;

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

  if (!authorized) {
    try {
      const { userId } = await auth();
      if (userId) authorized = true;
    } catch {
      // no clerk context — keep authorized = false
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const insforge = getInsforgeAdminClient();

    // ─── Step 1: recover stuck 'publishing' posts (fast SQL update) ─────
    // Posts that started publishing > 3 min ago and never completed are reset
    // to 'queue' so the next tick can retry. This guards against cold-start
    // crashes and dropped Inngest events.
    const threeMinutesAgo = new Date(Date.now() - 180_000).toISOString();
    try {
      await insforge.database
        .from("scheduled_posts")
        .update({ status: "queue" })
        .eq("status", "publishing")
        .lte("publishing_started_at", threeMinutesAgo)
        .is("published_at", null);
    } catch (recoveryErr) {
      // Never fail the whole fan-out for a recovery hiccup.
      await reportError(recoveryErr, {
        scope: "process-due.recovery",
      }, "warning");
    }

    // ─── Step 2: fetch due posts (fast SQL select) ──────────────────────
    // 60-second lookahead buffer catches posts that are about to be due,
    // keeping the effective scheduling accuracy within a minute even if
    // the cron ticks slightly early.
    const lookaheadNow = new Date(Date.now() + 60_000).toISOString();
    const { data: duePosts, error } = await insforge.database
      .from("scheduled_posts")
      .select("id, user_id, scheduled_at")
      .eq("status", "queue")
      .lte("scheduled_at", lookaheadNow)
      .order("scheduled_at", { ascending: true })
      .limit(500); // hard cap — anything beyond this waits for the next tick

    if (error) {
      await reportError(error, { scope: "process-due.fetch" }, "warning");
    }

    // ─── Step 3: fan out one Inngest event per due post ─────────────────
    let dispatched = 0;
    if (duePosts && duePosts.length > 0) {
      try {
        await inngest.send(
          duePosts.map((post) => ({
            name: "post/publish.requested",
            data: {
              postId: post.id,
              userId: post.user_id, // enables per-user Inngest concurrency scoping
            },
          }))
        );
        dispatched = duePosts.length;
      } catch (inngestErr: any) {
        // Even if the Inngest client is unreachable, we do NOT crash — the
        // next cron tick will retry. Failure is logged and reported.
        await reportError(inngestErr, { scope: "process-due.dispatch" }, "warning");
      }
    }

    const elapsedMs = Date.now() - startedAt;
    logInfo("Process-due fan-out complete", {
      scope: "process-due",
      extra: { dueCount: duePosts?.length ?? 0, dispatched, elapsedMs },
    });

    return NextResponse.json({
      success: true,
      dueCount: duePosts?.length ?? 0,
      dispatched,
      elapsedMs,
      // NOTE: comment polling and DM polling run on their own Inngest crons
      // (`pollPostComments`, `pollSocialDMs`). They are no longer executed
      // inline in this route.
    });
  } catch (err: any) {
    await reportError(err, { scope: "process-due" }, "error");
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
