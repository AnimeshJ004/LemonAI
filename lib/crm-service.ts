import { getInsforgeAdminClient } from "./insforge-server";
import { randomUUID } from "node:crypto";

export type LeadStage =
  | "new"
  | "contacted"
  | "qualified"
  | "booked"
  | "proposal"
  | "closed_won"
  | "closed_lost";

export type ChannelSource =
  | "website"
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "voice"
  | "organic"
  | "meta_ads";

export interface BANTBreakdown {
  budgetScore: number;
  authorityScore: number;
  needScore: number;
  timingScore: number;
  summary: string;
  evaluatedAt: string;
}

export interface VoiceCallLog {
  callId?: string;
  timestamp: string;
  status: "initiated" | "completed" | "failed" | "no-answer";
  durationSeconds?: number;
  summary?: string;
  recordingUrl?: string;
  transcript?: string;
}

export interface LeadMetadata {
  company?: string;
  notes?: string;
  bant?: BANTBreakdown;
  bookingInfo?: {
    bookingId?: string;
    scheduledAt?: string;
    calLink?: string;
    notes?: string;
  };
  callLogs?: VoiceCallLog[];
  [key: string]: any;
}

export interface Lead {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: ChannelSource | string;
  stage: LeadStage;
  score: number; // 0 to 10
  deal_value: number;
  metadata: LeadMetadata;
  created_at: string;
  updated_at: string;
}

export interface CRMConversation {
  id: string;
  user_id: string;
  lead_id: string | null;
  channel: ChannelSource | string;
  status: "open" | "resolved" | "snoozed";
  is_ai_active: boolean;
  last_message_at: string;
  created_at: string;
  lead?: Lead | null;
  messages?: CRMMessage[];
  unread_count?: number;
}

export interface CRMMessage {
  id: string;
  conversation_id: string;
  sender_type: "lead" | "ai_assistant" | "human_agent";
  content: string;
  created_at: string;
}

// ----------------------------------------------------------------------
// IN-MEMORY STORE & SEED DATA (Resilient fallback when DB tables not migrated)
// ----------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";

let memoryLeads = new Map<string, Lead[]>();
let memoryConversations = new Map<string, CRMConversation[]>();
let memoryMessages = new Map<string, CRMMessage[]>();

// --- FILE PERSISTENCE FOR DEV MODE ---
const DB_FILE = path.join(process.cwd(), ".lemon_crm_memory.json");

function loadFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      if (data.leads) {
        memoryLeads = new Map(Object.entries(data.leads));
      }
      if (data.conversations) {
        memoryConversations = new Map(Object.entries(data.conversations));
      }
      if (data.messages) {
        memoryMessages = new Map(Object.entries(data.messages));
      }
    }
  } catch (err) {
    console.error("Error loading dev DB file:", err);
  }
}

function saveToDisk() {
  try {
    const data = {
      leads: Object.fromEntries(memoryLeads),
      conversations: Object.fromEntries(memoryConversations),
      messages: Object.fromEntries(memoryMessages),
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error saving dev DB file:", err);
  }
}

loadFromDisk();

const INITIAL_SEED_LEADS: Lead[] = [
  {
    id: "e1a90d8a-3601-443b-85ea-2b8d0c144701",
    user_id: "user_lemon_default",
    name: "Sarah Jenkins",
    email: "sarah@growthwave.io",
    phone: "+1 (555) 349-2910",
    source: "website",
    stage: "qualified",
    score: 8.5,
    deal_value: 2400,
    metadata: {
      company: "GrowthWave Digital",
      notes: "Inquired about AI marketing autopilot. High intent for multi-channel setup.",
      bant: {
        budgetScore: 9,
        authorityScore: 8,
        needScore: 9,
        timingScore: 8,
        summary: "VP of Growth. Ready to deploy this quarter. Budget verified.",
        evaluatedAt: new Date().toISOString(),
      },
    },
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "e1a90d8a-3601-443b-85ea-2b8d0c144702",
    user_id: "user_lemon_default",
    name: "Michael Chang",
    email: "mchang@apexrealty.com",
    phone: "+1 (555) 890-1234",
    source: "whatsapp",
    stage: "booked",
    score: 9.0,
    deal_value: 4500,
    metadata: {
      company: "Apex Realty Group",
      notes: "Booked demo via WhatsApp Cloud bot. Urgent need for automated Instagram Reels.",
      bookingInfo: {
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        calLink: "https://cal.com/lemon-demo/30min",
      },
      bant: {
        budgetScore: 9,
        authorityScore: 9,
        needScore: 10,
        timingScore: 9,
        summary: "Founder/CEO. Needs instant deployment for 5 agents.",
        evaluatedAt: new Date().toISOString(),
      },
    },
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "e1a90d8a-3601-443b-85ea-2b8d0c144703",
    user_id: "user_lemon_default",
    name: "Elena Rostova",
    email: "elena@lumina-skincare.com",
    phone: "+1 (555) 678-9012",
    source: "meta_ads",
    stage: "new",
    score: 6.0,
    deal_value: 1800,
    metadata: {
      company: "Lumina Skincare",
      notes: "Clicked awareness reel campaign. Inquired about ad creative generation.",
    },
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "e1a90d8a-3601-443b-85ea-2b8d0c144704",
    user_id: "user_lemon_default",
    name: "David Sterling",
    email: "dsterling@sterlingfin.com",
    phone: "+1 (555) 432-1098",
    source: "website",
    stage: "proposal",
    score: 8.0,
    deal_value: 6000,
    metadata: {
      company: "Sterling Financial",
      notes: "Proposal sent for enterprise LinkedIn + Blog automation package.",
    },
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "e1a90d8a-3601-443b-85ea-2b8d0c144705",
    user_id: "user_lemon_default",
    name: "Aarav Patel",
    email: "aarav@patelconsulting.in",
    phone: "+91 98201 12345",
    source: "organic",
    stage: "closed_won",
    score: 9.5,
    deal_value: 8500,
    metadata: {
      company: "Patel Consulting",
      notes: "Onboarded and paid annual subscription.",
    },
    created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_SEED_CONVERSATIONS: CRMConversation[] = [
  {
    id: "conv-sarah-jenkins-01",
    user_id: "user_lemon_default",
    lead_id: "e1a90d8a-3601-443b-85ea-2b8d0c144701",
    channel: "website",
    status: "open",
    is_ai_active: true,
    last_message_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: "conv-michael-chang-02",
    user_id: "user_lemon_default",
    lead_id: "e1a90d8a-3601-443b-85ea-2b8d0c144702",
    channel: "whatsapp",
    status: "open",
    is_ai_active: true,
    last_message_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: "conv-elena-rostova-03",
    user_id: "user_lemon_default",
    lead_id: "e1a90d8a-3601-443b-85ea-2b8d0c144703",
    channel: "instagram",
    status: "open",
    is_ai_active: false,
    last_message_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

const INITIAL_SEED_MESSAGES: Record<string, CRMMessage[]> = {
  "conv-sarah-jenkins-01": [
    {
      id: "msg-sj-1",
      conversation_id: "conv-sarah-jenkins-01",
      sender_type: "lead",
      content: "Hi there! I saw your post about autonomous AI marketing. Can Lemon AI handle multi-channel video content repurposing?",
      created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    },
    {
      id: "msg-sj-2",
      conversation_id: "conv-sarah-jenkins-01",
      sender_type: "ai_assistant",
      content: "Hello Sarah! Absolutely. Lemon AI autonomously generates and schedules short-form video clips, carousel slides, and LinkedIn articles tailored to your brand voice. Are you looking to deploy this for your agency or an in-house team?",
      created_at: new Date(Date.now() - 1000 * 60 * 23).toISOString(),
    },
    {
      id: "msg-sj-3",
      conversation_id: "conv-sarah-jenkins-01",
      sender_type: "lead",
      content: "For our marketing agency clients — we manage around 10 accounts and need to scale up our content output this quarter.",
      created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    },
    {
      id: "msg-sj-4",
      conversation_id: "conv-sarah-jenkins-01",
      sender_type: "ai_assistant",
      content: "That's a great use case! Our Agency tier supports multi-brand workspaces and bulk publishing. Would you like to schedule a 15-minute walkthrough demo with our product team?",
      created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
  ],
  "conv-michael-chang-02": [
    {
      id: "msg-mc-1",
      conversation_id: "conv-michael-chang-02",
      sender_type: "lead",
      content: "Hello! We run a real estate brokerage in Miami with 5 agents. Does your WhatsApp bot qualify buyer leads automatically?",
      created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
    {
      id: "msg-mc-2",
      conversation_id: "conv-michael-chang-02",
      sender_type: "ai_assistant",
      content: "Hi Michael! Yes, Lemon AI connects directly with WhatsApp Cloud API to collect buyer budgets, preferred locations, and pre-qualification criteria 24/7, then syncs them instantly to your CRM pipeline.",
      created_at: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    },
    {
      id: "msg-mc-3",
      conversation_id: "conv-michael-chang-02",
      sender_type: "lead",
      content: "That sounds awesome. Can you send me the calendar link to book a quick setup call?",
      created_at: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
    },
    {
      id: "msg-mc-4",
      conversation_id: "conv-michael-chang-02",
      sender_type: "ai_assistant",
      content: "Here you go Michael! You can pick an instant slot here: https://cal.com/lemon-demo/30min. We're excited to help you automate your real estate pipeline.",
      created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
  ],
  "conv-elena-rostova-03": [
    {
      id: "msg-er-1",
      conversation_id: "conv-elena-rostova-03",
      sender_type: "lead",
      content: "Hey, I came across your Instagram ad. How does the AI generate ad creatives for skincare products?",
      created_at: new Date(Date.now() - 1000 * 60 * 130).toISOString(),
    },
    {
      id: "msg-er-2",
      conversation_id: "conv-elena-rostova-03",
      sender_type: "ai_assistant",
      content: "Hello Elena! You simply connect your product catalog or upload brand assets, and our AI crafts high-converting Meta and TikTok ad creatives with compelling hooks and copy variants.",
      created_at: new Date(Date.now() - 1000 * 60 * 125).toISOString(),
    },
    {
      id: "msg-er-3",
      conversation_id: "conv-elena-rostova-03",
      sender_type: "lead",
      content: "What is the typical pricing for an e-commerce brand?",
      created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
  ],
};

function ensureMemoryStore(userId: string) {
  loadFromDisk();
  if (!memoryLeads.has(userId) || (memoryLeads.get(userId) || []).length === 0) {
    const defaultLeads = memoryLeads.get("user_lemon_default");
    const base = defaultLeads && defaultLeads.length > 0 ? defaultLeads : INITIAL_SEED_LEADS;
    memoryLeads.set(userId, base.map((l) => ({ ...l, user_id: userId })));
    saveToDisk();
  }
  if (!memoryConversations.has(userId) || (memoryConversations.get(userId) || []).length === 0) {
    const defaultConvs = memoryConversations.get("user_lemon_default");
    const baseConvs = defaultConvs && defaultConvs.length > 0 ? defaultConvs : INITIAL_SEED_CONVERSATIONS;
    memoryConversations.set(userId, baseConvs.map((c) => ({ ...c, user_id: userId })));

    for (const conv of baseConvs) {
      if (!memoryMessages.has(conv.id) || (memoryMessages.get(conv.id) || []).length === 0) {
        const msgs = INITIAL_SEED_MESSAGES[conv.id] || [];
        memoryMessages.set(conv.id, [...msgs]);
      }
    }
    saveToDisk();
  } else {
    // Ensure existing conversations have their messages loaded if empty
    const convs = memoryConversations.get(userId) || [];
    let updated = false;
    for (const conv of convs) {
      if (!memoryMessages.has(conv.id) || (memoryMessages.get(conv.id) || []).length === 0) {
        if (INITIAL_SEED_MESSAGES[conv.id]) {
          memoryMessages.set(conv.id, [...INITIAL_SEED_MESSAGES[conv.id]]);
          updated = true;
        }
      }
    }
    if (updated) saveToDisk();
  }
}

// ----------------------------------------------------------------------
// LEADS REPOSITORY (PostgreSQL via InsForge with Resilient Memory Store)
// ----------------------------------------------------------------------

export async function getLeadsForUser(userId: string): Promise<Lead[]> {
  ensureMemoryStore(userId);
  try {
    const admin = getInsforgeAdminClient();
    const { data, error } = await admin.database
      .from("leads")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      const mem = memoryLeads.get(userId) || [];
      const dbIds = new Set(data.map((d: any) => d.id));
      const onlyInMem = mem.filter((m) => !dbIds.has(m.id));
      return [...data, ...onlyInMem] as Lead[];
    }
    if (error) {
      console.warn("Notice: reading leads from DB:", error.message || error);
    }
  } catch (err: any) {
    console.warn("Notice: reading leads from DB:", err?.message);
  }

  // Fallback to in-memory store so leads are never lost
  return memoryLeads.get(userId) || [];
}

export async function getLeadById(leadId: string, userId?: string): Promise<Lead | null> {
  loadFromDisk();
  try {
    const admin = getInsforgeAdminClient();
    let query = admin.database.from("leads").select("*").eq("id", leadId);
    if (userId) {
      query = query.eq("user_id", userId);
    }
    const { data, error } = await query.maybeSingle();

    if (!error && data) {
      return data as Lead;
    }
  } catch (err: any) {
    console.warn("Notice: reading lead by id from DB:", err?.message);
  }

  // Memory fallback
  if (userId) {
    const list = memoryLeads.get(userId) || [];
    const found = list.find((l) => l.id === leadId);
    if (found) return found;
  }
  for (const [, list] of memoryLeads.entries()) {
    const found = list.find((l) => l.id === leadId);
    if (found) return found;
  }

  return null;
}

export async function createLead(payload: Partial<Lead> & { user_id: string }): Promise<Lead> {
  ensureMemoryStore(payload.user_id);
  const now = new Date().toISOString();
  const newLead: Lead = {
    id: payload.id || randomUUID(),
    user_id: payload.user_id,
    name: payload.name || "Anonymous Lead",
    email: payload.email || null,
    phone: payload.phone || null,
    source: payload.source || "website",
    stage: payload.stage || "new",
    score: payload.score ?? 0,
    deal_value: payload.deal_value ?? 0,
    metadata: payload.metadata || {},
    created_at: now,
    updated_at: now,
  };

  // 1. Immediately store in memory so newly added lead is immediately available
  const memList = memoryLeads.get(payload.user_id) || [];
  memList.unshift(newLead);
  memoryLeads.set(payload.user_id, memList);
  saveToDisk();

  // 2. Persist to PostgreSQL via InsForge
  try {
    const admin = getInsforgeAdminClient();
    const { data, error } = await admin.database
      .from("leads")
      .insert([newLead])
      .select()
      .maybeSingle();

    if (!error && data) {
      const idx = memList.findIndex((l) => l.id === newLead.id);
      if (idx !== -1) memList[idx] = data as Lead;
      return data as Lead;
    }
    if (error) {
      console.warn("Notice: saving lead to DB:", error.message || error);
    }
  } catch (err: any) {
    console.warn("Notice: saving lead to DB:", err?.message);
  }

  return newLead;
}

export async function updateLead(
  leadId: string,
  updates: Partial<Lead>,
  userId?: string
): Promise<Lead | null> {
  const now = new Date().toISOString();

  // 1. Update in memory
  let foundInMem: Lead | null = null;
  if (userId) {
    const list = memoryLeads.get(userId) || [];
    const idx = list.findIndex((l) => l.id === leadId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates, updated_at: now };
      foundInMem = list[idx];
    }
  } else {
    for (const [, list] of memoryLeads.entries()) {
      const idx = list.findIndex((l) => l.id === leadId);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates, updated_at: now };
        foundInMem = list[idx];
        break;
      }
    }
  }
  
  if (foundInMem) {
    saveToDisk();
  }

  // 2. Update in DB
  try {
    const admin = getInsforgeAdminClient();
    let query = admin.database
      .from("leads")
      .update({ ...updates, updated_at: now })
      .eq("id", leadId);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query.select().maybeSingle();

    if (!error && data) {
      return data as Lead;
    }
  } catch (err: any) {
    console.warn("Notice: updating lead in DB:", err?.message);
  }

  return foundInMem;
}

export async function deleteLead(leadId: string, userId: string): Promise<boolean> {
  // Remove from memory
  const memList = memoryLeads.get(userId) || [];
  const nextList = memList.filter((l) => l.id !== leadId);
  memoryLeads.set(userId, nextList);
  saveToDisk();

  try {
    const admin = getInsforgeAdminClient();
    const { error } = await admin.database
      .from("leads")
      .delete()
      .eq("id", leadId)
      .eq("user_id", userId);
    return !error;
  } catch (err: any) {
    console.warn("Notice: deleting lead in DB:", err?.message);
  }
  return true;
}

export async function findOrCreateLeadByContact(params: {
  user_id: string;
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
}): Promise<Lead> {
  const { user_id, name, email, phone, source } = params;
  ensureMemoryStore(user_id);

  // Search existing by email or phone in Postgres
  try {
    const admin = getInsforgeAdminClient();
    let query = admin.database
      .from("leads")
      .select("*")
      .eq("user_id", user_id);

    if (email) {
      query = query.eq("email", email);
    } else if (phone) {
      query = query.eq("phone", phone);
    }

    const { data: existing } = await query.limit(1).maybeSingle();
    if (existing) {
      const updates: Partial<Lead> = {};
      if (name && (!existing.name || existing.name === "Anonymous Lead")) updates.name = name;
      if (phone && !existing.phone) updates.phone = phone;
      if (email && !existing.email) updates.email = email;
      if (Object.keys(updates).length > 0) {
        return (await updateLead(existing.id, updates, user_id)) || existing;
      }
      return existing as Lead;
    }
  } catch (err: any) {
    console.warn("Notice searching lead by contact:", err?.message);
  }

  // Search in memory
  const all = memoryLeads.get(user_id) || [];
  const found = all.find(
    (l) =>
      (email && l.email && l.email.toLowerCase() === email.toLowerCase()) ||
      (phone && l.phone && l.phone.replace(/\D/g, "") === phone.replace(/\D/g, ""))
  );

  if (found) {
    const updates: Partial<Lead> = {};
    if (name && (!found.name || found.name === "Anonymous Lead")) updates.name = name;
    if (phone && !found.phone) updates.phone = phone;
    if (email && !found.email) updates.email = email;
    if (Object.keys(updates).length > 0) {
      return (await updateLead(found.id, updates, user_id)) || found;
    }
    return found;
  }

  return await createLead({
    user_id,
    name: name || "Website Visitor",
    email: email || null,
    phone: phone || null,
    source: source || "website",
    stage: "new",
    score: 5,
    deal_value: 0,
    metadata: {},
  });
}

// ----------------------------------------------------------------------
// CONVERSATIONS REPOSITORY
// ----------------------------------------------------------------------

export async function getConversationsForUser(userId: string): Promise<CRMConversation[]> {
  ensureMemoryStore(userId);
  try {
    const admin = getInsforgeAdminClient();
    const { data: convs, error } = await admin.database
      .from("crm_conversations")
      .select("*, lead:leads(*)")
      .eq("user_id", userId)
      .order("last_message_at", { ascending: false });

    if (!error && convs && convs.length > 0) {
      return convs as CRMConversation[];
    }
  } catch (err: any) {
    console.warn("Notice: reading conversations from DB:", err?.message);
  }

  // Memory fallback with attached latest messages and lead
  const convs = memoryConversations.get(userId) || [];
  const leads = memoryLeads.get(userId) || memoryLeads.get("user_lemon_default") || [];
  return convs.map((c) => {
    const msgs = memoryMessages.get(c.id) || [];
    const lead = leads.find((l) => l.id === c.lead_id) || null;
    return {
      ...c,
      lead,
      messages: msgs,
    };
  });
}

export async function getConversationWithMessages(
  conversationId: string,
  userId?: string
): Promise<{ conversation: CRMConversation | null; messages: CRMMessage[] }> {
  loadFromDisk();
  try {
    const admin = getInsforgeAdminClient();
    let convQuery = admin.database
      .from("crm_conversations")
      .select("*, lead:leads(*)")
      .eq("id", conversationId);

    if (userId) {
      convQuery = convQuery.eq("user_id", userId);
    }

    const { data: conv } = await convQuery.maybeSingle();

    if (conv) {
      const { data: msgs } = await admin.database
        .from("crm_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      return {
        conversation: conv as CRMConversation,
        messages: (msgs as CRMMessage[]) || [],
      };
    }
  } catch (err: any) {
    console.warn("Notice: reading conv with messages from DB:", err?.message);
  }

  // Memory fallback
  let conv: CRMConversation | null = null;
  if (userId) {
    const list = memoryConversations.get(userId) || [];
    conv = list.find((c) => c.id === conversationId) || null;
  } else {
    for (const [, list] of memoryConversations.entries()) {
      const match = list.find((c) => c.id === conversationId);
      if (match) {
        conv = match;
        break;
      }
    }
  }

  if (conv) {
    const effectiveUserId = userId || conv.user_id;
    const leads = memoryLeads.get(effectiveUserId) || memoryLeads.get("user_lemon_default") || [];
    const lead = leads.find((l) => l.id === conv.lead_id) || null;
    conv = { ...conv, lead };
  }

  const messages = memoryMessages.get(conversationId) || [];
  return { conversation: conv, messages };
}

export async function createConversation(data: {
  user_id: string;
  lead_id?: string | null;
  channel: string;
  is_ai_active?: boolean;
}): Promise<CRMConversation> {
  ensureMemoryStore(data.user_id);
  const now = new Date().toISOString();
  const newConv: CRMConversation = {
    id: randomUUID(),
    user_id: data.user_id,
    lead_id: data.lead_id || null,
    channel: data.channel,
    status: "open",
    is_ai_active: data.is_ai_active ?? true,
    last_message_at: now,
    created_at: now,
  };

  try {
    const admin = getInsforgeAdminClient();
    const { data: inserted, error } = await admin.database
      .from("crm_conversations")
      .insert([newConv])
      .select("*, lead:leads(*)")
      .maybeSingle();

    if (!error && inserted) {
      const list = memoryConversations.get(data.user_id) || [];
      list.unshift(inserted as CRMConversation);
      memoryConversations.set(data.user_id, list);
      return inserted as CRMConversation;
    }
  } catch (err: any) {
    console.warn("Notice: inserting conversation in DB:", err?.message);
  }

  const list = memoryConversations.get(data.user_id) || [];
  list.unshift(newConv);
  memoryConversations.set(data.user_id, list);
  saveToDisk();
  return newConv;
}

export async function addMessage(data: {
  conversation_id: string;
  sender_type: "lead" | "ai_assistant" | "human_agent";
  content: string;
}): Promise<CRMMessage> {
  const now = new Date().toISOString();
  const newMsg: CRMMessage = {
    id: randomUUID(),
    conversation_id: data.conversation_id,
    sender_type: data.sender_type,
    content: data.content,
    created_at: now,
  };

  try {
    const admin = getInsforgeAdminClient();
    await admin.database
      .from("crm_conversations")
      .update({ last_message_at: now })
      .eq("id", data.conversation_id);

    const { data: inserted, error } = await admin.database
      .from("crm_messages")
      .insert([newMsg])
      .select()
      .maybeSingle();

    if (!error && inserted) {
      const list = memoryMessages.get(data.conversation_id) || [];
      list.push(inserted as CRMMessage);
      memoryMessages.set(data.conversation_id, list);
      return inserted as CRMMessage;
    }
  } catch (err: any) {
    console.warn("Notice: adding message in DB:", err?.message);
  }

  const list = memoryMessages.get(data.conversation_id) || [];
  list.push(newMsg);
  memoryMessages.set(data.conversation_id, list);

  // Update last_message_at in memory
  for (const [, convList] of memoryConversations.entries()) {
    const c = convList.find((item) => item.id === data.conversation_id);
    if (c) {
      c.last_message_at = now;
      break;
    }
  }

  saveToDisk();
  return newMsg;
}

export async function toggleAIActive(
  conversationId: string,
  is_ai_active: boolean,
  userId?: string
): Promise<CRMConversation | null> {
  if (userId) {
    ensureMemoryStore(userId);
  }
  try {
    const admin = getInsforgeAdminClient();
    let query = admin.database
      .from("crm_conversations")
      .update({ is_ai_active })
      .eq("id", conversationId);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query
      .select("*, lead:leads(*)")
      .maybeSingle();

    if (!error && data) {
      return data as CRMConversation;
    }
  } catch (err: any) {
    console.warn("Notice: toggling AI in DB:", err?.message);
  }

  for (const [, list] of memoryConversations.entries()) {
    const c = list.find((item) => item.id === conversationId);
    if (c) {
      c.is_ai_active = is_ai_active;
      saveToDisk();
      return c;
    }
  }
  return null;
}


