"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Download,
  ChevronLeft,
  ChevronRight,
  Palette,
  Sparkles,
  Share2,
  Check,
  FileText,
  Copy,
  Edit3,
  Undo2,
  Quote,
  TrendingUp,
  Layers,
  AtSign,
} from "lucide-react";
import { toast } from "sonner";

export interface CarouselSlide {
  slideNumber: number;
  type: "COVER" | "CONTENT" | "STAT_CALLOUT" | "QUOTE" | "CTA" | string;
  headline: string;
  subtext?: string;
  bulletPoints?: string[];
  statNumber?: string;
  statLabel?: string;
  quoteText?: string;
  quoteAuthor?: string;
  swipePrompt?: string;
  visualSuggestion?: string;
}

export interface CarouselData {
  title: string;
  slides: CarouselSlide[];
  caption: string;
  cta?: string;
}

interface ThemeConfig {
  id: string;
  name: string;
  bgGradient: string;
  canvasBg: string;
  canvasText: string;
  canvasAccent: string;
  canvasSubtext: string;
  accentBadge: string;
  border: string;
}

const THEMES: ThemeConfig[] = [
  {
    id: "midnight",
    name: "Midnight Slate",
    bgGradient: "from-slate-950 via-slate-900 to-indigo-950 text-white",
    canvasBg: "#090d16",
    canvasText: "#ffffff",
    canvasAccent: "#6366f1",
    canvasSubtext: "#94a3b8",
    accentBadge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    border: "border-indigo-500/20",
  },
  {
    id: "sunset",
    name: "Sunset Glow",
    bgGradient: "from-purple-950 via-pink-950 to-amber-950 text-white",
    canvasBg: "#1a0826",
    canvasText: "#ffffff",
    canvasAccent: "#f43f5e",
    canvasSubtext: "#cbd5e1",
    accentBadge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    border: "border-rose-500/20",
  },
  {
    id: "cyber",
    name: "Cyber Mint",
    bgGradient: "from-zinc-950 via-stone-950 to-emerald-950 text-white",
    canvasBg: "#05110d",
    canvasText: "#ffffff",
    canvasAccent: "#10b981",
    canvasSubtext: "#94a3b8",
    accentBadge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    border: "border-emerald-500/20",
  },
  {
    id: "minimal",
    name: "Editorial Crisp",
    bgGradient: "from-zinc-100 via-stone-50 to-slate-100 text-zinc-900",
    canvasBg: "#f8fafc",
    canvasText: "#0f172a",
    canvasAccent: "#2563eb",
    canvasSubtext: "#475569",
    accentBadge: "bg-blue-100 text-blue-800 border-blue-200",
    border: "border-zinc-300",
  },
  {
    id: "lavender",
    name: "Pastel Violet",
    bgGradient: "from-slate-900 via-purple-950 to-violet-900 text-white",
    canvasBg: "#120924",
    canvasText: "#ffffff",
    canvasAccent: "#a855f7",
    canvasSubtext: "#c4b5fd",
    accentBadge: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    border: "border-purple-500/20",
  },
  {
    id: "amber",
    name: "Warm Amber",
    bgGradient: "from-stone-950 via-neutral-900 to-amber-950 text-white",
    canvasBg: "#140e06",
    canvasText: "#ffffff",
    canvasAccent: "#f59e0b",
    canvasSubtext: "#d97706",
    accentBadge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    border: "border-amber-500/20",
  },
];

export function CarouselVisualPreview({
  carousel,
  onSchedule,
}: {
  carousel: CarouselData;
  onSchedule?: () => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [themeId, setThemeId] = useState("midnight");
  const [brandHandle, setBrandHandle] = useState("@lemonai");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Local mutable copy of slides for live edits
  const [slides, setSlides] = useState<CarouselSlide[]>(carousel.slides || []);

  useEffect(() => {
    setSlides(carousel.slides || []);
    setCurrentIdx(0);
  }, [carousel]);

  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  const currentSlide = slides[currentIdx] || slides[0];

  const handlePrev = () => setCurrentIdx((i) => Math.max(0, i - 1));
  const handleNext = () => setCurrentIdx((i) => Math.min(slides.length - 1, i + 1));

  // Edit current slide field
  const updateCurrentSlide = (field: keyof CarouselSlide, val: any) => {
    setSlides((prev) => {
      const copy = [...prev];
      if (copy[currentIdx]) {
        copy[currentIdx] = { ...copy[currentIdx], [field]: val };
      }
      return copy;
    });
  };

  // Helper function to wrap text on canvas
  const drawWrappedText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ): number => {
    const words = (text || "").split(" ");
    let line = "";
    let curY = y;
    for (const w of words) {
      const testLine = line + w + " ";
      if (ctx.measureText(testLine).width > maxWidth && line !== "") {
        ctx.fillText(line.trim(), x, curY);
        line = w + " ";
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, curY);
    return curY + lineHeight;
  };

  // Render high-resolution 1080x1350 (4:5) slide to canvas
  const renderSlideToCanvas = (slide: CarouselSlide, th: ThemeConfig): HTMLCanvasElement => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

    // Background
    ctx.fillStyle = th.canvasBg;
    ctx.fillRect(0, 0, 1080, 1350);

    // Ambient radial glow
    const grad = ctx.createRadialGradient(540, 420, 80, 540, 420, 680);
    grad.addColorStop(0, th.canvasAccent + "33");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1350);

    // Header: Slide badge & Topic
    ctx.fillStyle = th.canvasAccent;
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(`${slide.type || "SLIDE"} • ${slide.slideNumber}/${slides.length}`, 80, 115);

    ctx.fillStyle = th.canvasSubtext;
    ctx.font = "24px sans-serif";
    ctx.fillText(carousel.title.slice(0, 42), 80, 155);

    // Top Divider
    ctx.strokeStyle = th.canvasSubtext + "33";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(80, 185);
    ctx.lineTo(1000, 185);
    ctx.stroke();

    // BODY LAYOUTS BASED ON SLIDE TYPE
    if (slide.type === "STAT_CALLOUT" && (slide.statNumber || slide.headline)) {
      // 1. Big Stat / Number Layout
      const statNum = slide.statNumber || "84%";
      ctx.fillStyle = th.canvasAccent;
      ctx.font = "900 130px sans-serif";
      ctx.fillText(statNum, 80, 370);

      if (slide.statLabel) {
        ctx.fillStyle = th.canvasText;
        ctx.font = "bold 38px sans-serif";
        drawWrappedText(ctx, slide.statLabel, 80, 450, 920, 50);
      }

      ctx.fillStyle = th.canvasText;
      ctx.font = "bold 52px sans-serif";
      const nextY = drawWrappedText(ctx, slide.headline, 80, 580, 920, 68);

      if (slide.subtext) {
        ctx.fillStyle = th.canvasSubtext;
        ctx.font = "34px sans-serif";
        drawWrappedText(ctx, slide.subtext, 80, nextY + 30, 920, 52);
      }
    } else if (slide.type === "QUOTE" && (slide.quoteText || slide.headline)) {
      // 2. Quote Layout
      ctx.fillStyle = th.canvasAccent + "66";
      ctx.font = "900 120px serif";
      ctx.fillText("“", 80, 340);

      ctx.fillStyle = th.canvasText;
      ctx.font = "italic 46px sans-serif";
      const qText = slide.quoteText || slide.headline;
      const nextY = drawWrappedText(ctx, `"${qText}"`, 80, 420, 920, 64);

      if (slide.quoteAuthor) {
        ctx.fillStyle = th.canvasAccent;
        ctx.font = "bold 32px sans-serif";
        ctx.fillText(`— ${slide.quoteAuthor}`, 80, nextY + 30);
      }

      if (slide.subtext) {
        ctx.fillStyle = th.canvasSubtext;
        ctx.font = "32px sans-serif";
        drawWrappedText(ctx, slide.subtext, 80, nextY + 110, 920, 50);
      }
    } else if (slide.type === "COVER") {
      // 3. Cover Slide Layout
      ctx.fillStyle = th.canvasAccent;
      ctx.font = "bold 32px sans-serif";
      ctx.fillText("MASTERCLASS PLAYBOOK", 80, 310);

      ctx.fillStyle = th.canvasText;
      ctx.font = "bold 68px sans-serif";
      const nextY = drawWrappedText(ctx, slide.headline, 80, 420, 920, 88);

      if (slide.subtext) {
        ctx.fillStyle = th.canvasSubtext;
        ctx.font = "36px sans-serif";
        drawWrappedText(ctx, slide.subtext, 80, nextY + 40, 920, 54);
      }

      // Visual curiosity indicator
      ctx.fillStyle = th.canvasAccent + "22";
      ctx.beginPath();
      ctx.roundRect(80, 1050, 320, 65, 14);
      ctx.fill();

      ctx.fillStyle = th.canvasAccent;
      ctx.font = "bold 28px sans-serif";
      ctx.fillText("SWIPE TO LEARN →", 115, 1092);
    } else {
      // 4. Content / Bullet / CTA Layout
      ctx.fillStyle = th.canvasText;
      ctx.font = "bold 58px sans-serif";
      let curY = drawWrappedText(ctx, slide.headline || "", 80, 320, 920, 76);

      if (slide.subtext) {
        ctx.fillStyle = th.canvasSubtext;
        ctx.font = "34px sans-serif";
        curY = drawWrappedText(ctx, slide.subtext, 80, curY + 20, 920, 50);
      }

      if (slide.bulletPoints && slide.bulletPoints.length > 0) {
        curY += 20;
        for (const bp of slide.bulletPoints) {
          // Bullet dot
          ctx.fillStyle = th.canvasAccent;
          ctx.beginPath();
          ctx.arc(95, curY - 10, 9, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = th.canvasText;
          ctx.font = "32px sans-serif";
          curY = drawWrappedText(ctx, bp, 130, curY, 860, 48) + 16;
        }
      }
    }

    // Bottom Footer Bar
    ctx.strokeStyle = th.canvasSubtext + "33";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(80, 1220);
    ctx.lineTo(1000, 1220);
    ctx.stroke();

    // Brand handle watermark
    ctx.fillStyle = th.canvasSubtext;
    ctx.font = "24px sans-serif";
    ctx.fillText(brandHandle || "Lemon AI Studio", 80, 1270);

    // Swipe prompt
    const promptText = slide.swipePrompt || (slide.slideNumber === slides.length ? "Save for later" : "Swipe Next →");
    ctx.fillStyle = th.canvasAccent;
    ctx.font = "bold 26px sans-serif";
    const promptWidth = ctx.measureText(promptText).width;
    ctx.fillText(promptText, 1000 - promptWidth, 1270);

    return canvas;
  };

  // Download Current Slide as PNG
  const downloadCurrentSlide = () => {
    if (!currentSlide) return;
    try {
      const canvas = renderSlideToCanvas(currentSlide, theme);
      const link = document.createElement("a");
      link.download = `${carousel.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_slide_${currentSlide.slideNumber}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success(`Slide ${currentSlide.slideNumber} downloaded!`);
    } catch (err) {
      toast.error("Failed to generate slide image.");
    }
  };

  // Download All Slides sequentially
  const downloadAllSlides = async () => {
    setIsDownloading(true);
    toast.info(`Rendering and downloading ${slides.length} slides...`);
    try {
      for (let i = 0; i < slides.length; i++) {
        const c = renderSlideToCanvas(slides[i], theme);
        const link = document.createElement("a");
        link.download = `${carousel.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_slide_${slides[i].slideNumber}.png`;
        link.href = c.toDataURL("image/png");
        link.click();
        await new Promise((r) => setTimeout(r, 400));
      }
      toast.success(`All ${slides.length} slides downloaded as high-res PNGs!`);
    } catch (err) {
      toast.error("Error batch downloading slides.");
    } finally {
      setIsDownloading(false);
    }
  };

  // Copy Slide Image to Clipboard
  const copySlideToClipboard = async () => {
    if (!currentSlide) return;
    try {
      const canvas = renderSlideToCanvas(currentSlide, theme);
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error("Could not create image blob");
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
          toast.success(`Slide ${currentSlide.slideNumber} image copied to clipboard! Ready to paste into Slack/Figma/Canva.`);
        } catch (clipErr) {
          toast.info("Image downloaded instead (clipboard image write restricted by browser).");
          downloadCurrentSlide();
        }
      }, "image/png");
    } catch (err) {
      toast.error("Failed copying image");
    }
  };

  if (slides.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Top Controls: Theme selector, Brand Handle & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-card border rounded-xl shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <Palette className="size-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold">Themes:</span>
          <div className="flex gap-1.5 flex-wrap">
            {THEMES.map((t) => (
              <Button
                key={t.id}
                size="sm"
                variant={themeId === t.id ? "default" : "outline"}
                className="text-xs h-7 px-2.5"
                onClick={() => setThemeId(t.id)}
              >
                {t.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 border rounded-md px-2 h-8 bg-background">
            <AtSign className="size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={brandHandle}
              onChange={(e) => setBrandHandle(e.target.value)}
              placeholder="@handle"
              className="text-xs bg-transparent border-none outline-none w-24"
            />
          </div>

          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1.5 h-8"
            onClick={copySlideToClipboard}
          >
            {isCopied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
            {isCopied ? "Copied" : "Copy Image"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1.5 h-8"
            onClick={downloadCurrentSlide}
          >
            <Download className="size-3.5" /> Slide {currentSlide.slideNumber}
          </Button>

          <Button
            size="sm"
            variant="default"
            className="text-xs gap-1.5 h-8"
            onClick={downloadAllSlides}
            disabled={isDownloading}
          >
            <Download className="size-3.5" />
            {isDownloading ? "Downloading…" : `Download All (${slides.length})`}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="text-xs gap-1 h-8"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit3 className="size-3.5" /> {isEditing ? "Done Editing" : "Quick Edit"}
          </Button>
        </div>
      </div>

      {/* Main Preview Deck with Live Side Editor if open */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Visual 4:5 Slide Canvas Preview */}
        <div className={`${isEditing ? "lg:col-span-7" : "lg:col-span-12"} flex flex-col items-center justify-center p-6 bg-muted/40 rounded-2xl border`}>
          <div
            className={`relative w-full max-w-[400px] aspect-[4/5] rounded-2xl p-7 shadow-2xl flex flex-col justify-between overflow-hidden bg-gradient-to-br ${theme.bgGradient} border ${theme.border} transition-all duration-300`}
          >
            {/* Top metadata */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={`text-[10px] font-bold ${theme.accentBadge}`}>
                  {currentSlide.type}
                </Badge>
                <span className="text-xs font-semibold opacity-70">
                  {currentSlide.slideNumber} / {slides.length}
                </span>
              </div>
              <p className="text-[11px] opacity-60 truncate">{carousel.title}</p>
              <div className="w-full h-px bg-current opacity-15 pt-1" />
            </div>

            {/* Slide Body based on type */}
            <div className="my-auto space-y-3.5 py-2">
              {currentSlide.type === "STAT_CALLOUT" && (
                <div className="space-y-2">
                  <span className="text-4xl sm:text-5xl font-black text-primary tracking-tight">
                    {currentSlide.statNumber || "84%"}
                  </span>
                  {currentSlide.statLabel && (
                    <p className="text-sm font-semibold opacity-90">{currentSlide.statLabel}</p>
                  )}
                </div>
              )}

              {currentSlide.type === "QUOTE" && (
                <div className="space-y-2">
                  <Quote className="size-8 opacity-40 text-primary" />
                  <p className="text-base sm:text-lg italic font-medium opacity-90 leading-snug">
                    "{currentSlide.quoteText || currentSlide.headline}"
                  </p>
                  {currentSlide.quoteAuthor && (
                    <p className="text-xs font-bold text-primary">— {currentSlide.quoteAuthor}</p>
                  )}
                </div>
              )}

              {currentSlide.type !== "QUOTE" && (
                <h3 className="text-lg sm:text-xl font-black leading-tight tracking-tight">
                  {currentSlide.headline}
                </h3>
              )}

              {currentSlide.subtext && (
                <p className="text-xs opacity-80 leading-relaxed">{currentSlide.subtext}</p>
              )}

              {currentSlide.bulletPoints && currentSlide.bulletPoints.length > 0 && (
                <ul className="space-y-2 pt-1">
                  {currentSlide.bulletPoints.map((bp, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs">
                      <span className="size-1.5 rounded-full bg-current mt-1.5 shrink-0" />
                      <span>{bp}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Bottom Footer */}
            <div className="space-y-2 pt-2 border-t border-current/15">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] opacity-60">{brandHandle}</span>
                <span className="font-semibold text-xs flex items-center gap-1">
                  {currentSlide.swipePrompt || "Swipe Next"} →
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Prev / Next */}
          <div className="flex items-center gap-4 mt-5">
            <Button
              size="icon"
              variant="outline"
              className="rounded-full size-9"
              onClick={handlePrev}
              disabled={currentIdx === 0}
            >
              <ChevronLeft className="size-4" />
            </Button>

            <span className="text-xs font-semibold text-muted-foreground">
              Slide {currentIdx + 1} of {slides.length}
            </span>

            <Button
              size="icon"
              variant="outline"
              className="rounded-full size-9"
              onClick={handleNext}
              disabled={currentIdx === slides.length - 1}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Optional Live Quick-Editor for Current Slide */}
        {isEditing && (
          <Card className="lg:col-span-5 border shadow-sm">
            <CardContent className="pt-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b">
                <span className="font-bold text-sm flex items-center gap-1.5">
                  <Edit3 className="size-4 text-primary" /> Edit Slide {currentSlide.slideNumber}
                </span>
                <Badge variant="outline" className="text-xs">
                  {currentSlide.type}
                </Badge>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Headline</Label>
                <Input
                  value={currentSlide.headline || ""}
                  onChange={(e) => updateCurrentSlide("headline", e.target.value)}
                  placeholder="Headline"
                />
              </div>

              {currentSlide.type === "STAT_CALLOUT" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Stat Number</Label>
                    <Input
                      value={currentSlide.statNumber || ""}
                      onChange={(e) => updateCurrentSlide("statNumber", e.target.value)}
                      placeholder="e.g. 84%"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stat Label</Label>
                    <Input
                      value={currentSlide.statLabel || ""}
                      onChange={(e) => updateCurrentSlide("statLabel", e.target.value)}
                      placeholder="Label"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Subtext / Summary</Label>
                <Textarea
                  value={currentSlide.subtext || ""}
                  onChange={(e) => updateCurrentSlide("subtext", e.target.value)}
                  rows={2}
                  className="text-xs"
                />
              </div>

              {currentSlide.bulletPoints && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Bullet Points (one per line)</Label>
                  <Textarea
                    value={currentSlide.bulletPoints.join("\n")}
                    onChange={(e) =>
                      updateCurrentSlide(
                        "bulletPoints",
                        e.target.value.split("\n").filter(Boolean)
                      )
                    }
                    rows={3}
                    className="text-xs"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Swipe Prompt</Label>
                <Input
                  value={currentSlide.swipePrompt || ""}
                  onChange={(e) => updateCurrentSlide("swipePrompt", e.target.value)}
                  placeholder="Swipe to learn →"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Interactive Slide Thumbnail Strip / Filmstrip */}
      <div className="space-y-2 pt-2">
        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Layers className="size-3.5" /> Slide Filmstrip: Click to jump
        </p>
        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
          {slides.map((s, idx) => (
            <div
              key={idx}
              onClick={() => setCurrentIdx(idx)}
              className={`cursor-pointer shrink-0 w-28 p-2.5 rounded-xl border transition-all ${
                currentIdx === idx
                  ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="font-bold">#{s.slideNumber}</span>
                <span className="text-[9px] opacity-70 uppercase font-mono">{s.type.slice(0, 4)}</span>
              </div>
              <p className="text-[11px] font-medium line-clamp-2 leading-tight">
                {s.headline || "Slide"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
