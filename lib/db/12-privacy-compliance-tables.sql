-- =============================================================================
-- Migration 12: Data Privacy & Compliance Tables
--
-- Adds the four foundational tables that raise Lemon AI to enterprise-grade
-- GDPR (EU) + DPDP Act 2023 (India) + CCPA (California) compliance:
--
--   1. audit_logs            — immutable audit trail of privacy-sensitive events
--   2. consent_records       — user consent history (grant, revoke, versioning)
--   3. dsr_requests          — Data Subject Requests (access, deletion, portability)
--   4. data_retention_policies — declarative retention rules enforced by cron
--
-- Run this file in your Supabase / Insforge SQL editor BEFORE deploying the
-- new privacy modules. All statements are idempotent (IF NOT EXISTS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. audit_logs — append-only trail of security & privacy events.
--
-- Written by lib/audit-log.ts on: login, signup, account deletion, data export,
-- consent grant/revoke, channel connect/disconnect, cache clears, admin actions.
--
-- ip_address is stored as a SHA-256 hash prefix (16 chars) — never the raw IP —
-- so the trail is useful for security forensics without being additional PII.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT,                       -- subject of the event (nullable for anonymous)
  actor_type     TEXT        NOT NULL
                 CHECK (actor_type IN ('user', 'system', 'admin', 'anonymous', 'webhook')),
  actor_user_id  TEXT,                       -- performer of the event (usually = user_id)
  event          TEXT        NOT NULL,       -- see AUDIT_EVENT enum in lib/audit-log.ts
  resource_type  TEXT,                       -- e.g. 'user_channel', 'lead', 'scheduled_post'
  resource_id    TEXT,
  metadata       JSONB       DEFAULT '{}',   -- redacted extra context (no raw PII)
  ip_hash        TEXT,                       -- SHA-256 first 16 chars, never raw IP
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_own ON audit_logs;
CREATE POLICY audit_logs_select_own ON audit_logs
  FOR SELECT USING (user_id = requesting_user_id());

-- No user-facing INSERT/UPDATE/DELETE: writes are performed exclusively by the
-- service-role backend (lib/audit-log.ts). This preserves audit integrity —
-- a user cannot tamper with, insert, or erase their own audit trail from the
-- client. The service-role key bypasses RLS.

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
  ON audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_created
  ON audit_logs (event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
  ON audit_logs (resource_type, resource_id);

COMMENT ON TABLE audit_logs IS
  'Append-only audit trail for GDPR Art. 5(2) accountability and DPDP Sec. 8 '
  'record-keeping. Only the service-role backend writes; users may read only '
  'their own entries. Retained for 6 years by default (see data_retention_policies).';

-- -----------------------------------------------------------------------------
-- 2. consent_records — GDPR Art. 7 & DPDP Sec. 6 explicit consent history.
--
-- One row per (user, consent_type, granted_at). Never mutated — a revocation is
-- a new row with granted=false. This gives a full history that can be
-- reconstructed for compliance audits.
-- -----------------------------------------------------------------------------
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

COMMENT ON TABLE consent_records IS
  'Immutable history of user consent grants and revocations. To find the '
  'current effective consent for a (user, type), select the most recent row '
  'ORDER BY created_at DESC LIMIT 1.';

-- -----------------------------------------------------------------------------
-- 3. dsr_requests — Data Subject Requests under GDPR Arts. 15–22, DPDP Sec. 11–14.
--
-- Records every access / deletion / portability / rectification request so we
-- can prove regulatory response times (30 days GDPR, "reasonable time" DPDP).
-- -----------------------------------------------------------------------------
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

COMMENT ON TABLE dsr_requests IS
  'Data Subject Requests. GDPR Art. 12(3) requires fulfilment within 30 days; '
  'we track status transitions and fulfilment timestamps here.';

-- -----------------------------------------------------------------------------
-- 4. data_retention_policies — declarative retention rules.
--
-- The daily cron in inngest/functions/data-retention-cron.ts reads this table
-- and issues DELETE statements per active policy. Admin-only writes.
-- -----------------------------------------------------------------------------
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

-- No user-facing policies — this table is service-role-only.
-- (Absence of a permissive policy denies all authenticated access under RLS.)

CREATE INDEX IF NOT EXISTS idx_retention_active
  ON data_retention_policies (active, table_name);

COMMENT ON TABLE data_retention_policies IS
  'Declarative data retention rules. Enforced daily by the '
  'data-retention-cron Inngest job. Toggle active=false to pause a rule.';

-- -----------------------------------------------------------------------------
-- Seed default retention policies (idempotent).
--
-- These defaults reflect Lemon AI''s current data classes:
--   • audit_logs             → 2190 days (6 yrs)  — legal defense window
--   • replied_comments       →   30 days          — pure dedup, safe to prune
--   • crm_messages           →  730 days (2 yrs)  — abandoned inbound leads
--   • social_comments        →  365 days (1 yr)
--   • flywheel_executions    →  365 days
--   • ai_memory              →  730 days
--   • dsr_requests           → 2190 days          — regulatory evidence
--
-- To enable retention enforcement in production set DATA_RETENTION_ENABLED=true.
-- -----------------------------------------------------------------------------
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
-- End Migration 12 — Data Privacy & Compliance
-- =============================================================================
