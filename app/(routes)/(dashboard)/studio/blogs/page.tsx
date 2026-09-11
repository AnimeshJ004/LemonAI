"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Sparkles, Clock, Copy, Check, FileText, Calendar } from "lucide-react";
import ScheduleFromResearchDialog from "@/components/competition/schedule-from-research-dialog";

export default function BlogStudioPage() {
  const [form, setForm] = useState({
    topic: "",
    keyword: "",
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
      toast.success("Blog generated!");
    },
    onError: (err: any) => toast.error(err.message || "Generation failed"),
  });

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copied!");
  };

  const SECTION_COLORS: Record<string, string> = {
    INTRO: "border-l-4 border-l-primary",
    SECTION: "",
    FAQ: "bg-muted/30",
    CTA: "border-green-500/30 bg-green-500/5",
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="size-6 text-primary" />
          SEO Blog Writer
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate long-form SEO blogs with meta tags, FAQs & social media snippets
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="blog-topic">
                Blog Topic <span className="text-destructive">*</span>
              </Label>
              <Input
                id="blog-topic"
                placeholder="e.g. How to grow on Instagram in 2025"
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="blog-keyword">
                Focus Keyword{" "}
                <span className="text-muted-foreground text-xs">(for SEO)</span>
              </Label>
              <Input
                id="blog-keyword"
                placeholder="e.g. Instagram growth tips"
                value={form.keyword}
                onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>
              Target Word Count:{" "}
              <span className="font-bold text-primary">~{form.wordCount} words</span>
            </Label>
            <Slider
              min={600}
              max={2500}
              step={100}
              value={[form.wordCount]}
              onValueChange={([v]) => setForm((f) => ({ ...f, wordCount: v }))}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>600</span>
              <span>2500</span>
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
                Writing Blog… (may take 30 seconds)
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-2" />
                Generate SEO Blog
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {blog && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
            <div>
              <p className="font-semibold text-sm">SEO Blog Generated!</p>
              <p className="text-xs text-muted-foreground">
                Long-form structured article with FAQ, meta tags & social snippets.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearBlog}
              className="h-8 text-xs"
            >
              New Blog
            </Button>
          </div>

          {/* Meta Info */}
          <Card className="border-primary/30">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl font-bold leading-tight">{blog.title}</h2>
                <button onClick={() => copyText(blog.title, "title")} className="shrink-0 mt-1">
                  {copied === "title" ? (
                    <Check className="size-4 text-green-500" />
                  ) : (
                    <Copy className="size-4 text-muted-foreground" />
                  )}
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {blog.slug && (
                  <Badge variant="secondary" className="text-xs font-mono">
                    🔗 /{blog.slug}
                  </Badge>
                )}
                {blog.readTime && (
                  <Badge variant="outline" className="text-xs">
                    ⏱ {blog.readTime}
                  </Badge>
                )}
              </div>
              {blog.metaDescription && (
                <div className="border-l-2 border-primary pl-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-0.5">
                    META DESCRIPTION
                  </p>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-muted-foreground">{blog.metaDescription}</p>
                    <button
                      onClick={() => copyText(blog.metaDescription, "meta")}
                      className="shrink-0"
                    >
                      {copied === "meta" ? (
                        <Check className="size-3.5 text-green-500" />
                      ) : (
                        <Copy className="size-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Blog Sections */}
          {blog.sections?.map((s: any, i: number) => (
            <Card key={i} className={SECTION_COLORS[s.type] || ""}>
              <CardContent className="pt-4 space-y-2">
                {s.h2 && (
                  <h3 className="font-semibold text-base">{s.h2}</h3>
                )}
                {s.content && (
                  <p className="text-sm leading-relaxed">{s.content}</p>
                )}
                {s.faqs && s.faqs.length > 0 && (
                  <div className="space-y-3 mt-2">
                    {s.faqs.map((faq: any, j: number) => (
                      <div key={j} className="p-3 rounded-lg bg-background border space-y-1">
                        <p className="text-sm font-medium">Q: {faq.q}</p>
                        <p className="text-sm text-muted-foreground">A: {faq.a}</p>
                      </div>
                    ))}
                  </div>
                )}
                {s.type === "SECTION" && s.content && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => copyText(s.content, `section-${i}`)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {copied === `section-${i}` ? (
                        <Check className="size-3 text-green-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      Copy section
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Social Snippets */}
          {blog.socialSnippets?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">📱 Social Media Snippets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {blog.socialSnippets.map((s: string, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border">
                    <p className="text-sm flex-1">{s}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-primary"
                        onClick={() => {
                          setSelectedSnippet(s);
                          setIsScheduleOpen(true);
                        }}
                      >
                        <Calendar className="size-3 mr-1" /> Schedule
                      </Button>
                      <button onClick={() => copyText(s, `snippet-${i}`)} className="p-1">
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

      <ScheduleFromResearchDialog
        open={isScheduleOpen}
        onOpenChange={setIsScheduleOpen}
        mode="single"
        initialTopic={form.topic}
        initialContent={selectedSnippet || (blog?.title ? `${blog.title}\n\n${blog.summary || ""}` : form.topic)}
        suggestedFormat="FEED_POST"
        researchContext={{
          niche: form.topic,
        }}
      />
    </div>
  );
}
