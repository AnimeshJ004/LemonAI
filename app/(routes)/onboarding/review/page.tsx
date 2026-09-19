"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  TrendingUp,
  Flame,
  XCircle,
  CheckCircle2,
  Calendar,
  Clapperboard,
  LayoutTemplate,
  FileText,
  Copy,
  Check,
  Edit3,
  Loader2,
  ArrowRight,
  Hash,
  Target,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  Sparkle,
  Camera,
  Music,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface ViralPostDraft {
  id: string;
  dayNumber: number;
  format: "REEL" | "CAROUSEL" | "FEED_POST";
  contentAngle?: string;
  bestPlatform?: string;
  soundMood?: string;
  title: string;
  hook: string;
  visualCue?: string;
  caption: string;
  script?: string;
  engagementQuestion?: string;
  callToAction?: string;
  targetEmotion?: string;
  mediaPrompt?: string;
  carouselSlides?: any[];
  scheduledAt: string;
}

interface ViralResearchData {
  niche: string;
  targetRegion: string;
  viralVsFlop?: {
    whatGoesViral: string[];
    whatFlops: string[];
  };
  topTrendingHooks: {
    hook: string;
    hookType: string;
    targetEmotion: string;
    whyItWorks: string;
  }[];
  audiencePainPoints: {
    painPoint: string;
    agitation: string;
    proposedSolutionAngle: string;
  }[];
  competitorWeaknessesToExploit: string[];
  recommendedContentAngles: {
    angleTitle: string;
    suggestedFormat: string;
    shortHook: string;
  }[];
  recommendedHashtags: string[];
}

export default function OnboardingReviewPage() {
  const router = useRouter();
  const [research, setResearch] = useState<ViralResearchData | null>(null);
  const [posts, setPosts] = useState<ViralPostDraft[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit post modal
  const [editingPost, setEditingPost] = useState<ViralPostDraft | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editScript, setEditScript] = useState("");

  // Slide viewer active index for carousels
  const [activeSlideMap, setActiveSlideMap] = useState<Record<string, number>>({});

  // Active view tab
  const [activeTab, setActiveTab] = useState<"posts" | "viral_intel">("posts");

  // Pipeline generation mutation
  const {
    mutate: generatePipeline,
    isPending: isGenerating,
  } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/viral-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate viral content pipeline");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResearch(data.research);
      setPosts(data.posts || []);
      setProfile(data.profile || {});
      toast.success("Viral market analysis & 7-day content plan ready!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to run viral analysis. Retrying...");
    },
  });

  // Batch schedule mutation
  const { mutate: scheduleBatch, isPending: isScheduling } = useMutation({
    mutationFn: async (status: "queue" | "draft") => {
      const res = await fetch("/api/posts/batch-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posts,
          status,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to schedule posts");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || "All approved posts are now scheduled!");
      setTimeout(() => {
        router.push("/schedule");
      }, 1200);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to schedule posts. Please try again.");
    },
  });

  // Trigger pipeline automatically upon mounting
  useEffect(() => {
    generatePipeline();
  }, [generatePipeline]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Copied to clipboard!");
  };

  const handleOpenEdit = (post: ViralPostDraft) => {
    setEditingPost(post);
    setEditCaption(post.caption);
    setEditScript(post.script || "");
  };

  const handleSaveEdit = () => {
    if (!editingPost) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === editingPost.id
          ? { ...p, caption: editCaption, script: editScript }
          : p
      )
    );
    setEditingPost(null);
    toast.success("Post updated!");
  };

  // ─── Loading / AI Generation Screen ─────────────────────────────────────────
  if (isGenerating && posts.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-6 text-zinc-900">
        <div className="max-w-md w-full bg-white p-8 sm:p-10 rounded-3xl border border-zinc-200/80 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="relative mx-auto size-20">
            <div className="size-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 animate-pulse">
              <Sparkles className="size-10 text-white" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
              Lemon AI is Analyzing Your Niche
            </h2>
            <p className="text-zinc-600 text-sm leading-relaxed">
              Our autonomous research agent is examining viral patterns, benchmark hooks, and competitor gaps for your profile…
            </p>
          </div>

          {/* Stepper simulation */}
          <div className="space-y-3 text-left pt-2 text-xs">
            <div className="flex items-center gap-2.5 text-zinc-800 font-medium">
              <div className="size-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px]">✓</div>
              <span>Profile DNA and category verified</span>
            </div>
            <div className="flex items-center gap-2.5 text-zinc-800 font-medium">
              <Loader2 className="size-4 text-amber-500 animate-spin" />
              <span>Scanning high-retention 0-3s viral hooks</span>
            </div>
            <div className="flex items-center gap-2.5 text-zinc-400">
              <div className="size-4 rounded-full border border-zinc-300" />
              <span>Drafting 7-day personalized content batch (Reels, Carousels, Posts)</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-zinc-900 font-sans pb-28">
      {/* ── Top Header Navigation ── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20">
              <Sparkles className="size-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-zinc-900">
                  Viral Content Launchpad
                </h1>
                <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 border-amber-300 text-[11px] font-semibold">
                  Preview & Approval
                </Badge>
              </div>
              <p className="text-xs text-zinc-500">
                {profile?.businessName || "Your Brand"} • {profile?.niche || "Niche Content"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => generatePipeline()}
              disabled={isGenerating}
              className="rounded-xl border-zinc-200 text-xs font-semibold gap-1.5 h-9"
            >
              <RotateCcw className={cn("size-3.5", isGenerating && "animate-spin")} />
              Regenerate Plan
            </Button>
            <Button
              onClick={() => scheduleBatch("queue")}
              disabled={isScheduling || posts.length === 0}
              className="rounded-xl h-9 px-4 text-xs font-bold gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/20 transition-all"
            >
              {isScheduling ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Scheduling…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 stroke-[2.5]" />
                  Agree & Auto-Schedule ({posts.length} Posts)
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* ── Tabs Selector: Content Posts vs Viral Research ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("posts")}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2",
                activeTab === "posts"
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              )}
            >
              <Calendar className="size-4" />
              Generated 7-Day Content Plan
              <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-amber-400 text-zinc-950 font-bold">
                {posts.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("viral_intel")}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2",
                activeTab === "viral_intel"
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              )}
            >
              <Flame className="size-4 text-orange-500" />
              Niche Viral Intelligence
            </button>
          </div>

          <p className="text-xs text-zinc-500 hidden sm:block">
            Review and edit every piece below before confirming. Nothing is scheduled until you agree.
          </p>
        </div>

        {/* ── TAB 1: Generated Posts Preview ── */}
        {activeTab === "posts" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => {
                const isReel = post.format === "REEL";
                const isCarousel = post.format === "CAROUSEL";
                const activeSlide = activeSlideMap[post.id] || 0;
                const slides = post.carouselSlides || [];

                return (
                  <Card
                    key={post.id}
                    className="border border-zinc-200 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                  >
                    <CardHeader className="pb-3 border-b border-zinc-100 bg-zinc-50/50">
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 text-amber-900 border-amber-200 text-xs font-bold"
                        >
                          Day {post.dayNumber}
                        </Badge>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
                          {isReel ? (
                            <>
                              <Clapperboard className="size-3.5 text-rose-500" />
                              <span>Reel / Short Script</span>
                            </>
                          ) : isCarousel ? (
                            <>
                              <LayoutTemplate className="size-3.5 text-blue-500" />
                              <span>5-Slide Carousel</span>
                            </>
                          ) : (
                            <>
                              <FileText className="size-3.5 text-emerald-500" />
                              <span>Image / Feed Post</span>
                            </>
                          )}
                        </div>
                      </div>
                      <CardTitle className="text-base font-bold text-zinc-900 pt-2 line-clamp-1">
                        {post.title}
                      </CardTitle>

                      {/* Content Angle & Target Platform Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {post.contentAngle && (
                          <Badge variant="outline" className="text-[10px] font-semibold bg-zinc-100 text-zinc-700 border-zinc-200">
                            {post.contentAngle}
                          </Badge>
                        )}
                        {post.bestPlatform && (
                          <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {post.bestPlatform}
                          </span>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="pt-4 space-y-3.5 flex-1 flex flex-col justify-between">
                      {/* Hook callout */}
                      <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                          <span className="flex items-center gap-1">
                            <Sparkle className="size-3 fill-amber-500 text-amber-500" />
                            0-3s Viral Hook
                          </span>
                          <span className="text-zinc-500 font-normal">
                            {post.targetEmotion || "Curiosity"}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-zinc-800 italic">
                          &ldquo;{post.hook || post.title}&rdquo;
                        </p>
                      </div>

                      {/* Trending Audio / Sound Mood */}
                      {post.soundMood && (
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-600 bg-zinc-50/80 px-2.5 py-1 rounded-lg border border-zinc-200/60">
                          <Music className="size-3 text-rose-500 shrink-0" />
                          <span className="truncate"><strong>Audio:</strong> {post.soundMood}</span>
                        </div>
                      )}

                      {/* Reel Script preview */}
                      {isReel && post.script && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                            Director Voiceover Script
                          </span>
                          <div className="p-3 rounded-xl bg-zinc-900 text-zinc-100 text-xs font-mono whitespace-pre-line leading-relaxed max-h-40 overflow-y-auto border border-zinc-800">
                            {post.script}
                          </div>
                        </div>
                      )}

                      {/* Carousel Slides Preview */}
                      {isCarousel && slides.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500">
                            <span>Slide {activeSlide + 1} of {slides.length}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={activeSlide === 0}
                                onClick={() =>
                                  setActiveSlideMap((prev) => ({
                                    ...prev,
                                    [post.id]: Math.max(0, activeSlide - 1),
                                  }))
                                }
                                className="size-5 rounded border flex items-center justify-center hover:bg-zinc-100 disabled:opacity-30"
                              >
                                <ChevronLeft className="size-3" />
                              </button>
                              <button
                                type="button"
                                disabled={activeSlide === slides.length - 1}
                                onClick={() =>
                                  setActiveSlideMap((prev) => ({
                                    ...prev,
                                    [post.id]: Math.min(slides.length - 1, activeSlide + 1),
                                  }))
                                }
                                className="size-5 rounded border flex items-center justify-center hover:bg-zinc-100 disabled:opacity-30"
                              >
                                <ChevronRight className="size-3" />
                              </button>
                            </div>
                          </div>

                          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 text-xs space-y-1.5 min-h-[95px] flex flex-col justify-center">
                            <p className="font-bold text-zinc-900">
                              {slides[activeSlide]?.headline || "Slide Headline"}
                            </p>
                            <p className="text-zinc-600 text-[11px] line-clamp-2">
                              {slides[activeSlide]?.subtext}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Visual Direction / Camera Cue */}
                      {post.visualCue && (
                        <div className="flex items-start gap-2 text-[11px] text-zinc-700 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/70">
                          <Camera className="size-3.5 text-indigo-500 shrink-0 mt-0.5" />
                          <span><strong>Visual Cue:</strong> {post.visualCue}</span>
                        </div>
                      )}

                      {/* Caption Preview */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          Caption Preview
                        </span>
                        <p className="text-xs text-zinc-700 line-clamp-3 leading-relaxed">
                          {post.caption}
                        </p>
                      </div>

                      {/* Engagement Debate Question */}
                      {post.engagementQuestion && (
                        <div className="flex items-start gap-1.5 text-[11px] text-emerald-900 bg-emerald-50/70 p-2 rounded-lg border border-emerald-200/70">
                          <MessageSquare className="size-3 text-emerald-600 shrink-0 mt-0.5" />
                          <span><strong>Comment Prompt:</strong> {post.engagementQuestion}</span>
                        </div>
                      )}

                      {/* Goal CTA */}
                      {post.callToAction && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-900 bg-amber-50/60 px-2.5 py-1.5 rounded-lg border border-amber-200/60 font-medium">
                          <Target className="size-3 text-amber-600 shrink-0" />
                          <span><strong>Goal CTA:</strong> {post.callToAction}</span>
                        </div>
                      )}

                      {/* Card Footer Actions */}
                      <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                          <Calendar className="size-3 text-amber-500" />
                          {new Date(post.scheduledAt).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(post.caption, post.id)}
                            className="h-7 text-xs px-2 text-zinc-500 hover:text-zinc-900"
                            title="Copy Caption"
                          >
                            {copiedId === post.id ? (
                              <Check className="size-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(post)}
                            className="h-7 text-xs px-2.5 rounded-lg border-zinc-200 text-zinc-700 hover:bg-zinc-100 gap-1"
                          >
                            <Edit3 className="size-3" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB 2: Niche Viral Intelligence Breakdown ── */}
        {activeTab === "viral_intel" && research && (
          <div className="space-y-6">
            {/* Viral Signals vs Flop Signals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* What Goes Viral */}
              <Card className="border-emerald-200 bg-emerald-50/30 rounded-2xl shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-base">
                    <Flame className="size-5 text-emerald-600 fill-emerald-600" />
                    <span>What Explodes & Goes Viral in Your Niche</span>
                  </div>
                  <CardDescription className="text-emerald-700/80 text-xs">
                    Reverse-engineered algorithmic winning patterns
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5 text-xs text-zinc-800">
                  {research.viralVsFlop?.whatGoesViral?.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-white/80 p-3 rounded-xl border border-emerald-100">
                      <span className="text-emerald-600 font-bold shrink-0">✓</span>
                      <p className="leading-relaxed">{item}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* What Flops */}
              <Card className="border-rose-200 bg-rose-50/30 rounded-2xl shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-base">
                    <XCircle className="size-5 text-rose-600" />
                    <span>What Flops & Fails to Convert</span>
                  </div>
                  <CardDescription className="text-rose-700/80 text-xs">
                    Common industry mistakes that kill organic reach
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5 text-xs text-zinc-800">
                  {research.viralVsFlop?.whatFlops?.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-white/80 p-3 rounded-xl border border-rose-100">
                      <span className="text-rose-500 font-bold shrink-0">✕</span>
                      <p className="leading-relaxed">{item}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Top Trending Hooks */}
            {research.topTrendingHooks?.length > 0 && (
              <Card className="border-zinc-200 bg-white rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="size-5 text-amber-500" />
                    Top 0-3s High-Retention Viral Hooks
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Click any hook to copy for manual reels, shorts, or tweets
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {research.topTrendingHooks.map((h, i) => (
                    <div
                      key={i}
                      onClick={() => copyToClipboard(h.hook, `brief-hook-${i}`)}
                      className="p-3.5 rounded-xl border border-zinc-200 hover:border-amber-400 bg-zinc-50/60 hover:bg-amber-50/30 transition-all cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {h.hookType}
                        </Badge>
                        {copiedId === `brief-hook-${i}` ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <Copy className="size-3 text-zinc-400" />
                        )}
                      </div>
                      <p className="text-xs font-bold text-zinc-900">&ldquo;{h.hook}&rdquo;</p>
                      <p className="text-[11px] text-zinc-500 italic">{h.whyItWorks}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Hashtags & Competitor Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Hashtags */}
              <Card className="border-zinc-200 bg-white rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Hash className="size-4 text-purple-500" />
                    High-Velocity Trending Hashtags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {research.recommendedHashtags?.map((tag, idx) => (
                      <button
                        key={idx}
                        onClick={() => copyToClipboard(tag, `tag-${idx}`)}
                        className="px-3 py-1.5 rounded-full border border-purple-200 bg-purple-50 hover:bg-purple-100 text-xs font-semibold text-purple-800 transition-colors flex items-center gap-1"
                      >
                        {copiedId === `tag-${idx}` && <Check className="size-3 text-emerald-600" />}
                        {tag}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Competitor Gaps */}
              <Card className="border-zinc-200 bg-white rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="size-4 text-blue-500" />
                    Competitor Content Gaps to Exploit
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-zinc-700">
                  {research.competitorWeaknessesToExploit?.map((gap, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold">•</span>
                      <span>{gap}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      {/* ── Sticky Bottom Action Bar ── */}
      <footer className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-zinc-200/80 p-4 z-40">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <ShieldCheck className="size-4 text-emerald-600" />
            <span>
              <strong>100% Control:</strong> Every post will be placed into your calendar at peak engagement times.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => scheduleBatch("draft")}
              disabled={isScheduling || posts.length === 0}
              className="rounded-xl border-zinc-200 text-xs font-semibold h-10 px-4"
            >
              Save as Drafts Only
            </Button>

            <Button
              onClick={() => scheduleBatch("queue")}
              disabled={isScheduling || posts.length === 0}
              className="rounded-xl h-10 px-6 text-sm font-bold gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25 transition-all"
            >
              {isScheduling ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Scheduling to Calendar…
                </>
              ) : (
                <>
                  Agree & Auto-Schedule ({posts.length} Posts)
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </footer>

      {/* ── Edit Post Dialog ── */}
      <Dialog open={Boolean(editingPost)} onOpenChange={(open) => !open && setEditingPost(null)}>
        <DialogContent className="max-w-xl rounded-2xl p-6 bg-white text-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Edit Post (Day {editingPost?.dayNumber}: {editingPost?.title})
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {editingPost?.format === "REEL" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700">Voiceover & Hook Script</label>
                <Textarea
                  rows={4}
                  value={editScript}
                  onChange={(e) => setEditScript(e.target.value)}
                  className="font-mono text-xs rounded-xl border-zinc-200"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">Post Caption & Hashtags</label>
              <Textarea
                rows={6}
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                className="text-xs rounded-xl border-zinc-200"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditingPost(null)}
              className="rounded-xl text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              className="rounded-xl text-xs font-bold h-9 bg-amber-500 hover:bg-amber-600 text-white"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
