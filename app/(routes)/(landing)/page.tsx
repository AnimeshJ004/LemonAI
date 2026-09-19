"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";
import {
  ArrowRight,
  Check,
  Menu,
  X,
  Sparkles,
  Share2,
  BarChart3,
  Lightbulb,
  CreditCard,
  LogIn,
  UserPlus,
  LayoutDashboard,
} from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import Logo from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ChannelTypeEnum, getChannelIcon } from "@/constants/channels";

const navItems = [
  { name: "Features", href: "#features", icon: Sparkles },
  { name: "Channels", href: "#channels", icon: Share2 },
  { name: "Made for", href: "#stats", icon: BarChart3 },
  { name: "Resources", href: "/ideas", icon: Lightbulb },
  { name: "Pricing", href: "/billing", icon: CreditCard },
];

const platformBadges = [
  // Left column — desktop layout
  { type: ChannelTypeEnum.TWITTER, color: "#000000", className: "left-[2%] top-[8%]" },
  { type: ChannelTypeEnum.LINKEDIN, color: "#2867b2", className: "left-[6%] top-[32%]" },
  { type: ChannelTypeEnum.YOUTUBE, color: "#FF0000", className: "left-[2%] top-[56%]" },

  // Right column — desktop layout
  { type: ChannelTypeEnum.BLUESKY, color: "#1285fe", className: "right-[2%] top-[8%]" },
  { type: ChannelTypeEnum.INSTAGRAM, color: "#E4405F", className: "right-[6%] top-[32%]" },
  { type: ChannelTypeEnum.THREADS, color: "#000000", className: "right-[2%] top-[56%]" },
  { type: ChannelTypeEnum.FACEBOOK, color: "#1877F2", className: "right-[9%] top-[56%]" },
];

const stats = [
  { value: "8", label: "social platforms supported" },
  { value: "1", label: "workspace for planning and scheduling" },
  { value: "AI", label: "built into drafting and publishing" },
];

const featurePanels = [
  {
    title: "The cleanest way to plan your week",
    description:
      "See your ideas, drafts, and scheduled posts in one place without juggling tabs and spreadsheets.",
    tone: "bg-[#ead6ff]",
  },
  {
    title: "Customize once, publish everywhere",
    description:
      "Start with a global draft, fine-tune each channel, and keep every post matched to the platform.",
    tone: "bg-[#d7f2b7]",
  },
];

export default function LandingPage() {
  const { isSignedIn } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Sticky Responsive Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4">
          <Logo className="shrink-0 scale-95 sm:scale-100 origin-left" />

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-6 lg:gap-8 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icon className="size-3.5 text-muted-foreground/70" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {!isSignedIn ? (
              <>
                <Button asChild variant="outline" className="rounded-full px-5 min-h-[44px]">
                  <Link href="/sign-in" className="flex items-center gap-1.5">
                    <LogIn className="size-4" />
                    <span>Log in</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90 min-h-[44px]"
                >
                  <Link href="/sign-up" className="flex items-center gap-1.5">
                    <UserPlus className="size-4" />
                    <span>Get started free</span>
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button
                  asChild
                  className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90 min-h-[44px]"
                >
                  <Link href="/schedule" className="flex items-center gap-1.5">
                    <LayoutDashboard className="size-4" />
                    <span>Open workspace</span>
                  </Link>
                </Button>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "h-10 w-10",
                    },
                  }}
                />
              </>
            )}
          </div>

          {/* Mobile Right Controls: User Avatar (if signed in) + Hamburger Trigger */}
          <div className="flex items-center gap-2 md:hidden">
            {isSignedIn && (
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-9 w-9",
                  },
                }}
              />
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl p-2 text-foreground hover:bg-muted transition-colors border border-border/60"
            >
              {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Collapsible Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-border/80 bg-background/98 px-4 py-5 shadow-xl animate-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="min-h-[44px] flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-primary">
                      <Icon className="size-4" />
                    </div>
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-5 pt-4 border-t border-border/60 flex flex-col gap-2.5">
              {!isSignedIn ? (
                <>
                  <Button asChild variant="outline" className="w-full min-h-[44px] rounded-xl text-sm font-semibold justify-center gap-2">
                    <Link href="/sign-in" onClick={() => setMobileMenuOpen(false)}>
                      <LogIn className="size-4" />
                      <span>Log in</span>
                    </Link>
                  </Button>
                  <Button asChild className="w-full min-h-[44px] rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold justify-center gap-2">
                    <Link href="/sign-up" onClick={() => setMobileMenuOpen(false)}>
                      <UserPlus className="size-4" />
                      <span>Get started for free</span>
                    </Link>
                  </Button>
                </>
              ) : (
                <Button asChild className="w-full min-h-[44px] rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold justify-center gap-2">
                  <Link href="/schedule" onClick={() => setMobileMenuOpen(false)}>
                    <LayoutDashboard className="size-4" />
                    <span>Open workspace</span>
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="overflow-x-hidden">
        <section id="channels" className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20 [background-image:linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.06)_1px,transparent_1px)] dark:[background-image:linear-gradient(to_right,rgba(248,250,252,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(248,250,252,0.08)_1px,transparent_1px)] [background-size:56px_56px]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-background to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-background to-transparent" />

          <div className="relative mx-auto flex min-h-[600px] sm:min-h-[720px] max-w-7xl flex-col px-4 sm:px-6 pb-12 sm:pb-16 pt-8 sm:pt-16">
            {/* Desktop floating badges */}
            <div className="absolute hidden inset-0 md:block pointer-events-none">
              <div className="absolute inset-y-0 left-0 w-[22%] bg-gradient-to-r from-transparent to-background/0 z-10" />
              <div className="absolute inset-y-0 right-0 w-[22%] bg-gradient-to-l from-transparent to-background/0 z-10" />

              {platformBadges.map((platform) => {
                const icon = getChannelIcon(platform.type);
                return (
                  <div
                    key={platform.type}
                    className={`absolute ${platform.className} rounded-2xl border border-border/60 bg-card p-4 
          shadow-[0_10px_30px_rgba(15,23,42,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.24)]
          opacity-70 hover:opacity-100 transition-opacity`}
                  >
                    {icon && (
                      <div
                        className="flex size-9 items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: platform.color }}
                      >
                        <HugeiconsIcon icon={icon} color="currentColor" className="size-5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="z-10 mx-auto flex max-w-4xl flex-1 flex-col items-center justify-center text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/90 px-3.5 sm:px-4 py-1.5 text-xs sm:text-sm text-muted-foreground shadow-sm">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span>Plan ideas, customize by channel, and publish with AI</span>
              </div>

              <h1 className="max-w-4xl text-3xl font-bold tracking-tight text-foreground sm:text-5xl md:text-7xl leading-tight">
                Your social media workspace
              </h1>

              {/* Dynamic Short Description on Mobile (< 768px clamp-2, >= 768px full) */}
              <p className="mt-4 sm:mt-6 max-w-2xl text-sm sm:text-lg md:text-xl text-muted-foreground line-clamp-2 md:line-clamp-none px-2">
                Draft faster, stay organized, and schedule content across every channel without the usual mess.
              </p>

              {/* Mobile Platform Pills Carousel (< md) */}
              <div className="mt-5 flex md:hidden items-center justify-center gap-2 flex-wrap max-w-sm mx-auto">
                {platformBadges.map((platform) => {
                  const icon = getChannelIcon(platform.type);
                  return (
                    <div
                      key={platform.type}
                      className="flex size-9 items-center justify-center rounded-xl text-white shadow-xs"
                      style={{ backgroundColor: platform.color }}
                    >
                      {icon && <HugeiconsIcon icon={icon} color="currentColor" className="size-4" />}
                    </div>
                  );
                })}
              </div>

              {!isSignedIn ? (
                <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto px-4 sm:px-0">
                  <Button
                    asChild
                    className="h-12 min-h-[44px] w-full sm:w-auto rounded-full bg-primary px-7 text-base text-primary-foreground hover:bg-primary/90 shadow-sm"
                  >
                    <Link href="/sign-up" className="flex items-center justify-center gap-2">
                      <span>Get started for free</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-12 min-h-[44px] w-full sm:w-auto rounded-full px-7 text-base">
                    <Link href="/sign-in">Log in</Link>
                  </Button>
                </div>
              ) : (
                <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto px-4 sm:px-0">
                  <Button
                    asChild
                    className="h-12 min-h-[44px] w-full sm:w-auto rounded-full bg-primary px-7 text-base text-primary-foreground hover:bg-primary/90 shadow-sm"
                  >
                    <Link href="/schedule" className="flex items-center justify-center gap-2">
                      <span>Open workspace</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-12 min-h-[44px] w-full sm:w-auto rounded-full px-7 text-base">
                    <Link href="/ideas">View ideas</Link>
                  </Button>
                </div>
              )}

              {/* Dynamic Sub-Description (< 768px clamp-2, >= 768px full) */}
              <p className="mt-4 sm:mt-5 text-xs sm:text-sm text-muted-foreground line-clamp-2 md:line-clamp-none px-4">
                Build drafts once, adapt them per platform, and keep your schedule under control.
              </p>
            </div>

            <div id="stats" className="mt-8 sm:mt-12 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl sm:rounded-[28px] border border-border/60 bg-card/85 p-5 sm:p-8 text-center shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
                >
                  <div className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">{stat.value}</div>
                  <div className="mt-2 sm:mt-3 text-xs sm:text-sm uppercase tracking-[0.14em] sm:tracking-[0.16em] text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto grid max-w-7xl gap-4 sm:gap-5 px-4 sm:px-6 pb-12 sm:pb-16 grid-cols-1 md:grid-cols-2">
          {featurePanels.map((panel) => (
            <div
              key={panel.title}
              className={`${panel.tone} rounded-2xl sm:rounded-[28px] p-6 sm:p-8 dark:border dark:border-border/60 dark:bg-card`}
            >
              <div className="max-w-md">
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                  {panel.title}
                </h2>
                {/* Dynamic short description on mobile (< 768px clamp-2, >= 768px full) */}
                <p className="mt-3 sm:mt-4 text-sm sm:text-base leading-relaxed sm:leading-7 text-muted-foreground line-clamp-2 md:line-clamp-none">
                  {panel.description}
                </p>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
