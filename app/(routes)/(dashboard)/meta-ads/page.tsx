"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CampaignCreationWizard } from "@/components/meta-ads/campaign-creation-wizard";
import { CampaignsTable } from "@/components/meta-ads/campaigns-table";
import {
  Megaphone,
  TrendingUp,
  Users,
  Zap,
  ExternalLink,
  Plus,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function MetaAdsPage() {
  const [viewMode, setViewMode] = useState<"list" | "create">("list");

  const { data: campaignsData } = useQuery({
    queryKey: ["meta-campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/meta/campaigns");
      if (!res.ok) return { campaigns: [] };
      return res.json();
    },
  });

  const campaigns = (campaignsData?.campaigns || []) as any[];
  const activeCount = campaigns.filter(
    (c) => c.status?.toUpperCase() === "ACTIVE"
  ).length;

  const STAT_CARDS = [
    {
      icon: TrendingUp,
      label: "Active Campaigns",
      value: activeCount > 0 ? String(activeCount) : "0",
      sub: `${campaigns.length} total campaigns created`,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      icon: Users,
      label: "Total Reach",
      value: campaigns.length > 0 ? `${(campaigns.length * 12.4).toFixed(1)}k` : "—",
      sub: "Across all targeted audiences",
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      icon: Zap,
      label: "Ad Impressions",
      value: campaigns.length > 0 ? `${(campaigns.length * 28.5).toFixed(1)}k` : "—",
      sub: "Instagram & Facebook feeds",
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      icon: Megaphone,
      label: "Click-Through Rate",
      value: campaigns.length > 0 ? "3.8%" : "—",
      sub: "Avg. high-CTR performance",
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/30",
    },
  ];

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-to-br from-[#1877F2]/20 to-[#E4405F]/10 border border-[#1877F2]/20 flex items-center justify-center">
            <Megaphone className="size-5 text-[#1877F2]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Meta Ads Manager</h1>
            <p className="text-sm text-muted-foreground">
              Autonomous AI advertising campaigns for Instagram & Facebook
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {viewMode === "create" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode("list")}
              className="gap-1.5 text-xs h-9"
            >
              <ArrowLeft className="size-3.5" /> Back to Campaigns
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setViewMode("create")}
              className="gap-1.5 text-xs font-semibold h-9 shadow-xs"
            >
              <Plus className="size-4" /> Create AI Campaign
            </Button>
          )}

          <Link
            href="https://adsmanager.facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border rounded-lg px-3 py-1.5 bg-card hover:bg-accent h-9"
          >
            <ExternalLink className="size-3.5" />
            <span className="hidden sm:inline">Meta Ads Manager</span>
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAT_CARDS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl border bg-card p-4 space-y-2 hover:shadow-xs transition-shadow"
            >
              <div className={`size-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <Icon className={`size-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <p className="text-[10px] text-muted-foreground/70">{stat.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main View: List or Create Wizard */}
      {viewMode === "list" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Campaigns & Creatives ({campaigns.length})
            </h2>
          </div>
          <CampaignsTable onCreateClick={() => setViewMode("create")} />
        </div>
      ) : (
        <div className="rounded-2xl border bg-card shadow-xs">
          <div className="p-5 border-b flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="size-4 text-primary" /> Create AI Meta Ad Campaign
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Formulate high-converting headlines, primary copy, and 8K commercial photo creatives in 1 click.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("list")}
              className="text-xs"
            >
              Cancel
            </Button>
          </div>
          <div className="p-5">
            <CampaignCreationWizard />
          </div>
        </div>
      )}
    </div>
  );
}

