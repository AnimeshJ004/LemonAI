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
      try {
        const res = await fetch("/api/social/sync-now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.repliedCount && data.repliedCount > 0) {
            console.log(`[Auto-Reply Poller] Answered ${data.repliedCount} new comment(s) on Instagram.`);
            queryClient.invalidateQueries({
              predicate: (q) => q.queryKey[0] === "social-comments",
            });
          }
        }
      } catch {
        // Silent catch in background poller
      }
    }

    // Initial checks on mount
    checkDuePosts();
    syncLiveComments();

    // Periodic checks: posts every 45s, comments every 20s for immediate replies
    const postInterval = setInterval(checkDuePosts, 45_000);
    const commentInterval = setInterval(syncLiveComments, 20_000);

    return () => {
      clearInterval(postInterval);
      clearInterval(commentInterval);
    };
  }, [queryClient]);

  return null;
}
