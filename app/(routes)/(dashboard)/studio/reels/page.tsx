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
import { Clapperboard, Sparkles, Clock, Copy, Check, Calendar, Video, Play, Download, Loader2, Film } from "lucide-react";
import ScheduleFromResearchDialog from "@/components/competition/schedule-from-research-dialog";

export default function ReelsStudioPage() {
  const [form, setForm] = useState({
    topic: "",
    tone: "Energetic",
    targetAudience: "",
  });
  const [script, setScript] = useState<any>(null);
  const [videoResult, setVideoResult] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  // Restore cached script on page mount / tab switch
  useEffect(() => {
    try {
      const cached = localStorage.getItem("lemon_reels_script");
      if (cached) setScript(JSON.parse(cached));
      const cachedForm = localStorage.getItem("lemon_reels_form");
      if (cachedForm) setForm(JSON.parse(cachedForm));
    } catch {}
  }, []);

  // Persist script and form
  useEffect(() => {
    if (script) {
      try {
        localStorage.setItem("lemon_reels_script", JSON.stringify(script));
      } catch {}
    }
  }, [script]);

  useEffect(() => {
    if (form.topic) {
      try {
        localStorage.setItem("lemon_reels_form", JSON.stringify(form));
      } catch {}
    }
  }, [form]);

  const clearScript = () => {
    setScript(null);
    try {
      localStorage.removeItem("lemon_reels_script");
    } catch {}
    toast.info("Reels studio reset. Ready for a new topic.");
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/ai/studio-reels", {
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
      setScript(data.script);
      toast.success("Reel script generated!");
    },
    onError: (err: any) => toast.error(err.message || "Generation failed"),
  });

  const { mutate: generateVideo, isPending: isVideoPending } = useMutation({
    mutationFn: async () => {
      const prompt = script?.title ? `${form.topic}: ${script.title}` : form.topic;
      const res = await fetch("/api/ai/studio-reels-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, topic: form.topic }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Video generation failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setVideoResult(data.video);
      toast.success("9:16 Commercial Video Reel generated!");
    },
    onError: (err: any) => toast.error(err.message || "Video generation failed"),
  });

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copied!");
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clapperboard className="size-6 text-primary" />
          Reels Script Studio
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate viral 60-second Reel scripts — Hook, Body & CTA structured for maximum retention
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="reel-topic">
              Reel Topic <span className="text-destructive">*</span>
            </Label>
            <Input
              id="reel-topic"
              placeholder="e.g. 3 signs you need a business coach"
              value={form.topic}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reel-tone">Voice Tone</Label>
            <Select
              value={form.tone}
              onValueChange={(v) => setForm((f) => ({ ...f, tone: v }))}
            >
              <SelectTrigger id="reel-tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Energetic">⚡ Energetic</SelectItem>
                <SelectItem value="Authoritative">🎯 Authoritative</SelectItem>
                <SelectItem value="Casual">😊 Casual & Friendly</SelectItem>
                <SelectItem value="Inspirational">✨ Inspirational</SelectItem>
                <SelectItem value="Educational">📚 Educational</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reel-audience">Target Audience</Label>
            <Input
              id="reel-audience"
              placeholder="e.g. Small business owners"
              value={form.targetAudience}
              onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              id="generate-reel-btn"
              onClick={() => mutate(form)}
              disabled={isPending || !form.topic.trim()}
              className="w-full font-semibold"
              size="lg"
            >
              {isPending ? (
                <>
                  <Sparkles className="size-4 mr-2 animate-spin" />
                  Generating Script…
                </>
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" />
                  Generate Reel Script
                </>
              )}
            </Button>

            <Button
              id="generate-video-reel-btn"
              onClick={() => generateVideo()}
              disabled={isVideoPending || !form.topic.trim()}
              variant="outline"
              className="w-full font-semibold border-primary/40 hover:bg-primary/5 text-primary"
              size="lg"
            >
              {isVideoPending ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin text-primary" />
                  Rendering 9:16 Video Reel…
                </>
              ) : (
                <>
                  <Video className="size-4 mr-2 text-primary" />
                  Generate 9:16 Video Reel (AI Video)
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 9:16 Video Reel Player Preview */}
      {videoResult && videoResult.videoUrl && (
        <Card className="border-primary/30 shadow-md bg-card overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film className="size-4 text-primary" />
                <CardTitle className="text-sm font-bold">9:16 Vertical Video Reel Ready</CardTitle>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono">
                {videoResult.provider || "Wan 2.2 Commercial"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col md:flex-row items-center gap-6">
            <div className="relative w-full max-w-[260px] aspect-[9/16] rounded-2xl overflow-hidden border shadow-lg bg-black shrink-0">
              <video
                src={videoResult.videoUrl}
                controls
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-4 flex-1">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Commercial Social Video Rendered</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ultra-smooth 9:16 vertical video reel optimized for Instagram Reels, TikTok, and YouTube Shorts.
                </p>
                <p className="text-[11px] text-muted-foreground/80 font-mono pt-1">
                  Prompt: "{videoResult.prompt || form.topic}"
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
                  asChild
                  className="gap-2 text-xs font-semibold"
                >
                  <a href={videoResult.videoUrl} download="lemon-reel.mp4" target="_blank" rel="noopener noreferrer">
                    <Download className="size-3.5" /> Download MP4 Video
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsScheduleOpen(true)}
                  className="gap-2 text-xs"
                >
                  <Calendar className="size-3.5" /> Schedule Video to Social
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {script && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
            <div>
              <p className="font-semibold text-sm">Reel Script Ready!</p>
              <p className="text-xs text-muted-foreground">
                60-second retention-optimized script with cues and overlays.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearScript}
                className="h-8 text-xs"
              >
                New Reel
              </Button>
              <Button
                onClick={() => setIsScheduleOpen(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Calendar className="size-4 mr-2" /> Schedule this Reel
              </Button>
            </div>
          </div>

          {/* Hook */}
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="size-4" />
                🎣 HOOK (0–3 seconds)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-lg leading-snug">"{script.hook?.text}"</p>
                <button onClick={() => copyText(script.hook?.text, "hook")}>
                  {copied === "hook" ? (
                    <Check className="size-4 text-green-500 shrink-0" />
                  ) : (
                    <Copy className="size-4 text-muted-foreground shrink-0" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                📷 <strong>Visual:</strong> {script.hook?.visualCue}
              </p>
            </CardContent>
          </Card>

          {/* Body */}
          {script.body?.map((b: any, i: number) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  ⏱ {b.second}s — Value Point {i + 1}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{b.script}</p>
                  <button onClick={() => copyText(b.script, `body-${i}`)}>
                    {copied === `body-${i}` ? (
                      <Check className="size-4 text-green-500 shrink-0" />
                    ) : (
                      <Copy className="size-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  📷 <strong>B-roll:</strong> {b.visualCue}
                </p>
                <p className="text-xs text-muted-foreground">
                  📝 <strong>On-screen:</strong> {b.onScreenText}
                </p>
              </CardContent>
            </Card>
          ))}

          {/* CTA */}
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">📣 CTA (46–60 seconds)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold">{script.cta?.text}</p>
                <button onClick={() => copyText(script.cta?.text, "cta")}>
                  {copied === "cta" ? (
                    <Check className="size-4 text-green-500 shrink-0" />
                  ) : (
                    <Copy className="size-4 text-muted-foreground shrink-0" />
                  )}
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge>{script.cta?.action}</Badge>
                {script.voiceoverTone && (
                  <Badge variant="secondary">🎙 {script.voiceoverTone}</Badge>
                )}
                {script.musicMood && (
                  <Badge variant="outline">🎵 {script.musicMood}</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Caption */}
          {script.caption && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">📱 Instagram Caption + Hashtags</CardTitle>
                  <button onClick={() => copyText(script.caption, "caption")}>
                    {copied === "caption" ? (
                      <Check className="size-4 text-green-500" />
                    ) : (
                      <Copy className="size-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-xs whitespace-pre-wrap bg-muted/40 p-3 rounded-lg leading-relaxed">
                  {script.caption}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <ScheduleFromResearchDialog
        open={isScheduleOpen}
        onOpenChange={setIsScheduleOpen}
        mode="single"
        initialTopic={form.topic}
        initialContent={script?.caption || form.topic}
        initialVideoUrl={videoResult?.videoUrl}
        suggestedFormat="REEL"
        researchContext={{
          niche: form.topic,
          targetAudience: form.targetAudience,
        }}
      />
    </div>
  );
}
