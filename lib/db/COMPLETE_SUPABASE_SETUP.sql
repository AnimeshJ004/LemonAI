-- =============================================================================
-- 🍋 LEMON AI — COMPLETE ALL-IN-ONE SUPABASE DATABASE SETUP
-- =============================================================================
-- Instructions:
-- 1. Open your Supabase Dashboard -> SQL Editor
-- 2. Click "New Query"
-- 3. Paste this ENTIRE file and click "Run" (or Ctrl+Enter)
-- 4. That's it! All tables, indexes, RLS policies, seed data, and storage buckets
--    will be created in one single execution.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 0. AUTH HELPER (Compatible with Clerk JWT & Supabase Auth)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true)::json->>'sub', ''),
    auth.uid()::text
  );
$$;

-- =============================================================================
-- 1. CHANNEL TYPES (Lookup table with initial seed data)
-- =============================================================================
CREATE TABLE IF NOT EXISTS channel_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text NOT NULL UNIQUE,     -- TWITTER, INSTAGRAM, etc.
  name            text NOT NULL,
  color           text NOT NULL,
  character_limit integer NOT NULL DEFAULT 2200,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE channel_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "channel_types_public_read" ON channel_types;
CREATE POLICY "channel_types_public_read" ON channel_types
  FOR SELECT TO public USING (true);

INSERT INTO channel_types (type, name, color, character_limit) VALUES
  ('TWITTER',   'Twitter / X',       '#000000', 280),
  ('LINKEDIN',  'LinkedIn',          '#2867b2', 3000),
  ('INSTAGRAM', 'Instagram',         '#E4405F', 2200),
  ('THREADS',   'Threads',           '#000000', 500),
  ('FACEBOOK',  'Facebook',          '#1877F2', 63206),
  ('BLUESKY',   'Bluesky',           '#1285fe', 300),
  ('YOUTUBE',   'YouTube',           '#FF0000', 100),
  ('WHATSAPP',  'WhatsApp Cloud',    '#25D366', 4096),
  ('CHATBOT',   'Website AI Bot',    '#F59E0B', 2000)
ON CONFLICT (type) DO NOTHING;

-- Permanently clean up TikTok if present from prior migrations
DELETE FROM user_channels WHERE channel_type_id IN (SELECT id FROM channel_types WHERE type = 'TIKTOK');
DELETE FROM channel_types WHERE type = 'TIKTOK';

-- =============================================================================
-- 2. USER CHANNELS (Connected social accounts per user)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_channels (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             text NOT NULL,          -- Clerk user ID
  channel_type_id     uuid NOT NULL REFERENCES channel_types(id) ON DELETE RESTRICT,
  provider_account_id text,
  handle              text,
  profile_image       text,
  profile_url         text,
  access_token        text,
  refresh_token       text,
  token_expires_at    timestamptz,
  is_connected        boolean DEFAULT false,
  is_active           boolean DEFAULT true,
  page_id             text,                   -- Facebook Page ID for Page Messaging API
  page_access_token   text,                   -- Page token for DMs
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE (user_id, channel_type_id)
);

ALTER TABLE user_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_channels_policy ON user_channels;
CREATE POLICY user_channels_policy ON user_channels
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS idx_user_channels_user ON user_channels(user_id);

-- =============================================================================
-- 3. IDEA GROUPS & IDEAS
-- =============================================================================
CREATE TABLE IF NOT EXISTS idea_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE idea_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "idea_groups_public_read" ON idea_groups;
CREATE POLICY "idea_groups_public_read" ON idea_groups
  FOR SELECT TO public USING (true);

INSERT INTO idea_groups (name) VALUES
  ('Unassigned'),
  ('To Do'),
  ('In Progress'),
  ('Done')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS ideas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  group_id    uuid NOT NULL REFERENCES idea_groups(id) ON DELETE RESTRICT,
  title       text NOT NULL,
  description text,
  images      jsonb DEFAULT '[]',
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ideas_policy ON ideas;
CREATE POLICY ideas_policy ON ideas
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS idx_ideas_user ON ideas(user_id);

-- =============================================================================
-- 4. SCHEDULED POSTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                text NOT NULL,
  user_channel_id        uuid NOT NULL REFERENCES user_channels(id) ON DELETE CASCADE,
  content                text NOT NULL,
  images                 jsonb DEFAULT '[]',
  scheduled_at           timestamptz NOT NULL,
  status                 text NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('queue', 'draft', 'publishing', 'published', 'failed')),
  publishing_started_at  timestamptz,           -- Lock timestamp for worker crash recovery
  published_at           timestamptz,
  published_url          text,
  error_message          text,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scheduled_posts_policy ON scheduled_posts;
CREATE POLICY scheduled_posts_policy ON scheduled_posts
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user ON scheduled_posts(user_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_queue ON scheduled_posts(status, scheduled_at ASC);

-- =============================================================================
-- 5. CRM PIPELINE — LEADS
-- =============================================================================
CREATE TABLE IF NOT EXISTS leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  name        text,
  email       text,
  phone       text,
  source      text DEFAULT 'organic',          -- organic, meta_ads, website, whatsapp, inbound_call
  stage       text DEFAULT 'new',              -- new, contacted, qualified, booked, proposal, closed_won, closed_lost
  score       integer DEFAULT 0,              -- 0 to 10
  deal_value  numeric DEFAULT 0,
  metadata    jsonb DEFAULT '{}',              -- BANT scores, notes, company info, commenterId
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_user_policy ON leads;
CREATE POLICY leads_user_policy ON leads
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS idx_leads_user_stage ON leads (user_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_user_score ON leads (user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads (email);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads (phone);

-- =============================================================================
-- 6. CRM CONVERSATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS crm_conversations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          text NOT NULL,
  lead_id          uuid REFERENCES leads(id) ON DELETE CASCADE,
  channel          text NOT NULL,              -- website, whatsapp, instagram, facebook, voice
  status           text DEFAULT 'open',        -- open, resolved, snoozed
  is_ai_active     boolean DEFAULT true,       -- toggles human handover
  last_message_at  timestamptz DEFAULT now(),
  last_read_at     timestamptz DEFAULT now(),
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE crm_conversations ADD COLUMN IF NOT EXISTS last_read_at timestamptz DEFAULT now();

ALTER TABLE crm_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_conversations_user_policy ON crm_conversations;
CREATE POLICY crm_conversations_user_policy ON crm_conversations
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS idx_crm_conv_user_channel ON crm_conversations (user_id, channel);
CREATE INDEX IF NOT EXISTS idx_crm_conv_lead ON crm_conversations (lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_conv_last_msg ON crm_conversations (user_id, last_message_at DESC);

-- =============================================================================
-- 7. CRM MESSAGES (Live Realtime Chat)
-- =============================================================================
CREATE TABLE IF NOT EXISTS crm_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES crm_conversations(id) ON DELETE CASCADE,
  sender_type     text NOT NULL CHECK (sender_type IN ('lead', 'ai_assistant', 'human_agent')),
  content         text NOT NULL,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE crm_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_messages_user_policy ON crm_messages;
CREATE POLICY crm_messages_user_policy ON crm_messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM crm_conversations WHERE user_id = requesting_user_id()
    )
  );

CREATE INDEX IF NOT EXISTS idx_crm_msgs_conv_created ON crm_messages (conversation_id, created_at ASC);

-- Add to Realtime publication for live inbox updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'crm_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_messages;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- =============================================================================
-- 8. CRM ACTIVITIES (Audit log of all touchpoints)
-- =============================================================================
CREATE TABLE IF NOT EXISTS crm_activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  lead_id     uuid REFERENCES leads(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN (
                'note',
                'call',
                'email',
                'dm',
                'whatsapp',
                'bot_chat',
                'appointment',
                'stage_change',
                'lead_created',
                'score_updated',
                'follow_up',
                'message_sent'
              )),
  title       text NOT NULL,
  description text,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_activities_policy ON crm_activities;
CREATE POLICY crm_activities_policy ON crm_activities
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS idx_crm_activities_user ON crm_activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_lead ON crm_activities(lead_id, created_at DESC);

-- =============================================================================
-- 9. BRAND PROFILES (Onboarding, knowledge base & AI settings)
-- =============================================================================
CREATE TABLE IF NOT EXISTS brand_profiles (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    text NOT NULL UNIQUE,
  business_name              text NOT NULL,
  niche                      text NOT NULL,
  target_audience            text NOT NULL,
  brand_tone                 text NOT NULL DEFAULT 'Professional',
  main_offer                 text NOT NULL,
  competitors                text,
  products_services          text,
  pricing_details            text,
  knowledge_docs             text,
  location                   text,
  booking_url                text,
  auto_call_enabled          boolean DEFAULT false,
  auto_call_min_score        integer DEFAULT 7,
  whatsapp_phone_number_id   text,
  onboarding_completed       boolean NOT NULL DEFAULT false,
  created_at                 timestamptz DEFAULT now(),
  updated_at                 timestamptz DEFAULT now()
);

ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_profiles_policy ON brand_profiles;
CREATE POLICY brand_profiles_policy ON brand_profiles
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS idx_brand_profiles_user ON brand_profiles(user_id);

-- =============================================================================
-- 10. BRAND PRICING PACKAGES (Post-submit pricing display & CRM estimation)
-- =============================================================================
CREATE TABLE IF NOT EXISTS brand_pricing_packages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  name            text NOT NULL,
  price_display   text NOT NULL,
  price_amount    numeric,
  currency        text DEFAULT 'INR',
  billing_period  text,
  features        jsonb NOT NULL DEFAULT '[]',
  cta_label       text,
  is_featured     boolean DEFAULT false,
  display_order   integer DEFAULT 0,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE brand_pricing_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_pricing_packages_policy ON brand_pricing_packages;
CREATE POLICY brand_pricing_packages_policy ON brand_pricing_packages
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS idx_brand_pricing_packages ON brand_pricing_packages(user_id, display_order);

-- =============================================================================
-- 11. META CAMPAIGNS (Ad creative & audience management)
-- =============================================================================
CREATE TABLE IF NOT EXISTS meta_campaigns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             text NOT NULL,
  name                text NOT NULL,
  objective           text NOT NULL DEFAULT 'OUTCOME_LEADS',
  daily_budget        integer NOT NULL DEFAULT 1000,
  status              text NOT NULL DEFAULT 'DRAFT',
  ad_headline         text,
  ad_primary_text     text,
  ad_image_url        text,
  call_to_action      text NOT NULL DEFAULT 'LEARN_MORE',
  meta_ad_account_id  text,
  meta_campaign_id    text,
  meta_adset_id       text,
  meta_ad_id          text,
  meta_image_hash     text,
  meta_page_id        text,
  start_date          date,
  end_date            date,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE meta_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meta_campaigns_policy ON meta_campaigns;
CREATE POLICY meta_campaigns_policy ON meta_campaigns
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS idx_meta_campaigns_user ON meta_campaigns(user_id);

-- =============================================================================
-- 12. AI PROMPT MEMORY
-- =============================================================================
CREATE TABLE IF NOT EXISTS ai_memory (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          text NOT NULL,
  signal_type      text NOT NULL CHECK (signal_type IN ('positive', 'edited', 'deleted', 'explicit')),
  original_content text,
  final_content    text,
  feedback_text    text,
  learned_insight  text,
  context_niche    text,
  context_tone     text,
  post_id          text,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_memory_policy ON ai_memory;
CREATE POLICY ai_memory_policy ON ai_memory
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS idx_ai_memory_user_created ON ai_memory (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_memory_user_signal ON ai_memory (user_id, signal_type);

-- =============================================================================
-- 13. COMPETITOR RESEARCH & STUDIO DRAFTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS competitor_researches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  competitor_url  text,
  competitor_name text NOT NULL,
  industry        text NOT NULL,
  research_data   jsonb NOT NULL,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE competitor_researches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS competitor_researches_policy ON competitor_researches;
CREATE POLICY competitor_researches_policy ON competitor_researches
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS idx_competitor_researches_user ON competitor_researches(user_id);

CREATE TABLE IF NOT EXISTS studio_drafts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      text NOT NULL,
  type         text NOT NULL CHECK (type IN ('REEL', 'CAROUSEL', 'BLOG', 'AD_CREATIVE', 'STRATEGY')),
  title        text,
  content_data jsonb NOT NULL DEFAULT '{}',
  status       text DEFAULT 'draft' CHECK (status IN ('draft', 'saved', 'scheduled')),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE studio_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS studio_drafts_policy ON studio_drafts;
CREATE POLICY studio_drafts_policy ON studio_drafts
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS idx_studio_drafts_user_type ON studio_drafts(user_id, type, created_at DESC);

-- =============================================================================
-- 14. SOCIAL AUTOMATION & COMMENT BOT
-- =============================================================================
CREATE TABLE IF NOT EXISTS social_automation_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  rule_name       text NOT NULL,
  trigger_type    text NOT NULL CHECK (trigger_type IN ('KEYWORD', 'ANY_COMMENT', 'DM')),
  trigger_keyword text,
  platform        text NOT NULL CHECK (platform IN ('INSTAGRAM', 'FACEBOOK', 'ALL')),
  reply_template  text NOT NULL,
  send_dm         boolean DEFAULT false,
  dm_template     text,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE social_automation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_automation_rules_policy ON social_automation_rules;
CREATE POLICY social_automation_rules_policy ON social_automation_rules
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

CREATE TABLE IF NOT EXISTS social_comments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              text NOT NULL,
  post_id              uuid REFERENCES scheduled_posts(id) ON DELETE CASCADE,
  platform             text NOT NULL,
  platform_comment_id  text UNIQUE,
  commenter_handle     text,
  comment_text         text NOT NULL,
  sentiment            text CHECK (sentiment IN ('INQUIRY', 'PRAISE', 'COMPLAINT', 'SPAM', 'NEUTRAL')),
  reply_text           text,
  dm_sent              boolean DEFAULT false,
  status               text DEFAULT 'replied',
  created_at           timestamptz DEFAULT now()
);

ALTER TABLE social_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_comments_policy ON social_comments;
CREATE POLICY social_comments_policy ON social_comments
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

-- Durable comment reply idempotency table
CREATE TABLE IF NOT EXISTS replied_comments (
  comment_id   text PRIMARY KEY,
  user_id      text NOT NULL,
  replied_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_replied_comments_user ON replied_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_replied_comments_time ON replied_comments(replied_at);

-- Meta Ads Library cache
CREATE TABLE IF NOT EXISTS meta_ads_library_cache (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  niche       text NOT NULL,
  country     text DEFAULT 'IN',
  ads_data    jsonb NOT NULL DEFAULT '[]',
  fetched_at  timestamptz DEFAULT now()
);

ALTER TABLE meta_ads_library_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meta_ads_library_cache_policy ON meta_ads_library_cache;
CREATE POLICY meta_ads_library_cache_policy ON meta_ads_library_cache
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

-- Flywheel execution history telemetry
CREATE TABLE IF NOT EXISTS flywheel_executions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             text NOT NULL,
  niche               text NOT NULL,
  posts_scheduled     integer DEFAULT 0,
  ad_campaign_created boolean DEFAULT false,
  execution_summary   jsonb DEFAULT '{}',
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flywheel_executions_user ON flywheel_executions(user_id);

-- =============================================================================
-- 15. STORAGE BUCKET CREATION (Bucket 'lemon' for images & video reels)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('lemon', 'lemon', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public read access to the 'lemon' bucket
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'lemon');

-- Allow authenticated users to upload to 'lemon' bucket
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lemon');

-- Allow service role full management
DROP POLICY IF EXISTS "Service Role Manage" ON storage.objects;
CREATE POLICY "Service Role Manage" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'lemon')
  WITH CHECK (bucket_id = 'lemon');

-- =============================================================================
-- 16. COMMENT REPLY IDEMPOTENCY & PUBLISHING LOCK (Migration 11)
-- =============================================================================
CREATE TABLE IF NOT EXISTS replied_comments (
  comment_id   text        NOT NULL,
  user_id      text        NOT NULL,
  replied_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id)
);

CREATE INDEX IF NOT EXISTS idx_replied_comments_user_id
  ON replied_comments (user_id);

CREATE INDEX IF NOT EXISTS idx_replied_comments_replied_at
  ON replied_comments (replied_at);

ALTER TABLE scheduled_posts
  ADD COLUMN IF NOT EXISTS publishing_started_at timestamptz;

-- =============================================================================
-- 17. PRIVACY & AUDIT COMPLIANCE TABLES (Migration 12)
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT,
  actor_type     TEXT        NOT NULL
                 CHECK (actor_type IN ('user', 'system', 'admin', 'anonymous', 'webhook')),
  actor_user_id  TEXT,
  event          TEXT        NOT NULL,
  resource_type  TEXT,
  resource_id    TEXT,
  metadata       JSONB       DEFAULT '{}',
  ip_hash        TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_own ON audit_logs;
CREATE POLICY audit_logs_select_own ON audit_logs
  FOR SELECT USING (user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
  ON audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_created
  ON audit_logs (event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
  ON audit_logs (resource_type, resource_id);

CREATE TABLE IF NOT EXISTS consent_records (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT        NOT NULL,
  consent_type  TEXT        NOT NULL
                CHECK (consent_type IN (
                  'terms_of_service',
                  'privacy_policy',
                  'marketing_emails',
                  'analytics_cookies',
                  'ai_training',
                  'data_processing',
                  'third_party_sharing'
                )),
  granted       BOOLEAN     NOT NULL,
  version       TEXT        NOT NULL DEFAULT '1.0',
  ip_hash       TEXT,
  user_agent    TEXT,
  metadata      JSONB       DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consent_records_select_own ON consent_records;
CREATE POLICY consent_records_select_own ON consent_records
  FOR SELECT USING (user_id = requesting_user_id());

DROP POLICY IF EXISTS consent_records_insert_own ON consent_records;
CREATE POLICY consent_records_insert_own ON consent_records
  FOR INSERT WITH CHECK (user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS idx_consent_user_type_created
  ON consent_records (user_id, consent_type, created_at DESC);

CREATE TABLE IF NOT EXISTS dsr_requests (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            TEXT        NOT NULL,
  request_type       TEXT        NOT NULL
                     CHECK (request_type IN (
                       'access',
                       'deletion',
                       'portability',
                       'rectification',
                       'restriction',
                       'objection'
                     )),
  status             TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  fulfilled_at       TIMESTAMPTZ,
  rejection_reason   TEXT,
  metadata           JSONB       DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dsr_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dsr_requests_select_own ON dsr_requests;
CREATE POLICY dsr_requests_select_own ON dsr_requests
  FOR SELECT USING (user_id = requesting_user_id());

DROP POLICY IF EXISTS dsr_requests_insert_own ON dsr_requests;
CREATE POLICY dsr_requests_insert_own ON dsr_requests
  FOR INSERT WITH CHECK (user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS idx_dsr_user_created
  ON dsr_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dsr_status
  ON dsr_requests (status, created_at);

CREATE TABLE IF NOT EXISTS data_retention_policies (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name     TEXT        NOT NULL UNIQUE,
  timestamp_col  TEXT        NOT NULL DEFAULT 'created_at',
  retention_days INTEGER     NOT NULL CHECK (retention_days > 0),
  description    TEXT,
  active         BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_retention_active
  ON data_retention_policies (active, table_name);

INSERT INTO data_retention_policies (table_name, timestamp_col, retention_days, description)
VALUES
  ('audit_logs',          'created_at', 2190, 'Legal defense + regulator audit window (6 yrs).'),
  ('replied_comments',    'replied_at',   30, 'Comment reply dedup — safe to prune monthly.'),
  ('crm_messages',        'created_at',  730, 'Abandoned inbound conversations (2 yrs).'),
  ('social_comments',     'created_at',  365, 'Public comments log (1 yr).'),
  ('flywheel_executions', 'created_at',  365, 'Flywheel run history (1 yr).'),
  ('ai_memory',           'created_at',  730, 'AI conversational memory (2 yrs).'),
  ('dsr_requests',        'created_at', 2190, 'Regulatory evidence retention (6 yrs).')
ON CONFLICT (table_name) DO NOTHING;

-- =============================================================================
-- SETUP COMPLETE!
-- Your Supabase database is now 100% configured for LemonAI.
-- =============================================================================

