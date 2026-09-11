"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  CheckCircle2,
  Loader2,
  TrendingUp,
  FileText,
  Video,
  LayoutGrid,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Eye,
  Download,
  Film,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Send,
  AlertCircle,
  RefreshCw,
  Plus,
  Minus,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CampaignMediaPreviewDialog,
  CampaignMediaPost,
} from "./campaign-media-preview-dialog";
import { cn } from "@/lib/utils";
import ChannelAvatar from "@/components/channel-avatar";

interface AutonomousCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDays?: number;
  initialNiche?: string;
  initialAudience?: string;
  initialBusinessName?: string;
}

const PRESET_DAYS = [
  { value: 3, label: "3 Days", sub: "Quick Sprint" },
  { value: 7, label: "7 Days", sub: "1 Week" },
  { value: 14, label: "14 Days", sub: "2 Weeks" },
  { value: 30, label: "30 Days", sub: "Full Month" },
] as const;

const PRESET_POSTS_PER_DAY = [
  { value: 1, label: "1 / Day", desc: "Steady Base" },
  { value: 2, label: "2 / Day", desc: "Optimal Growth" },
  { value: 3, label: "3 / Day", desc: "High Engagement" },
  { value: 4, label: "4 / Day", desc: "Aggressive Blitz" },
];

const DEFAULT_TIME_SLOTS: Record<number, string[]> = {
  1: ["10:00"],
  2: ["09:30", "16:30"],
  3: ["09:00", "14:00", "19:30"],
  4: ["08:30", "12:30", "17:00", "20:30"],
};

function formatTimeDisplay(timeStr: string): string {
  if (!timeStr) return "";
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return timeStr;
  let hour = parseInt(match[1], 10);
  const min = match[2];
  const ampm = hour >= 12 ? "PM" : "AM";
  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;
  return `${hour.toString().padStart(2, "0")}:${min} ${ampm}`;
}

export default function AutonomousCampaignDialog({
  open,
  onOpenChange,
  defaultDays = 7,
  initialNiche = "",
  initialAudience = "",
  initialBusinessName = "",
}: AutonomousCampaignDialogProps) {
  const queryClient = useQueryClient();

  const [days, setDays] = useState<number>(defaultDays);
  const [postsPerDay, setPostsPerDay] = useState<number>(1);
  const [customDays, setCustomDays] = useState<string>("");
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [businessName, setBusinessName] = useState<string>(initialBusinessName);
  const [niche, setNiche] = useState<string>(initialNiche);
  const [audience, setAudience] = useState<string>(initialAudience);
  const [competitors, setCompetitors] = useState<string>("");
  const [draftAd, setDraftAd] = useState<boolean>(true);
  const [generateImages, setGenerateImages] = useState<boolean>(true);
  const [postStatus, setPostStatus] = useState<"queue" | "draft">("queue");
  const [customTimes, setCustomTimes] = useState<string[]>(["10:00"]);
  const [result, setResult] = useState<any | null>(null);
  const [expandedPostIdx, setExpandedPostIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [previewPost, setPreviewPost] = useState<CampaignMediaPost | null>(null);
  const [inlineTab, setInlineTab] = useState<Record<number, "caption" | "media" | "script">>({});
  const [activeSlide, setActiveSlide] = useState<Record<number, number>>({});
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);

  // Keep customTimes synced when postsPerDay changes
  useEffect(() => {
    setCustomTimes((prev) => {
      const defaults = DEFAULT_TIME_SLOTS[postsPerDay] || ["10:00"];
      const next: string[] = [];
      for (let i = 0; i < postsPerDay; i++) {
        next.push(prev[i] || defaults[i] || "10:00");
      }
      return next;
    });
  }, [postsPerDay]);

  const updateTimeSlot = (index: number, newTime: string) => {
    if (!newTime) return;
    setCustomTimes((prev) => {
      const copy = [...prev];
      copy[index] = newTime;
      return copy;
    });
  };

  const resetToDefaultTimes = () => {
    const defaults = DEFAULT_TIME_SLOTS[postsPerDay] || ["10:00"];
    setCustomTimes([...defaults]);
    toast.success("Reset to AI peak engagement times");
  };

  const activeFormattedTimes = customTimes.slice(0, postsPerDay).map((t) => formatTimeDisplay(t));

  // Load connected channels for channel selection filter
  const { data: channelsData } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const res = await fetch("/api/channel");
      if (!res.ok) return { channels: [] };
      return res.json();
    },
    enabled: open,
  });

  const allChannels: any[] = channelsData?.channels || [];
  const connectedChannels = allChannels.filter((c: any) => c.connected);

  // Default to selecting ALL connected channels when they load
  useEffect(() => {
    if (connectedChannels.length > 0 && selectedChannelIds.length === 0) {
      setSelectedChannelIds(connectedChannels.map((c: any) => c.user_channel_id || c.id));
    }
  }, [connectedChannels]);

  const toggleChannelSelection = (chId: string) => {
    setSelectedChannelIds((prev) =>
      prev.includes(chId) ? prev.filter((id) => id !== chId) : [...prev, chId]
    );
  };

  const handleSelectAllChannels = () => {
    if (selectedChannelIds.length === connectedChannels.length) {
      setSelectedChannelIds([]);
    } else {
      setSelectedChannelIds(connectedChannels.map((c: any) => c.user_channel_id || c.id));
    }
  };

  // Load Brand Profile if fields are empty
  const { data: brandData } = useQuery({
    queryKey: ["brand-profile"],
    queryFn: async () => {
      const res = await fetch("/api/brand");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: open && (!businessName || !niche),
  });

  useEffect(() => {
    if (brandData?.profile) {
      const p = brandData.profile;
      if (!businessName && p.business_name) setBusinessName(p.business_name);
      if (!niche && p.niche) setNiche(p.niche);
      if (!audience && p.target_audience) setAudience(p.target_audience);
      if (!competitors && p.competitors) setCompetitors(p.competitors);
    }
  }, [brandData, businessName, niche, audience, competitors]);

  const [isCustomMix, setIsCustomMix] = useState(false);
  const [customReels, setCustomReels] = useState(3);
  const [customImages, setCustomImages] = useState(2);
  const [customCarousels, setCustomCarousels] = useState(2);

  const autoDays = isCustom ? Math.max(1, parseInt(customDays, 10) || 1) : days;
  const totalBasePosts = autoDays * postsPerDay;
  const autoReels = Math.max(0, Math.floor(totalBasePosts / 3) + (totalBasePosts % 3 >= 1 ? 1 : 0));
  const autoCarousels = Math.max(0, Math.floor(totalBasePosts / 3));
  const autoImages = Math.max(0, totalBasePosts - autoReels - autoCarousels);

  const reelsCount = isCustomMix ? customReels : autoReels;
  const imagePostsCount = isCustomMix ? customImages : autoImages;
  const carouselsCount = isCustomMix ? customCarousels : autoCarousels;

  const totalPostsToSchedule = isCustomMix
    ? Math.max(1, customReels + customImages + customCarousels)
    : totalBasePosts;

  const dateRangePreview = (() => {
    const now = new Date();
    const start = now;
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (autoDays - 1));
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `Today (${start.toLocaleDateString("en-US", opts)}) – ${end.toLocaleDateString("en-US", opts)}`;
  })();

  const handleSelectPreset = (d: number) => {
    setDays(d);
    setIsCustom(false);
    setCustomDays("");
  };

  const handleCustomChange = (val: string) => {
    setCustomDays(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setIsCustom(true);
    }
  };

  const { mutate: executeCampaign, isPending } = useMutation({
    mutationFn: async () => {
      if (connectedChannels.length > 0 && selectedChannelIds.length === 0) {
        throw new Error("Please select at least one channel to launch this campaign.");
      }

      const res = await fetch("/api/ai/flywheel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim() || "My Business",
          niche: niche.trim() || "General Business",
          targetAudience: audience.trim() || "General Audience",
          competitors: competitors.trim() || undefined,
          daysToSchedule: autoDays,
          postsPerDay,
          customTimeSlots: customTimes.slice(0, postsPerDay),
          generateImages,
          postStatus,
          autoDraftMetaAd: draftAd,
          selectedChannelIds: selectedChannelIds.length > 0 ? selectedChannelIds : undefined,
          customMix: isCustomMix ? {
            reelsCount: customReels,
            imagePostsCount: customImages,
            carouselsCount: customCarousels,
          } : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Campaign scheduling failed");
      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(`Autonomous Campaign Scheduled: ${data.postsScheduledCount || totalPostsToSchedule} posts added to calendar`);
      queryClient.invalidateQueries({ queryKey: ["scheduled-posts"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-posts"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-overview"] });
      queryClient.invalidateQueries({ queryKey: ["meta-campaigns"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to execute autonomous campaign");
    },
  });

  const [publishingId, setPublishingId] = useState<string | null>(null);

  const handleReset = () => {
    setResult(null);
    setExpandedPostIdx(null);
    setPreviewPost(null);
    setInlineTab({});
    setActiveSlide({});
  };

  const handlePublishDirectly = async (postItem: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const idsToPublish: string[] = (postItem?.allPostIds && postItem.allPostIds.length > 0)
      ? postItem.allPostIds
      : (postItem?.targetChannels?.map((tc: any) => tc.id).filter(Boolean) || (postItem?.id ? [postItem.id] : []));

    if (idsToPublish.length === 0) {
      toast.error("Post ID not found. Post may not be saved yet.");
      return;
    }
    setPublishingId(postItem.id || idsToPublish[0]);
    try {
      const results = await Promise.allSettled(
        idsToPublish.map(async (id) => {
          const res = await fetch(`/api/post/${id}/publish`, {
            method: "POST",
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || "Failed to publish post to account");
          }
          return { id, ...data };
        })
      );

      const successful = results.filter((r) => r.status === "fulfilled");
      if (successful.length > 0) {
        toast.success(`Published post across ${successful.length} channel(s) successfully!`);
      } else {
        const firstErr = (results[0] as any)?.reason?.message || "Failed to publish post";
        throw new Error(firstErr);
      }

      setResult((prev: any) => {
        if (!prev || !prev.contentPieces) return prev;
        return {
          ...prev,
          contentPieces: prev.contentPieces.map((cp: any) =>
            cp.id === postItem.id || cp.dayNumber === postItem.dayNumber
              ? {
                  ...cp,
                  status: successful.length > 0 ? "published" : "failed",
                  errorMessage: null,
                }
              : cp
          ),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["scheduled-posts"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-posts"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-overview"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to publish post to account");
    } finally {
      setPublishingId(null);
    }
  };

  const handleCopy = (text: string, idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    toast.success("Post content copied to clipboard");
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Layers className="size-4" />
            <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
              Autonomous Campaign Engine
            </span>
          </div>
          <DialogTitle className="text-xl font-bold">
            Autonomous Campaign Generator
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Researches competitor trends, generates a balanced distribution of Reels, Carousels, and Image posts with hashtags, and schedules them onto your social calendar.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-5 py-2">
            {/* 1. Duration & Days to Schedule */}
            <div className="space-y-3 p-3.5 rounded-xl border bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-primary" /> 1. Duration & Timeline
                </Label>
                <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  {autoDays} {autoDays === 1 ? "Day" : "Days"} ({dateRangePreview})
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESET_DAYS.map((preset) => {
                  const selected = !isCustom && days === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => handleSelectPreset(preset.value)}
                      className={cn(
                        "flex flex-col items-center justify-center py-2 px-2.5 rounded-xl border text-xs transition-all cursor-pointer",
                        selected
                          ? "border-primary bg-primary/15 text-primary font-bold shadow-xs ring-1 ring-primary/30"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent/40"
                      )}
                    >
                      <span className="font-bold">{preset.label}</span>
                      <span className="text-[10px] opacity-75">{preset.sub}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Days Input & Slider */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[11px] text-muted-foreground shrink-0">Custom Days (1 – 30):</span>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={autoDays}
                  onChange={(e) => handleCustomChange(e.target.value)}
                  className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-foreground w-8 text-right">{autoDays}d</span>
              </div>
            </div>

            {/* 2. Daily Posting Frequency */}
            <div className="space-y-3 p-3.5 rounded-xl border bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <TrendingUp className="size-3.5 text-primary" /> 2. Daily Posting Frequency
                </Label>
                <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  {postsPerDay} {postsPerDay === 1 ? "Post" : "Posts"} / Day
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESET_POSTS_PER_DAY.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setPostsPerDay(preset.value)}
                    className={cn(
                      "flex flex-col items-center justify-center py-2 px-2.5 rounded-xl border text-xs transition-all cursor-pointer",
                      postsPerDay === preset.value
                        ? "border-primary bg-primary/15 text-primary font-bold shadow-xs ring-1 ring-primary/30"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent/40"
                    )}
                  >
                    <span className="font-bold">{preset.label}</span>
                    <span className="text-[10px] opacity-75">{preset.desc}</span>
                  </button>
                ))}
              </div>

              {/* Customizable Time Slots */}
              <div className="p-3 rounded-xl bg-card border space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <span>Daily Posting Time Slots:</span>
                  </div>
                  <button
                    type="button"
                    onClick={resetToDefaultTimes}
                    className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="size-3" /> Reset Peak Times
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                  {customTimes.slice(0, postsPerDay).map((timeVal, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg border bg-background text-xs"
                    >
                      <div className="min-w-0">
                        <span className="block text-[9px] uppercase font-bold text-muted-foreground">
                          Post #{idx + 1}
                        </span>
                        <span className="font-bold text-primary text-[11px]">
                          {formatTimeDisplay(timeVal)}
                        </span>
                      </div>
                      <input
                        type="time"
                        value={timeVal}
                        onChange={(e) => updateTimeSlot(idx, e.target.value)}
                        className="h-7 px-1.5 rounded border bg-card text-foreground font-mono text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        title={`Change time for Post #${idx + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Content Format Mix */}
            <div className="space-y-3 p-3.5 rounded-xl border bg-muted/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <SlidersHorizontal className="size-3.5 text-primary" /> 3. Content Format Distribution
                </Label>

                {/* Mode Switcher: Auto Balanced vs Custom Mix */}
                <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border">
                  <button
                    type="button"
                    onClick={() => setIsCustomMix(false)}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer",
                      !isCustomMix
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    ⚡ Auto Balanced
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomMix(true);
                      setCustomReels(reelsCount);
                      setCustomImages(imagePostsCount);
                      setCustomCarousels(carouselsCount);
                    }}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all flex items-center gap-1 cursor-pointer",
                      isCustomMix
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <SlidersHorizontal className="size-3" /> Custom Steppers
                  </button>
                </div>
              </div>

              {!isCustomMix ? (
                /* Auto Mix Breakdown */
                <div className="p-3 rounded-xl bg-card border flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-foreground">AI Rotation:</span>
                    <span className="inline-flex items-center gap-1">
                      <Video className="size-3.5 text-blue-500" />
                      {reelsCount} {reelsCount === 1 ? "Reel" : "Reels"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FileText className="size-3.5 text-amber-500" />
                      {imagePostsCount} {imagePostsCount === 1 ? "Image Post" : "Image Posts"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <LayoutGrid className="size-3.5 text-purple-500" />
                      {carouselsCount} {carouselsCount === 1 ? "Carousel" : "Carousels"}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-medium">
                    {totalPostsToSchedule} Total Posts
                  </Badge>
                </div>
              ) : (
                /* Custom Mix Stepper Controls */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Reels */}
                    <div className="p-3 rounded-xl border bg-card flex flex-col justify-between space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                          <Video className="size-3.5 text-blue-500" /> Reels
                        </div>
                        <Badge
                          variant={customReels === 0 ? "secondary" : "default"}
                          className="text-[10px] h-5 px-1.5"
                        >
                          {customReels === 0 ? "0 (Skipped)" : `${customReels} ${customReels === 1 ? "Reel" : "Reels"}`}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        9:16 Video scripts & hooks. Set to 0 to skip.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7 shrink-0"
                          onClick={() => setCustomReels((prev) => Math.max(0, prev - 1))}
                          disabled={customReels <= 0}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          max={30}
                          value={customReels}
                          onChange={(e) => setCustomReels(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="h-7 text-xs text-center font-bold px-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7 shrink-0"
                          onClick={() => setCustomReels((prev) => Math.min(30, prev + 1))}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Image Posts */}
                    <div className="p-3 rounded-xl border bg-card flex flex-col justify-between space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                          <FileText className="size-3.5 text-amber-500" /> Image Posts
                        </div>
                        <Badge
                          variant={customImages === 0 ? "secondary" : "default"}
                          className="text-[10px] h-5 px-1.5"
                        >
                          {customImages === 0 ? "0 (Skipped)" : `${customImages} ${customImages === 1 ? "Post" : "Posts"}`}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        High-converting single image posts.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7 shrink-0"
                          onClick={() => setCustomImages((prev) => Math.max(0, prev - 1))}
                          disabled={customImages <= 0}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          max={30}
                          value={customImages}
                          onChange={(e) => setCustomImages(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="h-7 text-xs text-center font-bold px-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7 shrink-0"
                          onClick={() => setCustomImages((prev) => Math.min(30, prev + 1))}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Carousels */}
                    <div className="p-3 rounded-xl border bg-card flex flex-col justify-between space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                          <LayoutGrid className="size-3.5 text-purple-500" /> Carousels
                        </div>
                        <Badge
                          variant={customCarousels === 0 ? "secondary" : "default"}
                          className="text-[10px] h-5 px-1.5"
                        >
                          {customCarousels === 0 ? "0 (Skipped)" : `${customCarousels} ${customCarousels === 1 ? "Deck" : "Decks"}`}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        5-slide educational swipe breakdown decks.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7 shrink-0"
                          onClick={() => setCustomCarousels((prev) => Math.max(0, prev - 1))}
                          disabled={customCarousels <= 0}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          max={30}
                          value={customCarousels}
                          onChange={(e) => setCustomCarousels(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="h-7 text-xs text-center font-bold px-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7 shrink-0"
                          onClick={() => setCustomCarousels((prev) => Math.min(30, prev + 1))}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Destination Channels */}
            <div className="space-y-2.5 p-3.5 rounded-xl border bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Layers className="size-3.5 text-primary" /> 4. Target Channels
                </Label>
                {connectedChannels.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-medium">
                      {selectedChannelIds.length} of {connectedChannels.length} Selected
                    </Badge>
                    <button
                      type="button"
                      onClick={handleSelectAllChannels}
                      className="text-xs font-medium text-primary hover:underline cursor-pointer"
                    >
                      {selectedChannelIds.length === connectedChannels.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                )}
              </div>

              {connectedChannels.length === 0 ? (
                <div className="p-3 rounded-lg border border-dashed text-xs text-muted-foreground text-center space-y-1">
                  <p>No social channels connected yet.</p>
                  <Link href="/settings?tab=channels" className="text-primary hover:underline font-medium inline-flex items-center gap-1">
                    Connect Channels in Settings <ExternalLink className="size-3" />
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {connectedChannels.map((channel: any) => {
                    const chKey = channel.user_channel_id || channel.id;
                    const isSelected = selectedChannelIds.includes(chKey) || selectedChannelIds.includes(channel.id);

                    return (
                      <div
                        key={channel.id}
                        onClick={() => toggleChannelSelection(chKey)}
                        className={cn(
                          "flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none",
                          isSelected
                            ? "bg-card border-primary/50 shadow-xs ring-1 ring-primary/30"
                            : "bg-muted/10 hover:bg-muted/30 border-border/70 opacity-65"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <ChannelAvatar
                            type={channel.type}
                            color={channel.color}
                            profileImage={channel.profile_image}
                            name={channel.name}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {channel.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {channel.handle || "Connected"}
                            </p>
                          </div>
                        </div>
                        <div
                          className={cn(
                            "size-4 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/40 bg-background"
                          )}
                        >
                          {isSelected && <Check className="size-3" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {connectedChannels.length > 0 && selectedChannelIds.length === 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                  <AlertCircle className="size-3 shrink-0" />
                  Please select at least one channel to target with this campaign.
                </p>
              )}
            </div>

            {/* 5. Advanced Publishing & Visual Generation Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3.5 rounded-xl border bg-muted/20">
              <div className="p-3 rounded-xl border bg-card flex items-center justify-between">
                <div className="space-y-0.5 pr-2">
                  <Label htmlFor="auto-pilot-gen-images" className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                    <FileText className="size-3.5 text-primary" /> 8K Photorealistic Visuals
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Generate authentic photography for each post
                  </p>
                </div>
                <Switch
                  id="auto-pilot-gen-images"
                  checked={generateImages}
                  onCheckedChange={setGenerateImages}
                />
              </div>

              <div className="p-3 rounded-xl border bg-card flex items-center justify-between">
                <div className="space-y-0.5 pr-2">
                  <Label htmlFor="auto-pilot-post-status" className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                    <Send className="size-3.5 text-primary" /> Schedule for Auto-Publish
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    {postStatus === "queue" ? "Active in Calendar Queue" : "Placed as Drafts"}
                  </p>
                </div>
                <Switch
                  id="auto-pilot-post-status"
                  checked={postStatus === "queue"}
                  onCheckedChange={(checked) => setPostStatus(checked ? "queue" : "draft")}
                />
              </div>

              <div className="p-3 rounded-xl border bg-card flex items-center justify-between sm:col-span-2">
                <div className="space-y-0.5 pr-2">
                  <Label htmlFor="auto-pilot-draft-ad" className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                    <Sparkles className="size-3.5 text-primary" /> Stage Meta Lead Ad Campaign
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Drafts an ad campaign from the top-performing angle ready in Meta Ads Manager
                  </p>
                </div>
                <Switch
                  id="auto-pilot-draft-ad"
                  checked={draftAd}
                  onCheckedChange={setDraftAd}
                />
              </div>
            </div>

            {/* 6. Live Scheduling Plan Summary Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5 border border-primary/25 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-4 text-primary" />
                  Scheduling Plan Summary
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {autoDays} Days × {postsPerDay} Post{postsPerDay > 1 ? "s" : ""}/Day =
                  </span>
                  <span className="text-xs font-extrabold text-primary bg-background/90 px-3 py-1 rounded-full border border-primary/30 shadow-2xs">
                    {totalPostsToSchedule} Total Posts
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1 text-muted-foreground">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-muted-foreground">Duration</span>
                  <strong className="text-foreground">{autoDays} Days</strong>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-muted-foreground">Frequency</span>
                  <strong className="text-foreground">{postsPerDay} Post{postsPerDay > 1 ? "s" : ""}/day</strong>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-muted-foreground">Daily Times</span>
                  <strong className="text-foreground text-[11px] truncate block" title={activeFormattedTimes.join(", ")}>
                    {activeFormattedTimes.join(", ")}
                  </strong>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-muted-foreground">Calendar Span</span>
                  <strong className="text-foreground">{dateRangePreview}</strong>
                </div>
              </div>
            </div>

            {/* Active Brand Context Preview */}
            <div className="flex items-center justify-between text-xs px-3.5 py-2.5 rounded-xl border bg-muted/20">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-[11px]">Brand Profile:</span>
                  <span className="font-semibold text-foreground truncate">{businessName || "Configured Brand"}</span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {niche || "Active Industry"} • {audience ? (audience.length > 40 ? audience.slice(0, 40) + "..." : audience) : "Target Audience"}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0 font-normal">
                Synced from Brand Profile
              </Badge>
            </div>

            {/* In-Progress Loading Indicator */}
            {isPending && (
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-primary font-semibold text-xs">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Autonomous Pipeline In Progress...</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Scraping competitor copy → Synthesizing viral hooks → Creating {totalPostsToSchedule} multi-format posts → Staging to Social Calendar
                </p>
              </div>
            )}

            {/* Execution Confirmation Button */}
            <div className="pt-2 flex justify-end gap-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => executeCampaign()}
                disabled={isPending || !niche.trim() || (connectedChannels.length > 0 && selectedChannelIds.length === 0)}
                className="text-xs font-semibold gap-1.5 px-4"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Executing Campaign...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" />
                    Execute and Schedule Campaign
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* Execution Result View */
          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
              <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                  Campaign Scheduled Successfully
                </p>
                <p className="text-xs text-muted-foreground">
                  {result.summary}
                </p>
              </div>
            </div>

            {result.contentPieces?.length > 0 && (() => {
              const publishedCount = result.contentPieces.filter((cp: any) => cp.status === "published").length;
              const queuedCount = result.contentPieces.filter((cp: any) => cp.status === "queue").length;
              return (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                        Generated Campaign Assets ({result.contentPieces.length} Posts)
                      </p>
                      {publishedCount > 0 && (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 text-[10px] font-semibold py-0">
                          {publishedCount} Published Live
                        </Badge>
                      )}
                      {queuedCount > 0 && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground py-0">
                          {queuedCount} Scheduled
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground">Click any post or View to preview media</span>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {result.contentPieces.map((p: any, idx: number) => {
                      const isExpanded = expandedPostIdx === idx;
                      const isReel = p.type === "REEL_SCRIPT";
                      const isCarousel = p.type === "CAROUSEL";
                      const formatLabel = isReel ? "Reel Video" : isCarousel ? "Carousel" : "Image Post";
                      const dayNum = p.dayNumber || idx + 1;
                      const currentTab = inlineTab[idx] || "caption";
                      const slides = p.carouselSlides || [];
                      const currentSlideIdx = activeSlide[idx] || 0;
                      const currentSlide = slides[currentSlideIdx] || slides[0];

                      return (
                        <div
                          key={idx}
                          onClick={() => setExpandedPostIdx(isExpanded ? null : idx)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${
                            isExpanded
                              ? "bg-card border-primary/40 shadow-xs ring-1 ring-primary/20"
                              : "bg-muted/20 hover:bg-muted/40 border-border/70"
                          }`}
                        >
                          {/* Header Row */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                              <Badge
                                variant="secondary"
                                className={`text-[10px] shrink-0 font-semibold px-2 py-0.5 mt-0.5 ${
                                  isReel
                                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900"
                                    : isCarousel
                                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900"
                                }`}
                              >
                                {isReel && <Video className="size-2.5 mr-1 inline" />}
                                {isCarousel && <LayoutGrid className="size-2.5 mr-1 inline" />}
                                {!isReel && !isCarousel && <FileText className="size-2.5 mr-1 inline" />}
                                {formatLabel}
                              </Badge>
                              <div className="min-w-0 flex-1">
                                <span className="font-semibold text-xs text-foreground truncate block">
                                  {p.title}
                                </span>
                                {p.targetChannels && p.targetChannels.length > 0 ? (
                                  <div className="flex flex-wrap items-center gap-1 mt-1">
                                    {p.targetChannels.map((tc: any) => (
                                      <span
                                        key={tc.id}
                                        className={cn(
                                          "inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-md border",
                                          tc.status === "published"
                                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                            : tc.status === "failed"
                                            ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                                            : "bg-muted/40 border-border text-muted-foreground"
                                        )}
                                      >
                                        <span
                                          className="size-1.5 rounded-full shrink-0"
                                          style={{
                                            backgroundColor:
                                              tc.status === "published"
                                                ? "#10b981"
                                                : tc.status === "failed"
                                                ? "#ef4444"
                                                : "#64748b",
                                          }}
                                        />
                                        <span>{tc.channelName}</span>
                                        {tc.status === "published" && <span>✓</span>}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                                    {p.channelName || "All Channels"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Prominent View Creative Button */}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewPost(p);
                                }}
                                className="h-6 text-[11px] font-semibold gap-1 px-2 bg-background hover:bg-muted text-foreground border-primary/30 hover:border-primary"
                              >
                                <Eye className="size-3 text-primary" /> View
                              </Button>

                              {/* Publication Status & Action Button */}
                              {p.status === "published" ? (
                                <div className="flex items-center gap-1">
                                  <Badge className="h-6 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 text-[10px] font-semibold gap-1 px-2">
                                    <CheckCircle2 className="size-2.5 text-emerald-500" /> Published
                                  </Badge>
                                  {p.publishedUrl && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(p.publishedUrl, "_blank", "noopener,noreferrer");
                                      }}
                                      className="h-6 text-[10px] font-semibold gap-1 px-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                                      title="Open published post link"
                                    >
                                      <ExternalLink className="size-2.5" />
                                    </Button>
                                  )}
                                </div>
                              ) : p.status === "failed" ? (
                                <div className="flex items-center gap-1">
                                  <Badge variant="destructive" className="h-6 text-[10px] font-semibold gap-1 px-1.5">
                                    <AlertCircle className="size-2.5" /> Failed
                                  </Badge>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => handlePublishDirectly(p, e)}
                                    disabled={publishingId === p.id}
                                    className="h-6 text-[10px] font-semibold gap-1 px-2 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                  >
                                    {publishingId === p.id ? (
                                      <Loader2 className="size-2.5 animate-spin" />
                                    ) : (
                                      <RefreshCw className="size-2.5" />
                                    )}
                                    Retry
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={(e) => handlePublishDirectly(p, e)}
                                  disabled={publishingId === p.id}
                                  className="h-6 text-[10px] font-semibold gap-1 px-2 hover:bg-primary hover:text-primary-foreground transition-colors"
                                  title="Publish immediately to your connected social channels"
                                >
                                  {publishingId === p.id ? (
                                    <Loader2 className="size-2.5 animate-spin" />
                                  ) : (
                                    <Send className="size-2.5" />
                                  )}
                                  Publish Now
                                </Button>
                              )}

                              <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground">
                                Day {dayNum}
                              </Badge>
                              {isExpanded ? (
                                <ChevronUp className="size-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="size-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>

                        {/* Expanded Full Content Details */}
                        {isExpanded && (
                          <div
                            className="pt-3 border-t mt-3 space-y-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Segmented Sub-tabs */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={currentTab === "caption" ? "default" : "secondary"}
                                  onClick={() => setInlineTab((prev) => ({ ...prev, [idx]: "caption" }))}
                                  className="h-6 text-[11px] font-semibold px-2"
                                >
                                  <FileText className="size-3 mr-1" /> Caption
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={currentTab === "media" ? "default" : "secondary"}
                                  onClick={() => setInlineTab((prev) => ({ ...prev, [idx]: "media" }))}
                                  className="h-6 text-[11px] font-semibold px-2"
                                >
                                  {isReel ? <Video className="size-3 mr-1" /> : isCarousel ? <LayoutGrid className="size-3 mr-1" /> : <Sparkles className="size-3 mr-1" />}
                                  {isReel ? "Video Reel" : isCarousel ? "Carousel Slides" : "Photo Creative"}
                                </Button>
                                {isReel && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={currentTab === "script" ? "default" : "secondary"}
                                    onClick={() => setInlineTab((prev) => ({ ...prev, [idx]: "script" }))}
                                    className="h-6 text-[11px] font-semibold px-2"
                                  >
                                    <Film className="size-3 mr-1" /> Voiceover Script
                                  </Button>
                                )}
                              </div>

                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setPreviewPost(p)}
                                className="h-6 text-[11px] font-semibold gap-1 px-2 text-primary hover:bg-primary/10"
                              >
                                <Eye className="size-3" /> Full Screen View
                              </Button>
                            </div>

                            {/* TAB 1: CAPTION */}
                            {currentTab === "caption" && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Publishable Social Caption & Hashtags
                                  </span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => handleCopy(p.caption || p.previewText, idx, e)}
                                    className="h-6 text-[11px] gap-1 px-2 text-primary hover:bg-primary/10"
                                  >
                                    {copiedIdx === idx ? (
                                      <>
                                        <Check className="size-3 text-emerald-500" /> Copied
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="size-3" /> Copy Caption
                                      </>
                                    )}
                                  </Button>
                                </div>
                                <div className="p-3 rounded-lg bg-background border font-sans text-xs whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto select-text shadow-2xs">
                                  {p.caption || p.previewText}
                                </div>
                              </div>
                            )}

                            {/* TAB 2: MEDIA PREVIEW */}
                            {currentTab === "media" && (
                              <div className="p-3 rounded-xl bg-muted/20 border space-y-3">
                                {isReel && (
                                  <div className="flex flex-col sm:flex-row items-center gap-4">
                                    <div className="relative w-[160px] aspect-[9/16] rounded-xl overflow-hidden shadow-md border border-primary/20 bg-black shrink-0">
                                      {p.videoUrl ? (
                                        <video
                                          src={p.videoUrl}
                                          controls
                                          autoPlay
                                          loop
                                          muted
                                          playsInline
                                          preload="auto"
                                          onError={(e) => {
                                            const target = e.currentTarget;
                                            if (!target.src.includes("/videos/reel-1.mp4")) {
                                              target.src = "/videos/reel-1.mp4";
                                              target.load();
                                            }
                                          }}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : p.imageUrl ? (
                                        <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                                      ) : null}
                                    </div>
                                    <div className="space-y-2 text-xs flex-1">
                                      <div>
                                        <p className="font-semibold text-foreground">9:16 Vertical Video Reel Ready</p>
                                        <p className="text-[11px] text-muted-foreground">
                                          Attached commercial MP4 video ready for Instagram Reels, Facebook Reels, and YouTube Shorts.
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap gap-2 pt-1">
                                        {p.videoUrl && (
                                          <Button size="sm" variant="outline" asChild className="h-7 text-xs font-semibold gap-1 px-2.5">
                                            <a href={p.videoUrl} download="reel.mp4" target="_blank" rel="noopener noreferrer">
                                              <Download className="size-3" /> Download MP4
                                            </a>
                                          </Button>
                                        )}
                                        <Button size="sm" variant="default" onClick={() => setPreviewPost(p)} className="h-7 text-xs font-semibold gap-1 px-2.5">
                                          <Eye className="size-3" /> Open Large Player
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {isCarousel && (
                                  <div className="space-y-3">
                                    <div className="p-4 rounded-xl border bg-card shadow-xs flex flex-col justify-between min-h-[160px]">
                                      <div className="flex items-center justify-between border-b pb-1.5 text-[10px] font-mono text-muted-foreground">
                                        <Badge variant="outline" className="text-[9px]">
                                          {currentSlide?.type || "SLIDE"}
                                        </Badge>
                                        <span>
                                          Slide {currentSlideIdx + 1} of {slides.length || 5}
                                        </span>
                                      </div>
                                      <div className="py-2 space-y-1.5">
                                        <p className="text-xs font-bold text-foreground">
                                          {currentSlide?.headline || p.title}
                                        </p>
                                        {currentSlide?.subtext && (
                                          <p className="text-[11px] text-muted-foreground">
                                            {currentSlide.subtext}
                                          </p>
                                        )}
                                      </div>
                                      <div className="pt-1.5 border-t flex items-center justify-between text-[10px] text-muted-foreground">
                                        <span>Swipe</span>
                                        <span className="text-primary font-semibold">
                                          {currentSlide?.swipePrompt || "Next →"}
                                        </span>
                                      </div>
                                    </div>

                                    {slides.length > 1 && (
                                      <div className="flex items-center justify-between pt-1">
                                        <div className="flex items-center gap-1">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-xs"
                                            onClick={() =>
                                              setActiveSlide((prev) => ({
                                                ...prev,
                                                [idx]: Math.max(0, currentSlideIdx - 1),
                                              }))
                                            }
                                            disabled={currentSlideIdx === 0}
                                          >
                                            <ChevronLeft className="size-3.5 mr-1" /> Prev
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-xs"
                                            onClick={() =>
                                              setActiveSlide((prev) => ({
                                                ...prev,
                                                [idx]: Math.min(slides.length - 1, currentSlideIdx + 1),
                                              }))
                                            }
                                            disabled={currentSlideIdx === slides.length - 1}
                                          >
                                            Next <ChevronRight className="size-3.5 ml-1" />
                                          </Button>
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="default"
                                          onClick={() => setPreviewPost(p)}
                                          className="h-7 text-xs font-semibold gap-1 px-2.5"
                                        >
                                          <Eye className="size-3" /> View Deck Modal
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {!isReel && !isCarousel && (
                                  <div className="flex flex-col sm:flex-row items-center gap-4">
                                    <div className="relative w-[150px] aspect-square rounded-xl overflow-hidden shadow-md border bg-black shrink-0">
                                      {p.imageUrl ? (
                                        <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                                      ) : null}
                                    </div>
                                    <div className="space-y-2 text-xs flex-1">
                                      <div>
                                        <p className="font-semibold text-foreground">1:1 Square Feed Photo Creative</p>
                                        <p className="text-[11px] text-muted-foreground">
                                          Ultra-sharp commercial editorial photography generated to match your brand style.
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap gap-2 pt-1">
                                        {p.imageUrl && (
                                          <Button size="sm" variant="outline" asChild className="h-7 text-xs font-semibold gap-1 px-2.5">
                                            <a href={p.imageUrl} download="photo.jpg" target="_blank" rel="noopener noreferrer">
                                              <Download className="size-3" /> Download HD Photo
                                            </a>
                                          </Button>
                                        )}
                                        <Button size="sm" variant="default" onClick={() => setPreviewPost(p)} className="h-7 text-xs font-semibold gap-1 px-2.5">
                                          <Eye className="size-3" /> View Fullscreen
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* TAB 3: SCRIPT (REEL ONLY) */}
                            {currentTab === "script" && isReel && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Director Voiceover Script & Timing Cues
                                  </span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => handleCopy(p.script || p.caption, idx, e)}
                                    className="h-6 text-[11px] gap-1 px-2 text-primary hover:bg-primary/10"
                                  >
                                    {copiedIdx === idx ? (
                                      <>
                                        <Check className="size-3 text-emerald-500" /> Copied
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="size-3" /> Copy Script
                                      </>
                                    )}
                                  </Button>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/30 border font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto select-text shadow-2xs">
                                  {p.script || p.caption}
                                </div>
                              </div>
                            )}

                            {p.mediaPrompt && (
                              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40 text-[11px] text-muted-foreground space-y-1">
                                <span className="font-semibold text-foreground text-[11px]">Visual Media Direction:</span>
                                <p className="leading-snug">{p.mediaPrompt}</p>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/30 gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-foreground">Target Channel:</span>
                                <span>{p.channelName || "Connected Accounts"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {p.status === "published" ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                    <CheckCircle2 className="size-3" /> Live on Social Media
                                  </span>
                                ) : p.status === "failed" ? (
                                  <span className="text-destructive font-medium flex items-center gap-1">
                                    <AlertCircle className="size-3" /> {p.errorMessage || "Publishing failed"}
                                  </span>
                                ) : (
                                  <span>Scheduled for Day {dayNum} at 10:00 AM</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

            {/* Dedicated Media Preview Dialog */}
            <CampaignMediaPreviewDialog
              open={Boolean(previewPost)}
              onOpenChange={(op) => !op && setPreviewPost(null)}
              post={previewPost}
            />

            <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="text-xs"
              >
                Configure Another Campaign
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="text-xs"
                >
                  Close
                </Button>
                <Button asChild size="sm" className="text-xs font-semibold gap-1.5">
                  <Link href="/schedule" onClick={() => onOpenChange(false)}>
                    <Calendar className="size-3.5" />
                    Open Social Calendar
                    <ArrowRight className="size-3" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
