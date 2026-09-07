import { getInsforgeAdminClient } from "./insforge-server";

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

// In-memory fallback stores on globalThis to guarantee persistent state across Next.js route workers
const globalForCRM = globalThis as unknown as {
  crmMemoryLeads?: Map<string, Lead[]>;
  crmMemoryConversations?: Map<string, CRMConversation[]>;
  crmMemoryMessages?: Map<string, CRMMessage[]>;
};

const memoryLeads = globalForCRM.crmMemoryLeads || new Map<string, Lead[]>();
const memoryConversations = globalForCRM.crmMemoryConversations || new Map<string, CRMConversation[]>();
const memoryMessages = globalForCRM.crmMemoryMessages || new Map<string, CRMMessage[]>();

if (process.env.NODE_ENV !== "production") {
  globalForCRM.crmMemoryLeads = memoryLeads;
  globalForCRM.crmMemoryConversations = memoryConversations;
  globalForCRM.crmMemoryMessages = memoryMessages;
}

/**
 * Seed initial sample leads for demonstration if DB is empty or unmigrated
 */
function getSampleLeads(userId: string): Lead[] {
  const now = new Date();
  return [
    {
      id: "demo-lead-1",
      user_id: userId,
      name: "Marcus Vance",
      email: "marcus@apexenterprises.io",
      phone: "+1 (555) 234-5678",
      source: "website",
      stage: "new",
      score: 8,
      deal_value: 12500,
      metadata: {
        company: "Apex Enterprises",
        notes: "Inquired through website bot about full omnichannel campaign automation.",
        bant: {
          budgetScore: 8,
          authorityScore: 9,
          needScore: 8,
          timingScore: 7,
          summary: "High enterprise budget, VP of Growth, looking to deploy this month.",
          evaluatedAt: now.toISOString(),
        },
      },
      created_at: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
      updated_at: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: "demo-lead-2",
      user_id: userId,
      name: "Elena Rostova",
      email: "elena@luminahealth.com",
      phone: "+1 (555) 345-6789",
      source: "whatsapp",
      stage: "contacted",
      score: 6,
      deal_value: 6800,
      metadata: {
        company: "Lumina Health",
        notes: "Requested service pricing sheet on WhatsApp.",
      },
      created_at: new Date(now.getTime() - 1000 * 60 * 120).toISOString(),
      updated_at: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
    },
    {
      id: "demo-lead-3",
      user_id: userId,
      name: "David Chen",
      email: "david@chenlogistics.co",
      phone: "+1 (555) 890-1234",
      source: "meta_ads",
      stage: "qualified",
      score: 9,
      deal_value: 24000,
      metadata: {
        company: "Chen Logistics Global",
        notes: "Needs automated lead qualification calls for 500+ inbound leads weekly.",
        bant: {
          budgetScore: 10,
          authorityScore: 9,
          needScore: 9,
          timingScore: 8,
          summary: "CEO directly contacted. Urgent pain point with inbound call queue.",
          evaluatedAt: now.toISOString(),
        },
      },
      created_at: new Date(now.getTime() - 1000 * 60 * 360).toISOString(),
      updated_at: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
    },
    {
      id: "demo-lead-4",
      user_id: userId,
      name: "Sarah Jenkins",
      email: "sarah@nordicdesign.dk",
      phone: "+44 20 7946 0912",
      source: "website",
      stage: "booked",
      score: 9,
      deal_value: 15000,
      metadata: {
        company: "Nordic Design Studio",
        bookingInfo: {
          scheduledAt: new Date(now.getTime() + 1000 * 60 * 60 * 24).toISOString(),
          calLink: "https://cal.com/lemon-ai/discovery",
          notes: "Cal.com Discovery Call confirmed for tomorrow at 2:00 PM.",
        },
      },
      created_at: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
      updated_at: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: "demo-lead-5",
      user_id: userId,
      name: "Alexander Gray",
      email: "alex@velocityventures.com",
      phone: "+1 (555) 432-8765",
      source: "voice",
      stage: "proposal",
      score: 8,
      deal_value: 32000,
      metadata: {
        company: "Velocity Ventures",
        notes: "Autonomous Voice Agent completed 4-minute qualification call.",
      },
      created_at: new Date(now.getTime() - 1000 * 60 * 60 * 48).toISOString(),
      updated_at: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString(),
    },
  ];
}

function getSampleConversations(userId: string, leads: Lead[]): CRMConversation[] {
  const conv1Lead = leads.find((l) => l.id === "demo-lead-1") || leads[0];
  const conv2Lead = leads.find((l) => l.id === "demo-lead-2") || leads[1];
  const conv3Lead = leads.find((l) => l.id === "demo-lead-3") || leads[2];

  return [
    {
      id: "demo-conv-1",
      user_id: userId,
      lead_id: conv1Lead?.id || null,
      channel: "website",
      status: "open",
      is_ai_active: true,
      last_message_at: new Date().toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      lead: conv1Lead,
    },
    {
      id: "demo-conv-2",
      user_id: userId,
      lead_id: conv2Lead?.id || null,
      channel: "whatsapp",
      status: "open",
      is_ai_active: false,
      last_message_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      lead: conv2Lead,
    },
    {
      id: "demo-conv-3",
      user_id: userId,
      lead_id: conv3Lead?.id || null,
      channel: "voice",
      status: "open",
      is_ai_active: true,
      last_message_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
      lead: conv3Lead,
    },
  ];
}

function getSampleMessages(): CRMMessage[] {
  const now = Date.now();
  return [
    {
      id: "msg-1",
      conversation_id: "demo-conv-1",
      sender_type: "lead",
      content: "Hello! We are looking to automate our multi-channel social posting and lead qualification.",
      created_at: new Date(now - 1000 * 60 * 25).toISOString(),
    },
    {
      id: "msg-2",
      conversation_id: "demo-conv-1",
      sender_type: "ai_assistant",
      content: "Welcome to Lemon AI! We handle end-to-end social generation, multi-channel scheduling, and autonomous voice lead qualification. What is your company name and target timeline?",
      created_at: new Date(now - 1000 * 60 * 24).toISOString(),
    },
    {
      id: "msg-3",
      conversation_id: "demo-conv-1",
      sender_type: "lead",
      content: "I'm Marcus Vance from Apex Enterprises. We want to start by end of this month. What is your pricing?",
      created_at: new Date(now - 1000 * 60 * 10).toISOString(),
    },
    {
      id: "msg-4",
      conversation_id: "demo-conv-1",
      sender_type: "ai_assistant",
      content: "Great to meet you, Marcus! Our enterprise tier starts around $12,500/yr with full custom voice bots and unlimited social channels. What is the best email or phone number to send our detailed deck to?",
      created_at: new Date(now - 1000 * 60 * 9).toISOString(),
    },
    {
      id: "msg-5",
      conversation_id: "demo-conv-1",
      sender_type: "lead",
      content: "You can reach me at marcus@apexenterprises.io or call me at +1 (555) 234-5678.",
      created_at: new Date(now - 1000 * 60 * 2).toISOString(),
    },
    {
      id: "msg-6",
      conversation_id: "demo-conv-2",
      sender_type: "lead",
      content: "Hi, can someone send me the WhatsApp pricing schedule?",
      created_at: new Date(now - 1000 * 60 * 45).toISOString(),
    },
    {
      id: "msg-7",
      conversation_id: "demo-conv-2",
      sender_type: "human_agent",
      content: "Hi Elena! I've paused the AI and am reviewing your requirements right now. Sending over the PDF in 2 minutes.",
      created_at: new Date(now - 1000 * 60 * 40).toISOString(),
    },
  ];
}

/**
 * Ensures memory store is populated for the user
 */
function ensureMemoryStore(userId: string) {
  if (!memoryLeads.has(userId)) {
    const leads = getSampleLeads(userId);
    memoryLeads.set(userId, leads);
    memoryConversations.set(userId, getSampleConversations(userId, leads));
    for (const msg of getSampleMessages()) {
      const existing = memoryMessages.get(msg.conversation_id) || [];
      existing.push(msg);
      memoryMessages.set(msg.conversation_id, existing);
    }
  }
}

// ----------------------------------------------------------------------
// LEADS REPOSITORY
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
      return data as Lead[];
    }
    if (!error && data && data.length === 0) {
      // If table exists but has 0 records, return empty or memory leads
      const mem = memoryLeads.get(userId) || [];
      return mem;
    }
  } catch (err: any) {
    console.warn("Notice: reading leads from DB:", err?.message);
  }
  return memoryLeads.get(userId) || [];
}

export async function getLeadById(leadId: string, userId?: string): Promise<Lead | null> {
  if (userId) {
    ensureMemoryStore(userId);
  }
  try {
    const admin = getInsforgeAdminClient();
    const { data, error } = await admin.database
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();

    if (!error && data) {
      return data as Lead;
    }
  } catch (err: any) {
    console.warn("Notice: reading lead by id from DB:", err?.message);
  }
  if (userId) {
    const mem = memoryLeads.get(userId) || [];
    const found = mem.find((l) => l.id === leadId);
    if (found) return found;
  }
  for (const [, list] of memoryLeads.entries()) {
    const match = list.find((l) => l.id === leadId);
    if (match) return match;
  }
  return null;
}

export async function createLead(payload: Partial<Lead> & { user_id: string }): Promise<Lead> {
  ensureMemoryStore(payload.user_id);
  const now = new Date().toISOString();
  const newLead: Lead = {
    id: payload.id || `lead-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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

  try {
    const admin = getInsforgeAdminClient();
    const { data, error } = await admin.database
      .from("leads")
      .insert([newLead])
      .select()
      .maybeSingle();

    if (!error && data) {
      // Sync memory
      const list = memoryLeads.get(payload.user_id) || [];
      list.unshift(data as Lead);
      memoryLeads.set(payload.user_id, list);
      return data as Lead;
    }
  } catch (err: any) {
    console.warn("Notice: saving lead to DB:", err?.message);
  }

  // Fallback to memory
  const list = memoryLeads.get(payload.user_id) || [];
  list.unshift(newLead);
  memoryLeads.set(payload.user_id, list);
  return newLead;
}

export async function updateLead(
  leadId: string,
  updates: Partial<Lead>,
  userId?: string
): Promise<Lead | null> {
  const now = new Date().toISOString();
  try {
    const admin = getInsforgeAdminClient();
    const { data, error } = await admin.database
      .from("leads")
      .update({ ...updates, updated_at: now })
      .eq("id", leadId)
      .select()
      .maybeSingle();

    if (!error && data) {
      if (userId) {
        const list = memoryLeads.get(userId) || [];
        const idx = list.findIndex((l) => l.id === leadId);
        if (idx !== -1) list[idx] = data as Lead;
      }
      return data as Lead;
    }
  } catch (err: any) {
    console.warn("Notice: updating lead in DB:", err?.message);
  }

  // In-memory fallback
  if (userId) {
    const list = memoryLeads.get(userId) || [];
    const idx = list.findIndex((l) => l.id === leadId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates, updated_at: now };
      return list[idx];
    }
  } else {
    for (const [uid, list] of memoryLeads.entries()) {
      const idx = list.findIndex((l) => l.id === leadId);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates, updated_at: now };
        return list[idx];
      }
    }
  }
  return null;
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

  // Search existing by email or phone
  const all = await getLeadsForUser(user_id);
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

  // Memory fallback with attached latest messages
  const convs = memoryConversations.get(userId) || [];
  return convs.map((c) => {
    const msgs = memoryMessages.get(c.id) || [];
    return {
      ...c,
      messages: msgs,
    };
  });
}

export async function getConversationWithMessages(
  conversationId: string,
  userId?: string
): Promise<{ conversation: CRMConversation | null; messages: CRMMessage[] }> {
  try {
    const admin = getInsforgeAdminClient();
    const { data: conv } = await admin.database
      .from("crm_conversations")
      .select("*, lead:leads(*)")
      .eq("id", conversationId)
      .maybeSingle();

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
    id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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
  return newConv;
}

export async function addMessage(data: {
  conversation_id: string;
  sender_type: "lead" | "ai_assistant" | "human_agent";
  content: string;
}): Promise<CRMMessage> {
  const now = new Date().toISOString();
  const newMsg: CRMMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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
      // Memory sync
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
    const { data, error } = await admin.database
      .from("crm_conversations")
      .update({ is_ai_active })
      .eq("id", conversationId)
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
      return c;
    }
  }
  return null;
}
