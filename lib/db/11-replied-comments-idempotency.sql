-- =============================================================================
-- Migration 11: Comment Reply Idempotency + Publishing Lock Column
-- Run this in your Supabase / Insforge SQL Editor before deploying to production.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. replied_comments — durable idempotency table for the comment-reply bot.
--
--    Replaces the previous in-memory Set/Map dedup that was per-instance and
--    completely ineffective on serverless runtimes. Using a DB primary key on
--    comment_id guarantees exactly-once reply delivery across all concurrent
--    serverless function instances.
-- ---------------------------------------------------------------------------
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

-- Auto-purge entries older than 30 days to keep the table lean.
-- Schedule this via a pg_cron job or a weekly Supabase Edge Function:
--   DELETE FROM replied_comments WHERE replied_at < now() - interval '30 days';

COMMENT ON TABLE replied_comments IS
  'Idempotency table: tracks comment IDs already replied to, preventing duplicate '
  'bot replies across concurrent serverless instances. PK on comment_id guarantees '
  'atomic exactly-once claim via INSERT ... ON CONFLICT.';

-- ---------------------------------------------------------------------------
-- 2. publishing_started_at — tracks when a post lock was acquired.
--
--    Used by the stuck-publishing recovery logic in process-due/route.ts to
--    only reset posts whose publishing attempt actually started > 3 min ago
--    AND which have no published_at timestamp. Prevents false recovery of
--    in-progress large-media uploads.
-- ---------------------------------------------------------------------------
ALTER TABLE scheduled_posts
  ADD COLUMN IF NOT EXISTS publishing_started_at timestamptz;

COMMENT ON COLUMN scheduled_posts.publishing_started_at IS
  'Timestamp when status was set to ''publishing''. Used by the stuck-publishing '
  'recovery guard: only posts where this is > 3 min ago AND published_at IS NULL '
  'are eligible for reset back to ''queue''.';
