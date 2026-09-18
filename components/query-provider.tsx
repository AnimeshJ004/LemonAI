"use client";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Global TanStack Query cache configuration for LemonAI.
 *
 * staleTime  — How long a fetched response is considered "fresh".
 *              Within this window, navigating back to a page does NOT trigger a refetch.
 * gcTime     — How long an *unused* query stays in memory before being garbage-collected.
 *              Longer = faster if the user returns to a feature they used earlier in the session.
 *
 * These values complement the server-side AI response cache in `lib/ai-cache.ts`:
 *   • Server cache deduplicates identical LLM calls → saves API cost
 *   • Client cache prevents re-fetching API routes on navigation → saves network + latency
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 3, // 3 min — data stays fresh, no refetch on navigation
            gcTime: 1000 * 60 * 30,   // 30 min — keep cached queries in memory for the session
            refetchOnWindowFocus: false, // Prevent unwanted refetches when switching browser tabs
            refetchOnMount: false,       // Use instant cached data when navigating between views
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}