"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Download,
  ChevronLeft,
  ChevronRight,
  Palette,
  Sparkles,
  Share2,
  Check,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

export interface CarouselSlide {
  slideNumber: number;
  type: "COVER" | "CONTENT" | "CTA";
  headline: string;
  subtext?: string;
  bulletPoints?: string[];
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
    name: "Sunset Gradient",
    bgGradient: "from-purple-950 via-pink-950 to-amber-950 text-white",
    canvasBg: "#1a0826",
    canvasText: "#ffffff",
    canvasAccent: "#f43f5e",
    canvasSubtext: "#cbd5e1",
    accentBadge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    border: "border-rose-500/20",
  },
  {
    id: "minimal",
    name: "Editorial White",
    bgGradient: "from-zinc-100 via-stone-50 to-slate-100 text-zinc-900",
    canvasBg: "#f8fafc",
    canvasText: "#0f172a",
    canvasAccent: "#2563eb",
    canvasSubtext: "#475569",
    accentBadge: "bg-blue-100 text-blue-800 border-blue-200",
    border: "border-zinc-300",
  },
  {
    id: "cyber",
    name: "Cyber Emerald",
    bgGradient: "from-zinc-950 via-stone-950 to-emerald-950 text-white",
    canvasBg: "#05110d",
    canvasText: "#ffffff",
    canvasAccent: "#10b981",
    canvasSubtext: "#94a3b8",
    accentBadge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    border: "border-emerald-500/20",
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
  const [isDownloading, setIsDownloading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  const slides = carousel.slides || [];
  const currentSlide = slides[currentIdx] || slides[0];

  const handlePrev = () => setCurrentIdx((i) => Math.max(0, i - 1));
  const handleNext = () => setCurrentIdx((i) => Math.min(slides.length - 1, i + 1));

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

    // Subtle ambient glow
    const grad = ctx.createRadialGradient(540, 400, 50, 540, 400, 650);
    grad.addColorStop(0, th.canvasAccent + "33");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1350);

    // Top Header / Slide counter
    ctx.fillStyle = th.canvasAccent;
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(`${slide.type} • SLIDE ${slide.slideNumber}/${slides.length}`, 80, 120);

    ctx.fillStyle = th.canvasSubtext;
    ctx.font = "24px sans-serif";
    ctx.fillText(carousel.title.slice(0, 40), 80, 160);

    // Divider
    ctx.strokeStyle = th.canvasSubtext + "44";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 190);
    ctx.lineTo(1000, 190);
    ctx.stroke();

    // Main Headline
    ctx.fillStyle = th.canvasText;
    ctx.font = "bold 62px sans-serif";
    const words = (slide.headline || "").split(" ");
    let line = "";
    let y = 320;
    for (const w of words) {
      const test = line + w + " ";
      if (ctx.measureText(test).width > 920) {
        ctx.fillText(line.trim(), 80, y);
        line = w + " ";
        y += 80;
      } else {
        line = test;
      }
    }
    ctx.fillText(line.trim(), 80, y);

    // Subtext or Body bullets
    y += 70;
    if (slide.subtext) {
      ctx.fillStyle = th.canvasSubtext;
      ctx.font = "34px sans-serif";
      const subWords = slide.subtext.split(" ");
      let sLine = "";
      for (const sw of subWords) {
        const test = sLine + sw + " ";
        if (ctx.measureText(test).width > 920) {
          ctx.fillText(sLine.trim(), 80, y);
          sLine = sw + " ";
          y += 50;
        } else {
          sLine = test;
        }
      }
      ctx.fillText(sLine.trim(), 80, y);
      y += 60;
    }

    if (slide.bulletPoints && slide.bulletPoints.length > 0) {
      for (const bp of slide.bulletPoints) {
        ctx.fillStyle = th.canvasAccent;
        ctx.beginPath();
        ctx.arc(95, y - 10, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = th.canvasText;
        ctx.font = "32px sans-serif";

        const bpWords = bp.split(" ");
        let bLine = "";
        let startX = 130;
        for (const bw of bpWords) {
          const test = bLine + bw + " ";
          if (ctx.measureText(test).width > 860) {
            ctx.fillText(bLine.trim(), startX, y);
            bLine = bw + " ";
            y += 50;
          } else {
            bLine = test;
          }
        }
        ctx.fillText(bLine.trim(), startX, y);
        y += 65;
      }
    }

    // Bottom Footer / Swipe Prompt
    ctx.strokeStyle = th.canvasSubtext + "33";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(80, 1220);
    ctx.lineTo(1000, 1220);
    ctx.stroke();

    ctx.fillStyle = th.canvasSubtext;
    ctx.font = "26px sans-serif";
    ctx.fillText("Lemon AI Social Studio", 80, 1270);

    const promptText = slide.swipePrompt || "Swipe Next →";
    ctx.fillStyle = th.canvasAccent;
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(promptText, 860, 1270);

    return canvas;
  };

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

  const downloadAllSlides = async () => {
    setIsDownloading(true);
    toast.info("Rendering all slides, please wait...");
    try {
      for (let i = 0; i < slides.length; i++) {
        const c = renderSlideToCanvas(slides[i], theme);
        const link = document.createElement("a");
        link.download = `${carousel.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_slide_${slides[i].slideNumber}.png`;
        link.href = c.toDataURL("image/png");
        link.click();
        // small delay between downloads
        await new Promise((r) => setTimeout(r, 350));
      }
      toast.success(`All ${slides.length} slides downloaded as high-res PNGs!`);
    } catch (err) {
      toast.error("Error batch downloading slides.");
    } finally {
      setIsDownloading(false);
    }
  };

  if (slides.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Top Controls: Theme selector & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-card border rounded-xl">
        <div className="flex items-center gap-2">
          <Palette className="size-4 text-muted-foreground" />
          <span className="text-xs font-semibold">Visual Theme:</span>
          <div className="flex gap-1.5">
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

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1.5 h-8"
            onClick={downloadCurrentSlide}
          >
            <Download className="size-3.5" /> Download Slide {currentSlide.slideNumber}
          </Button>
          <Button
            size="sm"
            variant="default"
            className="text-xs gap-1.5 h-8"
            onClick={downloadAllSlides}
            disabled={isDownloading}
          >
            <Download className="size-3.5" /> Download All ({slides.length})
          </Button>
        </div>
      </div>

      {/* Slide Preview Deck */}
      <div className="flex flex-col items-center justify-center p-6 bg-muted/40 rounded-2xl border">
        {/* 4:5 Aspect Ratio Preview Container */}
        <div
          className={`relative w-full max-w-[420px] aspect-[4/5] rounded-2xl p-7 shadow-2xl flex flex-col justify-between overflow-hidden bg-gradient-to-br ${theme.bgGradient} border ${theme.border} transition-all duration-300`}
        >
          {/* Top meta */}
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

          {/* Center Content */}
          <div className="my-auto space-y-4 py-3">
            <h3 className="text-xl sm:text-2xl font-black leading-tight tracking-tight">
              {currentSlide.headline}
            </h3>

            {currentSlide.subtext && (
              <p className="text-xs sm:text-sm opacity-80 leading-relaxed">
                {currentSlide.subtext}
              </p>
            )}

            {currentSlide.bulletPoints && currentSlide.bulletPoints.length > 0 && (
              <ul className="space-y-2.5 pt-1">
                {currentSlide.bulletPoints.map((bp, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm">
                    <span className="size-2 rounded-full bg-current mt-1.5 shrink-0" />
                    <span>{bp}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Bottom Footer */}
          <div className="space-y-2 pt-2 border-t border-current/15">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] opacity-60">Lemon AI Studio</span>
              <span className="font-semibold text-xs flex items-center gap-1">
                {currentSlide.swipePrompt || "Swipe Next"} →
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Bar */}
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
    </div>
  );
}
