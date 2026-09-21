"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  Sparkles,
  Copy,
  Check,
  Calendar,
  Search,
  CheckCircle2,
  AlertCircle,
  Download,
  List,
  Target,
  Share2,
  Code,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import ScheduleFromResearchDialog from "@/components/competition/schedule-from-research-dialog";

export default function BlogStudioPage() {
  const [form, setForm] = useState({
    topic: "",
    keyword: "",
    secondaryKeywords: "",
    searchIntent: "Informational / How-To",
    wordCount: 1200,
  });
  const [blog, setBlog] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [selectedSnippet, setSelectedSnippet] = useState("");

  // Restore cached blog on page mount / tab switch
  useEffect(() => {
    try {
      const cached = localStorage.getItem("lemon_blog_writer");
      if (cached) setBlog(JSON.parse(cached));
      const cachedForm = localStorage.getItem("lemon_blog_form");
      if (cachedForm) setForm(JSON.parse(cachedForm));
    } catch {}
  }, []);

  // Persist blog and form
  useEffect(() => {
    if (blog) {
      try {
        localStorage.setItem("lemon_blog_writer", JSON.stringify(blog));
      } catch {}
    }
  }, [blog]);

  useEffect(() => {
    if (form.topic) {
      try {
        localStorage.setItem("lemon_blog_form", JSON.stringify(form));
      } catch {}
    }
  }, [form]);

  const clearBlog = () => {
    setBlog(null);
    try {
      localStorage.removeItem("lemon_blog_writer");
    } catch {}
    toast.info("Blog cleared. Ready for a new topic.");
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/ai/studio-blogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Generation failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setBlog(data.blog);
      toast.success("SEO Blog generated!");
    },
    onError: (err: any) => toast.error(err.message || "Generation failed"),
  });

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copied to clipboard!");
  };

  // Compile full article text for analytics
  const fullArticleText = useMemo(() => {
    if (!blog?.sections) return "";
    return blog.sections
      .map((s: any) => {
        let txt = (s.h2 ? s.h2 + " " : "") + (s.content || "");
        if (s.faqs) {
          txt += " " + s.faqs.map((f: any) => f.q + " " + f.a).join(" ");
        }
        return txt;
      })
      .join(" ");
  }, [blog]);

  // Dynamic SEO Health Score Audit Calculation
  const seoAudit = useMemo(() => {
    if (!blog) return null;

    const title = blog.title || "";
    const meta = blog.metaDescription || "";
    const focusKeyword = (blog.focusKeyword || form.keyword || form.topic || "").trim().toLowerCase();
    const articleLower = fullArticleText.toLowerCase();
    const wordCount = fullArticleText.split(/\s+/).filter(Boolean).length;

    // Checks
    const titleLengthOk = title.length >= 35 && title.length <= 65;
    const titleHasKeyword = focusKeyword ? title.toLowerCase().includes(focusKeyword) : true;
    const metaLengthOk = meta.length >= 120 && meta.length <= 160;
    const metaHasKeyword = focusKeyword ? meta.toLowerCase().includes(focusKeyword) : true;
    
    // Keyword density
    let keywordMatches = 0;
    if (focusKeyword && wordCount > 0) {
      const escaped = focusKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "gi");
      const found = articleLower.match(regex);
      keywordMatches = found ? found.length : 0;
    }
    const keywordDensity = wordCount > 0 ? (keywordMatches / wordCount) * 100 : 0;
    const keywordDensityOk = keywordDensity >= 0.5 && keywordDensity <= 3.0;

    // Headings
    const h2Sections = blog.sections?.filter((s: any) => s.type === "SECTION" && s.h2) || [];
    const headingsOk = h2Sections.length >= 3;

    // FAQs
    const faqSection = blog.sections?.find((s: any) => s.type === "FAQ");
    const faqCount = faqSection?.faqs?.length || 0;
    const faqsOk = faqCount >= 2;

    // Calculate score
    let score = 0;
    if (titleLengthOk) score += 15;
    if (titleHasKeyword) score += 15;
    if (metaLengthOk) score += 15;
    if (metaHasKeyword) score += 10;
    if (headingsOk) score += 15;
    if (keywordDensityOk) score += 15;
    if (faqsOk) score += 15;

    return {
      score: Math.min(100, score),
      wordCount,
      keywordMatches,
      keywordDensity: keywordDensity.toFixed(1),
      titleLengthOk,
      titleHasKeyword,
      metaLengthOk,
      metaHasKeyword,
      headingsOk,
      h2Count: h2Sections.length,
      faqsOk,
      faqCount,
      keywordDensityOk,
    };
  }, [blog, form.keyword, form.topic, fullArticleText]);

  // Markdown Export
  const exportMarkdown = () => {
    if (!blog) return;
    const lines: string[] = [];
    lines.push(`# ${blog.title}\n`);
    lines.push(`> **Meta Description:** ${blog.metaDescription || ""}`);
    lines.push(`> **Slug:** /${blog.slug || ""} | **Read Time:** ${blog.readTime || ""} | **Intent:** ${blog.searchIntent || ""}\n`);

    if (blog.keyTakeaways && blog.keyTakeaways.length > 0) {
      lines.push("### 💡 Key Takeaways\n");
      blog.keyTakeaways.forEach((k: string) => lines.push(`- ${k}`));
      lines.push("\n---\n");
    }

    blog.sections?.forEach((s: any) => {
      if (s.h2) {
        lines.push(`## ${s.h2}\n`);
      }
      if (s.content) {
        lines.push(`${s.content}\n`);
      }
      if (s.faqs && s.faqs.length > 0) {
        s.faqs.forEach((faq: any) => {
          lines.push(`### Q: ${faq.q}`);
          lines.push(`${faq.a}\n`);
        });
      }
    });

    const md = lines.join("\n");
    navigator.clipboard.writeText(md);
    toast.success("Full article copied as Markdown!");

    // Also download file
    try {
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(blog.slug || "seo-blog").toLowerCase()}.md`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  // HTML Export
  const exportHTML = () => {
    if (!blog) return;
    const lines: string[] = [];
    lines.push(`<article>`);
    lines.push(`  <h1>${blog.title}</h1>`);
    lines.push(`  <meta name="description" content="${blog.metaDescription || ""}">`);
    
    if (blog.keyTakeaways && blog.keyTakeaways.length > 0) {
      lines.push(`  <div class="key-takeaways">`);
      lines.push(`    <strong>Key Takeaways:</strong>`);
      lines.push(`    <ul>`);
      blog.keyTakeaways.forEach((k: string) => lines.push(`      <li>${k}</li>`));
      lines.push(`    </ul>`);
      lines.push(`  </div>`);
    }

    blog.sections?.forEach((s: any) => {
      if (s.h2) lines.push(`  <h2>${s.h2}</h2>`);
      if (s.content) lines.push(`  <p>${s.content}</p>`);
      if (s.faqs && s.faqs.length > 0) {
        lines.push(`  <div class="faq-accordion">`);
        s.faqs.forEach((faq: any) => {
          lines.push(`    <div class="faq-item">`);
          lines.push(`      <h3>${faq.q}</h3>`);
          lines.push(`      <p>${faq.a}</p>`);
          lines.push(`    </div>`);
        });
        lines.push(`  </div>`);
      }
    });
    lines.push(`</article>`);

    const html = lines.join("\n");
    navigator.clipboard.writeText(html);
    toast.success("Full article copied as clean HTML!");
  };

  const SECTION_COLORS: Record<string, string> = {
    INTRO: "border-l-4 border-l-primary",
    SECTION: "",
    FAQ: "bg-muted/30",
    CTA: "border-green-500/30 bg-green-500/5",
  };

  return (
    <div className="max-w-5xl mx-auto py-4 sm:py-6 px-2 sm:px-4 space-y-6 w-full min-w-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-foreground">
            <BookOpen className="size-5 sm:size-6 text-primary shrink-0" />
            <span>SEO Blog Writer & Optimizer</span>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 line-clamp-2 md:line-clamp-none">
            Generate ranking long-form SEO articles with real-time SEO health audit, FAQ schema & one-click Markdown/HTML export.
          </p>
        </div>
        <Badge variant="outline" className="h-6 w-fit text-xs border-primary/40 text-primary">
          Rank-Ready Content Engine
        </Badge>
      </div>

      {/* Input Generator Form */}
      <Card className="border shadow-sm">
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="blog-topic">
                Blog Topic / Title Angle <span className="text-destructive">*</span>
              </Label>
              <Input
                id="blog-topic"
                placeholder="e.g. How to Scale B2B Lead Gen with Content Marketing"
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="blog-keyword">
                Focus Target Keyword <span className="text-xs text-primary font-medium">(Primary)</span>
              </Label>
              <Input
                id="blog-keyword"
                placeholder="e.g. B2B lead generation strategy"
                value={form.keyword}
                onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="blog-secondary-keywords">
                Secondary / LSI Keywords <span className="text-xs text-muted-foreground">(comma-separated)</span>
              </Label>
              <Input
                id="blog-secondary-keywords"
                placeholder="e.g. inbound funnel, conversion rate, customer pipeline"
                value={form.secondaryKeywords}
                onChange={(e) => setForm((f) => ({ ...f, secondaryKeywords: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="blog-search-intent">Search Intent</Label>
              <Select
                value={form.searchIntent}
                onValueChange={(val) => setForm((f) => ({ ...f, searchIntent: val }))}
              >
                <SelectTrigger id="blog-search-intent">
                  <SelectValue placeholder="Select intent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Informational / How-To">📘 Informational / How-To Guide</SelectItem>
                  <SelectItem value="Ultimate Playbook">🏆 Ultimate Playbook & Framework</SelectItem>
                  <SelectItem value="Commercial Investigation">💼 Commercial / Comparison</SelectItem>
                  <SelectItem value="Case Study & Tactical Breakdown">📊 Case Study & Tactical Breakdown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex justify-between items-center text-sm">
              <Label>
                Target Word Count:{" "}
                <span className="font-bold text-primary">~{form.wordCount} words</span>
              </Label>
              <span className="text-xs text-muted-foreground">In-depth structured article</span>
            </div>
            <Slider
              min={600}
              max={2500}
              step={100}
              value={[form.wordCount]}
              onValueChange={([v]) => setForm((f) => ({ ...f, wordCount: v }))}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>600 (Quick Overview)</span>
              <span>1200 (Standard SEO)</span>
              <span>2500 (Ultimate Pillar Guide)</span>
            </div>
          </div>

          <Button
            id="generate-blog-btn"
            onClick={() => mutate(form)}
            disabled={isPending || !form.topic.trim()}
            className="w-full"
            size="lg"
          >
            {isPending ? (
              <>
                <Sparkles className="size-4 mr-2 animate-spin" />
                Drafting & Optimizing Article… (takes 15-25s)
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-2" />
                Generate Comprehensive SEO Blog
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Blog Article Suite */}
      {blog && (
        <div className="space-y-6">
          {/* Action Ribbon & Top Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border bg-card shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">SEO Blog Generated</span>
                <Badge variant="secondary" className="text-xs">
                  {seoAudit?.wordCount || 0} words
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {blog.readTime || "7 min read"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Target Intent: <span className="font-medium text-foreground">{blog.searchIntent || form.searchIntent}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={exportMarkdown}
                className="h-8 text-xs gap-1.5"
              >
                <Download className="size-3.5" /> Copy Markdown (.md)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportHTML}
                className="h-8 text-xs gap-1.5"
              >
                <Code className="size-3.5" /> Copy Clean HTML
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearBlog}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                New Topic
              </Button>
            </div>
          </div>

          {/* Real-time SEO Health Score & Audit Widget */}
          {seoAudit && (
            <Card className="border border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="size-5 text-primary" />
                    <CardTitle className="text-base">Real-time SEO Scorecard</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-primary">{seoAudit.score}/100</span>
                    <Badge
                      className={
                        seoAudit.score >= 85
                          ? "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30"
                          : seoAudit.score >= 65
                          ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30"
                          : "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30"
                      }
                    >
                      {seoAudit.score >= 85 ? "Optimized for Search" : seoAudit.score >= 65 ? "Good Baseline" : "Needs Polish"}
                    </Badge>
                  </div>
                </div>
                <Progress value={seoAudit.score} className="h-2 mt-2" />
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-background border flex items-start gap-2">
                    {seoAudit.titleLengthOk && seoAudit.titleHasKeyword ? (
                      <CheckCircle2 className="size-4 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">H1 Title Optimization</p>
                      <p className="text-muted-foreground text-[11px]">
                        {blog.title?.length || 0} chars (target 35-65) • Focus keyword {seoAudit.titleHasKeyword ? "included" : "missing"}
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-background border flex items-start gap-2">
                    {seoAudit.metaLengthOk && seoAudit.metaHasKeyword ? (
                      <CheckCircle2 className="size-4 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">Meta Description</p>
                      <p className="text-muted-foreground text-[11px]">
                        {blog.metaDescription?.length || 0} chars (target 120-160) • Keyword {seoAudit.metaHasKeyword ? "included" : "missing"}
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-background border flex items-start gap-2">
                    {seoAudit.keywordDensityOk ? (
                      <CheckCircle2 className="size-4 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">Keyword Density</p>
                      <p className="text-muted-foreground text-[11px]">
                        {seoAudit.keywordDensity}% ({seoAudit.keywordMatches} occurrences, optimal 0.8%-2.5%)
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-background border flex items-start gap-2">
                    {seoAudit.headingsOk && seoAudit.faqsOk ? (
                      <CheckCircle2 className="size-4 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">Structure & Snippets</p>
                      <p className="text-muted-foreground text-[11px]">
                        {seoAudit.h2Count} H2 sections • {seoAudit.faqCount} FAQs for Google PAA
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Live Google Search Result (SERP) Preview */}
          <Card className="border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Search className="size-3.5" /> Live Google Search (SERP) Snippet Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border font-sans text-left max-w-2xl space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="size-4 rounded-full bg-primary/20 flex items-center justify-center text-[9px] text-primary font-bold">
                    L
                  </div>
                  <div className="truncate">
                    <span>yourdomain.com</span>
                    <span className="opacity-60"> › blog › {blog.slug || "guide"}</span>
                  </div>
                </div>
                <h3 className="text-blue-600 dark:text-blue-400 hover:underline text-lg font-medium leading-snug cursor-pointer line-clamp-1">
                  {blog.title}
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                  {blog.metaDescription}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Key Takeaways Executive Box */}
          {blog.keyTakeaways && blog.keyTakeaways.length > 0 && (
            <Card className="border-l-4 border-l-primary bg-primary/5">
              <CardContent className="pt-4 pb-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Sparkles className="size-3.5" /> Key Takeaways (Executive Summary)
                </h4>
                <ul className="space-y-1.5">
                  {blog.keyTakeaways.map((point: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
                      <ArrowRight className="size-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Quick Jump Table of Contents */}
          {blog.sections?.some((s: any) => s.h2) && (
            <div className="p-3.5 rounded-lg border bg-muted/20 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <List className="size-3.5" /> Table of Contents:
              </p>
              <div className="flex flex-wrap gap-2">
                {blog.sections
                  .filter((s: any) => s.h2)
                  .map((s: any, idx: number) => (
                    <a
                      key={idx}
                      href={`#sec-${idx}`}
                      className="text-xs px-2.5 py-1 rounded bg-background border hover:border-primary transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {s.h2}
                    </a>
                  ))}
              </div>
            </div>
          )}

          {/* Blog Sections Content */}
          <div className="space-y-4">
            {blog.sections?.map((s: any, i: number) => (
              <Card key={i} id={`sec-${i}`} className={SECTION_COLORS[s.type] || ""}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">
                      {s.type}
                    </Badge>
                    {s.content && (
                      <button
                        onClick={() => copyText(s.content, `section-${i}`)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {copied === `section-${i}` ? (
                          <Check className="size-3 text-green-500" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        Copy text
                      </button>
                    )}
                  </div>

                  {s.h2 && <h2 className="font-bold text-lg leading-tight">{s.h2}</h2>}
                  {s.content && <p className="text-sm leading-relaxed whitespace-pre-line">{s.content}</p>}

                  {/* FAQs Section */}
                  {s.faqs && s.faqs.length > 0 && (
                    <div className="space-y-3 mt-3 pt-2 border-t">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <HelpCircle className="size-3.5" /> Google People Also Ask (PAA) Schema Ready
                      </p>
                      {s.faqs.map((faq: any, j: number) => (
                        <div key={j} className="p-3.5 rounded-lg bg-background border space-y-1.5 shadow-sm">
                          <p className="text-sm font-semibold text-foreground">Q: {faq.q}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">A: {faq.a}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Social Snippets Promotion Section */}
          {blog.socialSnippets?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Share2 className="size-4 text-primary" /> Multi-Channel Social Syndication Snippets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {blog.socialSnippets.map((snippet: string, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border">
                    <p className="text-xs sm:text-sm flex-1 leading-relaxed">{snippet}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-primary"
                        onClick={() => {
                          setSelectedSnippet(snippet);
                          setIsScheduleOpen(true);
                        }}
                      >
                        <Calendar className="size-3 mr-1" /> Schedule
                      </Button>
                      <button onClick={() => copyText(snippet, `snippet-${i}`)} className="p-1">
                        {copied === `snippet-${i}` ? (
                          <Check className="size-3.5 text-green-500" />
                        ) : (
                          <Copy className="size-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Scheduler Dialog */}
      <ScheduleFromResearchDialog
        open={isScheduleOpen}
        onOpenChange={setIsScheduleOpen}
        mode="single"
        initialTopic={form.topic}
        initialContent={selectedSnippet || (blog?.title ? `${blog.title}\n\n${blog.metaDescription || ""}` : form.topic)}
        suggestedFormat="FEED_POST"
        researchContext={{
          niche: form.topic,
        }}
      />
    </div>
  );
}
