"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { LeafIcon } from "lucide-react";

interface ModernLoaderProps {
  label?: string;
  description?: string;
  fullScreen?: boolean;
  showSkeleton?: boolean;
  className?: string;
}

export function ModernLoader({
  label = "Loading...",
  description,
  fullScreen = false,
  showSkeleton = false,
  className,
}: ModernLoaderProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center min-w-0 w-full overflow-hidden transition-all duration-300",
        fullScreen
          ? "fixed inset-0 z-50 bg-background/80 backdrop-blur-md"
          : "min-h-[360px] h-full flex-1 py-12 px-4",
        className
      )}
    >
      {/* Background Skeleton Blueprint (Optional for Dashboard Navigation) */}
      {showSkeleton && (
        <div
          aria-hidden="true"
          className="absolute inset-0 p-4 md:p-6 flex flex-col gap-4 pointer-events-none opacity-40 dark:opacity-25 animate-pulse"
        >
          {/* Top Bar Skeleton */}
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="h-7 w-36 rounded-lg bg-muted" />
              <div className="h-5 w-20 rounded-md bg-muted/60 hidden sm:block" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-24 rounded-lg bg-muted/70" />
              <div className="h-8 w-8 rounded-lg bg-muted" />
            </div>
          </div>

          {/* Metric / Action Cards Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-card border border-border/40 p-4 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-20 rounded bg-muted" />
                  <div className="h-5 w-5 rounded-md bg-muted/70" />
                </div>
                <div className="h-6 w-16 rounded bg-muted/90" />
              </div>
            ))}
          </div>

          {/* Main Board / Table Skeleton */}
          <div className="flex-1 rounded-xl bg-card border border-border/40 p-5 mt-1 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-5 w-44 rounded bg-muted" />
              <div className="h-8 w-32 rounded-lg bg-muted/70" />
            </div>
            <div className="space-y-3 pt-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-12 w-full rounded-lg bg-muted/40 flex items-center justify-between px-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-6 rounded-full bg-muted/70" />
                    <div className="h-4 w-32 rounded bg-muted/80" />
                  </div>
                  <div className="h-4 w-20 rounded bg-muted/60" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modern Minimalist Glassmorphic Card */}
      <div className="relative z-10 flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl bg-card/75 dark:bg-card/50 backdrop-blur-xl border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-300 max-w-sm w-full mx-auto text-center">
        {/* Animated Minimal Spinner Ring + Brand Center */}
        <div className="relative size-16 flex items-center justify-center mb-4">
          {/* Subtle ambient glow behind the ring */}
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-lg animate-pulse" />

          {/* Smooth spinning SVG track */}
          <svg
            className="size-full animate-spin text-primary"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ animationDuration: "1.2s" }}
          >
            <circle
              className="opacity-15 stroke-foreground/40 dark:stroke-white/30"
              cx="24"
              cy="24"
              r="20"
              strokeWidth="3.5"
            />
            <path
              className="stroke-primary"
              d="M 24 4 A 20 20 0 0 1 44 24"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>

          {/* Concentric subtle inner ring */}
          <div className="absolute inset-2.5 rounded-full border border-primary/25 dark:border-primary/35 flex items-center justify-center">
            {/* Center Lemon AI Icon with breathing pulse */}
            <div className="size-6 rounded-md bg-primary/15 dark:bg-primary/25 flex items-center justify-center text-primary transition-transform duration-700 hover:scale-110">
              <LeafIcon className="size-3.5 animate-pulse text-primary" />
            </div>
          </div>
        </div>

        {/* Status Text */}
        <div className="space-y-1.5 flex flex-col items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {label}
            </span>
            <span className="inline-flex gap-0.5 items-center">
              <span className="size-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
              <span className="size-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
              <span className="size-1 rounded-full bg-primary animate-bounce" />
            </span>
          </div>

          {description ? (
            <p className="text-xs text-muted-foreground max-w-[240px] leading-relaxed">
              {description}
            </p>
          ) : (
            <p className="text-[11px] font-medium text-muted-foreground/80 tracking-wide uppercase">
              Lemon.ai Workspace
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ModernLoader;
