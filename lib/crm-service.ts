import fs from "fs";
import path from "path";
import crypto from "crypto";
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
  | "instagram_dm"
  | "facebook"
  | "facebook_dm"
  | "voice"
  | "inbound_call"
  | "organic"
  | "meta_ads"
  | "manual";

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
    dateText?: string;
    calLink?: string;
    topic?: string;
    bookingSource?: string;
    bookedAt?: string;
    status?: "confirmed" | "pending" | "completed" | "cancelled";
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
  status: "open" | "ai_handling" | "human_takeover" | "resolved";
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

export interface CRMActivity {
  id: string;
  user_id: string;
  lead_id?: string | null;
  type: string;
  title: string;
  description?: string | null;
  metadata?: any;
  created_at: string;
}

// ----------------------------------------------------------------------
// PERSISTENT LOCAL CRM DATA ENGINE (Fallback when SQL table not yet migrated)
// ----------------------------------------------------------------------

interface LocalCRMData {
  leads: Lead[];
  activities: CRMActivity[];
  conversations: CRMConversation[];
  messages: CRMMessage[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const CRM_STORE_PATH = path.join(DATA_DIR, "crm-store.json");

function getLocalStore(): LocalCRMData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(CRM_STORE_PATH)) {
      const raw = fs.readFileSync(CRM_STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        leads: Array.isArray(parsed.leads) ? parsed.leads : [],
        activities: Array.isArray(parsed.activities) ? parsed.activities : [],
        conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      };
    }
  } catch (e) {
    console.warn("Notice reading local CRM store:", e);
  }
  return { leads: [], activities: [], conversations: [], messages: [] };
}

function saveLocalStore(data: LocalCRMData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CRM_STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.warn("Notice writing local CRM store:", e);
  }
}

// ----------------------------------------------------------------------
// LEADS REPOSITORY (PostgreSQL via InsForge + Durable Local Fallback)
// ----------------------------------------------------------------------

// Helper to resolve all user IDs that share connected channels with the given user
async function getConnectedUserIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  const userIds = new Set<string>([userId]);
  try {
    const admin = getInsforgeAdminClient();
    const { data: userChans } = await admin.database
      .from("user_channels")
      .select("provider_account_id")
      .eq("user_id", userId)
      .eq("is_connected", true);

    const pIds = (userChans || [])
      .map((c: any) => c.provider_account_id)
      .filter(Boolean);

    if (pIds.length > 0) {
      const { data: siblings } = await admin.database
        .from("user_channels")
        .select("user_id")
        .in("provider_account_id", pIds)
        .eq("is_connected", true);

      for (const s of siblings || []) {
        if (s.user_id) userIds.add(s.user_id);
      }
    }

    // In development or demo fallback: ensure connected channel leads are never hidden
    if (userIds.size <= 1 || userId === "user_lemon_default" || userId === "usr_lemon_demo") {
      const { data: allActiveChans } = await admin.database
        .from("user_channels")
        .select("user_id")
        .eq("is_connected", true);
      for (const c of allActiveChans || []) {
        if (c.user_id) userIds.add(c.user_id);
      }
    }
  } catch {}
  return Array.from(userIds);
}

export async function getLeadsForUser(userId: string): Promise<Lead[]> {
  const allowedUserIds = await getConnectedUserIds(userId);
  const local = getLocalStore();
  const localLeads = local.leads.filter(
    (l) => !userId || allowedUserIds.includes(l.user_id) || userId === "usr_lemon_demo" || userId === "user_lemon_default" || l.user_id === "usr_lemon_demo"
  );

  try {
    const admin = getInsforgeAdminClient();
    const { data, error } = await admin.database
      .from("leads")
      .select("*")
      .in("user_id", allowedUserIds)
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      const mergedMap = new Map<string, Lead>();
      localLeads.forEach((l) => mergedMap.set(l.id, l));
      (data as Lead[]).forEach((l) => mergedMap.set(l.id, l));
      return Array.from(mergedMap.values()).sort((a, b) => {
        const timeA = new Date(a.updated_at || a.created_at).getTime();
        const timeB = new Date(b.updated_at || b.created_at).getTime();
        return timeB - timeA;
      });
    }
  } catch (err: any) {
    console.warn("Notice reading leads from DB:", err?.message);
  }
  return localLeads.sort((a, b) => {
    const timeA = new Date(a.updated_at || a.created_at).getTime();
    const timeB = new Date(b.updated_at || b.created_at).getTime();
    return timeB - timeA;
  });
}

export async function getLeadById(leadId: string, userId?: string): Promise<Lead | null> {
  const local = getLocalStore();
  const localLead = local.leads.find((l) => l.id === leadId);

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
    console.warn("Notice reading lead by id from DB:", err?.message);
  }
  return localLead || null;
}

export async function createLead(
  payload: Partial<Lead> & {
    user_id: string;
    company?: string;
    notes?: string;
  }
): Promise<Lead> {
  const now = new Date().toISOString();
  const leadId = payload.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.id)
    ? payload.id
    : crypto.randomUUID();
  const newLead: Lead = {
    id: leadId,
    user_id: payload.user_id,
    name: payload.name || "Anonymous Lead",
    email: payload.email || null,
    phone: payload.phone || null,
    source: payload.source || "website",
    stage: payload.stage || "new",
    score: payload.score ?? 5,
    deal_value: payload.deal_value ?? 0,
    metadata: {
      ...(payload.metadata || {}),
      ...(payload.company ? { company: payload.company } : {}),
      ...(payload.notes ? { notes: payload.notes } : {}),
    },
    created_at: now,
    updated_at: now,
  };

  // Always save to durable local cache first
  const local = getLocalStore();
  const idx = local.leads.findIndex((l) => l.id === newLead.id);
  if (idx >= 0) {
    local.leads[idx] = newLead;
  } else {
    local.leads.unshift(newLead);
  }
  saveLocalStore(local);

  try {
    const admin = getInsforgeAdminClient();
    const { data, error } = await admin.database
      .from("leads")
      .insert([newLead])
      .select()
      .maybeSingle();

    if (!error && data) {
      return data as Lead;
    }
  } catch (err: any) {
    console.warn("Notice saving lead to DB:", err?.message);
  }

  return newLead;
}

export async function updateLead(
  leadId: string,
  updates: Partial<Lead>,
  userId?: string
): Promise<Lead | null> {
  const now = new Date().toISOString();

  const local = getLocalStore();
  const idx = local.leads.findIndex((l) => l.id === leadId);
  let updatedLead: Lead | null = null;
  if (idx >= 0) {
    local.leads[idx] = {
      ...local.leads[idx],
      ...updates,
      metadata: {
        ...(local.leads[idx].metadata || {}),
        ...(updates.metadata || {}),
      },
      updated_at: now,
    };
    updatedLead = local.leads[idx];
    saveLocalStore(local);
  }

  try {
    const admin = getInsforgeAdminClient();

    let mergedMetadata = updates.metadata;
    if (updates.metadata) {
      const { data: currentLead } = await admin.database
        .from("leads")
        .select("metadata")
        .eq("id", leadId)
        .maybeSingle();
      if (currentLead?.metadata) {
        mergedMetadata = {
          ...currentLead.metadata,
          ...updates.metadata,
        };
      }
    }

    const payloadToDb: any = {
      ...updates,
      updated_at: now,
    };
    if (mergedMetadata) {
      payloadToDb.metadata = mergedMetadata;
    }

    let query = admin.database
      .from("leads")
      .update(payloadToDb)
      .eq("id", leadId);

    if (userId && userId !== "user_lemon_default" && userId !== "usr_lemon_demo") {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query.select().maybeSingle();
    if (!error && data) {
      return data as Lead;
    }
  } catch (err: any) {
    console.warn("Notice updating lead in DB:", err?.message);
  }

  return updatedLead;
}

export async function deleteLead(leadId: string, userId?: string): Promise<boolean> {
  if (!leadId) return false;

  // 1. Remove from local store
  const local = getLocalStore();
  const initialLength = local.leads.length;
  local.leads = local.leads.filter((l) => l.id !== leadId);
  local.activities = local.activities.filter((a) => a.lead_id !== leadId);
  local.conversations = local.conversations.filter((c) => c.lead_id !== leadId);
  if (local.leads.length !== initialLength) {
    saveLocalStore(local);
  }

  // 2. Remove from database
  try {
    const admin = getInsforgeAdminClient();

    // Clean up dependent activities and conversations
    try {
      await admin.database.from("crm_activities").delete().eq("lead_id", leadId);
    } catch {}
    try {
      await admin.database.from("crm_conversations").delete().eq("lead_id", leadId);
    } catch {}

    let deleteQuery = admin.database.from("leads").delete().eq("id", leadId);
    if (userId && userId !== "user_lemon_default" && userId !== "usr_lemon_demo") {
      deleteQuery = deleteQuery.eq("user_id", userId);
    }

    const { error } = await deleteQuery;
    if (error) {
      console.warn("Notice deleting lead from DB:", error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("Failed to delete lead from DB:", err?.message || err);
    return false;
  }
}

export async function findOrCreateLeadByContact(params: {
  user_id: string;
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
}): Promise<Lead> {
  const { user_id, name, email, phone, source } = params;

  // 1. Check local store
  const local = getLocalStore();
  const localExisting = local.leads.find(
    (l) =>
      (l.user_id === user_id || user_id === "usr_lemon_demo" || user_id === "user_lemon_default") &&
      ((email && l.email && l.email.toLowerCase() === email.toLowerCase()) ||
        (phone && l.phone && l.phone === phone))
  );
  if (localExisting) {
    const updates: Partial<Lead> = {};
    if (name && (!localExisting.name || localExisting.name === "Website Visitor" || localExisting.name === "Anonymous Lead")) {
      updates.name = name;
    }
    if (phone && !localExisting.phone) updates.phone = phone;
    if (email && !localExisting.email) updates.email = email;
    if (Object.keys(updates).length > 0) {
      return (await updateLead(localExisting.id, updates, user_id)) || localExisting;
    }
    return localExisting;
  }

  // 2. Search Postgres DB
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
    console.warn("Notice searching lead by contact in DB:", err?.message);
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
  const allowedUserIds = await getConnectedUserIds(userId);
  try {
    const admin = getInsforgeAdminClient();
    let convQuery = admin.database
      .from("crm_conversations")
      .select("*, lead:leads(*)")
      .order("last_message_at", { ascending: false });

    if (allowedUserIds.length > 0 && userId !== "user_lemon_default" && userId !== "usr_lemon_demo") {
      convQuery = convQuery.in("user_id", allowedUserIds);
    }

    const { data: convs, error } = await convQuery;

    if (!error && convs && convs.length > 0) {
      // Fetch latest messages for these conversations so conversation list displays real snippets
      const convIds = convs.map((c: any) => c.id).slice(0, 100);
      const { data: msgs } = await admin.database
        .from("crm_messages")
        .select("*")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: true });

      const msgMap = new Map<string, CRMMessage[]>();
      for (const m of (msgs || []) as CRMMessage[]) {
        if (!msgMap.has(m.conversation_id)) {
          msgMap.set(m.conversation_id, []);
        }
        msgMap.get(m.conversation_id)!.push(m);
      }

      return convs.map((c: any) => ({
        ...c,
        messages: msgMap.get(c.id) || [],
      })) as CRMConversation[];
    }
  } catch (err: any) {
    console.warn("Notice: reading conversations from DB:", err?.message);
  }

  // Fallback to local store
  const local = getLocalStore();
  return local.conversations.map((c) => ({
    ...c,
    messages: local.messages.filter((m) => m.conversation_id === c.id),
  }));
}

export async function getConversationWithMessages(
  conversationId: string,
  userId?: string
): Promise<{ conversation: CRMConversation | null; messages: CRMMessage[] }> {
  try {
    const admin = getInsforgeAdminClient();
    let convQuery = admin.database
      .from("crm_conversations")
      .select("*, lead:leads(*)")
      .eq("id", conversationId);

    // Only filter by user_id if specific Clerk user and not dev/demo mode
    if (userId && userId !== "user_lemon_default" && userId !== "usr_lemon_demo") {
      const allowedUserIds = await getConnectedUserIds(userId);
      convQuery = convQuery.in("user_id", allowedUserIds);
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

  // Fallback to local store
  const local = getLocalStore();
  const localConv = local.conversations.find((c) => c.id === conversationId);
  if (localConv) {
    const localMsgs = local.messages.filter((m) => m.conversation_id === conversationId);
    return {
      conversation: localConv,
      messages: localMsgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    };
  }

  return { conversation: null, messages: [] };
}

export async function createConversation(data: {
  user_id: string;
  lead_id?: string | null;
  channel: string;
  is_ai_active?: boolean;
}): Promise<CRMConversation> {
  const now = new Date().toISOString();
  const convId = crypto.randomUUID();
  const newConv: CRMConversation = {
    id: convId,
    user_id: data.user_id,
    lead_id: data.lead_id || null,
    channel: data.channel,
    status: "open",
    is_ai_active: data.is_ai_active ?? true,
    last_message_at: now,
    created_at: now,
  };

  // Local store sync
  const local = getLocalStore();
  local.conversations.unshift(newConv);
  saveLocalStore(local);

  try {
    const admin = getInsforgeAdminClient();
    const { data: inserted, error } = await admin.database
      .from("crm_conversations")
      .insert([newConv])
      .select("*, lead:leads(*)")
      .maybeSingle();

    if (!error && inserted) {
      return inserted as CRMConversation;
    }
  } catch (err: any) {
    console.warn("Notice: inserting conversation in DB:", err?.message);
  }

  return newConv;
}

export async function addMessage(data: {
  conversation_id: string;
  sender_type: "lead" | "ai_assistant" | "human_agent";
  content: string;
}): Promise<CRMMessage> {
  const now = new Date().toISOString();
  const msgId = crypto.randomUUID();
  const newMsg: CRMMessage = {
    id: msgId,
    conversation_id: data.conversation_id,
    sender_type: data.sender_type,
    content: data.content,
    created_at: now,
  };

  // Local store sync
  const local = getLocalStore();
  local.messages.push(newMsg);
  const convIdx = local.conversations.findIndex((c) => c.id === data.conversation_id);
  if (convIdx >= 0) {
    local.conversations[convIdx].last_message_at = now;
  }
  saveLocalStore(local);

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
      return inserted as CRMMessage;
    }
  } catch (err: any) {
    console.warn("Notice: adding message in DB:", err?.message);
  }

  return newMsg;
}

export async function toggleAIActive(
  conversationId: string,
  is_ai_active: boolean,
  userId?: string
): Promise<CRMConversation | null> {
  try {
    const admin = getInsforgeAdminClient();
    let query = admin.database
      .from("crm_conversations")
      .update({ is_ai_active })
      .eq("id", conversationId);

    if (userId && userId !== "user_lemon_default" && userId !== "usr_lemon_demo") {
      const allowedUserIds = await getConnectedUserIds(userId);
      query = query.in("user_id", allowedUserIds);
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
  return null;
}


// ----------------------------------------------------------------------
// ACTIVITIES & AUDIT TRAIL REPOSITORY
// ----------------------------------------------------------------------

export async function recordActivity(params: {
  user_id: string;
  lead_id?: string | null;
  type: string;
  title: string;
  description?: string | null;
  metadata?: any;
}): Promise<CRMActivity> {
  const now = new Date().toISOString();
  const actId = crypto.randomUUID();
  const activity: CRMActivity = {
    id: actId,
    user_id: params.user_id,
    lead_id: params.lead_id || null,
    type: params.type,
    title: params.title,
    description: params.description || null,
    metadata: params.metadata || {},
    created_at: now,
  };

  // Always save locally
  const local = getLocalStore();
  local.activities.unshift(activity);
  saveLocalStore(local);

  // Attempt to write to InsForge Postgres
  try {
    const admin = getInsforgeAdminClient();
    await admin.database.from("crm_activities").insert([activity]);
  } catch (e: any) {
    console.warn("Notice: saving activity to DB:", e?.message);
  }

  return activity;
}

export async function getActivitiesForUser(userId: string): Promise<CRMActivity[]> {
  const local = getLocalStore();
  const localActs = local.activities.filter(
    (a) => !userId || a.user_id === userId || userId === "usr_lemon_demo" || userId === "user_lemon_default" || a.user_id === "usr_lemon_demo"
  );

  try {
    const admin = getInsforgeAdminClient();
    const { data, error } = await admin.database
      .from("crm_activities")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      const mergedMap = new Map<string, CRMActivity>();
      localActs.forEach((a) => mergedMap.set(a.id, a));
      (data as CRMActivity[]).forEach((a) => mergedMap.set(a.id, a));
      return Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
  } catch (e: any) {
    console.warn("Notice: reading activities from DB:", e?.message);
  }

  return localActs.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// ----------------------------------------------------------------------
// APPOINTMENTS RETRIEVAL HELPER
// ----------------------------------------------------------------------

export interface AppointmentRecord {
  leadId: string;
  leadName: string;
  email: string | null;
  phone: string | null;
  scheduledAt?: string;
  dateText?: string;
  status: "confirmed" | "pending" | "completed" | "cancelled";
  source: string;
  dealValue: number;
  notes?: string;
  topic?: string;
  bookedAt?: string;
}

export async function getAppointmentsForUser(userId: string): Promise<AppointmentRecord[]> {
  const leads = await getLeadsForUser(userId);
  const appointments: AppointmentRecord[] = [];

  for (const lead of leads) {
    const hasBooking =
      lead.stage === "booked" ||
      lead.metadata?.bookingInfo?.scheduledAt ||
      lead.metadata?.bookingInfo?.dateText;

    if (hasBooking) {
      const bInfo = lead.metadata?.bookingInfo || {};
      appointments.push({
        leadId: lead.id,
        leadName: lead.name || "Valued Prospect",
        email: lead.email,
        phone: lead.phone,
        scheduledAt: bInfo.scheduledAt,
        dateText: bInfo.dateText || (bInfo.scheduledAt ? new Date(bInfo.scheduledAt).toLocaleString() : "Upcoming"),
        status: bInfo.status || "confirmed",
        source: bInfo.bookingSource || lead.source || "website_bot",
        dealValue: Number(lead.deal_value) || 5000,
        notes: bInfo.notes || "Booked via AI Assistant",
        topic: bInfo.topic || "Discovery & Strategy Consultation",
        bookedAt: bInfo.bookedAt || lead.created_at,
      });
    }
  }

  return appointments;
}



