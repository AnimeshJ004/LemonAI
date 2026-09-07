CREATE TABLE IF NOT EXISTS ai_memory (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          text        NOT NULL,
  signal_type      text        NOT NULL,
  original_content text,
  final_content    text,
  feedback_text    text,
  learned_insight  text,
  context_niche    text,
  context_tone     text,
  post_id          text,
  created_at       timestamptz DEFAULT now(),
  CONSTRAINT ai_memory_signal_type_check CHECK (
    signal_type IN ('positive', 'edited', 'deleted', 'explicit')
  )
);

ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_memory_policy ON ai_memory;

CREATE POLICY ai_memory_policy ON ai_memory
  FOR ALL
  USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS idx_ai_memory_user_created
  ON ai_memory (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_memory_user_signal
  ON ai_memory (user_id, signal_type);
