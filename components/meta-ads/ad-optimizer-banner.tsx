"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  AlertTriangle,
  PauseCircle,
  Sparkles,
  Zap,
  CheckCircle2,
  RefreshCw,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";

export function AdOptimizerBanner() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["meta-optimizer"],
    queryFn: async () => {
      const res = await fetch("/api/meta/optimize");
      if (!res.ok) return { recommendations: [], summary: "" };
      return res.json();
    },
  });

  const applyMutation = useMutation({
    mutationFn: async ({ campaignId, action }: { campaignId: string; action: string }) => {
      const res = await fetch("/api/meta/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, action }),
      });
      if (!res.ok) throw new Error("Failed to execute optimization");
      return res.json();
    },
    onSuccess: (result) => {
      toast.success(result.message || "Optimization applied successfully!");
      queryClient.invalidateQueries({ queryKey: ["meta-optimizer"] });
      queryClient.invalidateQueries({ queryKey: ["meta-campaigns"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to apply optimization");
    },
  });

  const recommendations = data?.recommendations || [];
  const actionItems = recommendations.filter(
    (r: any) => r.action === "SCALE_BUDGET" || r.action === "PAUSE_CAMPAIGN" || r.action === "REFRESH_CREATIVE"
  );

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="size-4 text-primary" /> Autonomous AI Ad Optimizer Engine
            </CardTitle>
            <CardDescription className="text-xs">
              Live ROAS feedback loop: Auto-scales winning ad sets & pauses zero-lead budget drains
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[11px] gap-1 text-emerald-600 border-emerald-300">
              <Clock className="size-3" /> 6-Hr Auto Cron Active
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="h-7 text-xs gap-1"
            >
              <RefreshCw className={`size-3 ${isRefetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : actionItems.length === 0 ? (
          <div className="flex items-center gap-3 p-3.5 rounded-xl border bg-card/60">
            <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">
                All Active Campaigns Operating at Target Efficiency
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                No underperforming budget drains detected. The autonomous optimization cron will audit spend and CPL every 6 hours.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {actionItems.map((item: any) => (
              <div
                key={item.campaignId}
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl border bg-card hover:bg-card/80 transition-colors flex-wrap"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                      item.action === "SCALE_BUDGET"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : item.action === "PAUSE_CAMPAIGN"
                        ? "bg-rose-500/10 text-rose-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {item.action === "SCALE_BUDGET" ? (
                      <ArrowUpRight className="size-4" />
                    ) : item.action === "PAUSE_CAMPAIGN" ? (
                      <PauseCircle className="size-4" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-foreground truncate">{item.campaignName}</p>
                      <Badge
                        className={`text-[10px] px-1.5 py-0 h-4 ${
                          item.action === "SCALE_BUDGET"
                            ? "bg-emerald-600 text-white"
                            : item.action === "PAUSE_CAMPAIGN"
                            ? "bg-rose-600 text-white"
                            : "bg-amber-500 text-white"
                        }`}
                      >
                        {item.action === "SCALE_BUDGET"
                          ? "Scale +20%"
                          : item.action === "PAUSE_CAMPAIGN"
                          ? "Pause Recommended"
                          : "Refresh Creative"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.reason}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.action === "SCALE_BUDGET" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        applyMutation.mutate({ campaignId: item.campaignId, action: "SCALE_BUDGET" })
                      }
                      disabled={applyMutation.isPending}
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                    >
                      <TrendingUp className="size-3" /> Scale to ₹{item.recommendedBudget?.toLocaleString()}/day
                    </Button>
                  )}
                  {item.action === "PAUSE_CAMPAIGN" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        applyMutation.mutate({ campaignId: item.campaignId, action: "PAUSE_CAMPAIGN" })
                      }
                      disabled={applyMutation.isPending}
                      className="h-7 text-xs gap-1"
                    >
                      <PauseCircle className="size-3" /> Pause Ad
                    </Button>
                  )}
                  {item.action === "REFRESH_CREATIVE" && (
                    <Badge variant="outline" className="text-[11px] text-amber-600 border-amber-300">
                      Ad Fatigue Detected
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
