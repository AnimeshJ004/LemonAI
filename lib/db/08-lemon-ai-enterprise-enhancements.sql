-- ============================================================
-- LEMON AI: ENTERPRISE ENHANCEMENTS MIGRATION
-- Adds Business Brain knowledge (products, pricing, location, booking URL)
-- and Autonomous Auto-Calling triggers.
-- ============================================================

-- 1. Extend brand_profiles table
ALTER TABLE brand_profiles
  ADD COLUMN IF NOT EXISTS products_services TEXT,
  ADD COLUMN IF NOT EXISTS pricing_details TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'India & Global',
  ADD COLUMN IF NOT EXISTS booking_url TEXT,
  ADD COLUMN IF NOT EXISTS auto_call_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_call_min_score INTEGER DEFAULT 7;

-- 2. Ensure competitor_researches table exists with index
CREATE TABLE IF NOT EXISTS competitor_researches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  niche TEXT NOT NULL,
  target_audience TEXT,
  country TEXT DEFAULT 'IN',
  competitor_urls TEXT[] DEFAULT '{}',
  research_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitor_researches_user_id ON competitor_researches(user_id);

-- 3. Flywheel execution history table (Optional telemetry)
CREATE TABLE IF NOT EXISTS flywheel_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  niche TEXT NOT NULL,
  posts_scheduled INTEGER DEFAULT 0,
  ad_campaign_created BOOLEAN DEFAULT false,
  execution_summary JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flywheel_executions_user_id ON flywheel_executions(user_id);
