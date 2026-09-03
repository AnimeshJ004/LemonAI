"use client";

import { cn } from "@/lib/utils";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Volume2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useState } from "react";
import Image from "next/image";

export type MockupMode = "instagram_feed" | "instagram_story" | "facebook_feed";

interface AdMockupPreviewProps {
  headline?: string;
  primaryText?: string;
  ctaLabel?: string;
  imageUrl?: string;
  businessName?: string;
  mode?: MockupMode;
  className?: string;
}

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80";

const MODE_LABELS: Record<MockupMode, string> = {
  instagram_feed: "Instagram Feed",
  instagram_story: "Instagram Story",
  facebook_feed: "Facebook Feed",
};

export function AdMockupPreview({
  headline = "Discover What's Possible",
  primaryText = "AI-powered advertising that converts. Get more leads, sales, and growth — starting today.",
  ctaLabel = "Learn More",
  imageUrl,
  businessName = "Your Business",
  mode = "instagram_feed",
  className,
}: AdMockupPreviewProps) {
  const [currentMode, setCurrentMode] = useState<MockupMode>(mode);
  const effectiveImage = imageUrl ?? PLACEHOLDER_IMAGE;
  const modes: MockupMode[] = ["instagram_feed", "instagram_story", "facebook_feed"];
  const currentIndex = modes.indexOf(currentMode);

  const handlePrev = () => {
    const prev = modes[(currentIndex - 1 + modes.length) % modes.length];
    setCurrentMode(prev);
  };
  const handleNext = () => {
    const next = modes[(currentIndex + 1) % modes.length];
    setCurrentMode(next);
  };

  return (
    <div className={cn("flex flex-col items-center gap-3 select-none", className)}>
      {/* Mode Selector */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePrev}
          className="rounded-full p-1.5 bg-muted hover:bg-muted/80 transition-colors"
          aria-label="Previous preview"
        >
          <ChevronLeft className="size-4 text-muted-foreground" />
        </button>
        <div className="flex gap-1.5">
          {modes.map((m) => (
            <button
              key={m}
              onClick={() => setCurrentMode(m)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-all",
                currentMode === m
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <button
          onClick={handleNext}
          className="rounded-full p-1.5 bg-muted hover:bg-muted/80 transition-colors"
          aria-label="Next preview"
        >
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      </div>

      {/* Phone Frame */}
      <div
        className={cn(
          "relative rounded-[2.8rem] border-[8px] border-zinc-800 bg-zinc-800 shadow-2xl overflow-hidden",
          "w-[280px]",
          currentMode === "instagram_story" ? "h-[540px]" : "h-[540px]"
        )}
        style={{
          boxShadow: "0 0 0 2px #3f3f3f, 0 30px 80px rgba(0,0,0,0.45), inset 0 0 20px rgba(0,0,0,0.3)",
        }}
      >
        {/* Notch */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-20 h-4 bg-zinc-800 rounded-full" />

        {/* Screen */}
        <div className="bg-white dark:bg-zinc-950 h-full w-full overflow-hidden rounded-[2rem]">
          {currentMode === "instagram_feed" && (
            <InstagramFeedMockup
              headline={headline}
              primaryText={primaryText}
              ctaLabel={ctaLabel}
              imageUrl={effectiveImage}
              businessName={businessName}
            />
          )}
          {currentMode === "instagram_story" && (
            <InstagramStoryMockup
              headline={headline}
              primaryText={primaryText}
              ctaLabel={ctaLabel}
              imageUrl={effectiveImage}
              businessName={businessName}
            />
          )}
          {currentMode === "facebook_feed" && (
            <FacebookFeedMockup
              headline={headline}
              primaryText={primaryText}
              ctaLabel={ctaLabel}
              imageUrl={effectiveImage}
              businessName={businessName}
            />
          )}
        </div>
      </div>

      {/* Live Badge */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        Live Preview — {MODE_LABELS[currentMode]}
      </div>
    </div>
  );
}

// ─── Instagram Feed Mockup ────────────────────────────────────────────────────
function InstagramFeedMockup({
  headline,
  primaryText,
  ctaLabel,
  imageUrl,
  businessName,
}: {
  headline: string;
  primaryText: string;
  ctaLabel: string;
  imageUrl: string;
  businessName: string;
}) {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white dark:bg-zinc-950">
      {/* IG Top Bar */}
      <div className="flex items-center justify-between px-3 pt-6 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <svg viewBox="0 0 24 24" className="w-20 h-5 fill-zinc-900 dark:fill-white" xmlns="http://www.w3.org/2000/svg">
          <text x="0" y="18" fontSize="14" fontFamily="'Billabong', cursive, sans-serif" fontStyle="italic">Instagram</text>
        </svg>
        <div className="flex gap-3 text-zinc-800 dark:text-zinc-200">
          <Heart className="size-5" />
          <Send className="size-5" />
        </div>
      </div>

      {/* Stories Row */}
      <div className="flex gap-3 px-3 py-2 overflow-x-hidden">
        {["Your Story", businessName.substring(0, 8), "Business", "Ads"].map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
            <div
              className={cn(
                "size-10 rounded-full border-2 flex items-center justify-center text-[8px] font-bold text-white",
                i === 0
                  ? "border-zinc-300 bg-zinc-200 dark:bg-zinc-700 dark:border-zinc-600"
                  : "border-transparent bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600"
              )}
            >
              {i === 0 ? "+" : s.charAt(0)}
            </div>
            <span className="text-[8px] text-zinc-600 dark:text-zinc-400 truncate w-10 text-center">{s}</span>
          </div>
        ))}
      </div>

      {/* Post */}
      <div className="flex-1">
        {/* Post Header */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
              <div className="size-full rounded-full bg-white dark:bg-zinc-950 flex items-center justify-center text-[9px] font-bold text-zinc-900 dark:text-white">
                {businessName.charAt(0).toUpperCase()}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-zinc-900 dark:text-white leading-none">
                {businessName.substring(0, 16)}
              </p>
              <p className="text-[8px] text-zinc-500 mt-0.5">Sponsored</p>
            </div>
          </div>
          <MoreHorizontal className="size-4 text-zinc-600 dark:text-zinc-400" />
        </div>

        {/* Image */}
        <div className="relative w-full aspect-square bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <img
            src={imageUrl}
            alt="Ad creative"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex gap-3">
            <Heart className="size-5 text-zinc-800 dark:text-zinc-200" />
            <MessageCircle className="size-5 text-zinc-800 dark:text-zinc-200" />
            <Send className="size-5 text-zinc-800 dark:text-zinc-200" />
          </div>
          <Bookmark className="size-5 text-zinc-800 dark:text-zinc-200" />
        </div>

        {/* CTA */}
        <div className="mx-3 mb-2 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <div className="bg-zinc-50 dark:bg-zinc-800 px-3 py-2">
            <p className="text-[9px] font-semibold text-zinc-900 dark:text-white truncate">{headline}</p>
            <p className="text-[8px] text-zinc-500 truncate">{primaryText.substring(0, 40)}...</p>
          </div>
          <button className="w-full py-2 bg-[#1877F2] text-white text-[10px] font-semibold tracking-wide">
            {ctaLabel}
          </button>
        </div>

        {/* Caption */}
        <div className="px-3 pb-3">
          <p className="text-[9px] text-zinc-800 dark:text-zinc-200 leading-relaxed">
            <span className="font-semibold">{businessName.substring(0, 10)}</span>{" "}
            {primaryText.substring(0, 60)}...
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Instagram Story Mockup ───────────────────────────────────────────────────
function InstagramStoryMockup({
  headline,
  primaryText,
  ctaLabel,
  imageUrl,
  businessName,
}: {
  headline: string;
  primaryText: string;
  ctaLabel: string;
  imageUrl: string;
  businessName: string;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Background Image */}
      <img
        src={imageUrl}
        alt="Story background"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

      {/* Progress Bars */}
      <div className="absolute top-6 left-3 right-3 flex gap-1">
        {[100, 0].map((p, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full" style={{ width: `${p}%` }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-8 left-3 right-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
            <div className="size-full rounded-full bg-white flex items-center justify-center text-[8px] font-bold text-zinc-900">
              {businessName.charAt(0)}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-semibold text-white">{businessName.substring(0, 14)}</p>
            <p className="text-[7px] text-white/70">Sponsored · now</p>
          </div>
        </div>
        <div className="flex gap-2">
          <MoreHorizontal className="size-4 text-white" />
          <X className="size-4 text-white" />
        </div>
      </div>

      {/* Text Overlay */}
      <div className="absolute bottom-20 left-3 right-3">
        <p className="text-white font-bold text-sm leading-snug drop-shadow-lg mb-1">{headline}</p>
        <p className="text-white/80 text-[9px] leading-relaxed drop-shadow">{primaryText.substring(0, 80)}...</p>
      </div>

      {/* Swipe Up / CTA */}
      <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-1">
        <Volume2 className="size-3 text-white/60 rotate-90" />
        <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-4 py-1.5">
          <p className="text-white text-[10px] font-semibold">{ctaLabel} ↑</p>
        </div>
      </div>
    </div>
  );
}

// ─── Facebook Feed Mockup ─────────────────────────────────────────────────────
function FacebookFeedMockup({
  headline,
  primaryText,
  ctaLabel,
  imageUrl,
  businessName,
}: {
  headline: string;
  primaryText: string;
  ctaLabel: string;
  imageUrl: string;
  businessName: string;
}) {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#f0f2f5] dark:bg-zinc-900">
      {/* FB Top bar */}
      <div className="bg-[#1877F2] px-3 pt-6 pb-2 flex items-center justify-between">
        <span className="text-white font-bold text-base">facebook</span>
        <div className="flex gap-2">
          <div className="size-7 rounded-full bg-white/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="size-4 fill-white"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          </div>
          <div className="size-7 rounded-full bg-white/20 flex items-center justify-center">
            <MessageCircle className="size-4 text-white" />
          </div>
        </div>
      </div>

      {/* Post Card */}
      <div className="bg-white dark:bg-zinc-800 mt-2 mx-0">
        {/* Post Header */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-full bg-[#1877F2] flex items-center justify-center text-white font-bold text-sm">
              {businessName.charAt(0)}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-zinc-900 dark:text-white">{businessName.substring(0, 18)}</p>
              <div className="flex items-center gap-1">
                <p className="text-[8px] text-zinc-500">Sponsored · </p>
                <svg viewBox="0 0 16 16" className="size-2 fill-zinc-400"><path d="M8 0a8 8 0 100 16A8 8 0 008 0z"/></svg>
              </div>
            </div>
          </div>
          <MoreHorizontal className="size-4 text-zinc-500" />
        </div>

        {/* Caption */}
        <p className="px-3 pb-2 text-[9px] text-zinc-800 dark:text-zinc-200 leading-relaxed">
          {primaryText.substring(0, 90)}...
        </p>

        {/* Image */}
        <div className="w-full aspect-video bg-zinc-100 overflow-hidden">
          <img src={imageUrl} alt="Ad" className="w-full h-full object-cover" />
        </div>

        {/* Headline + CTA strip */}
        <div className="flex items-center justify-between bg-[#f0f2f5] dark:bg-zinc-700 px-3 py-2">
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-[9px] font-semibold text-zinc-900 dark:text-white truncate">{headline}</p>
            <p className="text-[8px] text-zinc-500 truncate">{window !== undefined ? new URL(process.env.NEXT_PUBLIC_APP_URL ?? "example.com").hostname : "example.com"}</p>
          </div>
          <button className="bg-[#e4e6eb] dark:bg-zinc-600 text-[9px] font-semibold text-zinc-800 dark:text-white rounded px-2 py-1.5 whitespace-nowrap shrink-0">
            {ctaLabel}
          </button>
        </div>

        {/* Reactions Row */}
        <div className="px-3 py-2 border-t border-zinc-100 dark:border-zinc-700">
          <div className="flex justify-between">
            {["👍 Like", "💬 Comment", "↗ Share"].map((a) => (
              <button key={a} className="text-[9px] text-zinc-500 font-medium flex-1 text-center py-1">
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
