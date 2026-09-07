"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
  TrendingUp,
  Sparkles,
  Target,
  Calendar,
  CheckCircle,
  BarChart2,
  Layers,
} from "lucide-react";
import ScheduleFromResearchDialog from "@/components/competition/schedule-from-research-dialog";

const PLATFORMS = ["Instagram", "Facebook", "LinkedIn", "YouTube", "X (Twitter)"];
const PILLAR_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
];
const DAY_TYPE_COLORS: Record<string, string> = {
  REEL: "bg-orange-100 text-orange-700",
  CAROUSEL: "bg-blue-100 text-blue-700",
  FEED_POST: "bg-green-100 text-green-700",
  BLOG: "bg-purple-100 text-purple-700",
  STORY: "bg-pink-100 text-pink-700",
  VIDEO: "bg-red-100 text-red-700",
};

export default function ContentStrategyPage() {
  const [form, setForm] = useState({
    goal: "LEAD_GENERATION",
    timeframe: "30-day",
    platforms: ["Instagram", "Facebook"],
  });
  const [strategy, setStrategy] = useState<any>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"single" | "batch">("batch");
  const [scheduleTopic, setScheduleTopic] = useState("");
  const [scheduleFormat, setScheduleFormat] = useState("FEED_POST");

  // Restore cached strategy on page mount / tab switch
  useEffect(() => {
    try {
      const cached = localStorage.getItem("lemon_content_strategy");
      if (cached) setStrategy(JSON.parse(cached));
      const cachedForm = localStorage.getItem("lemon_strategy_form");
      if (cachedForm) setForm(JSON.parse(cachedForm));
    } catch {}
  }, []);

  // Persist strategy and form
  useEffect(() => {
    if (strategy) {
      try {
        localStorage.setItem("lemon_content_strategy", JSON.stringify(strategy));
      } catch {}
    }
  }, [strategy]);

  useEffect(() => {
    if (form.goal) {
      try {
        localStorage.setItem("lemon_strategy_form", JSON.stringify(form));
      } catch {}
    }
  }, [form]);

  const clearStrategy = () => {
    setStrategy(null);
    try {
      localStorage.removeItem("lemon_content_strategy");
    } catch {}
    toast.info("Strategy cleared. Ready for a new plan.");
  };

  const openSingleSchedule = (topic: string, format = "FEED_POST") => {
    setScheduleTopic(topic);
    setScheduleFormat(format);
    setScheduleMode("single");
    setIsScheduleOpen(true);
  };

  const openBatchSchedule = () => {
    setScheduleMode("batch");
    setIsScheduleOpen(true);
  };

  const togglePlatform = (p: string) => {
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(p)
        ? f.platforms.filter((x) => x !== p)
        : [...f.platforms, p],
    }));
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/ai/studio-strategy", {
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
      setStrategy(data.strategy);
      toast.success("Strategy generated!");
    },
    onError: (err: any) => toast.error(err.message || "Generation failed"),
  });

  return (
    <div className="max-w-5xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="size-6 text-primary" />
          Content Strategy Planner
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          AI builds your complete content strategy — pillars, weekly schedule, KPIs & quick wins
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="strategy-goal">Primary Goal</Label>
              <Select
                value={form.goal}
                onValueChange={(v) => setForm((f) => ({ ...f, goal: v }))}
              >
                <SelectTrigger id="strategy-goal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LEAD_GENERATION">🎯 Lead Generation</SelectItem>
                  <SelectItem value="BRAND_AWARENESS">📢 Brand Awareness</SelectItem>
                  <SelectItem value="SALES">💰 Direct Sales</SelectItem>
                  <SelectItem value="COMMUNITY">👥 Community Building</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="strategy-timeframe">Timeframe</Label>
              <Select
                value={form.timeframe}
                onValueChange={(v) => setForm((f) => ({ ...f, timeframe: v }))}
              >
                <SelectTrigger id="strategy-timeframe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7-day">7 Days</SelectItem>
                  <SelectItem value="14-day">14 Days</SelectItem>
                  <SelectItem value="30-day">30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>
              Platforms{" "}
              <span className="text-muted-foreground text-xs">(select all you use)</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    form.platforms.includes(p)
                      ? "bg-primary text-white border-primary"
                      : "bg-background border-border hover:border-primary/50 text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <Button
            id="generate-strategy-btn"
            onClick={() => mutate(form)}
            disabled={isPending || form.platforms.length === 0}
            className="w-full"
            size="lg"
          >
            {isPending ? (
              <>
                <Sparkles className="size-4 mr-2 animate-spin" />
                Building Strategy…
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-2" />
                Generate Content Strategy
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {strategy && (
        <div className="space-y-4">
          {/* Action Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-background shadow-sm">
            <div className="text-left space-y-0.5">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                Strategy Ready for Automated Execution
              </h3>
              <p className="text-xs text-muted-foreground">
                Deploy this entire {form.timeframe} calendar directly into your social queue using Auto-Pilot.
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={clearStrategy}
                className="h-9 text-xs"
              >
                New Strategy
              </Button>
              <Button
                onClick={openBatchSchedule}
                className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Layers className="size-4 mr-2" /> Auto-Schedule Full Strategy
              </Button>
            </div>
          </div>

          {/* Overview */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4">
              <p className="text-sm font-medium leading-relaxed">{strategy.strategyOverview}</p>
            </CardContent>
          </Card>

          {/* Content Pillars */}
          {strategy.contentPillars?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="size-4" />
                  Content Pillars
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {strategy.contentPillars.map((p: any, i: number) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{p.name}</span>
                      <span className="text-xs text-muted-foreground font-medium">
                        {p.percentage}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${PILLAR_COLORS[i % PILLAR_COLORS.length]} rounded-full transition-all duration-700`}
                        style={{ width: `${p.percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {p.exampleTopics?.map((t: string, j: number) => (
                        <Badge key={j} variant="outline" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Weekly Schedule */}
          {strategy.weeklySchedule?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="size-4" />
                  Weekly Content Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {strategy.weeklySchedule.map((day: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg border bg-muted/20"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold w-14 shrink-0 text-muted-foreground">
                          {day.day}
                        </span>
                        <Badge
                          className={`text-xs shrink-0 ${
                            DAY_TYPE_COLORS[day.contentType] || "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {day.contentType}
                        </Badge>
                        <p className="text-xs text-muted-foreground truncate">{day.topic}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs text-primary shrink-0"
                        onClick={() => openSingleSchedule(day.topic, day.contentType)}
                      >
                        Schedule
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quick Wins */}
            {strategy.quickWins?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="size-4 text-green-500" />
                    Quick Wins
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {strategy.quickWins.map((w: string, i: number) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="text-green-500 shrink-0">✓</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* KPIs */}
            {strategy.kpis?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart2 className="size-4" />
                    KPIs to Track
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {strategy.kpis.map((kpi: any, i: number) => (
                    <div key={i} className="p-2.5 rounded-lg bg-muted/40 space-y-0.5">
                      <p className="text-xs font-semibold">{kpi.metric}</p>
                      <p className="text-sm font-bold text-primary">{kpi.target}</p>
                      <p className="text-xs text-muted-foreground">{kpi.howToMeasure}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Monthly Milestones */}
          {strategy.monthlyMilestones?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">📅 Monthly Milestones</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {strategy.monthlyMilestones.map((m: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg border space-y-1">
                    <Badge variant="secondary" className="text-xs">
                      {m.week}
                    </Badge>
                    <p className="text-sm font-medium">{m.focus}</p>
                    <p className="text-xs text-muted-foreground">🎯 {m.goal}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <ScheduleFromResearchDialog
        open={isScheduleOpen}
        onOpenChange={setIsScheduleOpen}
        mode={scheduleMode}
        initialTopic={scheduleTopic}
        suggestedFormat={scheduleFormat}
        researchContext={{
          niche: strategy?.strategyOverview || form.goal,
          targetAudience: form.goal,
        }}
      />
    </div>
  );
}
