"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * ScheduledPostsPoller
 *
 * ⚠ DEPRECATED for production. Vercel Cron now drives `/api/post/process-due`
 * every minute (see `vercel.json → crons`), and Inngest crons drive comment
 * polling and DM polling directly. Hammering the API from every open browser
 * tab creates avoidable serverless invocations, cost, and rate-limit pressure.
 *
 * The component is retained as an emergency fallback that can be re-enabled
 * by setting `NEXT_PUBLIC_ENABLE_CLIENT_POLLER=true`. When the flag is unset
 * or "false" (the default), the component renders nothing and starts no
 * intervals — the return type is unchanged so no caller needs to update.
 *
 * The React Query cache still invalidates naturally on user-initiated events
 * (post create, edit, delete, publish-now), so users see fresh state without
 * the client-side polling.
 */
export function ScheduledPostsPoller() {
  const queryClient = useQueryClient();
  const isRunningRef = useRef(false);
  const isRunningCommentsRef = useRef(false);

  // Default ON to ensure near-instant (30s) comment synchronization while user is on dashboard
  const enabled = process.env.NEXT_PUBLIC_ENABLE_CLIENT_POLLER !== "false";

  useEffect(() => {
    if (!enabled) return;

    async function checkDuePosts() {
      if (isRunningRef.current) return;
      isRunningRef.current = true;

      try {
        const res = await fetch("/api/post/process-due", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.dispatched && data.dispatched > 0) {
            queryClient.invalidateQueries({
              predicate: (q) => q.queryKey[0] === "posts",
            });
          }
        }
      } catch {
        // Silent — this is a best-effort fallback only.
      } finally {
        isRunningRef.current = false;
      }
    }

    async function syncLiveComments() {
      if (isRunningCommentsRef.current) return;
      isRunningCommentsRef.current = true;

      try {
        const res = await fetch("/api/social/sync-now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.repliedCount && data.repliedCount > 0) {
            queryClient.invalidateQueries({
              predicate: (q) => q.queryKey[0] === "social-comments",
            });
          }
        }
      } catch {
        // Silent
      } finally {
        isRunningCommentsRef.current = false;
      }
    }

    const startupTimer = setTimeout(() => {
      checkDuePosts();
      syncLiveComments();
    }, 4_000);

    const postInterval = setInterval(checkDuePosts, 60_000);
    const commentInterval = setInterval(syncLiveComments, 30_000);

    return () => {
      clearTimeout(startupTimer);
      clearInterval(postInterval);
      clearInterval(commentInterval);
    };
  }, [enabled, queryClient]);

  return null;
}
