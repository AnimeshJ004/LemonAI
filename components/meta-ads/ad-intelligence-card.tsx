"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Eye,
  Sparkles,
  ExternalLink,
} from "lucide-react";

interface TrendingAd {
  id: string;
  advertiserName: string;
  headline: string;
  primaryText: string;
  callToAction: string;
  estimatedSpendTier: "LOW" | "MEDIUM" | "HIGH";
  isActive: boolean;
  startDate?: string;
  platforms: string[];
  whyItWorks?: string;
}

interface AdIntelligenceCardProps {
  /** Called when user clicks "Model This Ad" — pre-fills wizard */
  onModelAd?: (ad: TrendingAd) => void;
  /** Called when user wants to open the full side drawer */
  onOpenDrawer?: () => void;
}

const SPEND_CONFIG: Record<string, { label: string; classes: string }> = {
  HIGH: {
    label: "High Spend",
    classes:
      "text-red-600 border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400",
  },
  MEDIUM: {
    label: "Mid Spend",
    classes:
      "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400",
  },
  LOW: {
    label: "Low Spend",
    classes:
      "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400",
  },
};

const PLATFORM_ICONS: Record<string, string> = {
  instagram: "📸",
  facebook: "📘",
  messenger: "💬",
  audience_network: "🌐",
};

export function AdIntelligenceCard({
  onModelAd,
  onOpenDrawer,
}: AdIntelligenceCardProps) {
  const [ads, setAds] = useState<TrendingAd[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch brand niche automatically from brand profile
  const { data: brandData } = useQuery({
    queryKey: ["brand-profile"],
    queryFn: async () => {
      const res = await fetch("/api/brand");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const niche = brandData?.profile?.niche || "digital marketing";
  const country = "IN";

  const { mutate: fetchAds, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/meta/trending-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, country }),
      });
      if (!res.ok) throw new Error("Failed to fetch competitor ads");
      return res.json();
    },
    onSuccess: (data) => {
      setAds(data.ads || []);
      setHasFetched(true);
      if (!data.ads?.length) {
        toast.error("No competitor ads found for your niche.");
      }
    },
    onError: () => {
      toast.error("Failed to fetch competitor ads. Please try again.");
    },
  });

  const handleRefresh = () => {
    setAds([]);
    setHasFetched(false);
    fetchAds();
  };

  // Show only first 3 on the card (rest in drawer)
  const visibleAds = ads.slice(0, 3);

  return (
    <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-orange-500/5 via-amber-500/5 to-background">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <TrendingUp className="size-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              Live Competitor Ad Intelligence
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                LIVE
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Top performing competitor ads in{" "}
              <span className="font-semibold text-foreground">{niche}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasFetched && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isPending}
              className="h-8 gap-1.5 text-xs text-muted-foreground"
              title="Refresh competitor ads"
            >
              <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          )}
          {onOpenDrawer && hasFetched && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenDrawer}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <Eye className="size-3.5" />
              View All {ads.length}
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {!hasFetched && !isPending ? (
          // Pre-fetch CTA
          <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
            <div className="size-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Sparkles className="size-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Spy on what's working in your niche
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Fetch live competitor ads currently running on Facebook &
                Instagram to model winning ad formats for your campaigns.
              </p>
            </div>
            <Button
              onClick={() => fetchAds()}
              className="gap-2 font-semibold shadow-sm"
            >
              <TrendingUp className="size-4" />
              Fetch Live Competitor Ads
            </Button>
          </div>
        ) : isPending ? (
          // Loading skeletons
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-xl border space-y-2 animate-pulse"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full shrink-0" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            ))}
          </div>
        ) : visibleAds.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No competitor ads found.{" "}
            <button
              onClick={handleRefresh}
              className="text-primary underline underline-offset-2 font-medium"
            >
              Try again
            </button>
          </p>
        ) : (
          <div className="space-y-3">
            {visibleAds.map((ad, i) => {
              const spendCfg = SPEND_CONFIG[ad.estimatedSpendTier] || SPEND_CONFIG.LOW;
              const isExpanded = expanded === ad.id;

              return (
                <div
                  key={ad.id || i}
                  className="rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors overflow-hidden"
                >
                  {/* Ad row */}
                  <div className="flex items-start gap-3 p-4">
                    {/* Rank badge */}
                    <div
                      className={`size-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold ${
                        i === 0
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      #{i + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Advertiser + spend */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] text-muted-foreground font-medium truncate">
                          {ad.advertiserName}
                        </p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold shrink-0 ${spendCfg.classes}`}
                        >
                          💰 {spendCfg.label}
                        </Badge>
                      </div>

                      {/* Headline */}
                      <p className="text-sm font-bold text-foreground mt-1 leading-tight">
                        {ad.headline}
                      </p>

                      {/* Primary text (truncated) */}
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {ad.primaryText}
                      </p>

                      {/* Platforms */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {ad.platforms?.map((p) => (
                          <span
                            key={p}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-background border font-medium capitalize flex items-center gap-1"
                          >
                            {PLATFORM_ICONS[p] || "📱"} {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Expandable "Why it works" */}
                  {ad.whyItWorks && (
                    <div className="border-t">
                      <button
                        className="w-full flex items-center justify-between px-4 py-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                        onClick={() =>
                          setExpanded(isExpanded ? null : ad.id)
                        }
                      >
                        <span className="flex items-center gap-1.5 font-medium">
                          <Sparkles className="size-3 text-primary" />
                          Why this ad is winning
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-3">
                          <p className="text-xs text-foreground/80 bg-primary/5 border border-primary/15 rounded-lg p-3 leading-relaxed">
                            {ad.whyItWorks}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  {onModelAd && (
                    <div className="border-t px-4 py-2.5 flex justify-end bg-muted/10">
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1.5 font-semibold"
                        onClick={() => {
                          onModelAd(ad);
                          toast.success(
                            `"${ad.headline}" loaded into campaign wizard!`
                          );
                        }}
                      >
                        <Zap className="size-3" />
                        Model This Ad
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* View all hint */}
            {ads.length > 3 && onOpenDrawer && (
              <button
                onClick={onOpenDrawer}
                className="w-full text-xs text-center text-muted-foreground hover:text-primary py-2 transition-colors flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="size-3" />
                View {ads.length - 3} more competitor ads
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
