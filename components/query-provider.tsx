"use client";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 3, // Data stays fresh for 3 minutes (0ms cache hits on navigation)
            gcTime: 1000 * 60 * 15, // Keep cached queries in memory for 15 minutes
            refetchOnWindowFocus: false, // Prevent unwanted refetches when switching browser tabs
            refetchOnMount: false, // Use instant cached data when navigating between views
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