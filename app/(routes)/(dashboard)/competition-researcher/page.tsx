"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Sparkles,
  TrendingUp,
  Hash,
  Target,
  Copy,
  Check,
  AlertCircle,
  Calendar,
  Layers,
  ArrowRight,
  Zap,
} from "lucide-react";
import ScheduleFromResearchDialog from "@/components/competition/schedule-from-research-dialog";
import AutonomousCampaignDialog from "@/components/campaign/autonomous-campaign-dialog";
import Link from "next/link";

export default function CompetitionResearcherPage() {
  const [form, setForm] = useState({
    niche: "",
    targetAudience: "",
    competitorUrls: "",
    country: "IN",
    businessName: "",
  });
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Schedule modal states
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isFlywheelOpen, setIsFlywheelOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"single" | "batch">("single");
  const [scheduleTopic, setScheduleTopic] = useState("");
  const [scheduleFormat, setScheduleFormat] = useState("FEED_POST");

  // Restore cached research on page mount / tab switch
  useEffect(() => {
    try {
      const cached = localStorage.getItem("lemon_competition_research_result");
      if (cached) setResult(JSON.parse(cached));
      const cachedForm = localStorage.getItem("lemon_competition_research_form");
      if (cachedForm) setForm(JSON.parse(cachedForm));
    } catch {}
  }, []);

  // Persist result and form whenever updated
  useEffect(() => {
    if (result) {
      try {
        localStorage.setItem("lemon_competition_research_result", JSON.stringify(result));
      } catch {}
    }
  }, [result]);

  useEffect(() => {
    if (form.niche || form.targetAudience) {
      try {
        localStorage.setItem("lemon_competition_research_form", JSON.stringify(form));
      } catch {}
    }
  }, [form]);

  const clearResearch = () => {
    setResult(null);
    try {
      localStorage.removeItem("lemon_competition_research_result");
    } catch {}
    toast.info("Research cleared. Ready for new input.");
  };

  const openSingleSchedule = (topicText: string, format = "FEED_POST") => {
    setScheduleTopic(topicText);
    setScheduleFormat(format);
    setScheduleMode("single");
    setIsScheduleOpen(true);
  };

  const openBatchSchedule = () => {
    setScheduleMode("batch");
    setIsScheduleOpen(true);
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/ai/competitor-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          competitorUrls: data.competitorUrls
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Research failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data.research);
      toast.success("Market research complete!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Research failed. Please try again.");
    },
  });

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copied!");
  };

  const isFormValid = form.niche.trim() && form.targetAudience.trim();

  return (
    <div className="max-w-6xl mx-auto py-6 px-3 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Search className="size-6 text-primary" />
            Competition Researcher
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI analyses your market, competitors & extracts winning content angles, hooks & hashtags
          </p>
        </div>
        <Button
          onClick={() => setIsFlywheelOpen(true)}
          className="gap-2 font-semibold shadow-xs text-xs sm:text-sm h-9"
        >
          <Layers className="size-4 text-primary-foreground" /> Autonomous Campaign Generator
        </Button>
      </div>

      {/* Input Form */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Market Research Input</CardTitle>
          {result && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearResearch}
              className="h-7 text-xs"
            >
              Reset / New Research
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="businessName">Business Name</Label>
            <Input
              id="businessName"
              placeholder="e.g. FitLife Coach"
              value={form.businessName}
              onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="niche">
              Industry / Niche <span className="text-destructive">*</span>
            </Label>
            <Input
              id="niche"
              placeholder="e.g. High-ticket fitness coaching"
              value={form.niche}
              onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="targetAudience">
              Target Audience <span className="text-destructive">*</span>
            </Label>
            <Input
              id="targetAudience"
              placeholder="e.g. Busy professionals aged 28-45"
              value={form.targetAudience}
              onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">Target Country</Label>
            <Select
              value={form.country}
              onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}
            >
              <SelectTrigger id="country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">🇮🇳 India</SelectItem>
                <SelectItem value="US">🇺🇸 United States</SelectItem>
                <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                <SelectItem value="AE">🇦🇪 UAE</SelectItem>
                <SelectItem value="AU">🇦🇺 Australia</SelectItem>
                <SelectItem value="GLOBAL">🌍 Global</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="competitorUrls">
              Competitor Handles / URLs{" "}
              <span className="text-muted-foreground text-xs">(comma-separated, optional)</span>
            </Label>
            <Textarea
              id="competitorUrls"
              placeholder="instagram.com/competitor1, competitor2.com, @handle3"
              value={form.competitorUrls}
              onChange={(e) => setForm((f) => ({ ...f, competitorUrls: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="md:col-span-2">
            <Button
              id="run-research-btn"
              onClick={() => mutate(form)}
              disabled={isPending || !isFormValid}
              className="w-full"
              size="lg"
            >
              {isPending ? (
                <>
                  <Sparkles className="size-4 mr-2 animate-spin" />
                  Researching Market…
                </>
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" />
                  Run AI Market Research
                </>
              )}
            </Button>
            {!isFormValid && (
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                <AlertCircle className="size-3" /> Niche and Target Audience are required
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Top Auto-Pilot Campaign Banner */}
          <div className="p-4 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-background flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                Autonomous Content Distribution Ready
              </h3>
              <p className="text-xs text-muted-foreground">
                AI has identified high-performing angles for{" "}
                <span className="font-medium text-foreground">{form.niche}</span>.
                Auto-generate and schedule a full 7 to 30-day campaign in 1 click.
              </p>
            </div>
            <Button
              onClick={openBatchSchedule}
              className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              <Layers className="size-4 mr-2" />
              Auto-Schedule Campaign (Auto-Pilot)
            </Button>
          </div>

          {/* Trending Hooks */}
          {result.topTrendingHooks?.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="size-4 text-orange-500" />
                  Top Trending Hooks (Reverse-Engineered from Competitors)
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {result.topTrendingHooks.length} Viral Hooks
                </Badge>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {result.topTrendingHooks.map((h: any, i: number) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant="secondary" className="text-xs shrink-0 font-medium">
                          {h.hookType?.replace(/_/g, " ")}
                        </Badge>
                        <button
                          onClick={() => copyToClipboard(h.hook, `hook-${i}`)}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1"
                          title="Copy hook text"
                        >
                          {copied === `hook-${i}` ? (
                            <Check className="size-3.5 text-green-500" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="font-semibold text-sm leading-snug">"{h.hook}"</p>
                      <p className="text-xs text-muted-foreground">🎯 {h.targetEmotion}</p>
                      <p className="text-xs text-muted-foreground italic leading-relaxed">
                        {h.whyItWorks}
                      </p>
                    </div>

                    <div className="pt-2 border-t flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs flex-1"
                        onClick={() => openSingleSchedule(h.hook, "FEED_POST")}
                      >
                        <Calendar className="size-3 mr-1.5" /> Schedule Post
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="h-7 text-xs px-2"
                        title="Create Reel Script from this hook"
                      >
                        <Link href={`/studio/reels`}>
                          Reel Script
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Pain Points */}
          {result.audiencePainPoints?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="size-4 text-red-500" />
                  Audience Pain Points & Psychological Triggers
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.audiencePainPoints.map((p: any, i: number) => (
                  <div key={i} className="p-3.5 rounded-lg border space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{p.painPoint}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs text-primary"
                        onClick={() => openSingleSchedule(p.proposedSolutionAngle, "FEED_POST")}
                      >
                        Schedule Solution
                      </Button>
                    </div>
                    <p className="text-xs text-red-500/80">⚡ Agitation: {p.agitation}</p>
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                      ✓ Winning Angle: {p.proposedSolutionAngle}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Competitor Weaknesses */}
            {result.competitorWeaknessesToExploit?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="size-4 text-blue-500" />
                    Competitor Flaws & Content Gaps
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5">
                    {result.competitorWeaknessesToExploit.map((w: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-green-500 font-bold shrink-0 mt-0.5">✓</span>
                        <span className="flex-1 text-muted-foreground">{w}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Hashtags */}
            {result.recommendedHashtags?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Hash className="size-4 text-purple-500" />
                    High-Growth Trending Hashtags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {result.recommendedHashtags.map((tag: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => copyToClipboard(tag, `tag-${i}`)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border bg-primary/5 hover:bg-primary/15 transition-colors font-medium"
                      >
                        {copied === `tag-${i}` ? (
                          <Check className="size-3 text-green-500" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        {tag}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Content Angles */}
          {result.recommendedContentAngles?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  Winning Content Angles (Ready for Studio & Scheduling)
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {result.recommendedContentAngles.map((a: any, i: number) => {
                  const studioHref =
                    a.suggestedFormat === "REEL"
                      ? "/studio/reels"
                      : a.suggestedFormat === "CAROUSEL"
                      ? "/studio/carousels"
                      : a.suggestedFormat === "BLOG"
                      ? "/studio/blogs"
                      : a.suggestedFormat === "META_AD"
                      ? "/studio/ad-creatives"
                      : "/studio/strategy";

                  return (
                    <div
                      key={i}
                      className="p-3.5 rounded-lg border space-y-3 flex flex-col justify-between hover:border-primary/40 transition-colors"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm">{a.angleTitle}</span>
                          <Badge variant="secondary" className="text-xs shrink-0 font-medium">
                            {a.suggestedFormat}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground italic">"{a.shortHook}"</p>
                      </div>

                      <div className="pt-2 border-t flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs flex-1"
                          onClick={() =>
                            openSingleSchedule(
                              `${a.angleTitle}: ${a.shortHook}`,
                              a.suggestedFormat
                            )
                          }
                        >
                          <Calendar className="size-3 mr-1.5" /> Schedule
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="h-7 text-xs px-2"
                        >
                          <Link href={studioHref}>
                            Open Studio <ArrowRight className="size-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Schedule / Auto-Pilot Dialog */}
      <ScheduleFromResearchDialog
        open={isScheduleOpen}
        onOpenChange={setIsScheduleOpen}
        mode={scheduleMode}
        initialTopic={scheduleTopic}
        suggestedFormat={scheduleFormat}
        researchContext={{
          niche: form.niche,
          businessName: form.businessName,
          targetAudience: form.targetAudience,
          competitors: form.competitorUrls,
          hashtags: result?.recommendedHashtags,
        }}
      />

      {/* Autonomous Campaign Generator Dialog */}
      <AutonomousCampaignDialog
        open={isFlywheelOpen}
        onOpenChange={setIsFlywheelOpen}
        initialNiche={form.niche}
        initialAudience={form.targetAudience}
        initialBusinessName={form.businessName}
      />
    </div>
  );
}
