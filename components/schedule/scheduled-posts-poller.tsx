"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * ScheduledPostsPoller
 * Runs silently in the background of the dashboard to trigger due posts
 * and sync post statuses across Instagram, Facebook, Bluesky, Twitter, etc.
 */
export function ScheduledPostsPoller() {
  const queryClient = useQueryClient();
  const isRunningRef = useRef(false);
  const isRunningCommentsRef = useRef(false);

  useEffect(() => {
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
          if (data.successfulCount && data.successfulCount > 0) {
            console.log(`[Poller] Published ${data.successfulCount} due post(s). Refreshing UI.`);
            queryClient.invalidateQueries({
              predicate: (q) => q.queryKey[0] === "posts",
            });
          }
        }
      } catch (err) {
        // Silent catch in background poller
      } finally {
        isRunningRef.current = false;
      }
    }

    // Check for new Instagram comments to auto-reply immediately
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
          if (data.skipped) {
            // No Instagram/Facebook accounts connected; quietly do nothing
            return;
          }
          if (data.repliedCount && data.repliedCount > 0) {
            console.log(`[Auto-Reply Poller] Answered ${data.repliedCount} new comment(s) on Instagram.`);
            queryClient.invalidateQueries({
              predicate: (q) => q.queryKey[0] === "social-comments",
            });
          }
        }
      } catch {
        // Silent catch in background poller
      } finally {
        isRunningCommentsRef.current = false;
      }
    }

    // Stagger initial background sync by 8 seconds so the UI loads instantly without competing for serverless concurrency
    const startupTimer = setTimeout(() => {
      checkDuePosts();
      syncLiveComments();
    }, 8_000);

    // Periodic checks: check due posts every 60s, comments every 45s
    const postInterval = setInterval(checkDuePosts, 60_000);
    const commentInterval = setInterval(syncLiveComments, 45_000);

    return () => {
      clearTimeout(startupTimer);
      clearInterval(postInterval);
      clearInterval(commentInterval);
    };
  }, [queryClient]);

  return null;
}
