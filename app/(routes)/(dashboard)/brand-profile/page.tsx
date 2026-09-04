import { Metadata } from "next";
import { BrandProfileForm } from "@/components/brand/brand-profile-form";
import { Building2, ChevronRight } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Brand Profile | Lemon AI",
  description:
    "Set up your business brand profile to power AI-generated social media content and scheduled posts.",
};

export default function BrandProfilePage() {
  return (
    <div className="max-w-2xl mx-auto py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-muted-foreground mb-5">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground font-medium">Brand Profile</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="size-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
            <Building2 className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Brand Profile</h1>
            <p className="text-sm text-muted-foreground">
              Your AI uses this to personalize all generated social posts, captions & visuals
            </p>
          </div>
        </div>

        {/* Brand DNA Indicator */}
        <div className="flex items-center justify-between mt-4 p-3 rounded-xl bg-primary/5 border border-primary/15">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>AI Brand DNA Active</span>
          </div>
          <p className="text-[11px] text-muted-foreground hidden sm:block">
            Used automatically by the AI Assistant when creating & scheduling posts
          </p>
        </div>
      </div>

      {/* Main Card */}
      <div className="rounded-2xl border bg-card shadow-sm p-6">
        <BrandProfileForm />
      </div>

      {/* Guidance Cards */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            icon: Building2,
            title: "Audience Definition",
            desc: "Specify exact demographics and location (e.g. Adults 28-40 seeking premium services in urban centers).",
          },
          {
            icon: ChevronRight,
            title: "Value Proposition",
            desc: "Define your primary customer offer clearly to maximize ad click-through rates.",
          },
          {
            icon: Building2,
            title: "Market Positioning",
            desc: "Including key competitor handles enables the AI to position your brand distinctly in ad copy.",
          },
        ].map((tip) => {
          const Icon = tip.icon;
          return (
            <div
              key={tip.title}
              className="p-3.5 rounded-xl border bg-card/50 space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <Icon className="size-4 text-primary" />
                <p className="text-xs font-semibold text-foreground">{tip.title}</p>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{tip.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
