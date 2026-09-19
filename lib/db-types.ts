/**
 * Shared database row types.
 *
 * These types mirror the Postgres schema defined under `lib/db/*.sql`. They
 * are hand-authored rather than generated so we can express the discriminated
 * unions and enums the way the app actually uses them, without pulling in
 * `supabase-cli` codegen as a build dependency.
 *
 * Migration plan (see CONTRIBUTING.md → ESLint ratchet):
 *   • Every new query result should be typed against these row shapes.
 *   • Legacy `any` usages in query results are being retyped file by file.
 *   • Nullable columns are `T | null`, not `T | undefined`, matching the
 *     Supabase JS driver contract.
 */

// ---------------------------------------------------------------------------
// Enums (mirror the CHECK constraints in the SQL migrations)
// ---------------------------------------------------------------------------

export type ChannelTypeSlug =
  | "TWITTER"
  | "LINKEDIN"
  | "INSTAGRAM"
  | "THREADS"
  | "FACEBOOK"
  | "BLUESKY"
  | "YOUTUBE";

export type ScheduledPostStatus =
  | "draft"
  | "queue"
  | "publishing"
  | "published"
  | "failed";

export type LeadStage =
  | "new"
  | "contacted"
  | "qualified"
  | "booked"
  | "proposal"
  | "closed_won"
  | "closed_lost";

export type LeadSource =
  | "organic"
  | "meta_ads"
  | "website"
  | "whatsapp"
  | "inbound_call";

export type ConversationChannel =
  | "website"
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "voice";

export type ConversationStatus = "open" | "resolved" | "snoozed";

export type MessageSenderType = "lead" | "ai_assistant" | "human_agent";

// ---------------------------------------------------------------------------
// Image object type (also exported by types/post.type.ts historically)
// ---------------------------------------------------------------------------

export interface DbImageObject {
  id?: string;
  url: string;
  path?: string;
  key?: string;
  width?: number;
  height?: number;
  alt?: string;
}

// ---------------------------------------------------------------------------
// channel_types (lookup table)
// ---------------------------------------------------------------------------

export interface ChannelTypeRow {
  id: string;
  type: ChannelTypeSlug;
  name: string;
  color: string;
  character_limit: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// user_channels
// ---------------------------------------------------------------------------

export interface UserChannelRow {
  id: string;
  user_id: string;
  channel_type_id: string;
  provider_account_id: string | null;
  handle: string | null;
  profile_image: string | null;
  profile_url: string | null;
  /** AES-256-GCM ciphertext (lib/encryption.ts). Decrypt before use. */
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  page_id: string | null;
  page_access_token: string | null;
  is_connected: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * `user_channels` joined with its channel_types row. Supabase returns the
 * joined table as a nested object under the join alias.
 */
export interface UserChannelWithType extends UserChannelRow {
  channel_types: Pick<ChannelTypeRow, "id" | "type" | "name" | "color" | "character_limit"> | null;
}

// ---------------------------------------------------------------------------
// scheduled_posts
// ---------------------------------------------------------------------------

export interface ScheduledPostRow {
  id: string;
  user_id: string;
  user_channel_id: string;
  content: string;
  images: DbImageObject[];
  scheduled_at: string;
  status: ScheduledPostStatus;
  publishing_started_at: string | null;
  published_at: string | null;
  published_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledPostWithChannel extends ScheduledPostRow {
  user_channels: UserChannelWithType | null;
}

// ---------------------------------------------------------------------------
// leads / CRM
// ---------------------------------------------------------------------------

export interface LeadRow {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  stage: LeadStage;
  score: number;
  deal_value: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CrmConversationRow {
  id: string;
  user_id: string;
  lead_id: string | null;
  channel: ConversationChannel;
  status: ConversationStatus;
  is_ai_active: boolean;
  last_message_at: string;
  created_at: string;
}

export interface CrmMessageRow {
  id: string;
  conversation_id: string;
  sender_type: MessageSenderType;
  content: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// brand_profiles
// ---------------------------------------------------------------------------

export interface BrandProfileRow {
  id: string;
  user_id: string;
  business_name: string | null;
  niche: string | null;
  brand_tone: string | null;
  target_audience: string | null;
  target_geography: string | null;
  onboarding_completed: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// audit_logs / consent_records / dsr_requests (migration 12)
// ---------------------------------------------------------------------------

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  actor_type: "user" | "system" | "admin" | "anonymous" | "webhook";
  actor_user_id: string | null;
  event: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip_hash: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ConsentRecordRow {
  id: string;
  user_id: string;
  consent_type: string;
  granted: boolean;
  version: string;
  ip_hash: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DsrRequestRow {
  id: string;
  user_id: string;
  request_type:
    | "access"
    | "deletion"
    | "portability"
    | "rectification"
    | "restriction"
    | "objection";
  status: "pending" | "processing" | "completed" | "rejected";
  fulfilled_at: string | null;
  rejection_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Generic Supabase query result unwrappers
// ---------------------------------------------------------------------------

export interface DbResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

export interface DbListResult<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
}
