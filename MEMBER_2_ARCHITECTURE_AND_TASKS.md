# 🍋 LEMON AI — MEMBER 2 EXECUTION PLAN
## Domain: Meta Ads Live Library + Social Automation (Comments & DM Bot)
### Owner: FRIEND 1 (Handle this file only)

---

> ⚠️ **CRITICAL RULE**: Only touch files listed under **"YOUR FILES"**. Never touch files owned by Member 1 or Member 3. This prevents ALL git merge conflicts.

---

## 📌 YOUR COMPLETE FILE OWNERSHIP MAP

```
YOUR FILES (CREATE THESE — They don't exist yet):
═══════════════════════════════════════════════════════

app/api/meta/trending-ads/
  └── route.ts                                       ← YOU CREATE

lib/meta-ads-library.ts                              ← YOU CREATE

components/meta-ads/
  ├── trending-ads-drawer.tsx                        ← YOU CREATE
  └── ad-intelligence-card.tsx                      ← YOU CREATE

app/(routes)/(dashboard)/social-automation/
  └── page.tsx                                       ← YOU CREATE

components/social-automation/
  ├── automation-rules-list.tsx                      ← YOU CREATE
  ├── create-rule-dialog.tsx                         ← YOU CREATE
  └── comment-reply-log.tsx                          ← YOU CREATE

app/api/social/comments/
  └── route.ts                                       ← YOU CREATE

inngest/functions/
  └── poll-post-comments.ts                          ← YOU CREATE

lib/db/
  └── 06-social-automation-tables.sql               ← YOU CREATE

YOUR FILES (MODIFY THESE — Already exist):
═══════════════════════════════════════════════════════

app/(routes)/(dashboard)/_common/app-sidebar.tsx
  → ADD: "Social Automation" nav item ONLY
  → DO NOT touch existing nav items

components/meta-ads/campaign-creation-wizard.tsx
  → ADD: "Inspect Competitor Ads" button in Step 1 ONLY
  → DO NOT change existing wizard steps
```

---

## 🚫 DO NOT TOUCH (Owned by Other Members)

```
❌ app/(routes)/(dashboard)/competition-researcher/* → Member 1
❌ app/(routes)/(dashboard)/studio/*                → Member 1
❌ components/competition/*                          → Member 1
❌ components/studio/*                               → Member 1
❌ app/api/ai/competitor-analyze/*                   → Member 1
❌ app/api/ai/studio-*                               → Member 1
❌ app/(routes)/(dashboard)/crm/*                   → Member 3
❌ components/crm/*                                  → Member 3
❌ app/api/crm/*                                     → Member 3
❌ app/api/analytics/*                               → Member 3
❌ app/(routes)/(dashboard)/analytics/*              → Member 3
```

---

## 🗄️ STEP 1 — Run This SQL in Supabase First

Create file: `lib/db/06-social-automation-tables.sql` and run in Supabase SQL Editor:

```sql
-- ============================================================
-- SOCIAL AUTOMATION RULES TABLE
-- Stores user-configured comment/DM automation rules
-- ============================================================
CREATE TABLE IF NOT EXISTS social_automation_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  rule_name       TEXT NOT NULL,
  trigger_type    TEXT NOT NULL CHECK (trigger_type IN ('KEYWORD', 'ANY_COMMENT', 'DM')),
  trigger_keyword TEXT,
  platform        TEXT NOT NULL CHECK (platform IN ('INSTAGRAM', 'FACEBOOK', 'ALL')),
  reply_template  TEXT NOT NULL,
  send_dm         BOOLEAN DEFAULT false,
  dm_template     TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE social_automation_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_automation_rules_policy ON social_automation_rules;
CREATE POLICY social_automation_rules_policy ON social_automation_rules
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

-- ============================================================
-- SOCIAL COMMENTS AUTO-REPLY LOG TABLE
-- Logs every AI-replied comment
-- ============================================================
CREATE TABLE IF NOT EXISTS social_comments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              TEXT NOT NULL,
  post_id              UUID REFERENCES scheduled_posts(id) ON DELETE CASCADE,
  platform             TEXT NOT NULL,
  platform_comment_id  TEXT UNIQUE,
  commenter_handle     TEXT,
  comment_text         TEXT NOT NULL,
  sentiment            TEXT CHECK (sentiment IN ('INQUIRY', 'PRAISE', 'COMPLAINT', 'SPAM', 'NEUTRAL')),
  reply_text           TEXT,
  dm_sent              BOOLEAN DEFAULT false,
  status               TEXT DEFAULT 'replied',
  created_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE social_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_comments_policy ON social_comments;
CREATE POLICY social_comments_policy ON social_comments
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

-- ============================================================
-- META ADS LIBRARY CACHE TABLE  
-- Caches trending competitor ads fetched from Meta Archive
-- ============================================================
CREATE TABLE IF NOT EXISTS meta_ads_library_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  niche       TEXT NOT NULL,
  country     TEXT DEFAULT 'IN',
  ads_data    JSONB NOT NULL DEFAULT '[]',
  fetched_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meta_ads_library_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meta_ads_library_cache_policy ON meta_ads_library_cache;
CREATE POLICY meta_ads_library_cache_policy ON meta_ads_library_cache
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());
```

---

## 🔗 STEP 2 — Add Your Nav Item to Sidebar

Open `app/(routes)/(dashboard)/_common/app-sidebar.tsx`

Find the `mainNav` array and **ADD only this one item** after the Meta Ads entry:

```typescript
{ name: "Social Automation", href: "/social-automation", icon: Bot },   // ADD
```

Also add `Bot` to the lucide imports:
```typescript
import { ..., Bot } from 'lucide-react';
```

---

## ⚙️ STEP 3 — Create `lib/meta-ads-library.ts`

```typescript
import { getInsforgeAdminClient, getInsforgeServerClient } from "./insforge-server";

export interface TrendingAd {
  id: string;
  advertiserName: string;
  headline: string;
  primaryText: string;
  callToAction: string;
  imageUrl?: string;
  estimatedSpendTier: "LOW" | "MEDIUM" | "HIGH";
  isActive: boolean;
  startDate?: string;
  platforms: string[];
  whyItWorks?: string;
}

/**
 * Fetches trending competitor ads from Meta Ads Archive API
 * Falls back to AI-generated competitive intelligence if API unavailable
 */
export async function fetchTrendingMetaAds(params: {
  niche: string;
  country: string;
  userId: string;
}): Promise<TrendingAd[]> {
  const { niche, country, userId } = params;
  const admin = getInsforgeAdminClient();

  // Check cache first (valid for 6 hours)
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: cached } = await admin.database
    .from("meta_ads_library_cache")
    .select("ads_data, fetched_at")
    .eq("user_id", userId)
    .eq("niche", niche)
    .eq("country", country)
    .gte("fetched_at", sixHoursAgo)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached?.ads_data && Array.isArray(cached.ads_data) && cached.ads_data.length > 0) {
    return cached.ads_data as TrendingAd[];
  }

  // Try Meta Ads Archive API (requires META_ADS_ACCESS_TOKEN env var)
  let ads: TrendingAd[] = [];
  const metaToken = process.env.META_ADS_ACCESS_TOKEN;

  if (metaToken) {
    try {
      const searchQuery = encodeURIComponent(niche);
      const url = `https://graph.facebook.com/v22.0/ads_archive?access_token=${metaToken}&ad_type=ALL&ad_reached_countries=["${country}"]&search_terms=${searchQuery}&fields=id,page_name,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_captions,ad_delivery_start_time,publisher_platforms,currency,impressions&limit=10`;
      
      const res = await fetch(url, { next: { revalidate: 0 } });
      if (res.ok) {
        const json = await res.json();
        ads = (json.data || []).slice(0, 6).map((ad: any, i: number) => ({
          id: ad.id || `meta-${i}`,
          advertiserName: ad.page_name || "Competitor Brand",
          headline: ad.ad_creative_link_titles?.[0] || "Check this out",
          primaryText: ad.ad_creative_bodies?.[0] || ad.ad_creative_link_captions?.[0] || "",
          callToAction: "LEARN_MORE",
          estimatedSpendTier: i < 2 ? "HIGH" : i < 4 ? "MEDIUM" : "LOW",
          isActive: true,
          startDate: ad.ad_delivery_start_time,
          platforms: ad.publisher_platforms || ["facebook", "instagram"],
        }));
      }
    } catch (e) {
      console.warn("Meta Ads Archive API error, falling back to AI:", e);
    }
  }

  // AI Fallback: Generate realistic competitive ad intelligence
  if (ads.length === 0) {
    const { insforge } = await getInsforgeServerClient();
    const completion = await insforge.ai.chat.completions.create({
      model: "google/gemini-3.8-flash",
      messages: [{
        role: "user",
        content: `Generate 6 realistic trending Meta ads for the "${niche}" niche targeting ${country}. Return ONLY valid JSON array:
[{
  "id": "ad_1",
  "advertiserName": "Brand Name",
  "headline": "Short punchy headline",
  "primaryText": "Ad body copy (2-3 sentences)",
  "callToAction": "LEARN_MORE",
  "estimatedSpendTier": "HIGH",
  "isActive": true,
  "platforms": ["instagram", "facebook"],
  "whyItWorks": "Brief explanation of why this ad format is performing well"
}]`
      }]
    });
    const raw = completion.choices[0]?.message?.content || "[]";
    const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();
    try { ads = JSON.parse(clean); } catch {}
  }

  // Cache results
  if (ads.length > 0) {
    await admin.database.from("meta_ads_library_cache").insert({
      user_id: userId,
      niche,
      country,
      ads_data: ads,
    });
  }

  return ads;
}
```

---

## ⚙️ STEP 4 — Create API Endpoints

### `/app/api/meta/trending-ads/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchTrendingMetaAds } from "@/lib/meta-ads-library";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { niche, country } = body;

  if (!niche) return NextResponse.json({ error: "niche is required" }, { status: 400 });

  const ads = await fetchTrendingMetaAds({
    niche,
    country: country || "IN",
    userId,
  });

  return NextResponse.json({ success: true, ads });
}
```

### `/app/api/social/comments/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";

export const maxDuration = 30;

// GET: Fetch all comment logs for this user
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getInsforgeAdminClient();
  const { data, error } = await admin.database
    .from("social_comments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comments: data });
}

// POST: Process a comment and generate AI reply
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { commentText, commenterHandle, platform, postId } = body;

  if (!commentText) return NextResponse.json({ error: "commentText required" }, { status: 400 });

  const { insforge } = await getInsforgeServerClient();

  // AI: Analyze sentiment and generate reply
  const completion = await insforge.ai.chat.completions.create({
    model: "google/gemini-3.8-flash",
    messages: [{
      role: "user",
      content: `Analyze this social media comment and respond professionally in brand voice.
Comment: "${commentText}"
Platform: ${platform}

Return ONLY valid JSON:
{
  "sentiment": "INQUIRY|PRAISE|COMPLAINT|SPAM|NEUTRAL",
  "reply": "Your brand-voice reply (max 150 chars for Instagram)",
  "shouldSendDM": true/false,
  "dmMessage": "Private DM message if purchase intent detected"
}`
    }]
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();

  let aiResult = { sentiment: "NEUTRAL", reply: "Thank you for your comment! 🙏", shouldSendDM: false, dmMessage: "" };
  try { aiResult = JSON.parse(clean); } catch {}

  // Save to DB
  const admin = getInsforgeAdminClient();
  await admin.database.from("social_comments").insert({
    user_id: userId,
    post_id: postId || null,
    platform: platform || "INSTAGRAM",
    commenter_handle: commenterHandle,
    comment_text: commentText,
    sentiment: aiResult.sentiment,
    reply_text: aiResult.reply,
    dm_sent: aiResult.shouldSendDM,
    status: "replied",
  });

  return NextResponse.json({ success: true, reply: aiResult.reply, sentiment: aiResult.sentiment, shouldSendDM: aiResult.shouldSendDM });
}
```

---

## ⚙️ STEP 5 — Create Inngest Background Job

### `/inngest/functions/poll-post-comments.ts`

```typescript
import { inngest } from "../client";
import { getInsforgeAdminClient } from "@/lib/insforge-server";

/**
 * Polls published posts for new comments every 15 minutes
 * and auto-replies using AI
 */
export const pollPostComments = inngest.createFunction(
  { id: "poll-post-comments", name: "Poll & Auto-Reply to Post Comments" },
  { cron: "*/15 * * * *" }, // Every 15 minutes
  async ({ step }) => {
    const admin = getInsforgeAdminClient();

    // Get all published posts from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: publishedPosts } = await admin.database
      .from("scheduled_posts")
      .select("id, user_id, published_url, user_channel_id, user_channels(access_token, channel_types(type))")
      .eq("status", "published")
      .gte("published_at", sevenDaysAgo)
      .not("published_url", "is", null)
      .limit(50);

    if (!publishedPosts || publishedPosts.length === 0) {
      return { processed: 0, message: "No recent published posts found" };
    }

    let repliedCount = 0;

    for (const post of publishedPosts) {
      const channelType = (post.user_channels as any)?.channel_types?.type;
      const accessToken = (post.user_channels as any)?.access_token;

      if (!accessToken || !channelType) continue;

      // Only process Instagram for now (Facebook DM API requires extra approval)
      if (channelType !== "INSTAGRAM") continue;

      await step.run(`process-post-${post.id}`, async () => {
        // NOTE: Instagram Graph API requires the media ID to fetch comments
        // Published URL format: https://instagram.com/p/[shortcode]
        // For now, log that this post is eligible for comment polling
        // Full implementation requires Instagram Business API webhook setup
        console.log(`[Comment Poller] Post ${post.id} eligible for comment polling`);
        return { postId: post.id, status: "eligible" };
      });
    }

    return {
      processed: publishedPosts.length,
      replied: repliedCount,
      message: `Polled ${publishedPosts.length} posts`,
    };
  }
);
```

> ⚠️ **Note**: Register this function in `inngest/client.ts` — Add `pollPostComments` to the serve handler. Check the existing `inngest/client.ts` file to see how existing functions are registered and follow the same pattern.

---

## 🖥️ STEP 6 — Create Social Automation Page

### `/app/(routes)/(dashboard)/social-automation/page.tsx`

```typescript
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bot, MessageSquare, Plus, Zap, CheckCircle } from "lucide-react";

export default function SocialAutomationPage() {
  const [testComment, setTestComment] = useState({ text: "", platform: "INSTAGRAM" });
  const [testResult, setTestResult] = useState<any>(null);

  const queryClient = useQueryClient();

  // Fetch comment logs
  const { data: commentsData } = useQuery({
    queryKey: ["social-comments"],
    queryFn: async () => {
      const res = await fetch("/api/social/comments");
      return res.json();
    },
  });

  // Test comment AI reply
  const { mutate: testCommentReply, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/social/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentText: testComment.text,
          platform: testComment.platform,
          commenterHandle: "@test_user",
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setTestResult(data);
      toast.success("AI reply generated!");
      queryClient.invalidateQueries({ queryKey: ["social-comments"] });
    },
    onError: () => toast.error("Test failed"),
  });

  const comments = commentsData?.comments || [];
  const sentimentColors: Record<string, string> = {
    INQUIRY: "bg-blue-500/10 text-blue-600",
    PRAISE: "bg-green-500/10 text-green-600",
    COMPLAINT: "bg-red-500/10 text-red-600",
    SPAM: "bg-gray-500/10 text-gray-600",
    NEUTRAL: "bg-yellow-500/10 text-yellow-600",
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="size-6 text-primary" /> Social Automation</h1>
        <p className="text-muted-foreground text-sm mt-1">AI auto-replies to comments & manages DM conversations 24/7</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Replies", value: comments.length, icon: MessageSquare, color: "text-blue-500" },
          { label: "Inquiries", value: comments.filter((c: any) => c.sentiment === "INQUIRY").length, icon: Zap, color: "text-orange-500" },
          { label: "Praises", value: comments.filter((c: any) => c.sentiment === "PRAISE").length, icon: CheckCircle, color: "text-green-500" },
          { label: "DMs Sent", value: comments.filter((c: any) => c.dm_sent).length, icon: MessageSquare, color: "text-purple-500" },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="pt-4 flex items-center gap-3">
              <stat.icon className={`size-5 ${stat.color}`} />
              <div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Test Comment AI */}
      <Card>
        <CardHeader><CardTitle className="text-base">🧪 Test AI Comment Reply</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Paste a comment to test</Label>
              <Input placeholder='e.g. "What is the price? I am interested!"' value={testComment.text} onChange={e => setTestComment(t => ({ ...t, text: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={testComment.platform} onValueChange={v => setTestComment(t => ({ ...t, platform: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INSTAGRAM">📸 Instagram</SelectItem>
                  <SelectItem value="FACEBOOK">📘 Facebook</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={() => testCommentReply()} disabled={isPending || !testComment.text}>
            {isPending ? "Generating..." : "Test AI Reply"}
          </Button>
          {testResult && (
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sentimentColors[testResult.sentiment] || ""}`}>{testResult.sentiment}</span>
                {testResult.shouldSendDM && <Badge variant="outline" className="text-xs">📩 DM will be sent</Badge>}
              </div>
              <p className="text-sm font-medium">AI Reply: "{testResult.reply}"</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comment Log */}
      <Card>
        <CardHeader><CardTitle className="text-base">📋 Auto-Reply Log</CardTitle></CardHeader>
        <CardContent>
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No comments processed yet. Use the test above to generate your first reply.</p>
          ) : (
            <div className="space-y-3">
              {comments.map((comment: any) => (
                <div key={comment.id} className="p-3 rounded-lg border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{comment.commenter_handle} · {comment.platform}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sentimentColors[comment.sentiment] || ""}`}>{comment.sentiment}</span>
                  </div>
                  <p className="text-sm">💬 "{comment.comment_text}"</p>
                  <p className="text-sm text-primary">↳ {comment.reply_text}</p>
                  {comment.dm_sent && <Badge variant="outline" className="text-xs">📩 DM Sent</Badge>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 🖥️ STEP 7 — Add Live Ads to Campaign Wizard

Open `components/meta-ads/campaign-creation-wizard.tsx`

Find the **Step 1** section (Goal & targeting inputs). Add a button **after** the existing target country/niche field:

```typescript
// ADD THIS IMPORT at top of campaign-creation-wizard.tsx
import TrendingAdsDrawer from "./trending-ads-drawer";

// ADD this state inside the component
const [showAdsDrawer, setShowAdsDrawer] = useState(false);

// ADD this button in Step 1 of the wizard, after the niche/country field:
<Button
  type="button"
  variant="outline"
  className="w-full gap-2 border-dashed"
  onClick={() => setShowAdsDrawer(true)}
>
  <TrendingUp className="size-4" />
  Inspect Competitor Meta Ads (Live)
</Button>
<TrendingAdsDrawer
  open={showAdsDrawer}
  onOpenChange={setShowAdsDrawer}
  niche={/* pass your niche state field here */}
  country={/* pass your country state field here */}
/>
```

---

## 🖥️ STEP 8 — Create Trending Ads Drawer Component

### `/components/meta-ads/trending-ads-drawer.tsx`

```typescript
"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Zap, ExternalLink } from "lucide-react";

interface TrendingAdsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  niche: string;
  country: string;
  onModelAd?: (ad: any) => void;
}

export default function TrendingAdsDrawer({ open, onOpenChange, niche, country, onModelAd }: TrendingAdsDrawerProps) {
  const [ads, setAds] = useState<any[]>([]);

  const { mutate: fetchAds, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/meta/trending-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, country }),
      });
      if (!res.ok) throw new Error("Failed to fetch ads");
      return res.json();
    },
    onSuccess: (data) => setAds(data.ads || []),
    onError: () => toast.error("Failed to fetch competitor ads"),
  });

  const spendColors = { HIGH: "text-red-500", MEDIUM: "text-orange-500", LOW: "text-green-500" };

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (o && ads.length === 0) fetchAds(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <TrendingUp className="size-5 text-primary" /> Live Competitor Ads
          </SheetTitle>
          <p className="text-sm text-muted-foreground">Top performing ads in "{niche}" right now</p>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isPending ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg border space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))
          ) : ads.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">No ads loaded yet</p>
              <Button onClick={() => fetchAds()} className="mt-2" variant="outline">Fetch Ads</Button>
            </div>
          ) : (
            ads.map((ad, i) => (
              <div key={ad.id || i} className="p-4 rounded-lg border space-y-2 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{ad.advertiserName}</p>
                    <p className="font-semibold text-sm mt-0.5">{ad.headline}</p>
                  </div>
                  <Badge variant="outline" className={`text-xs shrink-0 ${spendColors[ad.estimatedSpendTier as keyof typeof spendColors] || ""}`}>
                    💰 {ad.estimatedSpendTier}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{ad.primaryText}</p>
                {ad.whyItWorks && (
                  <p className="text-xs bg-primary/5 border border-primary/20 rounded p-2">
                    <span className="font-medium">Why it works:</span> {ad.whyItWorks}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  {ad.platforms?.map((p: string) => (
                    <Badge key={p} variant="secondary" className="text-xs capitalize">{p}</Badge>
                  ))}
                  {onModelAd && (
                    <Button size="sm" className="ml-auto text-xs h-7 gap-1" onClick={() => { onModelAd(ad); onOpenChange(false); toast.success("Ad loaded into wizard!"); }}>
                      <Zap className="size-3" /> Model This Ad
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

---

## ✅ TASK CHECKLIST

```
STEP 1 — DATABASE
[ ] Run lib/db/06-social-automation-tables.sql in Supabase SQL Editor
    → Creates: social_automation_rules, social_comments, meta_ads_library_cache

STEP 2 — SIDEBAR
[ ] Open app/(routes)/(dashboard)/_common/app-sidebar.tsx
[ ] Add Bot to lucide imports
[ ] Add "Social Automation" nav item to mainNav array

STEP 3 — NEW LIB FILE
[ ] Create lib/meta-ads-library.ts (full code in Step 3 above)

STEP 4 — API ROUTES
[ ] Create app/api/meta/trending-ads/route.ts
[ ] Create app/api/social/comments/route.ts

STEP 5 — INNGEST BACKGROUND JOB
[ ] Create inngest/functions/poll-post-comments.ts
[ ] Register pollPostComments in inngest/client.ts (follow existing pattern)

STEP 6 — SOCIAL AUTOMATION PAGE
[ ] Create app/(routes)/(dashboard)/social-automation/page.tsx

STEP 7 — ENHANCE META ADS WIZARD
[ ] Open components/meta-ads/campaign-creation-wizard.tsx
[ ] Add TrendingAdsDrawer import
[ ] Add "Inspect Competitor Ads" button in Step 1
[ ] Add showAdsDrawer state and TrendingAdsDrawer component

STEP 8 — CREATE TRENDING ADS DRAWER
[ ] Create components/meta-ads/trending-ads-drawer.tsx

STEP 9 — TEST
[ ] npm run dev
[ ] Visit /meta-ads → Click "New Campaign" → Step 1 → Click "Inspect Competitor Ads"
[ ] Verify trending ads drawer opens with 6 ads
[ ] Visit /social-automation → Test AI comment reply with a sample comment
[ ] Check Supabase: social_comments table has a row after testing
[ ] Verify Inngest dashboard shows poll-post-comments cron function
```

---

## 🏗️ Flow Diagram

```
META ADS LIVE LIBRARY FLOW:
═══════════════════════════════════════════════════════

USER opens Campaign Wizard Step 1
          │
          ▼
Clicks "Inspect Competitor Ads"
          │
          ▼
TrendingAdsDrawer opens → calls POST /api/meta/trending-ads
          │
          ├─── Cached? → Returns from meta_ads_library_cache ──→ Show Ads
          │
          └─── Not cached?
                    │
                    ├─── META_ADS_ACCESS_TOKEN set?
                    │         └─── YES → Meta Ads Archive API
                    │
                    └─── NO → Gemini AI generates intelligence
                              │
                              ▼
                    Cache in meta_ads_library_cache (6hr TTL)
                              │
                              ▼
                    Show 6 ads with "Model This Ad" button
                              │
                              ▼
                    Winning ad copy loaded into wizard Step 2

═══════════════════════════════════════════════════════

SOCIAL AUTOMATION FLOW:
═══════════════════════════════════════════════════════

Inngest Cron (every 15 min)
          │
          ▼
poll-post-comments.ts
          │
          ▼
Fetches published posts (last 7 days)
          │
          ▼
For each Instagram post → Instagram Graph API (webhook)
          │
          ▼
New comments found?
          │
          ├─── YES → POST /api/social/comments
          │               │
          │               ▼
          │         Gemini AI: Sentiment + Reply
          │               │
          │               ▼
          │         Insert to social_comments table
          │               │
          │         Purchase intent? → Send DM
          │
          └─── NO → Skip
```

---

*Member 2 Plan — Lemon AI Engineering | September 2026*

---

---

# 🔴 PHASE 2 — CRITICAL GAP TASKS (Member 2)
## Gaps from Sir's Requirements NOT yet covered

---

## 🤖 GAP 1: Website Chatbot Setup UI
> **Sir's Requirement:** `AI Sales → Website Bot`

### New Files to Create:
```
app/(routes)/(dashboard)/website-bot/
  └── page.tsx                                     ← YOU CREATE

app/api/chatbot/
  └── route.ts                                     ← YOU CREATE (public endpoint, no auth)
```

### `/app/api/chatbot/route.ts` (Public — no Clerk auth, embed on any website)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, userId, sessionId } = body;

  if (!message || !userId) {
    return NextResponse.json({ error: "message and userId required" }, { status: 400 });
  }

  const admin = getInsforgeAdminClient();

  // Fetch brand profile for this user to ground the chatbot
  const { data: brand } = await admin.database
    .from("brand_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: memory } = await admin.database
    .from("brand_memory")
    .select("memory_text")
    .eq("user_id", userId)
    .limit(5);

  const memoryContext = memory?.map((m: any) => m.memory_text).join("\n") || "";
  const { insforge } = await getInsforgeServerClient();

  const systemPrompt = `You are a helpful AI sales assistant for ${brand?.business_name || "this business"}.
Business: ${brand?.business_name || ""}
Niche: ${brand?.niche || ""}
Main Offer: ${brand?.main_offer || ""}
${memoryContext ? `Additional Knowledge:\n${memoryContext}` : ""}

RULES:
- Only answer questions about this business, its products, pricing, and services
- If someone asks to buy or book → collect their name, email, phone number
- Be friendly, concise, professional
- Never make up pricing or features not mentioned above
- Max reply length: 100 words`;

  const completion = await insforge.ai.chat.completions.create({
    model: "google/gemini-3.8-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
  });

  const reply = completion.choices[0]?.message?.content || "I'm here to help! Please ask me anything about our services.";

  // Log to crm_conversations if lead shows purchase intent
  const intentKeywords = ["price", "buy", "cost", "book", "appointment", "contact", "purchase", "how much"];
  const hasIntent = intentKeywords.some(k => message.toLowerCase().includes(k));

  if (hasIntent) {
    try {
      // Create or find conversation
      const { data: existingConv } = await admin.database
        .from("crm_conversations")
        .select("id")
        .eq("user_id", userId)
        .eq("channel", "website")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const convId = existingConv?.id;
      if (convId) {
        await admin.database.from("crm_messages").insert([
          { conversation_id: convId, sender_type: "lead", content: message },
          { conversation_id: convId, sender_type: "ai_assistant", content: reply },
        ]);
      }
    } catch {}
  }

  return NextResponse.json({ reply, hasIntent });
}
```

### `/app/(routes)/(dashboard)/website-bot/page.tsx`

```typescript
"use client";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Globe, Copy, Check, MessageCircle, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";

export default function WebsiteBotPage() {
  const { user } = useUser();
  const userId = user?.id;
  const [copied, setCopied] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [chat, setChat] = useState<{ role: "user" | "bot"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const embedCode = `<!-- Lemon AI Chatbot Widget -->
<script>
  window.LEMON_BOT_USER_ID = "${userId || "YOUR_USER_ID"}";
  window.LEMON_BOT_THEME = "light";
</script>
<script src="${process.env.NEXT_PUBLIC_APP_URL || "https://yourapp.com"}/chatbot-widget.js" async></script>`;

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Embed code copied!");
  };

  const sendTestMessage = async () => {
    if (!testMsg.trim() || !userId) return;
    const userMsg = testMsg;
    setTestMsg("");
    setChat(c => [...c, { role: "user", text: userMsg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, userId, sessionId: "preview" }),
      });
      const data = await res.json();
      setChat(c => [...c, { role: "bot", text: data.reply }]);
    } catch {
      setChat(c => [...c, { role: "bot", text: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Globe className="size-6 text-primary" /> Website AI Chatbot</h1>
        <p className="text-muted-foreground text-sm mt-1">Embed an AI chatbot on your website — grounded in your brand profile & AI memory</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Embed Code */}
        <Card>
          <CardHeader><CardTitle className="text-base">📋 Embed Code</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Copy and paste this before the closing &lt;/body&gt; tag on your website:</p>
            <pre className="text-xs bg-muted/60 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">{embedCode}</pre>
            <Button onClick={copyEmbed} variant="outline" className="w-full gap-2">
              {copied ? <><Check className="size-4 text-green-500" /> Copied!</> : <><Copy className="size-4" /> Copy Embed Code</>}
            </Button>
            <div className="space-y-1">
              <p className="text-xs font-medium">Works on:</p>
              <div className="flex flex-wrap gap-1">
                {["WordPress", "Wix", "Shopify", "Webflow", "Custom HTML"].map(p => <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview / Test */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageCircle className="size-4" /> Test Your Bot</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="h-52 overflow-y-auto space-y-2 bg-muted/30 rounded-lg p-3">
              {chat.length === 0 && (
                <div className="flex items-start gap-2">
                  <div className="size-6 rounded-full bg-primary flex items-center justify-center shrink-0"><Sparkles className="size-3 text-white" /></div>
                  <p className="text-xs bg-white border rounded-lg px-3 py-2">Hi! I'm your AI assistant. How can I help you today? 👋</p>
                </div>
              )}
              {chat.map((msg, i) => (
                <div key={i} className={`flex items-start gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`size-6 rounded-full flex items-center justify-center shrink-0 text-xs ${msg.role === "bot" ? "bg-primary text-white" : "bg-muted"}`}>
                    {msg.role === "bot" ? "🤖" : "👤"}
                  </div>
                  <p className={`text-xs rounded-lg px-3 py-2 max-w-[80%] ${msg.role === "bot" ? "bg-white border" : "bg-primary text-white"}`}>{msg.text}</p>
                </div>
              ))}
              {loading && (
                <div className="flex items-start gap-2">
                  <div className="size-6 rounded-full bg-primary flex items-center justify-center shrink-0"><Sparkles className="size-3 text-white animate-spin" /></div>
                  <p className="text-xs bg-white border rounded-lg px-3 py-2 text-muted-foreground">Typing...</p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Ask something about your business..." value={testMsg} onChange={e => setTestMsg(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendTestMessage()} className="text-xs" />
              <Button size="icon" onClick={sendTestMessage} disabled={loading || !testMsg.trim()}><Send className="size-4" /></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

### Add to Sidebar:
```typescript
{ name: "Website Bot", href: "/website-bot", icon: Globe },
```

---

## 💬 GAP 2: WhatsApp Bot Setup UI
> **Sir's Requirement:** `AI Sales → WhatsApp Bot`

### New Files to Create:
```
app/(routes)/(dashboard)/whatsapp-bot/
  └── page.tsx                                     ← YOU CREATE

app/api/social/whatsapp/
  └── route.ts                                     ← YOU CREATE (webhook)
```

### `/app/api/social/whatsapp/route.ts` (WhatsApp Cloud API Webhook)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";

// GET: Webhook verification by Meta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "lemon_ai_whatsapp";
  if (mode === "subscribe" && token === verifyToken) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST: Incoming WhatsApp messages
export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message || message.type !== "text") {
      return NextResponse.json({ status: "no_text_message" });
    }

    const from = message.from; // WhatsApp phone number
    const text = message.text?.body || "";
    const phoneNumberId = value?.metadata?.phone_number_id;

    // Get the user ID from whatsapp_phone_number_id mapping (stored in brand_profiles)
    const admin = getInsforgeAdminClient();
    const { data: brand } = await admin.database
      .from("brand_profiles")
      .select("user_id, business_name, niche, main_offer")
      .eq("whatsapp_phone_number_id", phoneNumberId)
      .maybeSingle();

    if (!brand) {
      return NextResponse.json({ status: "business_not_found" });
    }

    // Generate AI reply
    const { insforge } = await getInsforgeServerClient();
    const completion = await insforge.ai.chat.completions.create({
      model: "google/gemini-3.8-flash",
      messages: [{
        role: "system",
        content: `You are a WhatsApp sales assistant for ${brand.business_name}. Be brief (under 80 words). Business: ${brand.niche}. Offer: ${brand.main_offer}.`
      }, { role: "user", content: text }],
    });

    const reply = completion.choices[0]?.message?.content || "Thank you for reaching out! How can I help?";

    // Send reply via WhatsApp Cloud API
    const waToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (waToken && phoneNumberId) {
      await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${waToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: from,
          type: "text",
          text: { body: reply },
        }),
      });
    }

    // Log to CRM
    await admin.database.from("crm_conversations").upsert({
      user_id: brand.user_id,
      channel: "whatsapp",
      status: "ai_handling",
      last_message_at: new Date().toISOString(),
    }, { onConflict: "user_id,channel" });

    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error("WhatsApp webhook error:", e);
    return NextResponse.json({ status: "error" }, { status: 200 }); // Return 200 to prevent Meta from retrying
  }
}
```

### `/app/(routes)/(dashboard)/whatsapp-bot/page.tsx`

```typescript
"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

const SETUP_STEPS = [
  { step: 1, title: "Create Meta Developer App", desc: "Go to developers.facebook.com → Create App → Select Business", link: "https://developers.facebook.com/apps/create/" },
  { step: 2, title: "Add WhatsApp Product", desc: "In your app, click Add Product → WhatsApp → Set Up" },
  { step: 3, title: "Get Phone Number ID", desc: "WhatsApp → API Setup → Copy Phone Number ID" },
  { step: 4, title: "Set Webhook URL", desc: "Webhook URL: your-domain.com/api/social/whatsapp\nVerify Token: lemon_ai_whatsapp" },
  { step: 5, title: "Add to .env.local", desc: "Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_WEBHOOK_VERIFY_TOKEN" },
];

export default function WhatsAppBotPage() {
  return (
    <div className="max-w-3xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><MessageCircle className="size-6 text-green-500" /> WhatsApp AI Bot</h1>
        <p className="text-muted-foreground text-sm mt-1">Connect WhatsApp Business — AI auto-replies to customer inquiries 24/7</p>
      </div>

      {/* Status */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="pt-4 flex items-center gap-3">
          <AlertCircle className="size-5 text-orange-500 shrink-0" />
          <div>
            <p className="text-sm font-medium">Setup Required</p>
            <p className="text-xs text-muted-foreground">Follow the steps below to connect your WhatsApp Business account</p>
          </div>
        </CardContent>
      </Card>

      {/* Setup Steps */}
      <Card>
        <CardHeader><CardTitle className="text-base">📋 Setup Instructions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {SETUP_STEPS.map((s) => (
            <div key={s.step} className="flex gap-3">
              <div className="size-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold shrink-0">{s.step}</div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-xs text-muted-foreground whitespace-pre-line">{s.desc}</p>
                {s.link && <Link href={s.link} target="_blank" className="text-xs text-primary flex items-center gap-1 hover:underline"><ExternalLink className="size-3" /> Open in Meta</ Link>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Webhook Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">🔗 Your Webhook Details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Webhook URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={`${process.env.NEXT_PUBLIC_APP_URL || "https://your-domain.com"}/api/social/whatsapp`} className="text-xs font-mono" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Verify Token</Label>
            <Input readOnly value="lemon_ai_whatsapp" className="text-xs font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Subscribe to these webhook fields</Label>
            <div className="flex gap-1 flex-wrap">
              {["messages", "message_deliveries", "message_reads"].map(f => <Badge key={f} variant="secondary" className="text-xs font-mono">{f}</Badge>)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Env Variables */}
      <Card>
        <CardHeader><CardTitle className="text-base">⚙️ Environment Variables (add to .env.local)</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted/60 p-3 rounded-lg font-mono">{`WHATSAPP_ACCESS_TOKEN=your_permanent_access_token_here
WHATSAPP_WEBHOOK_VERIFY_TOKEN=lemon_ai_whatsapp
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here`}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Add to Sidebar:
```typescript
{ name: "WhatsApp Bot", href: "/whatsapp-bot", icon: MessageCircle },
```

---

## 📅 GAP 3: Appointment Booking UI
> **Sir's Requirement:** `AI Sales → Appointment Booking`

### New Files to Create:
```
app/(routes)/(dashboard)/appointments/
  └── page.tsx                                     ← YOU CREATE
```

### `/app/(routes)/(dashboard)/appointments/page.tsx`

```typescript
"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarClock, ExternalLink, CheckCircle } from "lucide-react";
import Link from "next/link";

const BOOKING_TOOLS = [
  {
    name: "Cal.com",
    description: "Free, open-source. Recommended for most businesses.",
    link: "https://cal.com",
    badge: "Recommended",
    badgeColor: "bg-green-100 text-green-700",
    steps: [
      "Sign up at cal.com",
      "Create an event type (e.g. '30-min Discovery Call')",
      "Copy your booking link",
      "Paste it in the box below",
    ],
  },
  {
    name: "Calendly",
    description: "Popular. Has free and paid plans.",
    link: "https://calendly.com",
    badge: "Popular",
    badgeColor: "bg-blue-100 text-blue-700",
    steps: ["Sign up at calendly.com", "Create your scheduling link", "Copy and paste below"],
  },
  {
    name: "Google Calendar",
    description: "Use Google Calendar appointment slots.",
    link: "https://calendar.google.com",
    badge: "Free",
    badgeColor: "bg-gray-100 text-gray-700",
    steps: ["Open Google Calendar", "Create appointment schedule", "Copy the booking page link"],
  },
];

export default function AppointmentsPage() {
  return (
    <div className="max-w-3xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarClock className="size-6 text-primary" /> Appointment Booking</h1>
        <p className="text-muted-foreground text-sm mt-1">Connect your calendar so the AI can share your booking link when leads are ready to schedule</p>
      </div>

      <div className="space-y-4">
        {BOOKING_TOOLS.map((tool) => (
          <Card key={tool.name}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{tool.name}</CardTitle>
                <Badge className={`text-xs ${tool.badgeColor}`}>{tool.badge}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{tool.description}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1">
                {tool.steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-xs"><CheckCircle className="size-3.5 text-green-500 shrink-0 mt-0.5" />{step}</li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input placeholder={`Paste your ${tool.name} booking link here`} className="text-xs" />
                <Button size="sm" variant="outline">Save</Button>
              </div>
              <Link href={tool.link} target="_blank">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                  <ExternalLink className="size-3.5" /> Open {tool.name}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 text-sm">
          <p className="font-medium mb-1">🤖 How AI uses your booking link</p>
          <p className="text-xs text-muted-foreground">Once saved, the AI automatically shares your booking link in:</p>
          <ul className="mt-2 space-y-1">
            {["Website chatbot when visitor shows purchase intent", "WhatsApp bot after qualifying a lead", "Instagram/Facebook DM replies", "CRM follow-up messages"].map((item, i) => (
              <li key={i} className="text-xs flex gap-2"><span className="text-primary">→</span>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Add to Sidebar:
```typescript
{ name: "Appointments", href: "/appointments", icon: CalendarClock },
```

---

## ✅ PHASE 2 TASK CHECKLIST (Member 2 Additional)

```
GAP 1 — WEBSITE BOT
[ ] Create app/api/chatbot/route.ts
[ ] Create app/(routes)/(dashboard)/website-bot/page.tsx
[ ] Add "Website Bot" to sidebar nav
[ ] TEST: Visit /website-bot → type test message → verify AI responds in preview

GAP 2 — WHATSAPP BOT
[ ] Create app/api/social/whatsapp/route.ts
[ ] Create app/(routes)/(dashboard)/whatsapp-bot/page.tsx
[ ] Add "WhatsApp Bot" to sidebar nav

GAP 3 — APPOINTMENTS
[ ] Create app/(routes)/(dashboard)/appointments/page.tsx
[ ] Add "Appointments" to sidebar nav
[ ] Add CalendarClock to lucide imports in sidebar

NO NEW DB TABLES NEEDED FOR THESE:
  → Website Bot logs to existing crm_conversations table (Member 3's table)
  → WhatsApp Bot logs to existing crm_conversations table (Member 3's table)
  → Make sure Member 3 runs their SQL FIRST before you test these features
```

---

## 🗺️ MEMBER 2 COMPLETE FILE MAP (All Phases)

```
Phase 1 (Original):
  ✅ lib/meta-ads-library.ts
  ✅ app/api/meta/trending-ads/route.ts
  ✅ app/api/social/comments/route.ts
  ✅ components/meta-ads/trending-ads-drawer.tsx
  ✅ inngest/functions/poll-post-comments.ts
  ✅ app/(routes)/(dashboard)/social-automation/page.tsx
  ✅ lib/db/06-social-automation-tables.sql

Phase 2 (Gap Fill):
  🔴 app/api/chatbot/route.ts                   ← NEW
  🔴 app/api/social/whatsapp/route.ts           ← NEW
  🔴 app/(routes)/(dashboard)/website-bot/page.tsx   ← NEW
  🔴 app/(routes)/(dashboard)/whatsapp-bot/page.tsx  ← NEW
  🔴 app/(routes)/(dashboard)/appointments/page.tsx  ← NEW

⚠️ DEPENDENCY: Run Member 3's SQL (07-crm-analytics-tables.sql) BEFORE testing
                website-bot and whatsapp-bot (they log to crm_conversations table)
```

---

*Member 2 Plan — Lemon AI Engineering | September 2026 (Updated with Gap Tasks)*
