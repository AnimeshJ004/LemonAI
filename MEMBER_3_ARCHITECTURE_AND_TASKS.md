# 🍋 LEMON AI — MEMBER 3 EXECUTION PLAN
## Domain: CRM Pipeline + Unified Inbox + AI Sales Bots + Growth Analytics
### Owner: FRIEND 2 (Handle this file only)

---

> ⚠️ **CRITICAL RULE**: Only touch files listed under **"YOUR FILES"**. Never touch files owned by Member 1 or Member 2. This prevents ALL git merge conflicts.

---

## 📌 YOUR COMPLETE FILE OWNERSHIP MAP

```
YOUR FILES (CREATE THESE — They don't exist yet):
═══════════════════════════════════════════════════════

app/(routes)/(dashboard)/crm/
  ├── layout.tsx                                     ← YOU CREATE
  ├── pipeline/page.tsx                              ← YOU CREATE
  └── inbox/page.tsx                                 ← YOU CREATE

app/(routes)/(dashboard)/analytics/
  └── page.tsx                                       ← YOU CREATE

components/crm/
  ├── leads-kanban.tsx                               ← YOU CREATE
  ├── lead-card.tsx                                  ← YOU CREATE
  ├── add-lead-dialog.tsx                            ← YOU CREATE
  ├── move-lead-dialog.tsx                           ← YOU CREATE
  ├── unified-inbox.tsx                              ← YOU CREATE
  └── conversation-thread.tsx                        ← YOU CREATE

components/analytics/
  ├── analytics-overview.tsx                         ← YOU CREATE
  ├── post-performance-chart.tsx                     ← YOU CREATE
  └── ai-recommendations-card.tsx                   ← YOU CREATE

app/api/crm/
  ├── leads/route.ts                                 ← YOU CREATE
  ├── leads/[id]/route.ts                            ← YOU CREATE
  └── conversations/route.ts                         ← YOU CREATE

app/api/analytics/
  └── overview/route.ts                              ← YOU CREATE

lib/db/
  └── 07-crm-analytics-tables.sql                   ← YOU CREATE

YOUR FILES (MODIFY THESE — Already exist):
═══════════════════════════════════════════════════════

app/(routes)/(dashboard)/_common/app-sidebar.tsx
  → ADD: "CRM" nav group and "Analytics" nav item ONLY
  → DO NOT touch existing nav items
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
❌ components/meta-ads/trending-ads-drawer.tsx       → Member 2
❌ lib/meta-ads-library.ts                           → Member 2
❌ app/api/meta/trending-ads/*                       → Member 2
❌ app/api/social/*                                  → Member 2
❌ inngest/functions/poll-post-comments.ts           → Member 2
```

---

## 🗄️ STEP 1 — Run This SQL in Supabase First

Create file: `lib/db/07-crm-analytics-tables.sql` and run in Supabase SQL Editor:

```sql
-- ============================================================
-- LEADS TABLE (CRM Pipeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  name        TEXT,
  email       TEXT,
  phone       TEXT,
  company     TEXT,
  source      TEXT DEFAULT 'manual'
              CHECK (source IN ('manual', 'organic', 'meta_ads', 'website', 'whatsapp', 'instagram_dm', 'facebook_dm')),
  stage       TEXT DEFAULT 'new'
              CHECK (stage IN ('new', 'contacted', 'qualified', 'booked', 'proposal', 'closed_won', 'closed_lost')),
  score       INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 10),
  deal_value  NUMERIC DEFAULT 0,
  notes       TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leads_policy ON leads;
CREATE POLICY leads_policy ON leads
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

-- ============================================================
-- CRM CONVERSATIONS TABLE (Unified Inbox)
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL
                  CHECK (channel IN ('instagram', 'facebook', 'whatsapp', 'website', 'email')),
  status          TEXT DEFAULT 'open'
                  CHECK (status IN ('open', 'ai_handling', 'human_takeover', 'resolved')),
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE crm_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_conversations_policy ON crm_conversations;
CREATE POLICY crm_conversations_policy ON crm_conversations
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

-- ============================================================
-- CRM MESSAGES TABLE (Message history per conversation)
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES crm_conversations(id) ON DELETE CASCADE,
  sender_type     TEXT NOT NULL
                  CHECK (sender_type IN ('lead', 'ai_assistant', 'human_agent')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE crm_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_messages_policy ON crm_messages;
CREATE POLICY crm_messages_policy ON crm_messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM crm_conversations WHERE user_id = requesting_user_id()
    )
  );

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_user_stage ON leads(user_id, stage);
CREATE INDEX IF NOT EXISTS idx_crm_conversations_user ON crm_conversations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_messages_conversation ON crm_messages(conversation_id, created_at);
```

---

## 🔗 STEP 2 — Add Your Nav Items to Sidebar

Open `app/(routes)/(dashboard)/_common/app-sidebar.tsx`

Find the `mainNav` array and **ADD only these items** (after existing entries):

```typescript
{ name: "CRM Pipeline", href: "/crm/pipeline", icon: Users },           // ADD
{ name: "CRM Inbox", href: "/crm/inbox", icon: Inbox },                 // ADD
{ name: "Analytics", href: "/analytics", icon: BarChart3 },             // ADD
```

Add to lucide imports:
```typescript
import { ..., Users, Inbox, BarChart3 } from 'lucide-react';
```

---

## ⚙️ STEP 3 — Create API Endpoints

### `/app/api/crm/leads/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage");

  const admin = getInsforgeAdminClient();
  let query = admin.database
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (stage) query = query.eq("stage", stage);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by stage for Kanban view
  const stages = ["new", "contacted", "qualified", "booked", "proposal", "closed_won", "closed_lost"];
  const kanban = stages.reduce((acc, s) => {
    acc[s] = (data || []).filter((l: any) => l.stage === s);
    return acc;
  }, {} as Record<string, any[]>);

  return NextResponse.json({ leads: data, kanban, total: data?.length || 0 });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, email, phone, company, source, stage, score, deal_value, notes } = body;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const admin = getInsforgeAdminClient();
  const { data, error } = await admin.database
    .from("leads")
    .insert({
      user_id: userId,
      name,
      email,
      phone,
      company,
      source: source || "manual",
      stage: stage || "new",
      score: score || 0,
      deal_value: deal_value || 0,
      notes,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, lead: data });
}
```

### `/app/api/crm/leads/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const admin = getInsforgeAdminClient();

  const { data, error } = await admin.database
    .from("leads")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, lead: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getInsforgeAdminClient();
  const { error } = await admin.database
    .from("leads")
    .delete()
    .eq("id", params.id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

### `/app/api/crm/conversations/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";
import { getBrandProfileForUser } from "@/lib/brand-helper";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getInsforgeAdminClient();
  const { data, error } = await admin.database
    .from("crm_conversations")
    .select("*, leads(name, email, phone, stage), crm_messages(id, content, sender_type, created_at)")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { conversationId, messageContent, action } = body;

  const admin = getInsforgeAdminClient();

  // Human agent sends a message
  if (action === "send_message") {
    await admin.database.from("crm_messages").insert({
      conversation_id: conversationId,
      sender_type: "human_agent",
      content: messageContent,
    });
    await admin.database.from("crm_conversations")
      .update({ last_message_at: new Date().toISOString(), status: "human_takeover" })
      .eq("id", conversationId).eq("user_id", userId);
    return NextResponse.json({ success: true });
  }

  // AI reply to a message
  if (action === "ai_reply") {
    const brand = await getBrandProfileForUser(userId);
    const { insforge } = await getInsforgeServerClient();

    const completion = await insforge.ai.chat.completions.create({
      model: "google/gemini-3.8-flash",
      messages: [{
        role: "user",
        content: `You are an AI sales assistant for ${brand?.business_name || "our business"} in ${brand?.niche || "our industry"}.
Respond to this customer message in a helpful, professional, and friendly tone (max 150 words):
Customer: "${messageContent}"`
      }]
    });

    const aiReply = completion.choices[0]?.message?.content || "Thank you for your message! How can I help you?";

    await admin.database.from("crm_messages").insert([
      { conversation_id: conversationId, sender_type: "lead", content: messageContent },
      { conversation_id: conversationId, sender_type: "ai_assistant", content: aiReply },
    ]);

    await admin.database.from("crm_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId).eq("user_id", userId);

    return NextResponse.json({ success: true, aiReply });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
```

### `/app/api/analytics/overview/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getInsforgeAdminClient();

  // Fetch data from existing tables
  const [postsRes, leadsRes, commentsRes] = await Promise.all([
    admin.database.from("scheduled_posts").select("id, status, created_at, published_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
    admin.database.from("leads").select("id, stage, score, deal_value, source, created_at")
      .eq("user_id", userId),
    admin.database.from("social_comments").select("id, sentiment, created_at")
      .eq("user_id", userId).limit(100),
  ]);

  const posts = postsRes.data || [];
  const leads = leadsRes.data || [];
  const comments = commentsRes.data || [];

  // Calculate analytics
  const totalPosts = posts.length;
  const publishedPosts = posts.filter((p: any) => p.status === "published").length;
  const queuedPosts = posts.filter((p: any) => p.status === "queue").length;
  const totalLeads = leads.length;
  const qualifiedLeads = leads.filter((l: any) => ["qualified", "booked", "closed_won"].includes(l.stage)).length;
  const totalDealValue = leads.reduce((sum: number, l: any) => sum + (l.deal_value || 0), 0);
  const wonDeals = leads.filter((l: any) => l.stage === "closed_won");
  const wonRevenue = wonDeals.reduce((sum: number, l: any) => sum + (l.deal_value || 0), 0);

  const commentsByDay = comments.reduce((acc: Record<string, number>, c: any) => {
    const day = c.created_at?.slice(0, 10);
    if (day) acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});

  const postsByStatus = {
    published: publishedPosts,
    queued: queuedPosts,
    draft: posts.filter((p: any) => p.status === "draft").length,
  };

  const leadsByStage = ["new", "contacted", "qualified", "booked", "proposal", "closed_won", "closed_lost"]
    .map(stage => ({ stage, count: leads.filter((l: any) => l.stage === stage).length }));

  // Generate AI recommendations based on data
  let aiRecommendations: string[] = [];
  try {
    const { insforge } = await getInsforgeServerClient();
    const completion = await insforge.ai.chat.completions.create({
      model: "google/gemini-3.8-flash",
      messages: [{
        role: "user",
        content: `Analyze this social media performance data and give 3 specific actionable recommendations:
- Total posts: ${totalPosts}, Published: ${publishedPosts}
- Total leads: ${totalLeads}, Qualified: ${qualifiedLeads}
- Total pipeline value: ₹${totalDealValue}, Revenue won: ₹${wonRevenue}
- Comments processed: ${comments.length}

Return ONLY a JSON array of 3 recommendation strings (max 80 words each):
["recommendation 1", "recommendation 2", "recommendation 3"]`
      }]
    });
    const raw = completion.choices[0]?.message?.content || "[]";
    const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();
    aiRecommendations = JSON.parse(clean);
  } catch (e) {
    aiRecommendations = [
      "Keep publishing consistently — aim for 1-2 posts per day for best reach.",
      `You have ${totalLeads - qualifiedLeads} unqualified leads. Follow up with them to improve conversion.`,
      "Connect your Instagram account to enable live analytics and comment automation.",
    ];
  }

  return NextResponse.json({
    overview: { totalPosts, publishedPosts, queuedPosts, totalLeads, qualifiedLeads, totalDealValue, wonRevenue },
    postsByStatus,
    leadsByStage,
    commentsByDay,
    aiRecommendations,
  });
}
```

---

## 🖥️ STEP 4 — Create CRM Pages

### `/app/(routes)/(dashboard)/crm/layout.tsx`

```typescript
export default function CRMLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

### `/app/(routes)/(dashboard)/crm/pipeline/page.tsx`

```typescript
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Plus, Phone, Mail, Building, DollarSign } from "lucide-react";

const STAGES = [
  { id: "new", label: "New Lead", color: "bg-gray-100 border-gray-200" },
  { id: "contacted", label: "Contacted", color: "bg-blue-50 border-blue-200" },
  { id: "qualified", label: "Qualified", color: "bg-yellow-50 border-yellow-200" },
  { id: "booked", label: "Appointment Booked", color: "bg-purple-50 border-purple-200" },
  { id: "proposal", label: "Proposal Sent", color: "bg-orange-50 border-orange-200" },
  { id: "closed_won", label: "Closed Won ✅", color: "bg-green-50 border-green-200" },
  { id: "closed_lost", label: "Closed Lost ❌", color: "bg-red-50 border-red-100" },
];

const SOURCE_COLORS: Record<string, string> = {
  manual: "bg-gray-100 text-gray-700",
  organic: "bg-green-100 text-green-700",
  meta_ads: "bg-blue-100 text-blue-700",
  website: "bg-purple-100 text-purple-700",
  whatsapp: "bg-emerald-100 text-emerald-700",
  instagram_dm: "bg-pink-100 text-pink-700",
};

export default function CRMPipelinePage() {
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", source: "manual", deal_value: "" });
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await fetch("/api/crm/leads");
      return res.json();
    },
  });

  const { mutate: addLead, isPending: adding } = useMutation({
    mutationFn: async (formData: typeof form) => {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, deal_value: Number(formData.deal_value) || 0 }),
      });
      if (!res.ok) throw new Error("Failed to add lead");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Lead added!");
      setAddOpen(false);
      setForm({ name: "", email: "", phone: "", company: "", source: "manual", deal_value: "" });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Failed to add lead"),
  });

  const { mutate: moveLead } = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const res = await fetch(`/api/crm/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast.success("Lead moved!");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const kanban = data?.kanban || {};
  const totalValue = (data?.leads || []).reduce((sum: number, l: any) => sum + (l.deal_value || 0), 0);

  return (
    <div className="max-w-full py-6 px-3 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="size-6 text-primary" /> CRM Pipeline</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Total pipeline value: <span className="font-semibold text-foreground">₹{totalValue.toLocaleString()}</span></p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add Lead</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Lead</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="space-y-1.5"><Label>Name *</Label><Input placeholder="John Doe" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Email</Label><Input placeholder="john@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Phone</Label><Input placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Company</Label><Input placeholder="Company name" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Deal Value (₹)</Label><Input type="number" placeholder="50000" value={form.deal_value} onChange={e => setForm(f => ({ ...f, deal_value: e.target.value }))} /></div>
              </div>
              <div className="space-y-1.5">
                <Label>Lead Source</Label>
                <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="organic">Organic Social</SelectItem>
                    <SelectItem value="meta_ads">Meta Ads</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="instagram_dm">Instagram DM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => addLead(form)} disabled={adding || !form.name}>
                {adding ? "Adding..." : "Add Lead"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto">
        <div className="flex gap-3 min-w-max pb-4">
          {STAGES.map(stage => {
            const stageLeads: any[] = kanban[stage.id] || [];
            const stageValue = stageLeads.reduce((sum: number, l: any) => sum + (l.deal_value || 0), 0);
            return (
              <div key={stage.id} className={`w-64 rounded-xl border ${stage.color} p-3 space-y-2 flex-shrink-0`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{stage.label}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">{stageLeads.length}</Badge>
                  </div>
                </div>
                {stageValue > 0 && <p className="text-xs text-muted-foreground">₹{stageValue.toLocaleString()}</p>}
                
                <div className="space-y-2 min-h-[120px]">
                  {stageLeads.map((lead: any) => (
                    <div key={lead.id} className="bg-white rounded-lg border p-2.5 shadow-xs space-y-1.5">
                      <p className="font-semibold text-sm">{lead.name}</p>
                      {lead.company && <p className="text-xs text-muted-foreground flex items-center gap-1"><Building className="size-3" />{lead.company}</p>}
                      {lead.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="size-3" />{lead.email}</p>}
                      {lead.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="size-3" />{lead.phone}</p>}
                      {lead.deal_value > 0 && <p className="text-xs font-medium text-green-600 flex items-center gap-1"><DollarSign className="size-3" />₹{lead.deal_value.toLocaleString()}</p>}
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge className={`text-xs ${SOURCE_COLORS[lead.source] || ""}`}>{lead.source}</Badge>
                        {lead.score > 0 && <Badge variant="outline" className="text-xs">Score: {lead.score}/10</Badge>}
                      </div>
                      <Select value={lead.stage} onValueChange={(newStage) => moveLead({ id: lead.id, stage: newStage })}>
                        <SelectTrigger className="h-6 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STAGES.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

### `/app/(routes)/(dashboard)/crm/inbox/page.tsx`

```typescript
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Inbox, Send, Bot, User, UserCheck } from "lucide-react";

export default function CRMInboxPage() {
  const [selected, setSelected] = useState<any>(null);
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["crm-conversations"],
    queryFn: async () => {
      const res = await fetch("/api/crm/conversations");
      return res.json();
    },
    refetchInterval: 15000, // refresh every 15s
  });

  const { mutate: sendMessage, isPending: sending } = useMutation({
    mutationFn: async ({ action, content }: { action: string; content: string }) => {
      const res = await fetch("/api/crm/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selected?.id, messageContent: content, action }),
      });
      return res.json();
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
    },
    onError: () => toast.error("Failed to send"),
  });

  const conversations = data?.conversations || [];
  const channelIcons: Record<string, string> = { instagram: "📸", facebook: "📘", whatsapp: "💬", website: "🌐", email: "📧" };

  return (
    <div className="h-full flex" style={{ maxHeight: "calc(100vh - 80px)" }}>
      {/* Sidebar */}
      <div className="w-72 border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold flex items-center gap-2"><Inbox className="size-5 text-primary" /> Unified Inbox</h1>
        </div>
        <div className="overflow-y-auto flex-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No conversations yet</div>
          ) : (
            conversations.map((conv: any) => {
              const lastMsg = conv.crm_messages?.slice(-1)[0];
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelected(conv)}
                  className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${selected?.id === conv.id ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>{channelIcons[conv.channel] || "💬"}</span>
                    <span className="font-semibold text-sm">{conv.leads?.name || "Unknown"}</span>
                    <Badge variant={conv.status === "human_takeover" ? "default" : "secondary"} className="text-xs ml-auto">{conv.status}</Badge>
                  </div>
                  {lastMsg && <p className="text-xs text-muted-foreground truncate">{lastMsg.content}</p>}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <p className="font-semibold">{selected.leads?.name || "Unknown Lead"}</p>
              <p className="text-xs text-muted-foreground">{channelIcons[selected.channel]} {selected.channel} · {selected.leads?.email}</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {selected.crm_messages?.map((msg: any) => (
              <div key={msg.id} className={`flex gap-2 ${msg.sender_type === "lead" ? "justify-start" : "justify-end"}`}>
                {msg.sender_type === "lead" && <User className="size-4 text-muted-foreground shrink-0 mt-1" />}
                <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${
                  msg.sender_type === "lead" ? "bg-muted" :
                  msg.sender_type === "ai_assistant" ? "bg-primary text-white" : "bg-blue-600 text-white"
                }`}>
                  {msg.content}
                  {msg.sender_type === "ai_assistant" && <p className="text-xs opacity-70 mt-0.5">🤖 AI</p>}
                  {msg.sender_type === "human_agent" && <p className="text-xs opacity-70 mt-0.5">👤 You</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => e.key === "Enter" && message && sendMessage({ action: "send_message", content: message })}
                className="flex-1"
              />
              <Button size="icon" onClick={() => message && sendMessage({ action: "send_message", content: message })} disabled={sending || !message}>
                <Send className="size-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 w-full"
              onClick={() => { const lastLead = selected.crm_messages?.filter((m: any) => m.sender_type === "lead").slice(-1)[0]; if (lastLead) sendMessage({ action: "ai_reply", content: lastLead.content }); }}>
              <Bot className="size-3.5" /> Let AI Reply
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Inbox className="size-12 mx-auto mb-3 opacity-30" />
            <p>Select a conversation</p>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 🖥️ STEP 5 — Create Analytics Page

### `/app/(routes)/(dashboard)/analytics/page.tsx`

```typescript
"use client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, Users, FileText, MessageSquare, DollarSign, Sparkles, CheckCircle } from "lucide-react";

export default function AnalyticsPage() {
  const { data, isPending } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/overview");
      return res.json();
    },
  });

  const overview = data?.overview || {};
  const leadsByStage: any[] = data?.leadsByStage || [];
  const aiRecs: string[] = data?.aiRecommendations || [];

  const metrics = [
    { label: "Total Posts", value: overview.totalPosts || 0, sub: `${overview.publishedPosts || 0} published`, icon: FileText, color: "text-blue-500" },
    { label: "Queued Posts", value: overview.queuedPosts || 0, sub: "Scheduled to publish", icon: TrendingUp, color: "text-orange-500" },
    { label: "Total Leads", value: overview.totalLeads || 0, sub: `${overview.qualifiedLeads || 0} qualified`, icon: Users, color: "text-purple-500" },
    { label: "Pipeline Value", value: `₹${(overview.totalDealValue || 0).toLocaleString()}`, sub: `₹${(overview.wonRevenue || 0).toLocaleString()} won`, icon: DollarSign, color: "text-green-500" },
  ];

  return (
    <div className="max-w-5xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="size-6 text-primary" /> Growth Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Real-time performance across content, leads & revenue</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map((m, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={`size-4 ${m.color}`} />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              {isPending ? <Skeleton className="h-8 w-16" /> : (
                <>
                  <p className="text-2xl font-bold">{m.value}</p>
                  <p className="text-xs text-muted-foreground">{m.sub}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Leads by Stage */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="size-4" /> Leads by Stage</CardTitle></CardHeader>
          <CardContent>
            {isPending ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
            ) : (
              <div className="space-y-2">
                {leadsByStage.map((item: any) => {
                  const maxCount = Math.max(...leadsByStage.map((l: any) => l.count), 1);
                  return (
                    <div key={item.stage} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="capitalize">{item.stage.replace("_", " ")}</span>
                        <span className="font-medium">{item.count}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(item.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Recommendations */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="size-4 text-primary" /> AI Strategy Recommendations</CardTitle></CardHeader>
          <CardContent>
            {isPending ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : (
              <div className="space-y-3">
                {aiRecs.map((rec: string, i: number) => (
                  <div key={i} className="flex gap-2 p-3 rounded-lg bg-primary/5 border border-primary/15">
                    <CheckCircle className="size-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm">{rec}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Content Performance Note */}
      <Card className="border-dashed">
        <CardContent className="pt-4 text-center text-sm text-muted-foreground space-y-1">
          <p className="font-medium">📊 Real-time Social Analytics</p>
          <p>Connect your Instagram, Facebook & LinkedIn accounts in <strong>Settings</strong> to unlock live reach, impressions, engagement rate & Meta Ads ROAS data.</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## ✅ TASK CHECKLIST

```
STEP 1 — DATABASE
[ ] Run lib/db/07-crm-analytics-tables.sql in Supabase SQL Editor
    → Creates: leads, crm_conversations, crm_messages + indexes

STEP 2 — SIDEBAR
[ ] Open app/(routes)/(dashboard)/_common/app-sidebar.tsx
[ ] Add Users, Inbox, BarChart3 to lucide imports
[ ] Add "CRM Pipeline", "CRM Inbox", "Analytics" to mainNav array

STEP 3 — API ROUTES
[ ] Create app/api/crm/leads/route.ts
[ ] Create app/api/crm/leads/[id]/route.ts
[ ] Create app/api/crm/conversations/route.ts
[ ] Create app/api/analytics/overview/route.ts

STEP 4 — CRM PAGES
[ ] Create app/(routes)/(dashboard)/crm/layout.tsx
[ ] Create app/(routes)/(dashboard)/crm/pipeline/page.tsx
[ ] Create app/(routes)/(dashboard)/crm/inbox/page.tsx

STEP 5 — ANALYTICS PAGE
[ ] Create app/(routes)/(dashboard)/analytics/page.tsx

STEP 6 — TEST
[ ] npm run dev
[ ] Visit /crm/pipeline → Click "Add Lead" → Add a test lead → Verify it appears in kanban
[ ] Move lead to a different stage via dropdown → Verify it moves
[ ] Visit /crm/inbox → Should show empty state (no conversations yet — correct)
[ ] Visit /analytics → Verify metrics show (posts count, leads count)
[ ] AI recommendations should appear (may take 5-10 seconds)
[ ] Check Supabase: leads table has your test lead row
```

---

## 🏗️ Flow Diagram

```
CRM PIPELINE FLOW:
═══════════════════════════════════════════════════════

Lead enters system (manual / Instagram DM / Meta Ad)
          │
          ▼
POST /api/crm/leads → Insert into leads table
          │
          ▼
Appears in /crm/pipeline Kanban as "New Lead"
          │
          ▼
Sales rep moves card → PATCH /api/crm/leads/[id]
          │
          ▼
Stage: new → contacted → qualified → booked → closed_won

═══════════════════════════════════════════════════════

UNIFIED INBOX FLOW:
═══════════════════════════════════════════════════════

Incoming message (Instagram DM / WhatsApp / Web chat)
          │
          ▼
POST /api/crm/conversations (action: ai_reply)
          │
          ▼
Gemini AI reads brand profile → generates reply
          │
          ▼
Reply saved as ai_assistant message
          │
          ▼
Shows in /crm/inbox conversation thread
          │
          ▼
Human agent can "Take Over" → sends as human_agent

═══════════════════════════════════════════════════════

ANALYTICS FLOW:
═══════════════════════════════════════════════════════

User visits /analytics
          │
          ▼
GET /api/analytics/overview
          │
          ├── scheduled_posts table → post stats
          ├── leads table → pipeline stats
          └── social_comments table → engagement stats
          │
          ▼
Gemini AI generates 3 strategy recommendations
          │
          ▼
Dashboard renders metrics + charts + AI recommendations
```

---

*Member 3 Plan — Lemon AI Engineering | September 2026*

---

---

# 🔴 PHASE 2 — CRITICAL GAP TASKS (Member 3)
## Gaps from Sir's Requirements NOT yet covered

---

## 📞 GAP 1: AI Voice Calling Agent (Frontend UI Only)
> **Sir's Requirement:** `AI Calling → Outbound Calls, Inbound Calls, Lead Qualification`
> ⚠️ **Note from team:** Backend (Vapi.ai) integration is for a later phase. Build the UI now so it's ready.

### New Files to Create:
```
app/(routes)/(dashboard)/ai-calling/
  └── page.tsx                                     ← YOU CREATE
```

### `/app/(routes)/(dashboard)/ai-calling/page.tsx`

```typescript
"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, PhoneCall, PhoneIncoming, PhoneOff, Clock, User, CheckCircle, AlertCircle, Sparkles } from "lucide-react";

const MOCK_CALL_LOGS = [
  { id: 1, leadName: "Rahul Sharma", phone: "+91 98765 43210", status: "completed", duration: "4m 32s", outcome: "Appointment Booked", score: 8, time: "2 hours ago" },
  { id: 2, leadName: "Priya Patel", phone: "+91 87654 32109", status: "voicemail", duration: "0m 45s", outcome: "Voicemail Left", score: 6, time: "4 hours ago" },
  { id: 3, leadName: "Amit Singh", phone: "+91 76543 21098", status: "completed", duration: "2m 15s", outcome: "Not Interested", score: 2, time: "Yesterday" },
  { id: 4, leadName: "Neha Gupta", phone: "+91 65432 10987", status: "completed", duration: "7m 01s", outcome: "Qualified - Follow Up", score: 7, time: "Yesterday" },
];

const STATUS_CONFIG: Record<string, { color: string; icon: string }> = {
  completed: { color: "bg-green-100 text-green-700", icon: "✅" },
  voicemail: { color: "bg-yellow-100 text-yellow-700", icon: "📱" },
  no_answer: { color: "bg-red-100 text-red-700", icon: "❌" },
  in_progress: { color: "bg-blue-100 text-blue-700", icon: "🔄" },
};

export default function AICallingPage() {
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");

  const stats = [
    { label: "Calls Today", value: "12", icon: Phone, color: "text-blue-500" },
    { label: "Appointments Booked", value: "3", icon: CheckCircle, color: "text-green-500" },
    { label: "Avg Call Duration", value: "3m 42s", icon: Clock, color: "text-orange-500" },
    { label: "Connection Rate", value: "67%", icon: PhoneCall, color: "text-purple-500" },
  ];

  return (
    <div className="max-w-5xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Phone className="size-6 text-primary" /> AI Voice Calling Agent</h1>
        <p className="text-muted-foreground text-sm mt-1">AI calls your leads, qualifies them with BANT, and books appointments automatically</p>
      </div>

      {/* Coming Soon Banner */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-purple-500/5">
        <CardContent className="pt-4 flex items-start gap-3">
          <Sparkles className="size-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">AI Calling Engine — Powered by Vapi.ai</p>
            <p className="text-xs text-muted-foreground mt-0.5">Full voice AI integration is coming in the next sprint. The UI and call logs are ready. Once connected, the AI will automatically call leads with score ≥ 7 within 2 minutes of them entering the CRM.</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {["Ultra-low latency (<600ms)", "Natural conversation", "Auto appointment booking", "Call recordings", "Transcript analysis"].map(f => (
                <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <Card key={i}>
            <CardContent className="pt-4 flex items-center gap-3">
              <s.icon className={`size-5 ${s.color}`} />
              <div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Manual Call Trigger */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><PhoneCall className="size-4 text-green-500" /> Manual Call</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Lead Name</Label>
              <Input placeholder="John Doe" value={manualName} onChange={e => setManualName(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone Number</Label>
              <Input placeholder="+91 98765 43210" value={manualPhone} onChange={e => setManualPhone(e.target.value)} className="text-sm" />
            </div>
            <Button className="w-full gap-2" disabled={!manualPhone || !manualName}
              onClick={() => alert("🚀 AI Calling engine coming soon! This will trigger Vapi.ai to call the lead.")}>
              <PhoneCall className="size-4" /> Call Now (AI)
            </Button>
            <p className="text-xs text-center text-muted-foreground">Powered by Vapi.ai — Coming Soon</p>
          </CardContent>
        </Card>

        {/* Auto-Call Settings */}
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">⚙️ Auto-Call Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
              <div>
                <p className="text-sm font-medium">Auto-Call High-Intent Leads</p>
                <p className="text-xs text-muted-foreground">Automatically call leads with score ≥ 7 within 2 minutes</p>
              </div>
              <Badge className="bg-yellow-100 text-yellow-700">Coming Soon</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
              <div>
                <p className="text-sm font-medium">Inbound AI Receptionist</p>
                <p className="text-xs text-muted-foreground">AI answers your business phone and logs callers to CRM</p>
              </div>
              <Badge className="bg-yellow-100 text-yellow-700">Coming Soon</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
              <div>
                <p className="text-sm font-medium">Call Objective: BANT Qualification</p>
                <p className="text-xs text-muted-foreground">Budget, Authority, Need, Timeline — AI asks all 4 questions</p>
              </div>
              <Badge className="bg-green-100 text-green-700">Configured</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">📋 Recent Call Logs</CardTitle>
            <Badge variant="outline" className="text-xs">Demo Data — Live data connects with Vapi.ai</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {MOCK_CALL_LOGS.map((call) => {
              const config = STATUS_CONFIG[call.status] || STATUS_CONFIG.completed;
              return (
                <div key={call.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="size-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{call.leadName}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${config.color}`}>{config.icon} {call.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{call.phone} · {call.duration} · {call.time}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium">{call.outcome}</p>
                    <p className="text-xs text-muted-foreground">Intent: {call.score}/10</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Env Setup */}
      <Card className="border-dashed">
        <CardHeader><CardTitle className="text-base">🔧 Environment Variables Required (Later Phase)</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted/60 p-3 rounded-lg font-mono">{`# Add these when connecting Vapi.ai
VAPI_API_KEY=your_vapi_api_key_here
VAPI_PHONE_NUMBER_ID=your_phone_number_id
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token`}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Add to Sidebar:
```typescript
{ name: "AI Calling", href: "/ai-calling", icon: Phone },
```

---

## 📊 GAP 2: Lead Activities Timeline (CRM Enhancement)
> **Sir's Requirement:** `CRM → Activities`

### Modify Existing File (your file):
Open `app/(routes)/(dashboard)/crm/pipeline/page.tsx`

After the kanban board, add this section at the bottom:

```typescript
// ADD this section after the kanban board div
<Card className="mt-4">
  <CardHeader>
    <CardTitle className="text-base flex items-center gap-2">
      <Clock className="size-4" /> Recent Lead Activity
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-3">
      {(data?.leads || []).slice(0, 5).map((lead: any) => (
        <div key={lead.id} className="flex items-center gap-3 text-sm">
          <div className="size-2 rounded-full bg-primary shrink-0" />
          <span className="font-medium">{lead.name}</span>
          <span className="text-muted-foreground text-xs">moved to</span>
          <Badge variant="outline" className="text-xs capitalize">{lead.stage.replace("_", " ")}</Badge>
          <span className="text-xs text-muted-foreground ml-auto">
            {new Date(lead.updated_at).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  </CardContent>
</Card>
```

Also add `Clock` to imports at the top of the file:
```typescript
import { Users, Plus, Phone, Mail, Building, DollarSign, Clock } from "lucide-react";
```

---

## 📊 GAP 3: Enhanced Analytics (Real Social API Ready)
> **Sir's Requirement:** `Growth Analytics → Social Analytics, Ad Analytics`

### Modify Existing File (your file):
Open `app/(routes)/(dashboard)/analytics/page.tsx`

Add this section after the existing analytics cards to show the social platforms connection status:

```typescript
// ADD after the Content Performance Note card at the bottom
<Card>
  <CardHeader>
    <CardTitle className="text-base flex items-center gap-2">
      <BarChart3 className="size-4" /> Platform Analytics Status
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      {[
        { platform: "Instagram", icon: "📸", status: "Connect in Settings for live Reach, Impressions & Engagement data", connected: false },
        { platform: "Facebook", icon: "📘", status: "Connect for Facebook Page insights", connected: false },
        { platform: "LinkedIn", icon: "💼", status: "Connect for LinkedIn analytics", connected: false },
        { platform: "Meta Ads", icon: "📣", status: "Connect for CTR, CPC, ROAS & Spend data", connected: false },
      ].map((item, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
          <span className="text-lg">{item.icon}</span>
          <div className="flex-1">
            <p className="text-sm font-medium">{item.platform}</p>
            <p className="text-xs text-muted-foreground">{item.status}</p>
          </div>
          <Badge
            className={item.connected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}
          >
            {item.connected ? "✅ Connected" : "Not Connected"}
          </Badge>
        </div>
      ))}
    </div>
    <p className="text-xs text-muted-foreground text-center mt-3">
      Go to <strong>Settings</strong> to connect your social accounts and unlock real-time analytics
    </p>
  </CardContent>
</Card>
```

---

## ✅ PHASE 2 TASK CHECKLIST (Member 3 Additional)

```
GAP 1 — AI VOICE CALLING UI
[ ] Create app/(routes)/(dashboard)/ai-calling/page.tsx
[ ] Add Phone icon to lucide imports in sidebar
[ ] Add "AI Calling" to mainNav in sidebar
[ ] TEST: Visit /ai-calling → verify page loads with demo call logs
[ ] NOTE: Do NOT add backend yet — only frontend UI

GAP 2 — LEAD ACTIVITIES
[ ] Open app/(routes)/(dashboard)/crm/pipeline/page.tsx
[ ] Add Clock to lucide imports
[ ] Add "Recent Lead Activity" card after kanban board

GAP 3 — ENHANCED ANALYTICS
[ ] Open app/(routes)/(dashboard)/analytics/page.tsx
[ ] Add Platform Analytics Status card at bottom
[ ] No new API needed — purely UI enhancement
```

---

## 🗺️ MEMBER 3 COMPLETE FILE MAP (All Phases)

```
Phase 1 (Original):
  ✅ app/api/crm/leads/route.ts
  ✅ app/api/crm/leads/[id]/route.ts
  ✅ app/api/crm/conversations/route.ts
  ✅ app/api/analytics/overview/route.ts
  ✅ app/(routes)/(dashboard)/crm/layout.tsx
  ✅ app/(routes)/(dashboard)/crm/pipeline/page.tsx
  ✅ app/(routes)/(dashboard)/crm/inbox/page.tsx
  ✅ app/(routes)/(dashboard)/analytics/page.tsx
  ✅ lib/db/07-crm-analytics-tables.sql

Phase 2 (Gap Fill):
  🔴 app/(routes)/(dashboard)/ai-calling/page.tsx  ← NEW (frontend only)
  🔴 crm/pipeline/page.tsx                         ← MODIFY (add activities)
  🔴 analytics/page.tsx                            ← MODIFY (add platform status)

⚠️ IMPORTANT: Member 2's website-bot and whatsapp-bot DEPEND on your
   crm_conversations and crm_messages tables.
   RUN YOUR SQL FIRST (07-crm-analytics-tables.sql) before Member 2 tests their features.
```

---

## 📋 SQL ORDER — VERY IMPORTANT!

Run SQL files in this order to avoid dependency errors:

```
1️⃣  ALREADY EXISTS:
    lib/db/create-social-scheduling-tables.sql   (scheduled_posts table)
    lib/db/create-brand-profiles-and-meta-ads-tables.sql (brand_profiles table)

2️⃣  MEMBER 1 runs:
    lib/db/05-competitor-studio-tables.sql

3️⃣  MEMBER 3 runs FIRST (before Member 2 tests):
    lib/db/07-crm-analytics-tables.sql

4️⃣  MEMBER 2 runs:
    lib/db/06-social-automation-tables.sql
```

---

*Member 3 Plan — Lemon AI Engineering | September 2026 (Updated with Gap Tasks)*
