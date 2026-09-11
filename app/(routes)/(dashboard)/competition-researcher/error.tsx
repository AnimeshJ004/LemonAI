"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function CompetitionResearcherErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Competition researcher page error:", error);
  }, [error]);

  return (
    <div className="max-w-xl mx-auto my-12 p-6 rounded-2xl border bg-card text-center space-y-4 shadow-sm">
      <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
        <AlertCircle className="size-6" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-bold text-foreground">Something went wrong</h2>
        <p className="text-xs text-muted-foreground">
          {error?.message || "An unexpected error occurred while loading competition researcher."}
        </p>
      </div>
      <div className="flex items-center justify-center gap-2 pt-2">
        <Button
          onClick={() => reset()}
          size="sm"
          className="text-xs font-semibold gap-1.5"
        >
          <RefreshCw className="size-3.5" />
          Try Again
        </Button>
      </div>
    </div>
  );
}
