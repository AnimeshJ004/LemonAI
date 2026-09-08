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

    // Initial check on mount
    checkDuePosts();

    // Periodic check every 45 seconds
    const interval = setInterval(checkDuePosts, 45_000);

    return () => clearInterval(interval);
  }, [queryClient]);

  return null;
}
