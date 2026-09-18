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
// LEADS REPOSITORY (PostgreSQL via InsForge/Supabase)
//
// All reads and writes are scoped to the authenticated user (or the set of
// users who share a connected channel). There are NO demo/test bypasses and
// NO local filesystem persistence — the database is the single source of
// truth so the service is safe on ephemeral serverless runtimes.
// ----------------------------------------------------------------------

// Resolve all user IDs that share connected channels with the given user.
// This lets teammates who connect the same social channel see shared leads,
// while still preventing cross-tenant leakage to unrelated users.
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
  } catch (err: any) {
    console.warn("Notice resolving connected user IDs:", err?.message);
  }
  return Array.from(userIds);
}

export async function getLeadsForUser(userId: string): Promise<Lead[]> {
  if (!userId) return [];
  const allowedUserIds = await getConnectedUserIds(userId);

  try {
    const admin = getInsforgeAdminClient();
    const { data, error } = await admin.database
      .from("leads")
      .select("*")
      .in("user_id", allowedUserIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Notice reading leads from DB:", error.message);
      return [];
    }

    return ((data as Lead[]) || []).sort((a, b) => {
      const timeA = new Date(a.updated_at || a.created_at).getTime();
      const timeB = new Date(b.updated_at || b.created_at).getTime();
      return timeB - timeA;
    });
  } catch (err: any) {
    console.warn("Notice reading leads from DB:", err?.message);
    return [];
  }
}

export async function getLeadById(leadId: string, userId?: string): Promise<Lead | null> {
  try {
    const admin = getInsforgeAdminClient();
    let query = admin.database.from("leads").select("*").eq("id", leadId);
    if (userId) {
      const allowedUserIds = await getConnectedUserIds(userId);
      query = query.in("user_id", allowedUserIds);
    }
    const { data, error } = await query.maybeSingle();
    if (!error && data) {
      return data as Lead;
    }
  } catch (err: any) {
    console.warn("Notice reading lead by id from DB:", err?.message);
  }
  return null;
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

  try {
    const admin = getInsforgeAdminClient();
    const { data, error } = await admin.database
      .from("leads")
      .insert([newLead])
      .select()
      .maybeSingle();

    if (error) {
      console.error("Failed to save lead to DB:", error.message);
      throw new Error(`Failed to create lead: ${error.message}`);
    }
    return (data as Lead) || newLead;
  } catch (err: any) {
    console.error("Failed to save lead to DB:", err?.message || err);
    throw err instanceof Error ? err : new Error("Failed to create lead");
  }
}

export async function updateLead(
  leadId: string,
  updates: Partial<Lead>,
  userId?: string
): Promise<Lead | null> {
  const now = new Date().toISOString();

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

    if (userId) {
      const allowedUserIds = await getConnectedUserIds(userId);
      query = query.in("user_id", allowedUserIds);
    }

    const { data, error } = await query.select().maybeSingle();
    if (error) {
      console.warn("Notice updating lead in DB:", error.message);
      return null;
    }
    return (data as Lead) || null;
  } catch (err: any) {
    console.warn("Notice updating lead in DB:", err?.message);
    return null;
  }
}

export async function deleteLead(leadId: string, userId?: string): Promise<boolean> {
  if (!leadId) return false;

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
    if (userId) {
      const allowedUserIds = await getConnectedUserIds(userId);
      deleteQuery = deleteQuery.in("user_id", allowedUserIds);
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

  // Search existing leads owned by this user
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
      if (name && (!existing.name || existing.name === "Anonymous Lead" || existing.name === "Website Visitor")) {
        updates.name = name;
      }
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
  if (!userId) return [];
  const allowedUserIds = await getConnectedUserIds(userId);

  try {
    const admin = getInsforgeAdminClient();
    const { data: convs, error } = await admin.database
      .from("crm_conversations")
      .select("*, lead:leads(*)")
      .in("user_id", allowedUserIds)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.warn("Notice: reading conversations from DB:", error.message);
      return [];
    }

    if (convs && convs.length > 0) {
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
    return [];
  } catch (err: any) {
    console.warn("Notice: reading conversations from DB:", err?.message);
    return [];
  }
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

    if (userId) {
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

  try {
    const admin = getInsforgeAdminClient();
    const { data: inserted, error } = await admin.database
      .from("crm_conversations")
      .insert([newConv])
      .select("*, lead:leads(*)")
      .maybeSingle();

    if (error) {
      console.error("Failed to insert conversation in DB:", error.message);
      throw new Error(`Failed to create conversation: ${error.message}`);
    }
    return (inserted as CRMConversation) || newConv;
  } catch (err: any) {
    console.error("Failed to insert conversation in DB:", err?.message || err);
    throw err instanceof Error ? err : new Error("Failed to create conversation");
  }
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

    if (error) {
      console.error("Failed to add message in DB:", error.message);
      throw new Error(`Failed to add message: ${error.message}`);
    }
    return (inserted as CRMMessage) || newMsg;
  } catch (err: any) {
    console.error("Failed to add message in DB:", err?.message || err);
    throw err instanceof Error ? err : new Error("Failed to add message");
  }
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

    if (userId) {
      const allowedUserIds = await getConnectedUserIds(userId);
      query = query.in("user_id", allowedUserIds);
    }

    const { data, error } = await query
      .select("*, lead:leads(*)")
      .maybeSingle();

    if (error) {
      console.warn("Notice: toggling AI in DB:", error.message);
      return null;
    }
    return (data as CRMConversation) || null;
  } catch (err: any) {
    console.warn("Notice: toggling AI in DB:", err?.message);
    return null;
  }
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

  try {
    const admin = getInsforgeAdminClient();
    const { error } = await admin.database.from("crm_activities").insert([activity]);
    if (error) {
      console.warn("Notice: saving activity to DB:", error.message);
    }
  } catch (e: any) {
    console.warn("Notice: saving activity to DB:", e?.message);
  }

  return activity;
}

export async function getActivitiesForUser(userId: string): Promise<CRMActivity[]> {
  if (!userId) return [];

  try {
    const admin = getInsforgeAdminClient();
    const { data, error } = await admin.database
      .from("crm_activities")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Notice: reading activities from DB:", error.message);
      return [];
    }

    return ((data as CRMActivity[]) || []).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch (e: any) {
    console.warn("Notice: reading activities from DB:", e?.message);
    return [];
  }
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
