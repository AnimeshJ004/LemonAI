"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  Sparkles,
  Download,
  Calendar,
  Copy,
  Check,
  RefreshCw,
  Palette,
  SlidersHorizontal,
  Type,
  Maximize2,
  Share2,
  Quote,
  Layers,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import ScheduleFromResearchDialog from "@/components/competition/schedule-from-research-dialog";

function InstagramIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export interface BrandedPostData {
  category: string;
  headline: string;
  subtext: string;
  callToAction: string;
  caption: string;
  brandName: string;
  suggestedHandle: string;
  imageUrl: string | null;
  aspectRatio: "4:5" | "1:1";
  provider?: string;
  hashtags?: string[];
}

interface VisualTheme {
  id: string;
  name: string;
  accentColor: string;
  accentBg: string;
  badgeBorder: string;
  textColor: string;
  subtextColor: string;
  scrimGradient: [string, string, string]; // top, mid, bottom rgba
}

const THEMES: VisualTheme[] = [
  {
    id: "lemon",
    name: "Lemon Gold",
    accentColor: "#FACC15",
    accentBg: "rgba(250, 204, 21, 0.15)",
    badgeBorder: "rgba(250, 204, 21, 0.4)",
    textColor: "#FFFFFF",
    subtextColor: "#E2E8F0",
    scrimGradient: ["rgba(11, 15, 25, 0.4)", "rgba(11, 15, 25, 0.68)", "rgba(11, 15, 25, 0.94)"],
  },
  {
    id: "midnight",
    name: "Midnight Indigo",
    accentColor: "#818CF8",
    accentBg: "rgba(129, 140, 248, 0.15)",
    badgeBorder: "rgba(129, 140, 248, 0.4)",
    textColor: "#FFFFFF",
    subtextColor: "#CBD5E1",
    scrimGradient: ["rgba(7, 10, 20, 0.35)", "rgba(10, 15, 30, 0.65)", "rgba(7, 10, 20, 0.95)"],
  },
  {
    id: "sunset",
    name: "Sunset Luxe",
    accentColor: "#FB7185",
    accentBg: "rgba(251, 113, 133, 0.15)",
    badgeBorder: "rgba(251, 113, 133, 0.4)",
    textColor: "#FFFFFF",
    subtextColor: "#F1F5F9",
    scrimGradient: ["rgba(26, 10, 28, 0.35)", "rgba(35, 12, 38, 0.65)", "rgba(20, 5, 24, 0.94)"],
  },
  {
    id: "emerald",
    name: "Cyber Mint",
    accentColor: "#34D399",
    accentBg: "rgba(52, 211, 153, 0.15)",
    badgeBorder: "rgba(52, 211, 153, 0.4)",
    textColor: "#FFFFFF",
    subtextColor: "#E2E8F0",
    scrimGradient: ["rgba(4, 20, 16, 0.35)", "rgba(4, 26, 20, 0.65)", "rgba(2, 18, 14, 0.95)"],
  },
  {
    id: "mono",
    name: "Pure Monochrome",
    accentColor: "#E2E8F0",
    accentBg: "rgba(255, 255, 255, 0.15)",
    badgeBorder: "rgba(255, 255, 255, 0.3)",
    textColor: "#FFFFFF",
    subtextColor: "#94A3B8",
    scrimGradient: ["rgba(0, 0, 0, 0.4)", "rgba(0, 0, 0, 0.7)", "rgba(0, 0, 0, 0.96)"],
  },
];

export function BrandedPostCreator({ initialData }: { initialData?: BrandedPostData }) {
  const [topic, setTopic] = useState("");
  const [postType, setPostType] = useState<"QUOTE" | "TIP" | "FRAMEWORK" | "MYTH_BUST" | "MINDSET">("QUOTE");
  const [aspectRatio, setAspectRatio] = useState<"4:5" | "1:1">("4:5");
  const [themeId, setThemeId] = useState("lemon");
  const [layoutStyle, setLayoutStyle] = useState<"center" | "bottom" | "quote">("center");
  const [scrimOpacity, setScrimOpacity] = useState(70); // 70% default darkness
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduledImageUrl, setScheduledImageUrl] = useState<string>("");

  const [post, setPost] = useState<BrandedPostData>(
    initialData || {
      category: "FOUNDER INSIGHT",
      headline: "The biggest risk is not taking one. In a rapidly changing world, playing it safe guarantees failure.",
      subtext: "Action eliminates fear. Overthinking feeds it.",
      callToAction: "Save this post & tag someone who needs to hear it.",
      caption: "Growth requires taking the leap.\n\nSave this for when you need a push.\n\n#Entrepreneurship #Mindset #BusinessGrowth #LemonAI",
      brandName: "Lemon AI",
      suggestedHandle: "@lemon_growth",
      imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
      aspectRatio: "4:5",
    }
  );

  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // High-Resolution 1080p Canvas Render
  const renderToCanvas = useCallback(
    (targetWidth = 1080): Promise<HTMLCanvasElement> => {
      return new Promise((resolve) => {
        const targetHeight = aspectRatio === "4:5" ? Math.round(targetWidth * 1.25) : targetWidth;
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(canvas);

        const scale = targetWidth / 1080;

        const drawOverlayAndText = () => {
          // 1. Draw Scrim Gradient for Legibility
          const factor = scrimOpacity / 100;
          const [c1, c2, c3] = theme.scrimGradient;
          const grad = ctx.createLinearGradient(0, 0, 0, targetHeight);
          grad.addColorStop(0, c1.replace(/[\d\.]+\)$/, `${factor * 0.5})`));
          grad.addColorStop(0.45, c2.replace(/[\d\.]+\)$/, `${factor * 0.8})`));
          grad.addColorStop(1, c3.replace(/[\d\.]+\)$/, `${factor * 1.0})`));
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, targetWidth, targetHeight);

          // 2. Category Badge Pill
          const badgeY = (layoutStyle === "bottom" ? 100 : 130) * scale;
          const badgeX = 80 * scale;
          const badgeText = (post.category || "INSIGHT").toUpperCase();

          ctx.font = `bold ${20 * scale}px sans-serif`;
          const textWidth = ctx.measureText(badgeText).width;
          const padX = 22 * scale;
          const badgeHeight = 44 * scale;
          const badgeWidth = textWidth + padX * 2;

          ctx.fillStyle = theme.accentBg;
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 22 * scale);
          ctx.fill();

          ctx.strokeStyle = theme.badgeBorder;
          ctx.lineWidth = 1.5 * scale;
          ctx.stroke();

          ctx.fillStyle = theme.accentColor;
          ctx.fillText(badgeText, badgeX + padX, badgeY + 29 * scale);

          // 3. Layout: Quote symbol if quote style
          if (layoutStyle === "quote") {
            ctx.fillStyle = theme.accentColor + "40";
            ctx.font = `bold ${120 * scale}px Georgia, serif`;
            ctx.fillText("“", 80 * scale, (badgeY + 110 * scale));
          }

          // 4. Headline Typography (Auto Word-wrap)
          ctx.fillStyle = theme.textColor;
          const fontSize = (layoutStyle === "quote" ? 54 : 58) * scale;
          ctx.font = `800 ${fontSize}px sans-serif`;
          ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
          ctx.shadowBlur = 16 * scale;

          const words = (post.headline || "").split(" ");
          const maxTextWidth = (1080 - 160) * scale;
          const lineHeight = fontSize * 1.32;
          let line = "";
          const lines: string[] = [];

          for (const w of words) {
            const test = line + w + " ";
            if (ctx.measureText(test).width > maxTextWidth) {
              lines.push(line.trim());
              line = w + " ";
            } else {
              line = test;
            }
          }
          if (line.trim()) lines.push(line.trim());

          let startY =
            layoutStyle === "bottom"
              ? (targetHeight - 240 * scale) - (lines.length * lineHeight)
              : (targetHeight * 0.42) - ((lines.length * lineHeight) / 2);

          for (const l of lines) {
            ctx.fillText(l, 80 * scale, startY);
            startY += lineHeight;
          }

          ctx.shadowBlur = 0; // reset shadow

          // 5. Subtext
          if (post.subtext) {
            startY += 24 * scale;
            ctx.fillStyle = theme.subtextColor;
            const subFontSize = 28 * scale;
            ctx.font = `500 ${subFontSize}px sans-serif`;
            const subWords = post.subtext.split(" ");
            let sLine = "";
            for (const sw of subWords) {
              const test = sLine + sw + " ";
              if (ctx.measureText(test).width > maxTextWidth) {
                ctx.fillText(sLine.trim(), 80 * scale, startY);
                sLine = sw + " ";
                startY += subFontSize * 1.4;
              } else {
                sLine = test;
              }
            }
            if (sLine.trim()) ctx.fillText(sLine.trim(), 80 * scale, startY);
          }

          // 6. Divider Line
          const footerDividerY = targetHeight - (125 * scale);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
          ctx.lineWidth = 1.5 * scale;
          ctx.beginPath();
          ctx.moveTo(80 * scale, footerDividerY);
          ctx.lineTo(targetWidth - 80 * scale, footerDividerY);
          ctx.stroke();

          // 7. Footer: Brand Profile Name & Instagram Handle
          const footerTextY = targetHeight - (70 * scale);
          ctx.fillStyle = "#FFFFFF";
          ctx.font = `bold ${28 * scale}px sans-serif`;
          ctx.fillText(post.brandName || "Brand", 80 * scale, footerTextY);

          if (post.suggestedHandle) {
            const handleText = post.suggestedHandle.startsWith("@")
              ? post.suggestedHandle
              : `@${post.suggestedHandle}`;
            ctx.fillStyle = theme.accentColor;
            ctx.font = `600 ${25 * scale}px sans-serif`;
            const hWidth = ctx.measureText(handleText).width;
            ctx.fillText(handleText, targetWidth - (80 * scale) - hWidth, footerTextY);
          }

          resolve(canvas);
        };

        // If background image exists, load it
        if (post.imageUrl) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            // Draw image covering canvas keeping aspect
            const imgAspect = img.width / img.height;
            const targetAspect = targetWidth / targetHeight;
            let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

            if (imgAspect > targetAspect) {
              sWidth = img.height * targetAspect;
              sx = (img.width - sWidth) / 2;
            } else {
              sHeight = img.width / targetAspect;
              sy = (img.height - sHeight) / 2;
            }

            ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
            drawOverlayAndText();
          };
          img.onerror = () => {
            // Fallback gradient background if image fails to load
            ctx.fillStyle = "#0B0F19";
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            drawOverlayAndText();
          };
          img.src = post.imageUrl;
        } else {
          ctx.fillStyle = "#0B0F19";
          ctx.fillRect(0, 0, targetWidth, targetHeight);
          drawOverlayAndText();
        }
      });
    },
    [aspectRatio, post, theme, layoutStyle, scrimOpacity]
  );

  // Live Preview Canvas rendering
  useEffect(() => {
    let active = true;
    renderToCanvas(540).then((rendered) => {
      if (!active || !previewCanvasRef.current) return;
      const target = previewCanvasRef.current;
      target.width = rendered.width;
      target.height = rendered.height;
      const ctx = target.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, target.width, target.height);
        ctx.drawImage(rendered, 0, 0);
      }
    });
    return () => {
      active = false;
    };
  }, [renderToCanvas]);

  // AI Generation Trigger
  const handleGenerate = async () => {
    setIsGenerating(true);
    toast.info("Synthesizing branded visual & editorial prompt...");
    try {
      const res = await fetch("/api/ai/branded-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          postType,
          aspectRatio,
          customHandle: post.suggestedHandle,
          customBrandName: post.brandName,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate post");
      }

      const json = await res.json();
      if (json.data) {
        setPost(json.data);
        toast.success("AI Branded Creative generated successfully!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate branded post");
    } finally {
      setIsGenerating(false);
    }
  };

  // Download High-Res 1080p Image
  const handleDownload = async () => {
    toast.info("Rendering 1080p ultra-HD post image...");
    try {
      const canvas = await renderToCanvas(1080);
      const link = document.createElement("a");
      const filename = `${(post.brandName || "insta").toLowerCase().replace(/[^a-z0-9]/gi, "_")}_post.png`;
      link.download = filename;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Downloaded high-res 1080p Instagram graphic!");
    } catch (err) {
      toast.error("Failed to render high-res download.");
    }
  };

  // Schedule to Instagram Flow
  const handleOpenSchedule = async () => {
    setIsUploading(true);
    toast.info("Preparing creative for scheduling...");
    try {
      const canvas = await renderToCanvas(1080);
      const dataUrl = canvas.toDataURL("image/png");

      const uploadRes = await fetch("/api/ai/branded-post/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: dataUrl,
          filename: `${(post.brandName || "brand").toLowerCase()}-post.png`,
        }),
      });

      const uploadJson = await uploadRes.json();
      const finalUrl = uploadJson.url || dataUrl;
      setScheduledImageUrl(finalUrl);
      setIsScheduleOpen(true);
    } catch (err) {
      toast.error("Could not upload graphic for scheduling.");
    } finally {
      setIsUploading(false);
    }
  };

  const copyCaption = () => {
    if (!post.caption) return;
    navigator.clipboard.writeText(post.caption);
    setCopiedCaption(true);
    toast.success("Caption copied to clipboard!");
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Generator Bar */}
      <Card className="border border-primary/20 bg-gradient-to-r from-card via-card/90 to-primary/5 shadow-xs">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
            <div className="flex-1 w-full space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" /> Topic or Direction (Optional)
              </Label>
              <Input
                placeholder="e.g. Stop trading time for money, or leave blank to auto-derive from Brand Profile..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isGenerating}
                className="text-sm bg-background/80"
              />
            </div>

            <div className="w-full md:w-44 space-y-1.5">
              <Label className="text-xs font-semibold">Post Angle</Label>
              <select
                value={postType}
                onChange={(e) => setPostType(e.target.value as any)}
                disabled={isGenerating}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="QUOTE">Viral Quote</option>
                <option value="TIP">Actionable Tip</option>
                <option value="FRAMEWORK">Core Framework</option>
                <option value="MYTH_BUST">Myth Buster</option>
                <option value="MINDSET">Growth Mindset</option>
              </select>
            </div>

            <div className="w-full md:w-36 space-y-1.5">
              <Label className="text-xs font-semibold">Aspect Ratio</Label>
              <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-md">
                <Button
                  type="button"
                  size="sm"
                  variant={aspectRatio === "4:5" ? "default" : "ghost"}
                  className="h-7 text-[11px] px-1 font-semibold"
                  onClick={() => setAspectRatio("4:5")}
                >
                  4:5 Reel/Feed
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={aspectRatio === "1:1" ? "default" : "ghost"}
                  className="h-7 text-[11px] px-1 font-semibold"
                  onClick={() => setAspectRatio("1:1")}
                >
                  1:1 Square
                </Button>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full md:w-auto h-9 gap-2 font-semibold shadow-xs"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="size-4 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles className="size-4 text-amber-300" /> AI Generate Creative
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Studio Workspace: 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live Canvas Preview */}
        <div className="lg:col-span-6 flex flex-col items-center gap-4 bg-muted/30 p-6 rounded-2xl border">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <InstagramIcon className="size-4 text-pink-500" />
              <span className="text-xs font-semibold">Feed Preview ({aspectRatio === "4:5" ? "1080 x 1350" : "1080 x 1080"})</span>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">
              Live Canvas Render
            </Badge>
          </div>

          {/* Canvas Render Container */}
          <div
            className={`relative w-full max-w-[380px] ${
              aspectRatio === "4:5" ? "aspect-[4/5]" : "aspect-square"
            } rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-slate-950 flex items-center justify-center transition-all`}
          >
            <canvas
              ref={previewCanvasRef}
              className="w-full h-full object-contain rounded-2xl"
            />
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 w-full pt-2">
            <Button
              onClick={handleDownload}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs font-semibold"
            >
              <Download className="size-3.5" /> Download 1080p PNG
            </Button>
            <Button
              onClick={handleOpenSchedule}
              disabled={isUploading}
              size="sm"
              className="gap-1.5 text-xs font-semibold bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-700 hover:to-indigo-700 text-white"
            >
              <Calendar className="size-3.5" /> Schedule to Instagram
            </Button>
          </div>
        </div>

        {/* Right Column: Style & Content Customizer */}
        <div className="lg:col-span-6 space-y-5">
          {/* Visual Theme Selector */}
          <Card className="border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Palette className="size-3.5 text-primary" /> Visual Color Theme
                </Label>
                <span className="text-[11px] text-muted-foreground font-medium">{theme.name}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {THEMES.map((t) => (
                  <Button
                    key={t.id}
                    size="sm"
                    variant={themeId === t.id ? "default" : "outline"}
                    className="text-xs h-7 px-2.5 gap-1.5"
                    onClick={() => setThemeId(t.id)}
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: t.accentColor }}
                    />
                    {t.name}
                  </Button>
                ))}
              </div>

              {/* Layout Variations */}
              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Layers className="size-3.5 text-primary" /> Layout Position
                  </Label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    variant={layoutStyle === "center" ? "default" : "outline"}
                    className="text-xs h-7"
                    onClick={() => setLayoutStyle("center")}
                  >
                    Centered
                  </Button>
                  <Button
                    size="sm"
                    variant={layoutStyle === "bottom" ? "default" : "outline"}
                    className="text-xs h-7"
                    onClick={() => setLayoutStyle("bottom")}
                  >
                    Lower Third
                  </Button>
                  <Button
                    size="sm"
                    variant={layoutStyle === "quote" ? "default" : "outline"}
                    className="text-xs h-7"
                    onClick={() => setLayoutStyle("quote")}
                  >
                    Editorial Quote
                  </Button>
                </div>
              </div>

              {/* Scrim Contrast Slider */}
              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    <SlidersHorizontal className="size-3.5 text-primary" /> Background Scrim Contrast
                  </span>
                  <span className="text-muted-foreground font-mono">{scrimOpacity}%</span>
                </div>
                <Slider
                  value={[scrimOpacity]}
                  min={20}
                  max={95}
                  step={5}
                  onValueChange={(val) => setScrimOpacity(val[0])}
                  className="cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>

          {/* Live Content Editor */}
          <Card className="border">
            <CardContent className="p-4 space-y-3.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Type className="size-3.5 text-primary" /> Post Content & Branding
              </Label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Category Pill</Label>
                  <Input
                    value={post.category}
                    onChange={(e) => setPost({ ...post, category: e.target.value })}
                    className="text-xs h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Instagram Handle</Label>
                  <Input
                    value={post.suggestedHandle}
                    onChange={(e) => setPost({ ...post, suggestedHandle: e.target.value })}
                    className="text-xs h-8 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Brand Name (Footer)</Label>
                <Input
                  value={post.brandName}
                  onChange={(e) => setPost({ ...post, brandName: e.target.value })}
                  className="text-xs h-8"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Overlay Headline (Main Hook)</Label>
                <Textarea
                  value={post.headline}
                  onChange={(e) => setPost({ ...post, headline: e.target.value })}
                  rows={2}
                  className="text-xs leading-relaxed"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Supporting Subtext / Action</Label>
                <Input
                  value={post.subtext}
                  onChange={(e) => setPost({ ...post, subtext: e.target.value })}
                  className="text-xs h-8"
                />
              </div>
            </CardContent>
          </Card>

          {/* Caption & Hashtags */}
          <Card className="border">
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <InstagramIcon className="size-3.5 text-pink-500" /> Generated Instagram Caption
                </Label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs gap-1 px-2"
                  onClick={copyCaption}
                >
                  {copiedCaption ? (
                    <>
                      <Check className="size-3 text-green-500" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" /> Copy Caption
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                value={post.caption}
                onChange={(e) => setPost({ ...post, caption: e.target.value })}
                rows={4}
                className="text-xs leading-relaxed bg-muted/40 font-mono"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Integrated Schedule Dialog */}
      <ScheduleFromResearchDialog
        open={isScheduleOpen}
        onOpenChange={setIsScheduleOpen}
        initialTopic={post.headline}
        initialContent={post.caption}
        initialImages={scheduledImageUrl ? [{ url: scheduledImageUrl }] : []}
        suggestedFormat="FEED_POST"
        researchContext={{
          niche: "Instagram Post",
          businessName: post.brandName,
        }}
      />
    </div>
  );
}
