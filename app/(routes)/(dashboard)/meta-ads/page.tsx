import { Metadata } from "next";
import { CampaignCreationWizard } from "@/components/meta-ads/campaign-creation-wizard";
import { Megaphone, TrendingUp, Users, Zap, ExternalLink } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Meta Ads | Lemon AI",
  description:
    "Create and manage AI-powered Meta Ads campaigns. Generate creatives, preview on Instagram & Facebook, and deploy in 1 click.",
};

const STAT_CARDS = [
  {
    icon: TrendingUp,
    label: "Active Campaigns",
    value: "—",
    sub: "Launch your first one",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    icon: Users,
    label: "Total Reach",
    value: "—",
    sub: "Across all campaigns",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  {
    icon: Zap,
    label: "Ad Impressions",
    value: "—",
    sub: "Last 30 days",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    icon: Megaphone,
    label: "Click-Through Rate",
    value: "—",
    sub: "Avg. across campaigns",
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950/30",
  },
];

export default function MetaAdsPage() {
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
              AI-powered campaigns for Instagram & Facebook
            </p>
          </div>
        </div>

        <Link
          href="https://adsmanager.facebook.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border rounded-lg px-3 py-1.5 bg-card hover:bg-accent"
        >
          <ExternalLink className="size-3" />
          Open Meta Ads Manager
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAT_CARDS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl border bg-card p-4 space-y-2 hover:shadow-sm transition-shadow"
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

      {/* Sandbox Banner */}
      {!process.env.NEXT_PUBLIC_META_CLIENT_ID && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <div className="size-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 mt-0.5">
            <Zap className="size-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Sandbox Environment Active
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
              Meta API credentials are not configured. Campaigns will be created in demo mode with
              full UI flow. Add{" "}
              <code className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 rounded">
                META_CLIENT_ID
              </code>{" "}
              and{" "}
              <code className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 rounded">
                META_AD_ACCOUNT_ID
              </code>{" "}
              in your{" "}
              <code className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 rounded">
                .env.local
              </code>{" "}
              to deploy live campaigns.
            </p>
          </div>
        </div>
      )}

      {/* Main Wizard Card */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="p-5 border-b">
          <h2 className="text-base font-semibold text-foreground">
            Create New Campaign
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Follow the 3-step wizard to generate, preview, and launch your ad in minutes.
          </p>
        </div>
        <div className="p-5">
          <CampaignCreationWizard />
        </div>
      </div>
    </div>
  );
}
