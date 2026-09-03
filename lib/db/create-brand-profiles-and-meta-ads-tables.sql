-- ============================================================
-- BRAND PROFILES TABLE
-- Stores the user's business brand details for AI content generation and Meta Ads targeting
-- ============================================================

CREATE TABLE IF NOT EXISTS brand_profiles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          text NOT NULL,
  business_name    text NOT NULL,
  niche            text NOT NULL,
  target_audience  text NOT NULL,
  brand_tone       text NOT NULL DEFAULT 'Professional',
  main_offer       text NOT NULL,
  competitors      text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),

  UNIQUE (user_id)
);

ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_profiles_policy ON brand_profiles;
CREATE POLICY brand_profiles_policy ON brand_profiles
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK  (user_id = requesting_user_id());

-- ============================================================
-- META CAMPAIGNS TABLE
-- Stores every campaign generated and pushed to Meta Ads Manager
-- ============================================================

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
  WITH CHECK  (user_id = requesting_user_id());
