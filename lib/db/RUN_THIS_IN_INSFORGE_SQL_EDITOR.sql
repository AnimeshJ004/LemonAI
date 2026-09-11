-- ==============================================================================
-- LEMON AI — CRM DATABASE MIGRATION FOR INSFORGE POSTGRESQL
-- Copy this entire file and run it inside your InsForge Dashboard SQL Editor:
-- https://rp57vqig.us-east.insforge.app -> Database / SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. LEADS TABLE (CRM Deals & Pipeline)
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  source TEXT DEFAULT 'organic',
  stage TEXT DEFAULT 'new',
  score INTEGER DEFAULT 5,
  deal_value NUMERIC DEFAULT 0,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_stage ON public.leads(user_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

-- 2. CRM CONVERSATIONS TABLE (Omnichannel Inbox)
CREATE TABLE IF NOT EXISTS public.crm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'instagram',
  status TEXT DEFAULT 'open',
  is_ai_active BOOLEAN DEFAULT true,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_conversations_user ON public.crm_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_conversations_lead ON public.crm_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_conversations_last_msg ON public.crm_conversations(last_message_at DESC);

-- 3. CRM MESSAGES TABLE (Real-time Chat Thread)
CREATE TABLE IF NOT EXISTS public.crm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.crm_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL DEFAULT 'lead',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_messages_conv ON public.crm_messages(conversation_id, created_at ASC);

-- 4. CRM ACTIVITIES TABLE (Audit Timeline & Touchpoints)
CREATE TABLE IF NOT EXISTS public.crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'lead_created',
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_user ON public.crm_activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_lead ON public.crm_activities(lead_id, created_at DESC);
