-- ============================================================
-- SOCIAL AUTOMATION RULES TABLE
-- Stores user-configured comment/DM automation rules
-- ============================================================
CREATE TABLE IF NOT EXISTS social_automation_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  rule_name       TEXT NOT NULL,
  trigger_type    TEXT NOT NULL CHECK (trigger_type IN ('KEYWORD', 'ANY_COMMENT', 'DM')),
  trigger_keyword TEXT,
  platform        TEXT NOT NULL CHECK (platform IN ('INSTAGRAM', 'FACEBOOK', 'ALL')),
  reply_template  TEXT NOT NULL,
  send_dm         BOOLEAN DEFAULT false,
  dm_template     TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE social_automation_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_automation_rules_policy ON social_automation_rules;
CREATE POLICY social_automation_rules_policy ON social_automation_rules
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

-- ============================================================
-- SOCIAL COMMENTS AUTO-REPLY LOG TABLE
-- Logs every AI-replied comment
-- ============================================================
CREATE TABLE IF NOT EXISTS social_comments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              TEXT NOT NULL,
  post_id              UUID REFERENCES scheduled_posts(id) ON DELETE CASCADE,
  platform             TEXT NOT NULL,
  platform_comment_id  TEXT UNIQUE,
  commenter_handle     TEXT,
  comment_text         TEXT NOT NULL,
  sentiment            TEXT CHECK (sentiment IN ('INQUIRY', 'PRAISE', 'COMPLAINT', 'SPAM', 'NEUTRAL')),
  reply_text           TEXT,
  dm_sent              BOOLEAN DEFAULT false,
  status               TEXT DEFAULT 'replied',
  created_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE social_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_comments_policy ON social_comments;
CREATE POLICY social_comments_policy ON social_comments
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

-- ============================================================
-- META ADS LIBRARY CACHE TABLE
-- Caches trending competitor ads fetched from Meta Archive
-- ============================================================
CREATE TABLE IF NOT EXISTS meta_ads_library_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  niche       TEXT NOT NULL,
  country     TEXT DEFAULT 'IN',
  ads_data    JSONB NOT NULL DEFAULT '[]',
  fetched_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meta_ads_library_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meta_ads_library_cache_policy ON meta_ads_library_cache;
CREATE POLICY meta_ads_library_cache_policy ON meta_ads_library_cache
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());
