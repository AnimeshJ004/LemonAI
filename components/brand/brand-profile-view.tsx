"use client";

import { BrandProfileForm } from "@/components/brand/brand-profile-form";
import { BrandPricingPackages } from "@/components/brand/brand-pricing-packages";
import { Building2, ChevronRight } from "lucide-react";
import Link from "next/link";

export function BrandProfileView() {
  return (
    <div className="max-w-4xl mx-auto py-6 px-3 sm:px-0">
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
            <h1 className="text-xl font-bold text-foreground">Brand & Creator Profile</h1>
            <p className="text-sm text-muted-foreground line-clamp-2 md:line-clamp-none">
              Your AI uses this to personalize all generated social posts, reels, hooks & visuals
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
      <div className="rounded-2xl border bg-card shadow-sm p-4 sm:p-6">
        <BrandProfileForm />
      </div>

      {/* Pricing Packages — shown to prospects on the public lead-form page
          after they submit a pricing enquiry (Comment → DM → Form → Packages). */}
      <div className="mt-4">
        <BrandPricingPackages />
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
              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 md:line-clamp-none">{tip.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
