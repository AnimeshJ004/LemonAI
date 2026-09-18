"use client";

import { BrandedPostCreator } from "@/components/studio/branded-post-creator";
import { Sparkles } from "lucide-react";

export default function BrandedPostsPage() {
  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-amber-500/10 via-primary/10 to-background p-6 shadow-xs">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Sparkles className="size-3.5" /> Instagram Visual Engine
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
            Branded Instagram Graphic Creator
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Generate high-converting feed graphics with ultra-realistic AI backgrounds, high-fashion gradient scrims, and sharp overlay text perfectly tailored to your Brand Profile and Instagram handle.
          </p>
        </div>
      </div>

      <BrandedPostCreator />
    </div>
  );
}
