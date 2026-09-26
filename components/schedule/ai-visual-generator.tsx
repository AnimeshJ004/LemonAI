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
  const [generatedImages, setGeneratedImages] = useState<ImageObject[]>([]);

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
          brandProfile: brand,
          numOutputs: 4,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate AI visual");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.images && data.images.length > 0) {
        setGeneratedImages(data.images.map((img: any) => ({
          key: img.key || `ai-creative-${Date.now()}-${Math.random()}`,
          url: img.url,
        })));
        toast.success(`Generated ${data.images.length} visual variations! Click one to attach.`);
      } else if (data.image?.url) { // fallback for older API
        setGeneratedImages([{
          key: data.image.key || `ai-creative-${Date.now()}`,
          url: data.image.url,
        }]);
        toast.success("AI visual generated!");
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
            Generating 8K Visuals...
          </>
        ) : (
          <>
            <ImageIcon className="size-3.5" />
            Generate Visual Variations
          </>
        )}
      </Button>

      {/* Generated Images Grid */}
      {generatedImages.length > 0 && (
        <div className="pt-2 space-y-2 border-t">
          <label className="text-xs font-medium text-foreground">Select an Image to Attach:</label>
          <div className="grid grid-cols-2 gap-2">
            {generatedImages.map((img, index) => (
              <button
                key={img.key || index}
                type="button"
                onClick={() => {
                  onImageGenerated(img);
                  toast.success("Image attached to post!");
                }}
                className="relative group rounded-md overflow-hidden border bg-muted aspect-video hover:ring-2 hover:ring-primary transition-all"
              >
                <img
                  src={img.url}
                  alt={`AI Generated ${index + 1}`}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Check className="size-6 text-white" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

