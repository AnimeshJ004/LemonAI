# 🍋 LEMON AI — MEMBER 1 EXECUTION PLAN
## Domain: Competition Researcher UI + AI Content Studio
### Owner: YOU (Handle this file only)

---

> ⚠️ **CRITICAL RULE**: Only touch files listed under **"YOUR FILES"**. Never touch files owned by Member 2 or Member 3. This prevents ALL git merge conflicts.

---

## 📌 YOUR COMPLETE FILE OWNERSHIP MAP

```
YOUR FILES (CREATE THESE — They don't exist yet):
═══════════════════════════════════════════════════════

app/(routes)/(dashboard)/competition-researcher/
  └── page.tsx                                      ← YOU CREATE

app/(routes)/(dashboard)/studio/
  ├── layout.tsx                                    ← YOU CREATE
  ├── reels/page.tsx                                ← YOU CREATE
  ├── carousels/page.tsx                            ← YOU CREATE
  └── blogs/page.tsx                                ← YOU CREATE

components/competition/
  ├── research-form.tsx                             ← YOU CREATE
  ├── research-results-dashboard.tsx               ← YOU CREATE
  ├── competitor-card.tsx                           ← YOU CREATE
  ├── trending-hooks-panel.tsx                      ← YOU CREATE
  ├── recommended-hashtags.tsx                      ← YOU CREATE
  └── schedule-from-research-dialog.tsx             ← YOU CREATE

components/studio/
  ├── reels-script-generator.tsx                   ← YOU CREATE
  ├── carousel-slide-builder.tsx                   ← YOU CREATE
  ├── blog-article-writer.tsx                      ← YOU CREATE
  └── studio-output-card.tsx                       ← YOU CREATE

app/api/ai/competitor-analyze/
  └── route.ts                                     ← YOU CREATE

app/api/ai/studio-reels/
  └── route.ts                                     ← YOU CREATE

app/api/ai/studio-carousels/
  └── route.ts                                     ← YOU CREATE

app/api/ai/studio-blogs/
  └── route.ts                                     ← YOU CREATE

lib/db/
  └── 05-competitor-studio-tables.sql              ← YOU CREATE

YOUR FILES (MODIFY THESE — Already exist):
═══════════════════════════════════════════════════════

app/(routes)/(dashboard)/_common/app-sidebar.tsx   ← ADD YOUR NAV ITEMS ONLY
  → Add: "Competition Researcher" and "Content Studio" nav group
  → DO NOT touch existing nav items
```

---

## 🚫 DO NOT TOUCH (Owned by Other Members)

```
❌ components/meta-ads/*           → Member 2
❌ app/api/meta/*                  → Member 2
❌ inngest/functions/*             → Member 2
❌ components/social-automation/*  → Member 2
❌ app/(routes)/(dashboard)/crm/*  → Member 3
❌ app/(routes)/(dashboard)/analytics/* → Member 3
❌ components/crm/*                → Member 3
❌ app/api/crm/*                   → Member 3
❌ app/api/analytics/*             → Member 3
```

---

## 🗄️ STEP 1 — Run This SQL in Supabase First

Create file: `lib/db/05-competitor-studio-tables.sql` and run in Supabase SQL Editor:

```sql
-- ============================================================
-- COMPETITOR RESEARCH TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS competitor_researches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  niche           TEXT NOT NULL,
  target_audience TEXT,
  country         TEXT DEFAULT 'IN',
  competitor_urls TEXT[] DEFAULT '{}',
  research_data   JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE competitor_researches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS competitor_researches_policy ON competitor_researches;
CREATE POLICY competitor_researches_policy ON competitor_researches
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

-- ============================================================
-- STUDIO CONTENT DRAFTS TABLE (Reels, Carousels, Blogs)
-- ============================================================
CREATE TABLE IF NOT EXISTS studio_drafts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('REEL', 'CAROUSEL', 'BLOG', 'AD_CREATIVE')),
  title        TEXT,
  content_data JSONB NOT NULL DEFAULT '{}',
  status       TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'saved', 'scheduled')),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE studio_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS studio_drafts_policy ON studio_drafts;
CREATE POLICY studio_drafts_policy ON studio_drafts
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());
```

---

## 🔗 STEP 2 — Add Your Nav Items to Sidebar

Open `app/(routes)/(dashboard)/_common/app-sidebar.tsx`

Find the `mainNav` array (line ~25) and **ADD after the existing items**:

```typescript
// ADD THESE to mainNav array — do not remove existing items
{ name: "Research", href: "/competition-researcher", icon: Search },       // ADD
{ name: "Content Studio", href: "/studio/reels", icon: Clapperboard },    // ADD
```

Also add to the imports at top:
```typescript
import { Calendar, CreditCard, Lightbulb, Plus, PlusCircleIcon, Settings, Building2, Megaphone, Brain, Search, Clapperboard } from 'lucide-react';
```

---

## ⚙️ STEP 3 — Create API Endpoints

### `/api/ai/competitor-analyze/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { researchMarketTrends } from "@/lib/trend-researcher";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { niche, competitorUrls, targetAudience, country, businessName } = body;

  if (!niche || !targetAudience) {
    return NextResponse.json({ error: "niche and targetAudience required" }, { status: 400 });
  }

  const result = await researchMarketTrends({
    businessName: businessName || "My Business",
    niche,
    targetAudience,
    competitors: competitorUrls || [],
    targetRegion: country || "IN",
  });

  if (!result.success) {
    return NextResponse.json({ error: "Research failed" }, { status: 500 });
  }

  // Save to DB
  const admin = getInsforgeAdminClient();
  await admin.database.from("competitor_researches").insert({
    user_id: userId,
    niche,
    target_audience: targetAudience,
    country: country || "IN",
    competitor_urls: competitorUrls || [],
    research_data: result.data,
  });

  return NextResponse.json({ success: true, research: result.data });
}
```

### `/api/ai/studio-reels/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";
import { getBrandProfileForUser } from "@/lib/brand-helper";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { topic, tone, duration, targetAudience } = body;

  const brand = await getBrandProfileForUser(userId);
  const { insforge } = await getInsforgeServerClient();

  const systemPrompt = `You are a viral Reels Script Director. Generate a structured 60-second Reel script.
Return ONLY valid JSON:
{
  "hook": { "text": "0-3s scroll-stopping opening line", "visualCue": "what to show on screen" },
  "body": [
    { "second": "4-15", "script": "value point 1", "visualCue": "B-roll idea", "onScreenText": "caption overlay" },
    { "second": "16-30", "script": "value point 2", "visualCue": "B-roll idea", "onScreenText": "caption overlay" },
    { "second": "31-45", "script": "value point 3", "visualCue": "B-roll idea", "onScreenText": "caption overlay" }
  ],
  "cta": { "text": "46-60s closing CTA", "action": "Comment/Follow/Link in bio" },
  "caption": "Full Instagram caption with hashtags",
  "voiceoverTone": "Energetic/Calm/Authoritative",
  "musicMood": "Upbeat/Cinematic/Lo-fi"
}`;

  const completion = await insforge.ai.chat.completions.create({
    model: "google/gemini-3.8-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Business: ${brand?.business_name || "My Business"}. Topic: ${topic}. Tone: ${tone || brand?.brand_tone || "Professional"}. Target: ${targetAudience || brand?.target_audience || "general audience"}` }
    ]
  });

  const raw = completion.choices[0]?.message?.content || "";
  const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();
  
  try {
    const script = JSON.parse(clean);

    // Save draft
    const admin = getInsforgeAdminClient();
    await admin.database.from("studio_drafts").insert({
      user_id: userId,
      type: "REEL",
      title: topic,
      content_data: script,
    });

    return NextResponse.json({ success: true, script });
  } catch {
    return NextResponse.json({ error: "AI parse failed", raw }, { status: 500 });
  }
}
```

### `/api/ai/studio-carousels/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";
import { getBrandProfileForUser } from "@/lib/brand-helper";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { topic, platform, slides } = body;
  const slideCount = Math.min(Math.max(Number(slides || 7), 5), 10);

  const brand = await getBrandProfileForUser(userId);
  const { insforge } = await getInsforgeServerClient();

  const systemPrompt = `You are a carousel content strategist. Generate a ${slideCount}-slide carousel for ${platform || "Instagram"}.
Return ONLY valid JSON:
{
  "title": "Carousel topic title",
  "slides": [
    {
      "slideNumber": 1,
      "type": "COVER",
      "headline": "Bold cover title",
      "subtext": "Sub line",
      "visualSuggestion": "Design idea"
    },
    {
      "slideNumber": 2,
      "type": "CONTENT",
      "headline": "Slide headline",
      "bulletPoints": ["Point 1", "Point 2", "Point 3"],
      "swipePrompt": "Swipe to see →"
    }
  ],
  "caption": "Full post caption with hashtags",
  "cta": "Last slide call-to-action"
}`;

  const completion = await insforge.ai.chat.completions.create({
    model: "google/gemini-3.8-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Business: ${brand?.business_name}. Topic: ${topic}. Slides: ${slideCount}` }
    ]
  });

  const raw = completion.choices[0]?.message?.content || "";
  const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();

  try {
    const carousel = JSON.parse(clean);
    const admin = getInsforgeAdminClient();
    await admin.database.from("studio_drafts").insert({
      user_id: userId, type: "CAROUSEL", title: topic, content_data: carousel
    });
    return NextResponse.json({ success: true, carousel });
  } catch {
    return NextResponse.json({ error: "AI parse failed", raw }, { status: 500 });
  }
}
```

### `/api/ai/studio-blogs/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";
import { getBrandProfileForUser } from "@/lib/brand-helper";

export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { topic, keyword, wordCount } = body;

  const brand = await getBrandProfileForUser(userId);
  const { insforge } = await getInsforgeServerClient();

  const completion = await insforge.ai.chat.completions.create({
    model: "google/gemini-3.8-flash",
    messages: [
      { role: "system", content: `You are an expert SEO content writer. Write a complete long-form blog in JSON:
{
  "title": "SEO H1 title",
  "metaDescription": "155 char meta description",
  "slug": "url-friendly-slug",
  "readTime": "8 min read",
  "sections": [
    { "type": "INTRO", "h2": null, "content": "Opening paragraph" },
    { "type": "SECTION", "h2": "H2 heading", "content": "Body content" },
    { "type": "FAQ", "h2": "FAQs", "faqs": [{"q": "Question", "a": "Answer"}] },
    { "type": "CTA", "h2": null, "content": "Closing paragraph + CTA" }
  ],
  "socialSnippets": ["Short tweet", "LinkedIn post", "Instagram caption"]
}` },
      { role: "user", content: `Business: ${brand?.business_name}. Topic: ${topic}. Focus keyword: ${keyword || topic}. Target length: ~${wordCount || 1200} words.` }
    ]
  });

  const raw = completion.choices[0]?.message?.content || "";
  const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();

  try {
    const blog = JSON.parse(clean);
    const admin = getInsforgeAdminClient();
    await admin.database.from("studio_drafts").insert({
      user_id: userId, type: "BLOG", title: topic, content_data: blog
    });
    return NextResponse.json({ success: true, blog });
  } catch {
    return NextResponse.json({ error: "AI parse failed", raw }, { status: 500 });
  }
}
```

---

## 🖥️ STEP 4 — Create Pages

### `/app/(routes)/(dashboard)/competition-researcher/page.tsx`

```typescript
"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Search, TrendingUp, Hash, Target, Copy, Check } from "lucide-react";

export default function CompetitionResearcherPage() {
  const [form, setForm] = useState({ niche: "", targetAudience: "", competitorUrls: "", country: "IN", businessName: "" });
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/ai/competitor-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          competitorUrls: data.competitorUrls.split(",").map(s => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("Research failed");
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data.research);
      toast.success("Research complete!");
    },
    onError: () => toast.error("Research failed. Try again."),
  });

  const copyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopied(tag);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Search className="size-6 text-primary" /> Competition Researcher</h1>
        <p className="text-muted-foreground text-sm mt-1">AI analyses your market, competitors & extracts winning content angles automatically</p>
      </div>

      {/* Input Form */}
      <Card>
        <CardHeader><CardTitle className="text-base">Market Research Input</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Business Name</Label>
            <Input placeholder="e.g. FitLife Coach" value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Industry / Niche *</Label>
            <Input placeholder="e.g. High-ticket fitness coaching" value={form.niche} onChange={e => setForm(f => ({ ...f, niche: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Target Audience *</Label>
            <Input placeholder="e.g. Busy professionals aged 28-45" value={form.targetAudience} onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Target Country</Label>
            <Select value={form.country} onValueChange={v => setForm(f => ({ ...f, country: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">🇮🇳 India</SelectItem>
                <SelectItem value="US">🇺🇸 United States</SelectItem>
                <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                <SelectItem value="AE">🇦🇪 UAE</SelectItem>
                <SelectItem value="GLOBAL">🌍 Global</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Competitor Handles / URLs (comma-separated)</Label>
            <Textarea placeholder="instagram.com/competitor1, competitor2.com, @handle3" value={form.competitorUrls} onChange={e => setForm(f => ({ ...f, competitorUrls: e.target.value }))} rows={2} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => mutate(form)} disabled={isPending || !form.niche || !form.targetAudience} className="w-full" size="lg">
              {isPending ? <><Sparkles className="size-4 mr-2 animate-spin" /> Researching Market...</> : <><Sparkles className="size-4 mr-2" /> Run AI Market Research</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Trending Hooks */}
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="size-4 text-orange-500" /> Top Trending Hooks</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {result.topTrendingHooks?.map((h: any, i: number) => (
                <div key={i} className="p-3 rounded-lg border bg-muted/30 space-y-1">
                  <Badge variant="secondary" className="text-xs">{h.hookType}</Badge>
                  <p className="font-semibold text-sm">{h.hook}</p>
                  <p className="text-xs text-muted-foreground">🎯 {h.targetEmotion}</p>
                  <p className="text-xs text-muted-foreground italic">{h.whyItWorks}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Competitor Weaknesses */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="size-4 text-red-500" /> Competitor Weaknesses to Exploit</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.competitorWeaknessesToExploit?.map((w: string, i: number) => (
                  <li key={i} className="flex gap-2 text-sm"><span className="text-green-500 mt-0.5">✓</span>{w}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Hashtags */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Hash className="size-4 text-blue-500" /> Recommended Hashtags</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {result.recommendedHashtags?.map((tag: string, i: number) => (
                <button key={i} onClick={() => copyTag(tag)} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs border bg-primary/5 hover:bg-primary/15 transition-colors">
                  {copied === tag ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
                  {tag}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Content Angles */}
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-base">🎯 Recommended Content Angles</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {result.recommendedContentAngles?.map((a: any, i: number) => (
                <div key={i} className="p-3 rounded-lg border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{a.angleTitle}</span>
                    <Badge>{a.suggestedFormat}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground italic">"{a.shortHook}"</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
```

### `/app/(routes)/(dashboard)/studio/layout.tsx`

```typescript
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

### `/app/(routes)/(dashboard)/studio/reels/page.tsx`

```typescript
"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clapperboard, Sparkles, Clock } from "lucide-react";

export default function ReelsStudioPage() {
  const [form, setForm] = useState({ topic: "", tone: "Energetic", targetAudience: "" });
  const [script, setScript] = useState<any>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/ai/studio-reels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => { setScript(data.script); toast.success("Reel script generated!"); },
    onError: () => toast.error("Generation failed"),
  });

  return (
    <div className="max-w-4xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Clapperboard className="size-6 text-primary" /> Reels Script Studio</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate viral 60-second Reel scripts with Hook, Body & CTA</p>
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Reel Topic *</Label>
            <Input placeholder="e.g. 3 signs you need a business coach" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Voice Tone</Label>
            <Select value={form.tone} onValueChange={v => setForm(f => ({ ...f, tone: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Energetic">⚡ Energetic</SelectItem>
                <SelectItem value="Authoritative">🎯 Authoritative</SelectItem>
                <SelectItem value="Casual">😊 Casual</SelectItem>
                <SelectItem value="Inspirational">✨ Inspirational</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Target Audience</Label>
            <Input placeholder="e.g. Small business owners" value={form.targetAudience} onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => mutate(form)} disabled={isPending || !form.topic} className="w-full" size="lg">
              {isPending ? <><Sparkles className="size-4 mr-2 animate-spin" />Generating Script...</> : <><Sparkles className="size-4 mr-2" />Generate Reel Script</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {script && (
        <div className="space-y-4">
          {/* Hook */}
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="size-4" /> 🎣 HOOK (0-3 seconds)</CardTitle></CardHeader>
            <CardContent>
              <p className="font-bold text-lg">"{script.hook?.text}"</p>
              <p className="text-xs text-muted-foreground mt-1">📷 Visual: {script.hook?.visualCue}</p>
            </CardContent>
          </Card>

          {/* Body */}
          {script.body?.map((b: any, i: number) => (
            <Card key={i}>
              <CardHeader><CardTitle className="text-sm">⏱ {b.second}s — Value Point {i + 1}</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <p className="text-sm font-medium">{b.script}</p>
                <p className="text-xs text-muted-foreground">📷 B-roll: {b.visualCue}</p>
                <p className="text-xs text-muted-foreground">📝 On-screen text: {b.onScreenText}</p>
              </CardContent>
            </Card>
          ))}

          {/* CTA */}
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader><CardTitle className="text-sm">📣 CTA (46-60 seconds)</CardTitle></CardHeader>
            <CardContent>
              <p className="font-bold">{script.cta?.text}</p>
              <Badge className="mt-1">{script.cta?.action}</Badge>
            </CardContent>
          </Card>

          {/* Caption */}
          <Card>
            <CardHeader><CardTitle className="text-sm">📱 Instagram Caption</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs whitespace-pre-wrap bg-muted/40 p-3 rounded-lg">{script.caption}</pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
```

### `/app/(routes)/(dashboard)/studio/carousels/page.tsx`

```typescript
"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayoutTemplate, Sparkles } from "lucide-react";

export default function CarouselStudioPage() {
  const [form, setForm] = useState({ topic: "", platform: "Instagram", slides: 7 });
  const [carousel, setCarousel] = useState<any>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/ai/studio-carousels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => { setCarousel(data.carousel); toast.success("Carousel created!"); },
    onError: () => toast.error("Generation failed"),
  });

  return (
    <div className="max-w-4xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><LayoutTemplate className="size-6 text-primary" /> Carousel Creator</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate multi-slide carousels for Instagram & LinkedIn</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Carousel Topic *</Label>
            <Input placeholder="e.g. 7 mistakes new entrepreneurs make" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Instagram">📸 Instagram</SelectItem>
                  <SelectItem value="LinkedIn">💼 LinkedIn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Slides: {form.slides}</Label>
              <Slider min={5} max={10} step={1} value={[form.slides]} onValueChange={([v]) => setForm(f => ({ ...f, slides: v }))} className="mt-2" />
            </div>
          </div>
          <Button onClick={() => mutate(form)} disabled={isPending || !form.topic} className="w-full" size="lg">
            {isPending ? <><Sparkles className="size-4 mr-2 animate-spin" />Creating Carousel...</> : <><Sparkles className="size-4 mr-2" />Generate Carousel</>}
          </Button>
        </CardContent>
      </Card>

      {carousel && (
        <div className="space-y-3">
          {carousel.slides?.map((slide: any, i: number) => (
            <Card key={i} className={i === 0 ? "border-primary/40 bg-primary/5" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Slide {slide.slideNumber}</CardTitle>
                  <Badge variant={i === 0 ? "default" : "secondary"}>{slide.type}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="font-bold">{slide.headline}</p>
                {slide.subtext && <p className="text-sm text-muted-foreground">{slide.subtext}</p>}
                {slide.bulletPoints && <ul className="list-disc list-inside space-y-0.5">{slide.bulletPoints.map((bp: string, j: number) => <li key={j} className="text-sm">{bp}</li>)}</ul>}
                {slide.swipePrompt && <p className="text-xs text-primary font-medium">{slide.swipePrompt}</p>}
                {slide.visualSuggestion && <p className="text-xs text-muted-foreground">🎨 Design: {slide.visualSuggestion}</p>}
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Caption</p>
              <pre className="text-xs whitespace-pre-wrap bg-muted/40 p-3 rounded-lg">{carousel.caption}</pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
```

### `/app/(routes)/(dashboard)/studio/blogs/page.tsx`

```typescript
"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Sparkles } from "lucide-react";

export default function BlogStudioPage() {
  const [form, setForm] = useState({ topic: "", keyword: "", wordCount: 1200 });
  const [blog, setBlog] = useState<any>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/ai/studio-blogs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => { setBlog(data.blog); toast.success("Blog generated!"); },
    onError: () => toast.error("Generation failed"),
  });

  return (
    <div className="max-w-4xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="size-6 text-primary" /> SEO Blog Writer</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate long-form SEO blogs with meta tags, FAQs & social snippets</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Blog Topic *</Label>
              <Input placeholder="e.g. How to grow on Instagram in 2025" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Focus Keyword</Label>
              <Input placeholder="e.g. Instagram growth tips" value={form.keyword} onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Target Word Count: ~{form.wordCount} words</Label>
            <Slider min={600} max={2500} step={100} value={[form.wordCount]} onValueChange={([v]) => setForm(f => ({ ...f, wordCount: v }))} />
          </div>
          <Button onClick={() => mutate(form)} disabled={isPending || !form.topic} className="w-full" size="lg">
            {isPending ? <><Sparkles className="size-4 mr-2 animate-spin" />Writing Blog...</> : <><Sparkles className="size-4 mr-2" />Generate Blog</>}
          </Button>
        </CardContent>
      </Card>

      {blog && (
        <div className="space-y-4">
          <Card className="border-primary/30">
            <CardContent className="pt-4 space-y-2">
              <h2 className="text-xl font-bold">{blog.title}</h2>
              <div className="flex gap-2">
                <Badge variant="secondary">🔗 /{blog.slug}</Badge>
                <Badge variant="outline">⏱ {blog.readTime}</Badge>
              </div>
              <p className="text-sm text-muted-foreground border-l-2 border-primary pl-3">{blog.metaDescription}</p>
            </CardContent>
          </Card>
          {blog.sections?.map((s: any, i: number) => (
            <Card key={i}>
              <CardContent className="pt-4 space-y-1">
                {s.h2 && <h3 className="font-semibold text-base">{s.h2}</h3>}
                {s.content && <p className="text-sm leading-relaxed">{s.content}</p>}
                {s.faqs && s.faqs.map((faq: any, j: number) => (
                  <div key={j} className="mt-2 p-2 rounded bg-muted/40">
                    <p className="text-sm font-medium">Q: {faq.q}</p>
                    <p className="text-sm text-muted-foreground">A: {faq.a}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
          {blog.socialSnippets && (
            <Card>
              <CardHeader><CardTitle className="text-sm">📱 Social Media Snippets</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {blog.socialSnippets.map((s: string, i: number) => (
                  <p key={i} className="text-sm p-2 rounded bg-muted/40">{s}</p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## ✅ TASK CHECKLIST

```
STEP 1 — DATABASE
[ ] Run lib/db/05-competitor-studio-tables.sql in Supabase SQL Editor

STEP 2 — SIDEBAR
[ ] Open app/(routes)/(dashboard)/_common/app-sidebar.tsx
[ ] Add Search and Clapperboard to lucide imports
[ ] Add "Research" and "Content Studio" to mainNav array

STEP 3 — API ROUTES (Create these files)
[ ] app/api/ai/competitor-analyze/route.ts
[ ] app/api/ai/studio-reels/route.ts
[ ] app/api/ai/studio-carousels/route.ts
[ ] app/api/ai/studio-blogs/route.ts

STEP 4 — PAGES (Create these files)
[ ] app/(routes)/(dashboard)/competition-researcher/page.tsx
[ ] app/(routes)/(dashboard)/studio/layout.tsx
[ ] app/(routes)/(dashboard)/studio/reels/page.tsx
[ ] app/(routes)/(dashboard)/studio/carousels/page.tsx
[ ] app/(routes)/(dashboard)/studio/blogs/page.tsx

STEP 5 — TEST
[ ] npm run dev
[ ] Visit /competition-researcher → fill form → verify AI research shows
[ ] Visit /studio/reels → generate script → verify hook/body/CTA shows
[ ] Visit /studio/carousels → generate → verify slides show
[ ] Visit /studio/blogs → generate → verify full blog shows
[ ] Check Supabase: competitor_researches and studio_drafts tables have rows
```

---

## 🏗️ Flow Diagram

```
USER INPUT (niche, competitors, country)
          │
          ▼
/api/ai/competitor-analyze
          │
          ▼
lib/trend-researcher.ts → Gemini AI (Search Grounding)
          │
          ▼
Saves to competitor_researches table
          │
          ▼
UI: Trending Hooks + Hashtags + Content Angles shown
          │
          ▼
"Generate Post" → calls /api/ai/auto-pilot (already built by base)

─────────────────────────────────────

USER OPENS CONTENT STUDIO
          │
    ┌─────┼────────┐
    ▼     ▼        ▼
 Reels Carousels  Blogs
    │     │        │
    ▼     ▼        ▼
 /api/ai/studio-[type]
    │     │        │
    ▼     ▼        ▼
Gemini AI generates structured JSON script
    │     │        │
    ▼     ▼        ▼
Saved to studio_drafts table
    │     │        │
    ▼     ▼        ▼
UI renders formatted output with copy buttons
```

---

*Member 1 Plan — Lemon AI Engineering | September 2026*

---

---

# 🔴 PHASE 2 — CRITICAL GAP TASKS (Member 1)
## Gaps from Sir's Requirements NOT yet covered

---

## 🎨 GAP 1: Ad Creatives Studio Page
> **Sir's Requirement:** `AI Content Studio → Ad Creatives`

### New Files to Create:
```
app/(routes)/(dashboard)/studio/ad-creatives/
  └── page.tsx                                     ← YOU CREATE

app/api/ai/studio-ad-creatives/
  └── route.ts                                     ← YOU CREATE
```

### `/app/api/ai/studio-ad-creatives/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";
import { getBrandProfileForUser } from "@/lib/brand-helper";
import { generateAdCreativeImage } from "@/lib/ai-image-generator";

export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { objective, targetAudience, offer, platform, generateImage } = body;

  const brand = await getBrandProfileForUser(userId);
  const { insforge } = await getInsforgeServerClient();

  const completion = await insforge.ai.chat.completions.create({
    model: "google/gemini-3.8-flash",
    messages: [{
      role: "user",
      content: `You are a world-class Meta Ads copywriter for ${brand?.business_name || "a business"}.
Generate 3 high-converting ad creative variations for ${platform || "Meta Ads (Instagram + Facebook)"}.
Objective: ${objective || "Lead Generation"}
Offer: ${offer}
Target Audience: ${targetAudience || brand?.target_audience || "general"}

Return ONLY valid JSON:
{
  "variations": [
    {
      "variationName": "Hook-Lead (Curiosity)",
      "primaryText": "Full ad body copy (3-4 sentences)",
      "headline": "Short punchy headline (max 7 words)",
      "description": "Supporting description line",
      "callToAction": "LEARN_MORE",
      "visualPrompt": "Detailed image generation prompt for this ad",
      "whyItWorks": "Brief explanation of the psychology used"
    }
  ]
}`,
    }],
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();

  try {
    const result = JSON.parse(clean);
    const variations = result.variations || [];

    // Generate image for first variation if requested
    if (generateImage && variations.length > 0) {
      try {
        const imgRes = await generateAdCreativeImage({
          prompt: variations[0].visualPrompt,
          aspectRatio: "4:5",
          userId,
          niche: brand?.niche || "",
        });
        if (imgRes.success && imgRes.imageUrl) {
          variations[0].imageUrl = imgRes.imageUrl;
        }
      } catch {}
    }

    // Save to studio_drafts
    const admin = getInsforgeAdminClient();
    await admin.database.from("studio_drafts").insert({
      user_id: userId,
      type: "AD_CREATIVE",
      title: offer || "Ad Creative",
      content_data: { objective, platform, variations },
    });

    return NextResponse.json({ success: true, variations });
  } catch {
    return NextResponse.json({ error: "Parse failed", raw }, { status: 500 });
  }
}
```

### `/app/(routes)/(dashboard)/studio/ad-creatives/page.tsx`

```typescript
"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Sparkles, Copy, Check, Image as ImageIcon } from "lucide-react";

export default function AdCreativesStudioPage() {
  const [form, setForm] = useState({ objective: "LEAD_GENERATION", offer: "", targetAudience: "", platform: "Meta Ads", generateImage: false });
  const [variations, setVariations] = useState<any[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/ai/studio-ad-creatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => { setVariations(data.variations || []); toast.success("3 ad variations generated!"); },
    onError: () => toast.error("Generation failed"),
  });

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone className="size-6 text-primary" /> Ad Creatives Studio</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate 3 high-converting ad copy variations with AI — ready for Meta Ads</p>
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Campaign Objective *</Label>
            <Select value={form.objective} onValueChange={v => setForm(f => ({ ...f, objective: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LEAD_GENERATION">🎯 Lead Generation</SelectItem>
                <SelectItem value="SALES">💰 Sales / Conversions</SelectItem>
                <SelectItem value="BRAND_AWARENESS">📢 Brand Awareness</SelectItem>
                <SelectItem value="TRAFFIC">🌐 Website Traffic</SelectItem>
                <SelectItem value="ENGAGEMENT">❤️ Engagement</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ad Platform</Label>
            <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Meta Ads">📘 Meta Ads (Facebook + Instagram)</SelectItem>
                <SelectItem value="Instagram Only">📸 Instagram Only</SelectItem>
                <SelectItem value="Facebook Only">📘 Facebook Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Your Offer / Product *</Label>
            <Input placeholder="e.g. 30-day fitness transformation program at ₹4,999" value={form.offer} onChange={e => setForm(f => ({ ...f, offer: e.target.value }))} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Target Audience</Label>
            <Input placeholder="e.g. Men 25-40 in Mumbai who want to lose weight" value={form.targetAudience} onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <Switch checked={form.generateImage} onCheckedChange={v => setForm(f => ({ ...f, generateImage: v }))} id="gen-img" />
            <Label htmlFor="gen-img" className="cursor-pointer">Generate AI image for first variation <span className="text-muted-foreground text-xs">(takes longer)</span></Label>
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => mutate(form)} disabled={isPending || !form.offer} className="w-full" size="lg">
              {isPending ? <><Sparkles className="size-4 mr-2 animate-spin" /> Generating 3 Variations...</> : <><Sparkles className="size-4 mr-2" /> Generate 3 Ad Variations</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {variations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {variations.map((v: any, i: number) => (
            <Card key={i} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{v.variationName}</CardTitle>
                  <Badge variant="secondary" className="text-xs">{v.callToAction}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 flex-1">
                {v.imageUrl && <img src={v.imageUrl} alt="Ad Creative" className="w-full rounded-lg object-cover aspect-square" />}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">HEADLINE</p>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold">{v.headline}</p>
                    <button onClick={() => copyText(v.headline, `h-${i}`)} className="shrink-0">
                      {copied === `h-${i}` ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5 text-muted-foreground" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">PRIMARY TEXT</p>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs leading-relaxed">{v.primaryText}</p>
                    <button onClick={() => copyText(v.primaryText, `p-${i}`)} className="shrink-0 mt-0.5">
                      {copied === `p-${i}` ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5 text-muted-foreground" />}
                    </button>
                  </div>
                </div>
                {v.description && <p className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-2">{v.description}</p>}
                {v.whyItWorks && <p className="text-xs bg-primary/5 border border-primary/20 rounded p-2 mt-2">💡 {v.whyItWorks}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Add to Sidebar (Step 2 of your original plan):
```typescript
// Add this to the studio nav group in app-sidebar.tsx
{ name: "Ad Creatives", href: "/studio/ad-creatives", icon: Megaphone },
```

---

## 📅 GAP 2: Content Strategy / Growth Plan Page
> **Sir's Requirement:** `Marketing Strategy → Content Strategy, Campaign Strategy, Growth Plan`

### New Files to Create:
```
app/(routes)/(dashboard)/studio/strategy/
  └── page.tsx                                     ← YOU CREATE

app/api/ai/studio-strategy/
  └── route.ts                                     ← YOU CREATE
```

### `/app/api/ai/studio-strategy/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeServerClient } from "@/lib/insforge-server";
import { getBrandProfileForUser } from "@/lib/brand-helper";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { goal, timeframe, platforms } = body;

  const brand = await getBrandProfileForUser(userId);
  const { insforge } = await getInsforgeServerClient();

  const completion = await insforge.ai.chat.completions.create({
    model: "google/gemini-3.8-flash",
    messages: [{
      role: "user",
      content: `You are a senior social media strategist.
Create a complete ${timeframe || "30-day"} content strategy for ${brand?.business_name || "this business"} in ${brand?.niche || "their industry"}.
Primary Goal: ${goal || "Brand Awareness & Lead Generation"}
Target Platforms: ${(platforms || ["Instagram", "Facebook"]).join(", ")}
Target Audience: ${brand?.target_audience || "target customers"}

Return ONLY valid JSON:
{
  "strategyOverview": "2-sentence executive summary",
  "contentPillars": [
    { "name": "Pillar name", "percentage": 30, "description": "What to post", "exampleTopics": ["Topic 1", "Topic 2", "Topic 3"] }
  ],
  "weeklySchedule": [
    { "day": "Monday", "contentType": "REEL", "pillar": "Educational", "topic": "Specific topic idea" }
  ],
  "kpis": [
    { "metric": "Reach", "target": "10,000/month", "howToMeasure": "Instagram Insights" }
  ],
  "quickWins": ["Action you can do today", "Action for this week"],
  "monthlyMilestones": [
    { "week": "Week 1", "focus": "What to focus on", "goal": "Specific measurable goal" }
  ]
}`,
    }],
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();

  try {
    const strategy = JSON.parse(clean);
    return NextResponse.json({ success: true, strategy });
  } catch {
    return NextResponse.json({ error: "Parse failed", raw }, { status: 500 });
  }
}
```

### `/app/(routes)/(dashboard)/studio/strategy/page.tsx`

```typescript
"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { TrendingUp, Sparkles, Target, Calendar, CheckCircle, BarChart } from "lucide-react";

const PLATFORMS = ["Instagram", "Facebook", "LinkedIn", "YouTube", "X (Twitter)"];
const PILLAR_COLORS = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-pink-500"];

export default function ContentStrategyPage() {
  const [form, setForm] = useState({ goal: "LEAD_GENERATION", timeframe: "30-day", platforms: ["Instagram", "Facebook"] });
  const [strategy, setStrategy] = useState<any>(null);

  const togglePlatform = (p: string) => {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
    }));
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/ai/studio-strategy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => { setStrategy(data.strategy); toast.success("Strategy generated!"); },
    onError: () => toast.error("Generation failed"),
  });

  const DAY_COLORS: Record<string, string> = { REEL: "bg-orange-100 text-orange-700", CAROUSEL: "bg-blue-100 text-blue-700", FEED_POST: "bg-green-100 text-green-700", BLOG: "bg-purple-100 text-purple-700", STORY: "bg-pink-100 text-pink-700" };

  return (
    <div className="max-w-5xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="size-6 text-primary" /> Content Strategy Planner</h1>
        <p className="text-muted-foreground text-sm mt-1">AI builds your complete 30-day content strategy, pillars & weekly schedule</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Primary Goal</Label>
              <Select value={form.goal} onValueChange={v => setForm(f => ({ ...f, goal: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LEAD_GENERATION">🎯 Lead Generation</SelectItem>
                  <SelectItem value="BRAND_AWARENESS">📢 Brand Awareness</SelectItem>
                  <SelectItem value="SALES">💰 Direct Sales</SelectItem>
                  <SelectItem value="COMMUNITY">👥 Community Building</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Timeframe</Label>
              <Select value={form.timeframe} onValueChange={v => setForm(f => ({ ...f, timeframe: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7-day">7 Days</SelectItem>
                  <SelectItem value="14-day">14 Days</SelectItem>
                  <SelectItem value="30-day">30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Platforms (select all that apply)</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button key={p} onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${form.platforms.includes(p) ? "bg-primary text-white border-primary" : "bg-background border-border hover:border-primary/50"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={() => mutate(form)} disabled={isPending || form.platforms.length === 0} className="w-full" size="lg">
            {isPending ? <><Sparkles className="size-4 mr-2 animate-spin" /> Building Strategy...</> : <><Sparkles className="size-4 mr-2" /> Generate Content Strategy</>}
          </Button>
        </CardContent>
      </Card>

      {strategy && (
        <div className="space-y-4">
          {/* Overview */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4">
              <p className="text-sm font-medium">{strategy.strategyOverview}</p>
            </CardContent>
          </Card>

          {/* Content Pillars */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="size-4" /> Content Pillars</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {strategy.contentPillars?.map((p: any, i: number) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.percentage}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${PILLAR_COLORS[i % PILLAR_COLORS.length]} rounded-full`} style={{ width: `${p.percentage}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                  <div className="flex flex-wrap gap-1">{p.exampleTopics?.map((t: string, j: number) => <Badge key={j} variant="outline" className="text-xs">{t}</Badge>)}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Weekly Schedule */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="size-4" /> Weekly Content Schedule</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {strategy.weeklySchedule?.map((day: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg border">
                    <span className="text-xs font-semibold w-16 shrink-0">{day.day}</span>
                    <Badge className={`text-xs shrink-0 ${DAY_COLORS[day.contentType] || "bg-gray-100 text-gray-700"}`}>{day.contentType}</Badge>
                    <p className="text-xs text-muted-foreground truncate">{day.topic}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Wins */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle className="size-4 text-green-500" /> Quick Wins</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {strategy.quickWins?.map((w: string, i: number) => (
                  <li key={i} className="flex gap-2 text-sm"><span className="text-green-500">✓</span>{w}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* KPIs */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart className="size-4" /> KPIs to Track</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {strategy.kpis?.map((kpi: any, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-muted/40 space-y-0.5">
                  <p className="text-xs font-semibold">{kpi.metric}</p>
                  <p className="text-sm font-bold text-primary">{kpi.target}</p>
                  <p className="text-xs text-muted-foreground">{kpi.howToMeasure}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
```

### Add to Sidebar:
```typescript
{ name: "Strategy Planner", href: "/studio/strategy", icon: TrendingUp },
```

---

## ✅ PHASE 2 TASK CHECKLIST (Member 1 Additional)

```
GAP 1 — AD CREATIVES STUDIO
[x] Create app/api/ai/studio-ad-creatives/route.ts
[x] Create app/(routes)/(dashboard)/studio/ad-creatives/page.tsx
[x] Add "Ad Creatives" to sidebar nav

GAP 2 — CONTENT STRATEGY PAGE
[x] Create app/api/ai/studio-strategy/route.ts
[x] Create app/(routes)/(dashboard)/studio/strategy/page.tsx
[x] Add "Strategy Planner" to sidebar nav

TEST
[x] Visit /studio/ad-creatives → enter offer → verify 3 variations generate
[x] Visit /studio/strategy → select goal + platforms → verify strategy shows with pillars + schedule
```

---

## 🗺️ MEMBER 1 COMPLETE FILE MAP (All Phases)

```
Phase 1 (Original):
  ✅ /competition-researcher/page.tsx
  ✅ /studio/reels/page.tsx
  ✅ /studio/carousels/page.tsx
  ✅ /studio/blogs/page.tsx
  ✅ /api/ai/competitor-analyze/route.ts
  ✅ /api/ai/studio-reels/route.ts
  ✅ /api/ai/studio-carousels/route.ts
  ✅ /api/ai/studio-blogs/route.ts
  ✅ lib/db/05-competitor-studio-tables.sql

Phase 2 (Gap Fill):
  ✅ /studio/ad-creatives/page.tsx
  ✅ /studio/strategy/page.tsx
  ✅ /api/ai/studio-ad-creatives/route.ts
  ✅ /api/ai/studio-strategy/route.ts
```

---

*Member 1 Plan — Lemon AI Engineering | September 2026 (Updated with Gap Tasks)*
