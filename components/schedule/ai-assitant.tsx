"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Repeat, Minus, Plus, Wand2Icon, ImageIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "../ui/spinner";
import { ImageObject } from "@/types/post.type";

const QUICK_ACTIONS = [
  { icon: Repeat, label: "Rephrase" },
  { icon: Minus, label: "Shorten" },
  { icon: Plus, label: "Expand" },
];

export interface AIAssistantGeneratedData {
  content: string;
  schedule?: { date: string; time: string } | null;
  autoSchedule?: boolean;
  channels?: string[] | null;
  image?: ImageObject | null;
}

interface AIAssistantProps {
  onGenerate?: (data: AIAssistantGeneratedData | string) => void;
  className?: string;
  content?: string;
  channelId?: string;
}

export function AIAssistant({ className, content, channelId, onGenerate }: AIAssistantProps) {
  const [prompt, setPrompt] = React.useState("");
  const [generateImage, setGenerateImage] = React.useState(true);
  const [aspectRatio, setAspectRatio] = React.useState<"1:1" | "9:16" | "16:9">("1:1");

  // Fetch client brand profile for personalized context
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

  const generateMutation = useMutation({
    mutationFn: async ({
      action,
      promptText,
    }: {
      action: string;
      promptText?: string;
    }) => {
      const res = await fetch("/api/post/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          prompt: promptText,
          content,
          channelId,
          generateImage,
          aspectRatio,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to generate post");
      }
      return res.json();
    },
    onSuccess: (data) => {
      onGenerate?.(data);
      if (data.image) {
        toast.success("AI Caption & Professional Photo attached to post!");
      } else if (data.schedule?.date && data.schedule?.time) {
        toast.success(`Generated & scheduled for ${data.schedule.date} at ${data.schedule.time}`);
      } else {
        toast.success("Post content generated with AI!");
      }
      setPrompt("");
    },
    onError: (error: unknown) => {
      console.error("Generation error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to generate post. Please try again.";
      toast.error(message);
    },
  });

  const handleQuickAction = (label: string) => {
    generateMutation.mutate({
      action: label.toLowerCase(),
    });
  };

  const handleGenerate = () => {
    if (prompt.trim()) {
      generateMutation.mutate({
        action: "generate",
        promptText: prompt.trim(),
      });
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full rounded-lg border border-border bg-background p-4 space-y-3",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2Icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            All-in-One AI Assistant
          </span>
        </div>
        {brand?.business_name && (
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {brand.business_name}
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Tell AI what to write, what photo to generate, and when/where to schedule in one prompt.
      </p>

      {/* Textarea for unified prompt */}
      <div className="flex flex-col gap-2.5 flex-1">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Generate a post for doctors with professional clinic photo, best caption & schedule on Bluesky today at 3:15 PM"
          className="w-full min-h-[110px] resize-none text-xs"
        />

        {/* Visual Format Options */}
        <div className="p-2.5 rounded-lg border bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={generateImage}
                onChange={(e) => setGenerateImage(e.target.checked)}
                className="size-3.5 rounded border-border text-primary focus:ring-primary"
              />
              <span className="flex items-center gap-1">
                <ImageIcon className="size-3.5 text-primary" /> Generate & Attach AI Photo
              </span>
            </label>
          </div>

          {generateImage && (
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {[
                { id: "1:1" as const, label: "Square (1:1)", sub: "Feed" },
                { id: "9:16" as const, label: "Vertical (9:16)", sub: "Story/Reel" },
                { id: "16:9" as const, label: "Landscape (16:9)", sub: "Wide" },
              ].map((ar) => (
                <button
                  key={ar.id}
                  type="button"
                  onClick={() => setAspectRatio(ar.id)}
                  className={cn(
                    "py-1 px-1.5 rounded-md border text-center text-[10px] transition-all",
                    aspectRatio === ar.id
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <div className="font-medium">{ar.id}</div>
                  <div className="text-[8px] opacity-75">{ar.sub}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          size="lg"
          onClick={handleGenerate}
          disabled={!prompt.trim() || generateMutation.isPending}
          className="w-full gap-2 text-xs font-medium"
        >
          {generateMutation.isPending ? (
            <>
              <Spinner className="h-4 w-4" />
              Generating Post & Media...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Post & Visuals
            </>
          )}
        </Button>
      </div>

      {content && content.trim() && (
        <div className="pt-2 border-t">
          <p className="mb-1.5 text-[11px] text-muted-foreground font-medium">Quick copy actions:</p>
          <div className="grid grid-cols-3 gap-1.5">
            {QUICK_ACTIONS.map(({ icon: Icon, label }) => (
              <Button
                key={label}
                variant="outline"
                size="sm"
                className="gap-1 text-xs h-7 px-2"
                onClick={() => handleQuickAction(label)}
                disabled={generateMutation.isPending}
              >
                <Icon className="h-3 w-3 text-primary" />
                {label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
