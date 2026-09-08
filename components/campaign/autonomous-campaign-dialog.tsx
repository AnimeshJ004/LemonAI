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
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CampaignMediaPreviewDialog,
  CampaignMediaPost,
} from "./campaign-media-preview-dialog";

interface AutonomousCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDays?: number;
  initialNiche?: string;
  initialAudience?: string;
  initialBusinessName?: string;
}

const PRESET_DAYS = [1, 7, 14, 30] as const;

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
  const [customDays, setCustomDays] = useState<string>("");
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [businessName, setBusinessName] = useState<string>(initialBusinessName);
  const [niche, setNiche] = useState<string>(initialNiche);
  const [audience, setAudience] = useState<string>(initialAudience);
  const [competitors, setCompetitors] = useState<string>("");
  const [draftAd, setDraftAd] = useState<boolean>(true);
  const [result, setResult] = useState<any | null>(null);
  const [expandedPostIdx, setExpandedPostIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [previewPost, setPreviewPost] = useState<CampaignMediaPost | null>(null);
  const [inlineTab, setInlineTab] = useState<Record<number, "caption" | "media" | "script">>({});
  const [activeSlide, setActiveSlide] = useState<Record<number, number>>({});

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

  const activeDays = isCustom ? Math.max(1, parseInt(customDays, 10) || 1) : days;

  // Calculate format breakdown
  const reelsCount = Math.max(0, Math.floor(activeDays / 3) + (activeDays % 3 >= 1 ? 1 : 0));
  const carouselsCount = Math.max(0, Math.floor(activeDays / 3));
  const imagePostsCount = Math.max(0, activeDays - reelsCount - carouselsCount);

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
      const res = await fetch("/api/ai/flywheel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim() || "My Business",
          niche: niche.trim() || "General Business",
          targetAudience: audience.trim() || "General Audience",
          competitors: competitors.trim() || undefined,
          daysToSchedule: activeDays,
          autoDraftMetaAd: draftAd,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Campaign scheduling failed");
      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(`Autonomous Campaign Scheduled: ${data.postsScheduledCount || activeDays} posts added to calendar`);
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
    if (!postItem?.id) {
      toast.error("Post ID not found. Post may not be saved yet.");
      return;
    }
    setPublishingId(postItem.id);
    try {
      const res = await fetch(`/api/post/${postItem.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to publish post to account");
      }
      toast.success(data.message || "Post published successfully to social account!");
      setResult((prev: any) => {
        if (!prev || !prev.contentPieces) return prev;
        return {
          ...prev,
          contentPieces: prev.contentPieces.map((cp: any) =>
            cp.id === postItem.id
              ? {
                  ...cp,
                  status: "published",
                  publishedUrl: data.publishedUrl || cp.publishedUrl,
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
      toast.error(err.message || "Publishing failed");
      setResult((prev: any) => {
        if (!prev || !prev.contentPieces) return prev;
        return {
          ...prev,
          contentPieces: prev.contentPieces.map((cp: any) =>
            cp.id === postItem.id
              ? {
                  ...cp,
                  status: "failed",
                  errorMessage: err.message,
                }
              : cp
          ),
        };
      });
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
            {/* Duration Selector */}
            <div className="space-y-2.5 p-3.5 rounded-xl border bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-primary" /> Campaign Duration
                </Label>
                <Badge variant="outline" className="text-xs font-medium">
                  {activeDays} {activeDays === 1 ? "Day" : "Days"} Campaign
                </Badge>
              </div>

              {/* Presets and Custom Input */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PRESET_DAYS.map((preset) => {
                  const selected = !isCustom && days === preset;
                  return (
                    <Button
                      key={preset}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSelectPreset(preset)}
                      className="text-xs font-semibold h-9"
                    >
                      {preset} {preset === 1 ? "Day" : "Days"}
                    </Button>
                  );
                })}

                {/* Custom Days Input */}
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    placeholder="Custom"
                    value={customDays}
                    onChange={(e) => handleCustomChange(e.target.value)}
                    className={`h-9 text-xs pr-8 ${isCustom ? "border-primary font-semibold ring-1 ring-primary" : ""}`}
                  />
                  <span className="absolute right-2.5 top-2.5 text-[11px] text-muted-foreground pointer-events-none">
                    d
                  </span>
                </div>
              </div>

              {/* Dynamic Mix Breakdown */}
              <div className="pt-2 border-t flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Content Distribution:</span>
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
            </div>

            {/* Active Brand Context Preview (Managed exclusively in Brand Profile) */}
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

            {/* Options */}
            <div className="p-3 rounded-xl border bg-muted/10 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-foreground">Stage Meta Lead Ad Campaign</p>
                <p className="text-[11px] text-muted-foreground">
                  Drafts an ad campaign from the top-performing angle ready in Meta Ads Manager
                </p>
              </div>
              <Switch checked={draftAd} onCheckedChange={setDraftAd} />
            </div>

            {/* In-Progress Loading Indicator */}
            {isPending && (
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-primary font-semibold text-xs">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Autonomous Pipeline In Progress...</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Scraping competitor copy → Synthesizing viral hooks → Creating {activeDays} multi-format posts → Staging to Social Calendar
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
                disabled={isPending || !niche.trim()}
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
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Badge
                                variant="secondary"
                                className={`text-[10px] shrink-0 font-semibold px-2 py-0.5 ${
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
                              <span className="font-semibold text-xs text-foreground truncate">
                                {p.title}
                              </span>
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
