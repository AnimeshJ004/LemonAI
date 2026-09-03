"use client";

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, ImageIcon, Loader2, Wand2, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ImageObject } from "@/types/post.type";

interface AIVisualGeneratorProps {
  currentPostText?: string;
  onImageGenerated: (image: ImageObject) => void;
  className?: string;
}

const ASPECT_RATIOS = [
  { id: "1:1" as const, label: "Square (1:1)", sub: "Feed Posts" },
  { id: "9:16" as const, label: "Vertical (9:16)", sub: "Stories / Reels" },
  { id: "16:9" as const, label: "Landscape (16:9)", sub: "Headers / YouTube" },
];

export function AIVisualGenerator({
  currentPostText,
  onImageGenerated,
  className,
}: AIVisualGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "9:16" | "16:9">("1:1");
  const [lastGeneratedUrl, setLastGeneratedUrl] = useState<string | null>(null);

  // Auto-fetch user's saved brand profile for context
  const { data: brandData } = useQuery({
    queryKey: ["brand-profile"],
    queryFn: async () => {
      const res = await fetch("/api/brand");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const brand = brandData?.profile;

  // Auto-formulate prompt from current post text or brand
  const handleAutoPrompt = () => {
    if (currentPostText && currentPostText.trim()) {
      const cleanSnippet = currentPostText
        .replace(/#\S+/g, "")
        .replace(/https?:\/\/\S+/g, "")
        .slice(0, 120)
        .trim();
      const nichePrefix = brand?.niche ? `${brand.niche} commercial visual, ` : "";
      setPrompt(`${nichePrefix}high quality advertising visual representing: ${cleanSnippet}`);
    } else if (brand?.niche) {
      setPrompt(`Modern aesthetic commercial visual for ${brand.business_name || "brand"} (${brand.niche}), studio lighting, award-winning photography`);
    } else {
      setPrompt("Modern high-end commercial visual for social media campaign, vibrant lighting, ultra-detailed");
    }
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const effectivePrompt = prompt.trim() || currentPostText?.slice(0, 100) || "Commercial social media visual banner";
      const res = await fetch("/api/ai/generate-creative-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: effectivePrompt,
          aspectRatio,
          niche: brand?.niche,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate AI visual");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.image?.url) {
        setLastGeneratedUrl(data.image.url);
        onImageGenerated({
          key: data.image.key || `ai-creative-${Date.now()}`,
          url: data.image.url,
        });
        toast.success("AI visual generated & attached to post!");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to generate visual. Please try again.");
    },
  });

  return (
    <div className={cn("flex flex-col h-full rounded-lg border border-border bg-background p-4 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">AI Visual Assistant</h3>
        </div>
        {brand?.business_name && (
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {brand.business_name}
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Generate custom 8K marketing images & video scene backgrounds tailored to your post content.
      </p>

      {/* Aspect Ratio Selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Aspect Ratio Format</label>
        <div className="grid grid-cols-3 gap-2">
          {ASPECT_RATIOS.map((ar) => (
            <button
              key={ar.id}
              type="button"
              onClick={() => setAspectRatio(ar.id)}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all",
                aspectRatio === ar.id
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-border hover:bg-muted text-muted-foreground"
              )}
            >
              <span className="text-xs">{ar.id}</span>
              <span className="text-[9px] opacity-75">{ar.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Box */}
      <div className="space-y-1.5 flex-1 flex flex-col">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground">Visual Description</label>
          <button
            type="button"
            onClick={handleAutoPrompt}
            className="text-[11px] text-primary hover:underline flex items-center gap-1"
          >
            <Wand2 className="size-3" /> Auto-Suggest from Post
          </button>
        </div>
        <Textarea
          placeholder="e.g. Modern electric scooter with sleek neon headlight on city street at sunset, commercial photography"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="text-xs resize-none flex-1 min-h-[80px]"
        />
      </div>

      {/* Action Button */}
      <Button
        type="button"
        onClick={() => generateMutation.mutate()}
        disabled={generateMutation.isPending}
        className="w-full gap-2 text-xs font-medium"
      >
        {generateMutation.isPending ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Generating 8K Visual...
          </>
        ) : (
          <>
            <ImageIcon className="size-3.5" />
            Generate & Attach AI Image
          </>
        )}
      </Button>

      {/* Last Generated Preview */}
      {lastGeneratedUrl && (
        <div className="p-2 rounded-lg border bg-muted/30 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <Check className="size-3" /> Attached to post
            </span>
            <span>{aspectRatio}</span>
          </div>
          <div className="relative aspect-video rounded-md overflow-hidden border bg-background">
            <img
              src={lastGeneratedUrl}
              alt="AI Generated"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}
    </div>
  );
}
