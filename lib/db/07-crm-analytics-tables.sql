-- ============================================================
-- LEMON AI — MEMBER 3: CRM PIPELINE, CONVERSATIONS, MESSAGES & ANALYTICS
-- ============================================================

-- 1. LEADS TABLE (CRM Pipeline)
CREATE TABLE IF NOT EXISTS leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  name        TEXT,
  email       TEXT,
  phone       TEXT,
  company     TEXT,
  source      TEXT DEFAULT 'manual'
              CHECK (source IN ('manual', 'organic', 'meta_ads', 'website', 'whatsapp', 'instagram_dm', 'facebook_dm', 'inbound_call')),
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

-- 2. CRM CONVERSATIONS TABLE (Unified Omnichannel Inbox)
CREATE TABLE IF NOT EXISTS crm_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL
                  CHECK (channel IN ('instagram', 'facebook', 'whatsapp', 'website', 'email', 'voice')),
  status          TEXT DEFAULT 'open'
                  CHECK (status IN ('open', 'ai_handling', 'human_takeover', 'resolved')),
  is_ai_active    BOOLEAN DEFAULT true,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE crm_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_conversations_policy ON crm_conversations;
CREATE POLICY crm_conversations_policy ON crm_conversations
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

-- 3. CRM MESSAGES TABLE (Realtime Chat History)
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

-- 4. INDEXES FOR HIGH-THROUGHPUT QUERIES
CREATE INDEX IF NOT EXISTS idx_leads_user_stage ON leads(user_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_user_score ON leads(user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_crm_conversations_user ON crm_conversations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_messages_conversation ON crm_messages(conversation_id, created_at ASC);
