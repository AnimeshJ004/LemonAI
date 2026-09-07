"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { LayoutTemplate, Sparkles, Copy, Check, Calendar } from "lucide-react";
import ScheduleFromResearchDialog from "@/components/competition/schedule-from-research-dialog";

const SLIDE_TYPE_COLORS: Record<string, string> = {
  COVER: "bg-primary/10 border-primary/30",
  CONTENT: "",
  CTA: "bg-green-500/5 border-green-500/20",
};

export default function CarouselStudioPage() {
  const [form, setForm] = useState({
    topic: "",
    platform: "Instagram",
    slides: 7,
  });
  const [carousel, setCarousel] = useState<any>(null);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  // Restore cached carousel on page mount / tab switch
  useEffect(() => {
    try {
      const cached = localStorage.getItem("lemon_carousel_creator");
      if (cached) setCarousel(JSON.parse(cached));
      const cachedForm = localStorage.getItem("lemon_carousel_form");
      if (cachedForm) setForm(JSON.parse(cachedForm));
    } catch {}
  }, []);

  // Persist carousel and form
  useEffect(() => {
    if (carousel) {
      try {
        localStorage.setItem("lemon_carousel_creator", JSON.stringify(carousel));
      } catch {}
    }
  }, [carousel]);

  useEffect(() => {
    if (form.topic) {
      try {
        localStorage.setItem("lemon_carousel_form", JSON.stringify(form));
      } catch {}
    }
  }, [form]);

  const clearCarousel = () => {
    setCarousel(null);
    try {
      localStorage.removeItem("lemon_carousel_creator");
    } catch {}
    toast.info("Carousel cleared. Ready for a new topic.");
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/ai/studio-carousels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Generation failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setCarousel(data.carousel);
      toast.success("Carousel created!");
    },
    onError: (err: any) => toast.error(err.message || "Generation failed"),
  });

  const copyCaption = () => {
    navigator.clipboard.writeText(carousel?.caption || "");
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
    toast.success("Caption copied!");
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutTemplate className="size-6 text-primary" />
          Carousel Creator
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate multi-slide carousels for Instagram & LinkedIn — with headlines, bullets & swipe prompts
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="carousel-topic">
              Carousel Topic <span className="text-destructive">*</span>
            </Label>
            <Input
              id="carousel-topic"
              placeholder="e.g. 7 mistakes new entrepreneurs make"
              value={form.topic}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="carousel-platform">Platform</Label>
              <Select
                value={form.platform}
                onValueChange={(v) => setForm((f) => ({ ...f, platform: v }))}
              >
                <SelectTrigger id="carousel-platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Instagram">📸 Instagram</SelectItem>
                  <SelectItem value="LinkedIn">💼 LinkedIn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Slides: {form.slides}</Label>
              <Slider
                min={5}
                max={10}
                step={1}
                value={[form.slides]}
                onValueChange={(vals: number[]) => setForm((f) => ({ ...f, slides: vals[0] }))}
                className="mt-2.5"
              />
            </div>
          </div>
          <Button
            id="generate-carousel-btn"
            onClick={() => mutate(form)}
            disabled={isPending || !form.topic.trim()}
            className="w-full"
            size="lg"
          >
            {isPending ? (
              <>
                <Sparkles className="size-4 mr-2 animate-spin" />
                Creating Carousel…
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-2" />
                Generate Carousel ({form.slides} slides)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {carousel && (
        <div className="space-y-3">
          {/* Action Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-lg border bg-primary/5">
            <div className="text-left">
              <h2 className="text-base font-bold">{carousel.title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {carousel.slides?.length} slides · {form.platform} format
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={clearCarousel}
                className="h-9 text-xs"
              >
                New Carousel
              </Button>
              <Button
                onClick={() => setIsScheduleOpen(true)}
                className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Calendar className="size-4 mr-2" /> Schedule Carousel
              </Button>
            </div>
          </div>

          {/* Slides */}
          {carousel.slides?.map((slide: any, i: number) => (
            <Card
              key={i}
              className={SLIDE_TYPE_COLORS[slide.type] || ""}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    Slide {slide.slideNumber}
                  </CardTitle>
                  <Badge
                    variant={slide.type === "COVER" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {slide.type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <p className="font-bold text-base">{slide.headline}</p>
                {slide.subtext && (
                  <p className="text-sm text-muted-foreground">{slide.subtext}</p>
                )}
                {slide.bulletPoints && slide.bulletPoints.length > 0 && (
                  <ul className="list-disc list-inside space-y-0.5">
                    {slide.bulletPoints.map((bp: string, j: number) => (
                      <li key={j} className="text-sm">
                        {bp}
                      </li>
                    ))}
                  </ul>
                )}
                {slide.swipePrompt && (
                  <p className="text-xs text-primary font-medium">{slide.swipePrompt}</p>
                )}
                {slide.visualSuggestion && (
                  <p className="text-xs text-muted-foreground">
                    🎨 <strong>Design:</strong> {slide.visualSuggestion}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Caption */}
          {carousel.caption && (
            <Card>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground">POST CAPTION</p>
                  <button
                    onClick={copyCaption}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {copiedCaption ? (
                      <Check className="size-3.5 text-green-500" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    Copy
                  </button>
                </div>
                <pre className="text-xs whitespace-pre-wrap bg-muted/40 p-3 rounded-lg leading-relaxed">
                  {carousel.caption}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* CTA Slide */}
          {carousel.cta && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-3 pb-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">LAST SLIDE CTA</p>
                <p className="text-sm font-bold">{carousel.cta}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <ScheduleFromResearchDialog
        open={isScheduleOpen}
        onOpenChange={setIsScheduleOpen}
        mode="single"
        initialTopic={carousel?.caption || form.topic}
        suggestedFormat="CAROUSEL"
        researchContext={{
          niche: form.topic,
        }}
      />
    </div>
  );
}
