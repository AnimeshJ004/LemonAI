"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CampaignCreationWizard } from "@/components/meta-ads/campaign-creation-wizard";
import { CampaignsTable } from "@/components/meta-ads/campaigns-table";
import {
  Megaphone,
  TrendingUp,
  Clock,
  ExternalLink,
  Plus,
  ArrowLeft,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function MetaAdsPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"list" | "create">("list");
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [autoGenDialogOpen, setAutoGenDialogOpen] = useState(false);
  const [campaignsCount, setCampaignsCount] = useState(3);
  const [daysSpan, setDaysSpan] = useState(14);
  const [dailyBudget, setDailyBudget] = useState(500);

  // Fetch campaigns from database
  const { data: campaignsData } = useQuery({
    queryKey: ["meta-campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/meta/campaigns");
      if (!res.ok) return { campaigns: [] };
      return res.json();
    },
  });

  // Fetch connected channels to check Meta (Instagram / Facebook) status
  const { data: channelsData } = useQuery({
    queryKey: ["user-channels"],
    queryFn: async () => {
      const res = await fetch("/api/channel");
      if (!res.ok) return { channels: [] };
      return res.json();
    },
  });

  const channels = (channelsData?.channels || []) as any[];
  const metaConnectedChannels = channels.filter(
    (c) =>
      c.connected &&
      ["FACEBOOK", "INSTAGRAM"].includes(c.type?.toUpperCase() || "")
  );
  const isMetaConnected = metaConnectedChannels.length > 0;

  const campaigns = (campaignsData?.campaigns || []) as any[];
  const activeCount = campaigns.filter(
    (c) => c.status?.toUpperCase() === "ACTIVE"
  ).length;
  const scheduledCount = campaigns.filter(
    (c) => c.status?.toUpperCase() === "SCHEDULED"
  ).length;
  const creativesCount = campaigns.filter((c) => !!c.ad_image_url).length;

  const STAT_CARDS = [
    {
      icon: TrendingUp,
      label: "Active Campaigns",
      value: String(activeCount),
      sub: "Currently live on feeds",
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      icon: Clock,
      label: "Scheduled Campaigns",
      value: String(scheduledCount),
      sub: "AI queued across calendar",
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-950/30",
    },
    {
      icon: Layers,
      label: "Total Campaigns Created",
      value: String(campaigns.length),
      sub: "Full campaign portfolio",
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      icon: ImageIcon,
      label: "Creative Assets",
      value: String(creativesCount),
      sub: "Reels & photo creatives",
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/30",
    },
  ];

  // Handler for 1-Click AI Auto-Pilot Campaign Generation
  const handleAutoPilotGenerate = async () => {
    setIsAutoGenerating(true);
    try {
      const res = await fetch("/api/meta/campaigns/auto-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignsCount,
          daysSpan,
          dailyBudget,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to auto-generate campaigns");
      }

      toast.success(
        `AI successfully generated & scheduled ${data.count || campaignsCount} Meta Ad campaigns!`,
        {
          description: "Creatives, targeting, copy and schedule have been queued.",
        }
      );

      setAutoGenDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["meta-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-posts"] });
    } catch (err: any) {
      toast.error(err.message || "Auto-pilot generation failed");
    } finally {
      setIsAutoGenerating(false);
    }
  };

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
            <>
              {/* 1-Click AI Auto-Pilot Dialog */}
              <Dialog open={autoGenDialogOpen} onOpenChange={setAutoGenDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs font-semibold h-9 border-primary/30 text-primary hover:bg-primary/5"
                  >
                    <Sparkles className="size-3.5 text-primary animate-pulse" />
                    AI Auto-Generate Campaigns
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Sparkles className="size-4 text-primary" /> Autonomous AI Meta Campaign Suite
                    </DialogTitle>
                    <DialogDescription>
                      AI will analyze your brand profile, formulate high-CTR direct-response ad copies, generate 8K photorealistic creatives, and schedule campaigns across your marketing sprint.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Number of Campaigns</Label>
                      <Input
                        type="number"
                        min={1}
                        max={6}
                        value={campaignsCount}
                        onChange={(e) => setCampaignsCount(Number(e.target.value))}
                        className="h-9 text-xs"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Includes balanced Lead Gen, Direct Offer, and Awareness campaigns.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Marketing Sprint (Days)</Label>
                      <Input
                        type="number"
                        min={7}
                        max={30}
                        value={daysSpan}
                        onChange={(e) => setDaysSpan(Number(e.target.value))}
                        className="h-9 text-xs"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Schedules launch dates across the next {daysSpan} days.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Daily Budget per Campaign (₹ INR)</Label>
                      <Input
                        type="number"
                        min={100}
                        step={100}
                        value={dailyBudget}
                        onChange={(e) => setDailyBudget(Number(e.target.value))}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAutoGenDialogOpen(false)}
                      disabled={isAutoGenerating}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAutoPilotGenerate}
                      disabled={isAutoGenerating}
                      className="gap-1.5 text-xs font-semibold"
                    >
                      {isAutoGenerating ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" /> Auto-Generating Suite...
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-3.5" /> Launch AI Auto-Pilot
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button
                size="sm"
                onClick={() => setViewMode("create")}
                className="gap-1.5 text-xs font-semibold h-9 shadow-xs"
              >
                <Plus className="size-4" /> Create Custom Campaign
              </Button>
            </>
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

      {/* Meta Account Status Banner */}
      <div
        className={`rounded-xl border p-3.5 flex items-center justify-between gap-3 text-xs ${
          isMetaConnected
            ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-950 dark:text-emerald-200"
            : "bg-amber-500/5 border-amber-500/20 text-amber-950 dark:text-amber-200"
        }`}
      >
        <div className="flex items-center gap-2.5">
          {isMetaConnected ? (
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="size-4 text-amber-600 shrink-0" />
          )}
          <span>
            {isMetaConnected ? (
              <>
                <strong>Meta Account Connected:</strong>{" "}
                {metaConnectedChannels.map((c) => c.name || c.type).join(", ")}. Campaigns will deploy to your active Meta Business Account.
              </>
            ) : (
              <>
                <strong>Meta Account Not Connected:</strong> Running in Sandbox Preview Mode. Connect Facebook or Instagram in Settings to push directly to live feeds.
              </>
            )}
          </span>
        </div>
        {!isMetaConnected && (
          <Link
            href="/settings"
            className="text-primary underline font-medium hover:opacity-80 shrink-0"
          >
            Connect Account →
          </Link>
        )}
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
