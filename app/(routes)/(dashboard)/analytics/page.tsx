"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, Users, FileText, DollarSign, Sparkles, CheckCircle } from "lucide-react";

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
  const leadsByStage: any[] = data?.leadsByStage || [];
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
          <BarChart3 className="size-6 text-primary" /> Growth Analytics
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Real-time performance across content, leads & revenue
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Leads by Stage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4" /> Leads by Stage
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
              <div className="space-y-2">
                {leadsByStage.map((item: any) => {
                  const maxCount = Math.max(...leadsByStage.map((l: any) => l.count), 1);
                  return (
                    <div key={item.stage} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="capitalize">{item.stage.replace("_", " ")}</span>
                        <span className="font-medium">{item.count}</span>
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
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> AI Strategy Recommendations
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
                  <div key={i} className="flex gap-2 p-3 rounded-lg bg-primary/5 border border-primary/15">
                    <CheckCircle className="size-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm">{rec}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform Analytics Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="size-4" /> Platform Analytics Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { platform: "Instagram", icon: "📸", status: "Connect in Settings for live Reach, Impressions & Engagement data", connected: false },
              { platform: "Facebook", icon: "📘", status: "Connect for Facebook Page insights", connected: false },
              { platform: "LinkedIn", icon: "💼", status: "Connect for LinkedIn analytics", connected: false },
              { platform: "Meta Ads", icon: "📣", status: "Connect for CTR, CPC, ROAS & Spend data", connected: false },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                <span className="text-lg">{item.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.platform}</p>
                  <p className="text-xs text-muted-foreground">{item.status}</p>
                </div>
                <Badge
                  className={item.connected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600 dark:bg-muted dark:text-muted-foreground"}
                >
                  {item.connected ? "✅ Connected" : "Not Connected"}
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Go to <strong>Settings</strong> to connect your social accounts and unlock real-time analytics
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
