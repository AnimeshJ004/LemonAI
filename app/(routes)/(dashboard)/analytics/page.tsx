"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  TrendingUp,
  Users,
  FileText,
  DollarSign,
  Sparkles,
  CheckCircle,
  Layers,
  ArrowDownRight,
  Send,
  Zap,
  ExternalLink,
  Flame,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

export default function AnalyticsPage() {
  const { data, isPending } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/overview");
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
  });

  const overview = data?.overview || {};
  const funnel: any[] = data?.funnel || [];
  const topContent: any[] = data?.topContent || [];
  const leadsByStage: any[] = data?.leadsByStage || [];
  const leadsBySource: any[] = data?.leadsBySource || [];
  const platformStatus: any[] = data?.platformStatus || [];
  const aiRecs: string[] = data?.aiRecommendations || [];

  const metrics = [
    { label: "Total Posts", value: overview.totalPosts || 0, sub: `${overview.publishedPosts || 0} published`, icon: FileText, color: "text-blue-500" },
    { label: "Queued Posts", value: overview.queuedPosts || 0, sub: "Scheduled to publish", icon: TrendingUp, color: "text-orange-500" },
    { label: "Total Leads", value: overview.totalLeads || 0, sub: `${overview.qualifiedLeads || 0} qualified`, icon: Users, color: "text-purple-500" },
    { label: "Pipeline Value", value: `₹${(overview.totalDealValue || 0).toLocaleString()}`, sub: `₹${(overview.wonRevenue || 0).toLocaleString()} won`, icon: DollarSign, color: "text-green-500" },
  ];

  return (
    <div className="max-w-5xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="size-6 text-primary" /> Growth Analytics & Attribution
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Real-time performance across multi-channel content, leads, appointment conversion & closed revenue
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map((m, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={`size-4 ${m.color}`} />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              {isPending ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <p className="text-2xl font-bold">{m.value}</p>
                  <p className="text-xs text-muted-foreground">{m.sub}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Full Customer Journey & Conversion Funnel */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="size-4 text-primary" /> Multi-Agent Conversion Funnel
              </CardTitle>
              <CardDescription className="text-xs">
                Authentic end-to-end attribution: Content Assets → Engagement → Inbound CRM Leads → BANT Qualification → Consultations → Revenue
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[11px] gap-1 text-emerald-600 border-emerald-300">
              <ShieldCheck className="size-3" /> Zero Fake Multipliers
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3.5">
              {funnel.map((step, idx) => {
                const maxFunnelCount = Math.max(...funnel.map((f: any) => f.count), 1);
                const pct = Math.max(8, Math.min(100, Math.round((step.count / maxFunnelCount) * 100)));
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="flex items-center gap-1.5 text-foreground">
                        <span className="size-2 rounded-full bg-primary" />
                        {step.step}
                        {step.note && (
                          <span className="text-[10px] text-muted-foreground font-normal ml-1">
                            ({step.note})
                          </span>
                        )}
                      </span>
                      <span className="font-bold text-foreground font-mono">{step.count.toLocaleString()}</span>
                    </div>
                    <div className="h-2.5 bg-muted/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${step.color} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Performing Content Leaderboard */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="size-4 text-orange-500" /> Top Performing Content Leaderboard
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time attribution showing high-engagement assets driving CRM leads & pipeline value
              </CardDescription>
            </div>
            <Link href="/schedule">
              <Badge variant="outline" className="text-[11px] gap-1 cursor-pointer hover:bg-muted">
                View Calendar <ExternalLink className="size-3" />
              </Badge>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : topContent.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-xs">
              No content assets published yet. Create posts in Content Studio or Schedule to see performance.
            </div>
          ) : (
            <div className="space-y-2">
              {topContent.map((item: any, i: number) => (
                <div
                  key={item.id || i}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-card/60 hover:bg-card transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-xs text-primary shrink-0">
                      #{i + 1}
                    </div>
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt="Thumbnail"
                        className="size-10 rounded-md object-cover border shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {item.channel}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {item.publishedAt
                            ? `Published ${new Date(item.publishedAt).toLocaleDateString()}`
                            : item.scheduledAt
                            ? `Scheduled ${new Date(item.scheduledAt).toLocaleDateString()}`
                            : "Draft"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      className={
                        item.status === "published"
                          ? "bg-emerald-600 text-white text-[10px]"
                          : item.status === "queue"
                          ? "bg-orange-500 text-white text-[10px]"
                          : "text-[10px]"
                      }
                    >
                      {item.status === "published" ? "Published" : item.status === "queue" ? "Queued" : "Draft"}
                    </Badge>
                    {item.publishedUrl && (
                      <a
                        href={item.publishedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Leads by Stage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4" /> Pipeline Stage Velocity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {leadsByStage.map((item: any) => {
                  const maxCount = Math.max(...leadsByStage.map((l: any) => l.count), 1);
                  return (
                    <div key={item.stage} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="capitalize">{item.stage.replace("_", " ")}</span>
                        <span className="font-medium font-mono">{item.count}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(item.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Recommendations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> Executive Strategy Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {aiRecs.map((rec: string, i: number) => (
                  <div key={i} className="flex gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/15">
                    <CheckCircle className="size-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed text-foreground">{rec}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform Analytics Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="size-4" /> Multi-Platform Sync Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {platformStatus.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                <span className="text-lg">{item.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.platform}</p>
                  <p className="text-xs text-muted-foreground">{item.status}</p>
                </div>
                <Badge
                  variant={item.connected ? "default" : "secondary"}
                  className={item.connected ? "bg-emerald-600 text-white" : "text-xs"}
                >
                  {item.connected ? "● Live Sync Active" : "Not Connected"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
