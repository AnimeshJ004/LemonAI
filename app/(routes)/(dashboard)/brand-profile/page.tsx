import { Metadata } from "next";
import { BrandProfileForm } from "@/components/brand/brand-profile-form";
import { Building2, ChevronRight } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Brand Profile | Lemon AI",
  description:
    "Set up your business brand profile to power AI-generated content and Meta Ads targeting.",
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
              Your AI uses this to generate high-converting ads & content
            </p>
          </div>
        </div>

        {/* Progress hint */}
        <div className="flex items-center gap-3 mt-4 p-3 rounded-xl bg-primary/5 border border-primary/15">
          <div className="flex items-center gap-0">
            {[
              { n: 1, label: "Brand Profile", active: true, done: false },
              { n: 2, label: "AI Creative", active: false, done: false },
              { n: 3, label: "Meta Ads", active: false, done: false },
            ].map((step, idx, arr) => (
              <div key={step.n} className="flex items-center">
                <div
                  className={`size-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step.active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.n}
                </div>
                <span
                  className={`text-[10px] ml-1.5 font-medium ${
                    step.active ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
                {idx < arr.length - 1 && (
                  <div className="w-6 h-[2px] bg-border mx-2 rounded" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="rounded-2xl border bg-card shadow-sm p-6">
        <BrandProfileForm />
      </div>

      {/* Tips */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            emoji: "🎯",
            title: "Be Specific",
            desc: 'Instead of "Adults", say "Adults 28-40 in Mumbai seeking smile makeover"',
          },
          {
            emoji: "✨",
            title: "Strong Hook",
            desc: "Your Main Offer is the first thing people see in your ad. Make it irresistible.",
          },
          {
            emoji: "🚀",
            title: "Know Competitors",
            desc: "Adding competitor handles helps AI craft messaging that stands out from the market.",
          },
        ].map((tip) => (
          <div
            key={tip.title}
            className="p-3.5 rounded-xl border bg-card/50 space-y-1"
          >
            <p className="text-sm font-semibold text-foreground">
              {tip.emoji} {tip.title}
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{tip.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
