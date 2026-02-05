-- ============================================
-- CONVERSATION MEMORY SCHEMA FOR SUPABASE
-- Optimized for Free Tier (500MB database)
-- ============================================

-- ============================================
-- 1. CONVERSATIONS TABLE
-- Stores conversation metadata
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated 
  ON conversations(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_agent 
  ON conversations(agent_id, updated_at DESC);

-- Note: Partial index removed due to NOW() not being immutable
-- The above indexes are sufficient for query performance

-- ============================================
-- 2. CONVERSATION MESSAGES TABLE
-- Stores only recent messages (auto-pruned)
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'function')),
  content TEXT NOT NULL,
  tool_calls JSONB,  -- NULL when not present (saves space)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fetching conversation messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation 
  ON conversation_messages(conversation_id, created_at ASC);

-- ============================================
-- 3. AUTO-CLEANUP FUNCTIONS & TRIGGERS
-- ============================================

-- Function: Cleanup old messages (keep last 30)
CREATE OR REPLACE FUNCTION cleanup_old_messages()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all but the most recent 30 messages
  DELETE FROM conversation_messages
  WHERE conversation_id = NEW.conversation_id
  AND id NOT IN (
    SELECT id 
    FROM conversation_messages
    WHERE conversation_id = NEW.conversation_id
    ORDER BY created_at DESC
    LIMIT 30
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Run cleanup after each message insert
DROP TRIGGER IF EXISTS trigger_cleanup_messages ON conversation_messages;
CREATE TRIGGER trigger_cleanup_messages
AFTER INSERT ON conversation_messages
FOR EACH ROW
EXECUTE FUNCTION cleanup_old_messages();

-- Function: Update message count and updated_at
CREATE OR REPLACE FUNCTION update_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    message_count = (
      SELECT COUNT(*) 
      FROM conversation_messages 
      WHERE conversation_id = NEW.conversation_id
    ),
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update message count after insert
DROP TRIGGER IF EXISTS trigger_update_message_count ON conversation_messages;
CREATE TRIGGER trigger_update_message_count
AFTER INSERT ON conversation_messages
FOR EACH ROW
EXECUTE FUNCTION update_message_count();

-- Function: Smart cleanup (handles stale conversations probabilistically)
CREATE OR REPLACE FUNCTION smart_cleanup()
RETURNS TRIGGER AS $$
BEGIN
  -- Probabilistic stale conversation cleanup (1% chance)
  -- This means cleanup runs ~once per 100 messages
  IF random() < 0.01 THEN
    -- Delete max 10 stale conversations at a time (fast, no timeout)
    DELETE FROM conversations
    WHERE id IN (
      SELECT id 
      FROM conversations
      WHERE updated_at < NOW() - INTERVAL '30 days'
      ORDER BY updated_at ASC
      LIMIT 10
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Smart cleanup after message insert
DROP TRIGGER IF EXISTS trigger_smart_cleanup ON conversation_messages;
CREATE TRIGGER trigger_smart_cleanup
AFTER INSERT ON conversation_messages
FOR EACH ROW
EXECUTE FUNCTION smart_cleanup();

-- ============================================
-- 4. MANUAL CLEANUP FUNCTIONS (For API/Admin)
-- ============================================

-- Function: Delete stale conversations (30+ days old)
CREATE OR REPLACE FUNCTION delete_stale_conversations(max_delete INTEGER DEFAULT 100)
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
  del_count INTEGER;
BEGIN
  DELETE FROM conversations
  WHERE id IN (
    SELECT id 
    FROM conversations
    WHERE updated_at < NOW() - INTERVAL '30 days'
    ORDER BY updated_at ASC
    LIMIT max_delete
  );
  
  GET DIAGNOSTICS del_count = ROW_COUNT;
  RETURN QUERY SELECT del_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get database statistics
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS TABLE(
  total_conversations BIGINT,
  total_messages BIGINT,
  avg_messages_per_conversation NUMERIC,
  active_conversations_7d BIGINT,
  oldest_conversation_days INTEGER,
  database_size_mb NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT c.id)::BIGINT as total_conversations,
    COUNT(m.id)::BIGINT as total_messages,
    COALESCE(ROUND(AVG(COALESCE((
      SELECT COUNT(*) FROM conversation_messages 
      WHERE conversation_id = c.id
    ), 0)), 2), 0) as avg_messages_per_conversation,
    COUNT(DISTINCT c.id) FILTER (WHERE c.updated_at > NOW() - INTERVAL '7 days')::BIGINT as active_conversations_7d,
    COALESCE(EXTRACT(DAY FROM NOW() - MIN(c.updated_at))::INTEGER, 0) as oldest_conversation_days,
    ROUND(pg_database_size(current_database())::NUMERIC / (1024*1024), 2) as database_size_mb
  FROM conversations c
  LEFT JOIN conversation_messages m ON c.id = m.conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view messages from own conversations" ON conversation_messages;
DROP POLICY IF EXISTS "Users can create messages in own conversations" ON conversation_messages;

-- Conversations policies
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create own conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- Messages policies
CREATE POLICY "Users can view messages from own conversations"
  ON conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
      AND conversations.user_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Users can create messages in own conversations"
  ON conversation_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
      AND conversations.user_id::text = auth.uid()::text
    )
  );

-- ============================================
-- 6. OPTIONAL: SCHEDULED CLEANUP WITH pg_cron
-- (Only if you want scheduled cleanup in addition to triggers)
-- ============================================

-- Enable pg_cron extension
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 2 AM UTC
-- SELECT cron.schedule(
--   'daily-cleanup-stale-conversations',
--   '0 2 * * *',
--   $$SELECT delete_stale_conversations(100);$$
-- );

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule:
-- SELECT cron.unschedule('daily-cleanup-stale-conversations');

-- ============================================
-- 7. UTILITY QUERIES (For Monitoring)
-- ============================================

-- Check total database size
-- SELECT pg_size_pretty(pg_database_size(current_database())) as total_size;

-- Check table sizes
-- SELECT 
--   schemaname,
--   tablename,
--   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
-- FROM pg_tables
-- WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Get conversation statistics
-- SELECT * FROM get_database_stats();

-- Check for stale conversations
-- SELECT id, title, updated_at, 
--        NOW() - updated_at as age
-- FROM conversations
-- WHERE updated_at < NOW() - INTERVAL '30 days'
-- ORDER BY updated_at ASC
-- LIMIT 10;

-- ============================================
-- SCHEMA CREATION COMPLETE
-- ============================================

-- Run get_database_stats() to verify setup
SELECT * FROM get_database_stats();
