import { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Clapperboard,
  LayoutTemplate,
  BookOpen,
  Megaphone,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "AI Content Studio | Lemon AI",
  description: "Create viral Reels, multi-slide Carousels, SEO Blogs, and Meta Ad Creatives powered by Gemini AI.",
};

const STUDIO_TOOLS = [
  {
    title: "Reels & Video Studio",
    href: "/studio/reels",
    icon: Clapperboard,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    badge: "9:16 Video Ready",
    badgeColor: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
    description: "Generate 3-part viral video scripts (Hook, Body, CTA) and render 9:16 vertical video reels.",
    features: ["Hook-Retention Architecture", "Visual B-Roll Prompts", "AI Video Synthesis"],
  },
  {
    title: "Multi-Slide Carousel Creator",
    href: "/studio/carousels",
    icon: LayoutTemplate,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    badge: "Instagram & LinkedIn",
    badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    description: "Build 5 to 10-slide educational swipe carousels formatted for high saves and profile visits.",
    features: ["Cover Hook Slide", "Actionable Frameworks", "Save/Share Call-to-Action"],
  },
  {
    title: "SEO Long-Form Blog Writer",
    href: "/studio/blogs",
    icon: BookOpen,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    badge: "Google Rank Ready",
    badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
    description: "Draft 1,500+ word articles grounded in your brand expertise with meta tags, FAQs and H1-H3 structure.",
    features: ["Keyword Density Optimization", "Schema FAQ Formatting", "Social Snippet Extraction"],
  },
  {
    title: "Meta Ad Creatives & Copy",
    href: "/studio/ad-creatives",
    icon: Megaphone,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
    badge: "High ROAS",
    badgeColor: "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400",
    description: "Generate direct-response ad headlines, primary texts, and commercial visual photo prompts.",
    features: ["Pain-Agitate-Solve Copy", "Click-Through Headlines", "Commercial Photo Generation"],
  },
  {
    title: "Content Strategy Planner",
    href: "/studio/strategy",
    icon: TrendingUp,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    badge: "30-Day Masterplan",
    badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    description: "Synthesize full 30-day cross-platform editorial calendars with 1-click batch calendar scheduling.",
    features: ["5 Core Content Pillars", "Posting Rhythm Allocation", "1-Click Push to Calendar"],
  },
];

export default function StudioHubPage() {
  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6 md:p-8 shadow-xs">
        <div className="max-w-2xl space-y-2.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Sparkles className="size-3.5" /> AI Multi-Modal Content Suite
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
            AI Content Studio Hub
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Create high-retention video reels, multi-slide carousels, SEO articles, and paid ad creatives tailored to your verified brand persona in seconds.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="sm" className="gap-2 font-semibold">
              <Link href="/studio/reels">
                <Clapperboard className="size-4" /> Create Reel Video
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/studio/strategy">
                <TrendingUp className="size-4" /> Plan 30-Day Strategy
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {STUDIO_TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Card
              key={tool.title}
              className={`flex flex-col justify-between hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 border ${tool.border}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className={`size-10 rounded-xl ${tool.bg} flex items-center justify-center`}>
                    <Icon className={`size-5 ${tool.color}`} />
                  </div>
                  <Badge variant="outline" className={`text-[11px] font-semibold ${tool.badgeColor}`}>
                    {tool.badge}
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold text-foreground">{tool.title}</CardTitle>
                <CardDescription className="text-xs leading-relaxed mt-1">
                  {tool.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <ul className="space-y-1.5 border-t pt-3">
                  {tool.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <Button asChild className="w-full justify-between gap-2 text-xs font-semibold h-9" variant="outline">
                  <Link href={tool.href}>
                    <span>Open Generator</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
