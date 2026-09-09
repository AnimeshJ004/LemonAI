-- ============================================================
-- LEMON AI — CRM ACTIVITIES TABLE
-- Full audit trail for every lead touchpoint:
-- voice calls, DMs, stage changes, WhatsApp messages,
-- chatbot conversations, and manual notes.
-- Run this migration in your InsForge SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  lead_id     UUID REFERENCES leads(id) ON DELETE CASCADE,
  type        TEXT NOT NULL
              CHECK (type IN (
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
                'follow_up'
              )),
  title       TEXT NOT NULL,
  description TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_activities_policy ON crm_activities;
CREATE POLICY crm_activities_policy ON crm_activities
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

-- Efficient indexes for timeline queries
CREATE INDEX IF NOT EXISTS idx_crm_activities_user      ON crm_activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_lead      ON crm_activities(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_type      ON crm_activities(user_id, type);
