"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Video,
  FileText,
  LayoutGrid,
  Download,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export interface CampaignMediaPost {
  dayNumber: number;
  title: string;
  type: "FEED_POST" | "REEL_SCRIPT" | "CAROUSEL";
  previewText?: string;
  caption: string;
  script?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  carouselSlides?: {
    slideNumber: number;
    type: "COVER" | "CONTENT" | "CTA";
    headline: string;
    subtext?: string;
    bulletPoints?: string[];
    swipePrompt?: string;
  }[];
  mediaPrompt?: string;
}

interface CampaignMediaPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: CampaignMediaPost | null;
}

export function CampaignMediaPreviewDialog({
  open,
  onOpenChange,
  post,
}: CampaignMediaPreviewDialogProps) {
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!post) return null;

  const isReel = post.type === "REEL_SCRIPT";
  const isCarousel = post.type === "CAROUSEL";
  const isImage = post.type === "FEED_POST";
  const formatLabel = isReel ? "Reel Video" : isCarousel ? "Carousel Deck" : "Image Post";

  const slides = post.carouselSlides || [];
  const currentSlide = slides[currentSlideIdx] || slides[0];

  const handleCopy = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handlePrevSlide = () => {
    setCurrentSlideIdx((prev) => Math.max(0, prev - 1));
  };

  const handleNextSlide = () => {
    setCurrentSlideIdx((prev) => Math.min(slides.length - 1, prev + 1));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto p-5">
        <DialogHeader className="pb-3 border-b">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={`text-[11px] font-semibold px-2.5 py-0.5 ${
                  isReel
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900"
                    : isCarousel
                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900"
                }`}
              >
                {isReel && <Video className="size-3 mr-1" />}
                {isCarousel && <LayoutGrid className="size-3 mr-1" />}
                {isImage && <FileText className="size-3 mr-1" />}
                {formatLabel}
              </Badge>
              <Badge variant="outline" className="text-[11px] font-medium">
                Day {post.dayNumber}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {isReel ? "9:16 Vertical HD" : isCarousel ? "4:5 Multi-Slide" : "1:1 Feed Post"}
            </span>
          </div>
          <DialogTitle className="text-base sm:text-lg font-bold pt-1 text-left">
            {post.title}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-3 items-start">
          {/* Left Column: Visual Media Preview */}
          <div className="md:col-span-6 flex flex-col items-center justify-center bg-muted/20 border rounded-2xl p-4 min-h-[380px]">
            {/* 1. REEL 9:16 VIDEO PLAYER */}
            {isReel && (
              <div className="w-full flex flex-col items-center space-y-3">
                <div className="relative w-[210px] aspect-[9/16] rounded-2xl overflow-hidden shadow-xl border border-primary/20 bg-black shrink-0">
                  {post.videoUrl ? (
                    <video
                      src={post.videoUrl}
                      controls
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : post.imageUrl ? (
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                      <Video className="size-8 mb-2 opacity-50" />
                      <span className="text-xs">9:16 Reel Video</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1 w-full">
                  {post.videoUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="h-8 text-xs font-semibold gap-1.5"
                    >
                      <a href={post.videoUrl} download="reel-video.mp4" target="_blank" rel="noopener noreferrer">
                        <Download className="size-3.5" /> Download MP4
                      </a>
                    </Button>
                  )}
                  {post.imageUrl && (
                    <Button
                      size="sm"
                      variant="ghost"
                      asChild
                      className="h-8 text-xs gap-1.5 text-muted-foreground"
                    >
                      <a href={post.imageUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-3.5" /> Cover Photo
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* 2. CAROUSEL MULTI-SLIDE VIEWER */}
            {isCarousel && (
              <div className="w-full flex flex-col items-center space-y-3">
                <div className="relative w-full max-w-[270px] aspect-[4/5] rounded-2xl overflow-hidden shadow-xl border bg-card p-5 flex flex-col justify-between shrink-0">
                  {/* Slide Header */}
                  <div className="flex items-center justify-between border-b pb-2">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {currentSlide?.type || "SLIDE"}
                    </Badge>
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {slides.length > 0 ? `${currentSlideIdx + 1}/${slides.length}` : "1/5"}
                    </span>
                  </div>

                  {/* Slide Body */}
                  <div className="space-y-2.5 my-auto py-2">
                    <h4 className="text-sm font-bold text-foreground leading-snug">
                      {currentSlide?.headline || post.title}
                    </h4>
                    {currentSlide?.subtext && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {currentSlide.subtext}
                      </p>
                    )}
                    {currentSlide?.bulletPoints && currentSlide.bulletPoints.length > 0 && (
                      <ul className="space-y-1.5 pt-1">
                        {currentSlide.bulletPoints.map((bp, i) => (
                          <li key={i} className="text-[11px] text-foreground flex items-start gap-1.5">
                            <span className="size-1.5 rounded-full bg-primary mt-1 shrink-0" />
                            <span>{bp}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Slide Footer */}
                  <div className="pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                    <span>Swipe</span>
                    <span className="text-primary font-semibold">
                      {currentSlide?.swipePrompt || "Next →"}
                    </span>
                  </div>
                </div>

                {/* Carousel Controls */}
                {slides.length > 1 && (
                  <div className="flex items-center gap-3 pt-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-8 rounded-full"
                      onClick={handlePrevSlide}
                      disabled={currentSlideIdx === 0}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <div className="flex items-center gap-1.5">
                      {slides.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentSlideIdx(i)}
                          className={`size-2 rounded-full transition-all ${
                            i === currentSlideIdx ? "bg-primary w-4" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                          }`}
                        />
                      ))}
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-8 rounded-full"
                      onClick={handleNextSlide}
                      disabled={currentSlideIdx === slides.length - 1}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* 3. IMAGE FEED POST PREVIEW */}
            {isImage && (
              <div className="w-full flex flex-col items-center space-y-3">
                <div className="relative w-full max-w-[270px] aspect-square rounded-2xl overflow-hidden shadow-xl border bg-black shrink-0">
                  {post.imageUrl ? (
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                      <FileText className="size-8 mb-2 opacity-50" />
                      <span className="text-xs">1:1 Photo Creative</span>
                    </div>
                  )}
                </div>

                {post.imageUrl && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="h-8 text-xs font-semibold gap-1.5"
                    >
                      <a href={post.imageUrl} download="post-image.jpg" target="_blank" rel="noopener noreferrer">
                        <Download className="size-3.5" /> Download HD Photo
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Copy, Script & Direction */}
          <div className="md:col-span-6 space-y-3 flex flex-col h-full">
            {isReel ? (
              <Tabs defaultValue="caption" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-9 p-1">
                  <TabsTrigger value="caption" className="text-xs font-semibold">
                    Post Caption
                  </TabsTrigger>
                  <TabsTrigger value="script" className="text-xs font-semibold">
                    Voiceover Script
                  </TabsTrigger>
                </TabsList>

                {/* Social Media Caption */}
                <TabsContent value="caption" className="space-y-2 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Clean Publishing Caption
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(post.caption, "caption")}
                      className="h-6 text-[11px] gap-1 px-2 text-primary"
                    >
                      {copiedSection === "caption" ? (
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
                  <div className="p-3 rounded-xl bg-background border font-sans text-xs whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto select-text shadow-2xs">
                    {post.caption}
                  </div>
                </TabsContent>

                {/* Actor / Voiceover Script */}
                <TabsContent value="script" className="space-y-2 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Hook, Timing & Voiceover Notes
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(post.script || post.caption, "script")}
                      className="h-6 text-[11px] gap-1 px-2 text-primary"
                    >
                      {copiedSection === "script" ? (
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
                  <div className="p-3 rounded-xl bg-muted/30 border font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto select-text shadow-2xs">
                    {post.script || post.caption}
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              /* Carousel & Image Copy */
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Publishable Caption & Hashtags
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(post.caption, "caption")}
                    className="h-6 text-[11px] gap-1 px-2 text-primary"
                  >
                    {copiedSection === "caption" ? (
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
                <div className="p-3 rounded-xl bg-background border font-sans text-xs whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto select-text shadow-2xs">
                  {post.caption}
                </div>
              </div>
            )}

            {/* Visual Media Direction */}
            {post.mediaPrompt && (
              <div className="p-3 rounded-xl bg-muted/30 border text-xs space-y-1 mt-2">
                <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5">
                  <Sparkles className="size-3 text-primary" /> Visual Direction
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {post.mediaPrompt}
                </p>
              </div>
            )}

            <div className="mt-auto pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
              <span>Status</span>
              <Badge variant="outline" className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                Scheduled in Calendar
              </Badge>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
