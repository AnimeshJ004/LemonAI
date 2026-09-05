-- ============================================================
-- AI PROMPT MEMORY TABLE
-- Stores user feedback signals so the AI can learn and personalize
-- future content generation (post edits, likes, dislikes, explicit feedback)
-- Zero extra API cost — feedback is injected into existing Gemini prompts
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_memory (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           text        NOT NULL,
  signal_type       text        NOT NULL
                    CHECK (signal_type IN ('positive', 'edited', 'deleted', 'explicit')),
  original_content  text,       -- What AI originally generated
  final_content     text,       -- What user kept / edited it to
  feedback_text     text,       -- Optional written feedback ("too formal", "shorter")
  learned_insight   text,       -- 1-line AI-summarized learning (auto-generated)
  context_niche     text,       -- Brand niche at time of feedback
  context_tone      text,       -- Brand tone at time of feedback
  post_id           text,       -- Reference to the scheduled_posts ID (optional)
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_memory_policy ON ai_memory;
CREATE POLICY ai_memory_policy ON ai_memory
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK  (user_id = requesting_user_id());

-- Fast lookup index for recent memories per user
CREATE INDEX IF NOT EXISTS idx_ai_memory_user_created
  ON ai_memory (user_id, created_at DESC);

-- Index for signal type filtering
CREATE INDEX IF NOT EXISTS idx_ai_memory_user_signal
  ON ai_memory (user_id, signal_type);
