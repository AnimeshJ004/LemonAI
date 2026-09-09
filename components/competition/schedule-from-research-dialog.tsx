"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar as CalendarIcon,
  Sparkles,
  Clock,
  Send,
  Layers,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
} from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { getChannelIcon } from "@/constants/channels";
import Link from "next/link";

interface ScheduleFromResearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "single" | "batch";
  initialTopic?: string;
  suggestedFormat?: string;
  researchContext?: {
    niche: string;
    businessName?: string;
    targetAudience?: string;
    competitors?: string;
    hashtags?: string[];
    strategyPillars?: any[];
    strategySchedule?: any[];
  };
}

export default function ScheduleFromResearchDialog({
  open,
  onOpenChange,
  mode: initialMode = "single",
  initialTopic = "",
  suggestedFormat = "FEED_POST",
  researchContext,
}: ScheduleFromResearchDialogProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"single" | "batch">(initialMode);
  
  // Single post states
  const [topic, setTopic] = useState(initialTopic);
  const [generatedContent, setGeneratedContent] = useState("");
  const [generatedImages, setGeneratedImages] = useState<{ url: string }[]>([]);
  const [selectedChannelTypeId, setSelectedChannelTypeId] = useState<string>("");
  const [includeImage, setIncludeImage] = useState(true);
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    return d.toISOString().slice(0, 16); // format: YYYY-MM-DDTHH:mm
  });

  // Batch campaign states
  const [days, setDays] = useState(7);
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [batchStatus, setBatchStatus] = useState<"queue" | "draft">("queue");
  const [batchIncludeImages, setBatchIncludeImages] = useState(true);

  // Sync mode and topic when props change without losing generated content
  useEffect(() => {
    setMode(initialMode);
    if (initialTopic && initialTopic !== topic) {
      setTopic(initialTopic);
      setGeneratedContent("");
      setGeneratedImages([]);
    }
  }, [initialMode, initialTopic, open, topic]);

  // Fetch connected channels
  const { data: channelsData, isLoading: isLoadingChannels } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const res = await fetch("/api/channel");
      if (!res.ok) throw new Error("Failed to load channels");
      return res.json();
    },
    enabled: open,
  });

  const connectedChannels = (channelsData?.channels || []).filter(
    (c: any) => c.connected
  );

  // Auto-select first connected channel
  useEffect(() => {
    if (connectedChannels.length > 0 && !selectedChannelTypeId) {
      setSelectedChannelTypeId(
        connectedChannels[0].channel_type_id || connectedChannels[0].id
      );
    }
  }, [connectedChannels, selectedChannelTypeId]);

  // AI Single Post Generator Mutation
  const { mutate: generatePost, isPending: isGenerating } = useMutation({
    mutationFn: async () => {
      const promptText = `Write a high-engaging social media post based on this winning trending hook/angle: "${topic}".
Niche: ${researchContext?.niche || "General"}. Target Audience: ${researchContext?.targetAudience || "Target customers"}.
Format: ${suggestedFormat}.
Include 3-5 relevant viral hashtags: ${researchContext?.hashtags?.slice(0, 5).join(" ") || ""}`;

      const res = await fetch("/api/post/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          prompt: promptText,
          generateImage: includeImage,
          channelId: selectedChannelTypeId || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate post");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedContent(data.content || "");
      if (data.images && data.images.length > 0) {
        setGeneratedImages(data.images);
      }
      toast.success("Post content generated from trending hook!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Could not generate post content");
    },
  });

  // Single Post Schedule Mutation
  const { mutate: scheduleSinglePost, isPending: isScheduling } = useMutation({
    mutationFn: async () => {
      if (!generatedContent.trim()) {
        throw new Error("Post content is empty. Please generate or write content first.");
      }

      // If user hasn't selected a channel or none connected, fallback to first available or empty
      const targetChannelId = selectedChannelTypeId || connectedChannels[0]?.channel_type_id || connectedChannels[0]?.id;

      const postPayload = {
        posts: [
          {
            channelTypeId: targetChannelId,
            content: generatedContent,
            images: generatedImages,
          },
        ],
        scheduledAt: new Date(scheduledDate).toISOString(),
      };

      const res = await fetch("/api/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postPayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to schedule post");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Post successfully scheduled to your calendar!");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to schedule post");
    },
  });

  // Batch Auto-Pilot Mutation
  const { mutate: runBatchAutoPilot, isPending: isBatchScheduling } = useMutation({
    mutationFn: async () => {
      const payload = {
        businessName: researchContext?.businessName || "My Brand",
        niche: researchContext?.niche,
        targetAudience: researchContext?.targetAudience,
        competitors: researchContext?.competitors,
        strategyPillars: researchContext?.strategyPillars,
        strategySchedule: researchContext?.strategySchedule,
        days,
        postsPerDay,
        generateImages: batchIncludeImages,
        postStatus: batchStatus,
        selectedChannelIds: connectedChannels.map((c: any) => c.channel_type_id || c.id),
      };

      const res = await fetch("/api/ai/auto-pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Batch auto-schedule failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success(
        `Auto-Pilot scheduled ${data.totalPosts || days * postsPerDay} posts to your calendar!`
      );
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Batch scheduling failed");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 text-lg">
              {mode === "single" ? (
                <>
                  <Sparkles className="size-5 text-primary" />
                  Schedule Post from Trending Angle
                </>
              ) : (
                <>
                  <Layers className="size-5 text-primary" />
                  Auto-Schedule Campaign from Trends
                </>
              )}
            </DialogTitle>
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  mode === "single"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Single Post
              </button>
              <button
                type="button"
                onClick={() => setMode("batch")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  mode === "batch"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Multi-Day Auto-Pilot
              </button>
            </div>
          </div>
          <DialogDescription>
            {mode === "single"
              ? "Convert this discovered trending angle into a high-converting post and schedule it directly to your channels."
              : "Let AI take these competitor & market trends and automatically generate & schedule a complete multi-day campaign."}
          </DialogDescription>
        </DialogHeader>

        {connectedChannels.length === 0 && !isLoadingChannels ? (
          <div className="p-3.5 rounded-lg border border-primary/20 bg-primary/5 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-primary">
              <Sparkles className="size-3.5" /> Ready for Calendar Scheduling
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Posts will be scheduled directly into your Lemon AI Calendar queue. You can link live social accounts anytime in{" "}
              <Link href="/settings" className="underline font-semibold text-foreground">
                Settings &gt; Channels
              </Link>{" "}
              for autonomous publishing.
            </p>
          </div>
        ) : null}

        {mode === "single" ? (
          /* ================= SINGLE POST MODE ================= */
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="post-topic">Trending Hook / Angle Topic</Label>
              <Input
                id="post-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Why 90% of founders fail at organic reach..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="target-channel">Destination Channel</Label>
                <Select
                  value={selectedChannelTypeId}
                  onValueChange={setSelectedChannelTypeId}
                >
                  <SelectTrigger id="target-channel">
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedChannels.map((c: any) => {
                      const icon = getChannelIcon(c.type || c.name);
                      return (
                        <SelectItem
                          key={c.id}
                          value={c.channel_type_id || c.id}
                        >
                          <div className="flex items-center gap-2">
                            {icon ? (
                              <div
                                className="size-5 rounded flex items-center justify-center shrink-0"
                                style={c.color ? { backgroundColor: c.color } : undefined}
                              >
                                <HugeiconsIcon
                                  icon={icon}
                                  className={c.color ? "size-3 text-white" : "size-4 text-muted-foreground"}
                                />
                              </div>
                            ) : null}
                            <span>{c.name || c.type}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="post-datetime">Schedule Date & Time</Label>
                <Input
                  id="post-datetime"
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <ImageIcon className="size-4 text-primary" /> Generate AI Image
                </Label>
                <p className="text-xs text-muted-foreground">
                  AI will craft a matching high-converting visual for this post
                </p>
              </div>
              <Switch
                checked={includeImage}
                onCheckedChange={setIncludeImage}
              />
            </div>

            {/* Generate Button if not generated yet */}
            {!generatedContent && (
              <Button
                onClick={() => generatePost()}
                disabled={isGenerating || !topic.trim()}
                className="w-full"
                variant="outline"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="size-4 mr-2 animate-spin" />
                    AI Generating Post & Visuals...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 mr-2" />
                    Auto-Generate Full Post Content with AI
                  </>
                )}
              </Button>
            )}

            {/* Generated Content Preview / Edit */}
            {generatedContent && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="post-content">Post Content (Editable)</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => generatePost()}
                    disabled={isGenerating}
                  >
                    <Sparkles className="size-3 mr-1" /> Regenerate
                  </Button>
                </div>
                <Textarea
                  id="post-content"
                  rows={6}
                  value={generatedContent}
                  onChange={(e) => setGeneratedContent(e.target.value)}
                  placeholder="Post copy..."
                  className="text-sm font-sans"
                />

                {generatedImages.length > 0 && (
                  <div className="mt-2">
                    <Label className="text-xs text-muted-foreground block mb-1">
                      Generated Creative
                    </Label>
                    <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                      <img
                        src={generatedImages[0].url}
                        alt="Creative"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ================= BATCH AUTO-PILOT MODE ================= */
          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-lg border border-primary/20 bg-primary/5 space-y-1">
              <p className="text-sm font-semibold flex items-center gap-1.5 text-primary">
                <Sparkles className="size-4" /> AI Trend Campaign Director
              </p>
              <p className="text-xs text-muted-foreground">
                Lemon AI will synthesize your competitor intelligence in{" "}
                <span className="font-semibold text-foreground">
                  {researchContext?.niche || "your industry"}
                </span>{" "}
                and schedule posts automatically at peak engagement hours.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Campaign Duration</Label>
                <Select
                  value={String(days)}
                  onValueChange={(v) => setDays(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 Days (Quick Burst)</SelectItem>
                    <SelectItem value="7">7 Days (1 Week Campaign)</SelectItem>
                    <SelectItem value="14">14 Days (2 Weeks Campaign)</SelectItem>
                    <SelectItem value="30">30 Days (Full Month Strategy)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Posts per Day</Label>
                <Select
                  value={String(postsPerDay)}
                  onValueChange={(v) => setPostsPerDay(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Post / Day</SelectItem>
                    <SelectItem value="2">2 Posts / Day</SelectItem>
                    <SelectItem value="3">3 Posts / Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Publish Mode</Label>
              <Select
                value={batchStatus}
                onValueChange={(v: "queue" | "draft") => setBatchStatus(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="queue">
                    🚀 Queue for Auto-Publish (Publishes automatically via Inngest)
                  </SelectItem>
                  <SelectItem value="draft">
                    📝 Save as Drafts (Review in Calendar before publishing)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <ImageIcon className="size-4 text-primary" /> Auto-Generate AI Images
                </Label>
                <p className="text-xs text-muted-foreground">
                  Creates custom ad & social visual assets for each post
                </p>
              </div>
              <Switch
                checked={batchIncludeImages}
                onCheckedChange={setBatchIncludeImages}
              />
            </div>

            <div className="p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground flex items-center justify-between">
              <span>Total Posts to Generate & Schedule:</span>
              <Badge variant="secondary" className="font-bold text-sm">
                {days * postsPerDay} Posts
              </Badge>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>

          {mode === "single" ? (
            <Button
              onClick={() => scheduleSinglePost()}
              disabled={isScheduling || !generatedContent.trim()}
            >
              {isScheduling ? (
                <>
                  <Clock className="size-4 mr-2 animate-spin" /> Scheduling...
                </>
              ) : (
                <>
                  <CalendarIcon className="size-4 mr-2" /> Schedule to Calendar
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => runBatchAutoPilot()}
              disabled={isBatchScheduling}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isBatchScheduling ? (
                <>
                  <Sparkles className="size-4 mr-2 animate-spin" />
                  Generating & Scheduling {days * postsPerDay} Posts...
                </>
              ) : (
                <>
                  <Send className="size-4 mr-2" />
                  Launch {days * postsPerDay}-Post Campaign
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
