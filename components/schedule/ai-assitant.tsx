"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Repeat, Minus, Plus } from "lucide-react";
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
  isMultiDay?: boolean;
  scheduledCount?: number;
}

interface AIAssistantProps {
  onGenerate?: (data: AIAssistantGeneratedData | string) => void;
  className?: string;
  content?: string;
  channelId?: string;
}

export function AIAssistant({ className, content, channelId, onGenerate }: AIAssistantProps) {
  const queryClient = useQueryClient();
  const [plannerMode, setPlannerMode] = React.useState<"single" | "multi">("single");
  const [prompt, setPrompt] = React.useState("");
  const [daysCount, setDaysCount] = React.useState<number>(1);
  const [postsPerDay, setPostsPerDay] = React.useState<number>(1);
  const [targetChannel, setTargetChannel] = React.useState<string>("all");
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

  const isMultiActive = plannerMode === "multi" && (daysCount > 1 || postsPerDay > 1);
  const totalPosts = isMultiActive ? daysCount * postsPerDay : 1;

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
          daysCount: plannerMode === "single" ? 1 : daysCount,
          postsPerDay: plannerMode === "single" ? 1 : postsPerDay,
          targetChannel,
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
      if (data.isMultiDay || (data.scheduledCount && data.scheduledCount > 1)) {
        toast.success(`Generated & scheduled ${data.scheduledCount || totalPosts} posts across your calendar`);
        queryClient.invalidateQueries({ queryKey: ["posts"] });
        queryClient.invalidateQueries({ queryKey: ["scheduled-posts"] });
        queryClient.invalidateQueries({ queryKey: ["calendar-posts"] });
      } else if (data.image) {
        toast.success("AI Caption & Professional Photo attached to post");
      } else if (data.schedule?.date && data.schedule?.time) {
        toast.success(`Generated & scheduled for ${data.schedule.date} at ${data.schedule.time}`);
      } else {
        toast.success("Post content generated with AI");
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
        <span className="text-sm font-semibold text-foreground">
          AI Assistant
        </span>
        {brand?.business_name ? (
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
            {brand.business_name}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
            Brand DNA Active
          </span>
        )}
      </div>

      {/* Mode Switcher: Single Post vs Multi-Day Planner */}
      <div className="grid grid-cols-2 p-0.5 rounded-lg bg-muted/60 border border-border/50 text-[11px] font-semibold">
        <button
          type="button"
          onClick={() => {
            setPlannerMode("single");
            setDaysCount(1);
            setPostsPerDay(1);
          }}
          className={cn(
            "py-1.5 rounded-md transition-all text-center",
            plannerMode === "single"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Single Post (No Filter)
        </button>
        <button
          type="button"
          onClick={() => {
            setPlannerMode("multi");
            if (daysCount === 1) setDaysCount(3);
          }}
          className={cn(
            "py-1.5 rounded-md transition-all text-center",
            plannerMode === "multi"
              ? "bg-background text-primary shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Multi-Day Planner
        </button>
      </div>

      {/* Multi-Day Planner Options (Only visible if Multi-Day mode is active) */}
      {plannerMode === "multi" && (
        <div className="space-y-2 pt-0.5 p-2.5 rounded-lg border bg-muted/20">
          <div className="grid grid-cols-2 gap-2">
            {/* Days Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground">
                Duration:
              </label>
              <select
                value={daysCount}
                onChange={(e) => setDaysCount(Number(e.target.value))}
                className="w-full h-8 text-[11px] rounded-md border border-border bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value={1}>1 Day</option>
                <option value={3}>3 Days Plan</option>
                <option value={7}>7 Days (1 Week)</option>
                <option value={14}>14 Days (2 Wks)</option>
                <option value={30}>30 Days (Month)</option>
              </select>
            </div>

            {/* Posts per Day Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground">
                Posts per Day:
              </label>
              <select
                value={postsPerDay}
                onChange={(e) => setPostsPerDay(Number(e.target.value))}
                className="w-full h-8 text-[11px] rounded-md border border-border bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value={1}>1 / Day (10 AM)</option>
                <option value={2}>2 / Day (10 AM, 6 PM)</option>
                <option value={3}>3 / Day (9 AM, 2 PM, 8 PM)</option>
                <option value={4}>4 / Day (9 AM, 1 PM, 5 PM, 8 PM)</option>
              </select>
            </div>
          </div>

          {/* Target Channel Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground">
              Target Channel:
            </label>
            <select
              value={targetChannel}
              onChange={(e) => setTargetChannel(e.target.value)}
              className="w-full h-8 text-[11px] rounded-md border border-border bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Channels</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="linkedin">LinkedIn</option>
              <option value="twitter">Twitter / X</option>
              <option value="bluesky">Bluesky</option>
              <option value="threads">Threads</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
            </select>
          </div>
        </div>
      )}

      {/* Textarea for unified prompt */}
      <div className="flex flex-col gap-2.5 flex-1">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            plannerMode === "multi" && totalPosts > 1
              ? `Create ${totalPosts} posts (${daysCount} days with ${postsPerDay} posts/day) with authentic photos for our brand...`
              : "Write a post for tomorrow at 3 PM about our new offers with photo..."
          }
          className="w-full min-h-[90px] resize-none text-xs"
        />

        {/* Visual Format Options */}
        <div className="p-2 rounded-lg border bg-muted/30 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={generateImage}
                onChange={(e) => setGenerateImage(e.target.checked)}
                className="size-3.5 rounded border-border text-primary focus:ring-primary"
              />
              <span>Generate & Attach 8K AI Photo</span>
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
          className="w-full text-xs font-semibold h-10"
        >
          {generateMutation.isPending
            ? (totalPosts > 1
                ? `Generating ${totalPosts} Posts (${daysCount} Days × ${postsPerDay}/Day)...`
                : "Generating Post & Media...")
            : (totalPosts > 1
                ? (daysCount > 1
                    ? `Generate & Schedule ${totalPosts} Posts (${daysCount} Days × ${postsPerDay}/Day)`
                    : `Generate & Schedule ${postsPerDay} Posts Today`)
                : "Generate Post & Visuals")}
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
