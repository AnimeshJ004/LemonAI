-- ============================================================
-- LEMON AI — MEMBER 3: CRM PIPELINE, CONVERSATIONS & MESSAGES
-- ============================================================

-- 1. LEADS & PIPELINE TABLE
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  source TEXT DEFAULT 'organic', -- organic, meta_ads, website, whatsapp, inbound_call
  stage TEXT DEFAULT 'new',       -- new, contacted, qualified, booked, proposal, closed_won, closed_lost
  score INTEGER DEFAULT 0,       -- 0 to 10
  deal_value NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}',   -- bant breakdown, call logs, notes, company info
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
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

-- 2. CRM CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS crm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- website, whatsapp, instagram, facebook, voice
  status TEXT DEFAULT 'open', -- open, resolved, snoozed
  is_ai_active BOOLEAN DEFAULT true, -- toggles human handover
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE crm_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_conversations_user_policy ON crm_conversations;
CREATE POLICY crm_conversations_user_policy ON crm_conversations
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS idx_crm_conv_user_channel ON crm_conversations (user_id, channel);
CREATE INDEX IF NOT EXISTS idx_crm_conv_lead ON crm_conversations (lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_conv_last_msg ON crm_conversations (user_id, last_message_at DESC);

-- 3. CRM MESSAGES TABLE (REALTIME ENABLED)
CREATE TABLE IF NOT EXISTS crm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES crm_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('lead', 'ai_assistant', 'human_agent')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
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

-- Enable Supabase Realtime for instant chat
ALTER PUBLICATION supabase_realtime ADD TABLE crm_messages;
